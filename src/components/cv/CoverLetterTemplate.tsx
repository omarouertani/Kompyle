import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CoverLetterData, CoverLetterTemplateId, CVTheme, PersonalInfo } from "@/types/cv";
import { resolvePdfFontFamily } from "@/utils/pdf-fonts";
import { stripHtml, normalizeSpaces } from "@/utils/strip-html";

/** Styles matching the CV theme: same font family (registered on demand,
 *  idempotent), text colour, page background and accent colour for the
 *  sender name, the rule under the header and the subject. Bold works for
 *  every family, including the standard Times-Roman / Courier (react-pdf
 *  maps fontWeight to Times-Bold / Courier-Bold). Without a theme the letter
 *  keeps its former look (Carlito, black text).
 *
 *  Two variants:
 *   - "classic": sender block on the left, thin accent rule underneath.
 *   - "modern": full-width accent header band with the sender in white. */
function makeStyles(theme: CVTheme | undefined, variant: CoverLetterTemplateId) {
  const fontFamily = resolvePdfFontFamily(theme?.fontFamily);
  const textColor = theme?.textColor || "#000000";
  const accentColor = theme?.primaryColor || textColor;
  const modern = variant === "modern";
  return StyleSheet.create({
    page: {
      paddingTop: modern ? 0 : 40,
      paddingBottom: 40,
      paddingLeft: modern ? 0 : 50,
      paddingRight: modern ? 0 : 50,
      fontFamily,
      fontSize: 11,
      lineHeight: 1.5,
      color: textColor,
      ...(theme?.pageBg ? { backgroundColor: theme.pageBg } : {}),
    },
    /** Content wrapper: the modern header is full-bleed, the body keeps margins. */
    body: modern ? { paddingLeft: 50, paddingRight: 50 } : {},

    /* ---------- Header / Sender ---------- */
    senderBlock: modern
      ? {
          backgroundColor: accentColor,
          paddingTop: 32,
          paddingBottom: 22,
          paddingLeft: 50,
          paddingRight: 50,
          marginBottom: 30,
        }
      : {
          marginBottom: 30,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: accentColor,
        },
    senderName: {
      fontSize: modern ? 22 : 18,
      fontWeight: "bold",
      color: modern ? "#ffffff" : accentColor,
      marginBottom: 4,
    },
    senderContact: {
      fontSize: 10,
      color: modern ? "#ffffff" : theme?.textColor || "#444444",
      marginBottom: 2,
    },
    senderLink: {
      fontSize: 10,
      color: modern ? "#ffffff" : theme?.textColor || "#444444",
      textDecoration: "none",
    },

    /* ---------- Recipient & Date ---------- */
    recipientDateBlock: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 30,
    },
    recipientBlock: {
      flex: 1,
    },
    recipientText: {
      fontSize: 11,
      marginBottom: 2,
    },
    recipientName: {
      fontWeight: "bold",
    },
    dateBlock: {
      flex: 1,
      alignItems: "flex-end",
    },

    /* ---------- Subject ---------- */
    subjectBlock: {
      marginBottom: 20,
    },
    subjectText: {
      fontWeight: "bold",
      fontSize: 11,
      color: accentColor,
    },

    /* ---------- Body ---------- */
    salutation: {
      marginBottom: 15,
    },
    paragraph: {
      marginBottom: 15,
      textAlign: "justify",
    },

    /* ---------- Sign-off ---------- */
    signOffBlock: {
      marginTop: 20,
    },
    signOff: {
      marginBottom: 30,
    },
    signOffWithImage: {
      marginBottom: 6,
    },
    signatureImage: {
      width: 140,
      maxHeight: 60,
      objectFit: "contain",
      marginBottom: 6,
    },
    signatureName: {
      fontWeight: "bold",
    },
  });
}

/** Translated strings (react-pdf templates cannot call hooks, so the preview
 *  resolves them and passes them in). */
export interface CoverLetterLabels {
  /** "Objet :" / "Subject:" */
  subjectPrefix: string;
  /** PDF document title prefix: "Lettre de motivation" / "Cover letter" */
  documentTitle: string;
  /** UI locale ("fr", "en") — formats the default date and tags the PDF language. */
  locale?: string;
}

interface CoverLetterTemplateProps {
  data: CoverLetterData;
  personalInfo: PersonalInfo;
  labels: CoverLetterLabels;
  /** Theme of the current CV, so the letter matches it. */
  theme?: CVTheme;
}

/** Remplace les placeholders de nom laissés par l'IA ("[Votre nom]",
 *  "[Your Name]"…) par le vrai nom issu du CV. */
const fillNamePlaceholders = (text: string, name: string): string =>
  name ? text.replace(/\[\s*(votre\s+nom|your\s+name|nom\s+pr[ée]nom|pr[ée]nom\s+nom|name|nom)\s*\]/gi, name) : text;

/** Today's date in the letter's language ("10 novembre 2026", "November 10, 2026"). */
export function defaultLetterDate(locale = "fr", now = new Date()): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(now);
  } catch {
    return now.toLocaleDateString();
  }
}

/** URL shown without protocol / "www." / trailing slash (linkedin.com/in/x). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/** Absolute link target for a profile URL typed without protocol. */
function linkHref(url: string): string | undefined {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[^\s]+\.[^\s]+$/.test(url)) return `https://${url}`;
  return undefined;
}

