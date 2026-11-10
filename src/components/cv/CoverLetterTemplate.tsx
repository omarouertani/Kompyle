import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CoverLetterData, PersonalInfo } from "@/types/cv";
import { registerPdfFont, ACTIVE_PDF_FONT } from "@/utils/pdf-fonts";
import { stripHtml } from "@/utils/strip-html";

// Enregistre la police active (idempotent) et l'utilise pour toute la lettre.
// (Avant, ce template comptait sur une police enregistrée par CVTemplate,
// d'où une erreur « Font not registered » quand elle manquait.)
const FONT_FAMILY = registerPdfFont(ACTIVE_PDF_FONT);

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 50,
    paddingRight: 50,
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#000000",
  },
  
  /* ---------- Header / Sender ---------- */
  senderBlock: {
    marginBottom: 30,
  },
  senderName: {
    fontSize: 18,
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    marginBottom: 4,
  },
  senderContact: {
    fontSize: 10,
    color: "#444444",
    marginBottom: 2,
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
    fontFamily: FONT_FAMILY,
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
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: 11,
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
  signatureName: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
  },
});

/** Translated strings (react-pdf templates cannot call hooks, so the preview
 *  resolves them and passes them in). */
export interface CoverLetterLabels {
  /** "Objet :" / "Subject:" */
  subjectPrefix: string;
  /** PDF document title prefix: "Lettre de motivation" / "Cover letter" */
  documentTitle: string;
}

interface CoverLetterTemplateProps {
  data: CoverLetterData;
  personalInfo: PersonalInfo;
  labels: CoverLetterLabels;
}

/** Remplace les placeholders de nom laissés par l'IA ("[Votre nom]",
 *  "[Your Name]"…) par le vrai nom issu du CV. */
const fillNamePlaceholders = (text: string, name: string): string =>
  name ? text.replace(/\[\s*(votre\s+nom|your\s+name|nom\s+pr[ée]nom|pr[ée]nom\s+nom|name|nom)\s*\]/gi, name) : text;

const CoverLetterTemplate: React.FC<CoverLetterTemplateProps> = ({ data, personalInfo, labels }) => {
  // Les champs du CV peuvent porter du HTML inline (mise en forme appliquée sur
  // le canvas). Ce template utilise le <Text> brut de react-pdf (pas la primitive
  // qui parse le HTML) : on nettoie donc ici, sinon la lettre afficherait des
  // balises littérales (<b>…</b>) pour le nom/rôle/contact.
  const senderName = stripHtml(personalInfo.name).trim();
  const senderRole = stripHtml(personalInfo.role).trim();
  const senderEmail = stripHtml(personalInfo.email).trim();
  const senderPhone = stripHtml(personalInfo.phone).trim();
  const senderLocation = stripHtml(personalInfo.location).trim();
  // Separator only between two present values (no orphan "•").
  const senderContact = [senderEmail, senderPhone].filter(Boolean).join(" • ");
  return (
    <Document
      title={senderName ? `${labels.documentTitle} - ${senderName}` : labels.documentTitle}
      author={senderName}
    >
      <Page size="A4" style={styles.page}>

        {/* SENDER INFO (Top Left) */}
        <View style={styles.senderBlock}>
          <Text style={styles.senderName}>{senderName}</Text>
          {senderRole && <Text style={styles.senderContact}>{senderRole}</Text>}
          {senderContact && <Text style={styles.senderContact}>{senderContact}</Text>}
          {senderLocation && <Text style={styles.senderContact}>{senderLocation}</Text>}
        </View>

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
            <Text style={styles.recipientText}>{data.date}</Text>
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
        <View style={styles.signOffBlock}>
          <Text style={styles.signOff}>{fillNamePlaceholders(data.signOff, senderName)}</Text>
          <Text style={styles.signatureName}>{senderName}</Text>
        </View>

      </Page>
    </Document>
  );
};

export default CoverLetterTemplate;