/** Only embed data URLs that react-pdf can decode (PNG / JPEG). */
const isEmbeddableImage = (src?: string): src is string =>
  !!src && /^data:image\/(png|jpe?g);base64,/i.test(src);

/** Copie de la lettre dont chaque texte est sans espace insécable. */
function normalizeLetter(d: CoverLetterData): CoverLetterData {
  const n = (s: string | undefined) => (s ? normalizeSpaces(s) : s ?? "");
  return {
    ...d,
    recipientName: n(d.recipientName),
    recipientCompany: n(d.recipientCompany),
    recipientAddress: n(d.recipientAddress),
    date: n(d.date),
    subject: n(d.subject),
    salutation: n(d.salutation),
    paragraphs: (d.paragraphs ?? []).map((p) => n(p)),
    signOff: n(d.signOff),
  };
}

const CoverLetterTemplate: React.FC<CoverLetterTemplateProps> = ({ data: rawData, personalInfo, labels, theme }) => {
  // Les champs de la lettre vont au <Text> brut de react-pdf : on retire
  // l’espace insécable (U+00A0), qui fait planter le rendu PDF.
  const data = normalizeLetter(rawData);
  const variant: CoverLetterTemplateId = data.template === "modern" ? "modern" : "classic";
  const styles = makeStyles(theme, variant);
  // Les champs du CV peuvent porter du HTML inline (mise en forme appliquée sur
  // le canvas). Ce template utilise le <Text> brut de react-pdf (pas la primitive
  // qui parse le HTML) : on nettoie donc ici, sinon la lettre afficherait des
  // balises littérales (<b>…</b>) pour le nom/rôle/contact.
  const senderName = stripHtml(personalInfo.name).trim();
  const senderRole = stripHtml(personalInfo.role).trim();
  const senderEmail = stripHtml(personalInfo.email).trim();
  const senderPhone = stripHtml(personalInfo.phone).trim();
  const senderLocation = stripHtml(personalInfo.location).trim();
  const profileLinks = [stripHtml(personalInfo.linkedin ?? "").trim(), stripHtml(personalInfo.portfolio ?? "").trim()]
    .filter(Boolean);
  // Separator only between two present values (no orphan "•").
  const senderContact = [senderEmail, senderPhone].filter(Boolean).join(" • ");
  const letterDate = data.date?.trim() || defaultLetterDate(labels.locale);
  const signature = isEmbeddableImage(data.signature) ? data.signature : undefined;

  return (
    <Document
      title={senderName ? `${labels.documentTitle} - ${senderName}` : labels.documentTitle}
      author={senderName}
      subject={data.subject || undefined}
      creator="Kompyle"
      producer="Kompyle"
      language={labels.locale}
    >
      <Page size="A4" style={styles.page}>

        {/* SENDER INFO */}
        <View style={styles.senderBlock}>
          <Text style={styles.senderName}>{senderName}</Text>
          {senderRole && <Text style={styles.senderContact}>{senderRole}</Text>}
          {senderContact && <Text style={styles.senderContact}>{senderContact}</Text>}
          {senderLocation && <Text style={styles.senderContact}>{senderLocation}</Text>}
          {profileLinks.length > 0 && (
            <Text style={styles.senderContact}>
              {profileLinks.map((url, i) => {
                const href = linkHref(url);
                return (
                  <React.Fragment key={url}>
                    {i > 0 && " • "}
                    {href ? <Link src={href} style={styles.senderLink}>{displayUrl(url)}</Link> : displayUrl(url)}
                  </React.Fragment>
                );
              })}
            </Text>
          )}
        </View>

        <View style={styles.body}>
          {/* RECIPIENT & DATE */}
          <View style={styles.recipientDateBlock}>
            <View style={styles.recipientBlock}>
              {data.recipientName && (
                <Text style={[styles.recipientText, styles.recipientName]}>
                  {data.recipientName}
                </Text>
              )}
              {data.recipientCompany && (
                <Text style={[styles.recipientText, styles.recipientName]}>
                  {data.recipientCompany}
                </Text>
              )}
              {data.recipientAddress && (
                <Text style={styles.recipientText}>{data.recipientAddress}</Text>
              )}
            </View>
            <View style={styles.dateBlock}>
              <Text style={styles.recipientText}>{letterDate}</Text>
            </View>
          </View>

          {/* SUBJECT */}
          <View style={styles.subjectBlock}>
            <Text style={styles.subjectText}>{labels.subjectPrefix} {data.subject}</Text>
          </View>

          {/* SALUTATION */}
          <Text style={styles.salutation}>{data.salutation}</Text>

          {/* BODY PARAGRAPHS */}
          {data.paragraphs.map((para, i) => (
            <Text key={i} style={styles.paragraph}>
              {fillNamePlaceholders(para, senderName)}
            </Text>
          ))}

          {/* SIGN OFF */}
          <View style={styles.signOffBlock} wrap={false}>
            <Text style={signature ? styles.signOffWithImage : styles.signOff}>
              {fillNamePlaceholders(data.signOff, senderName)}
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {signature && <Image src={signature} style={styles.signatureImage} />}
            <Text style={styles.signatureName}>{senderName}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};

export default CoverLetterTemplate;
