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

// Enregistre la police active (idempotent) et l'utilise pour toute la lettre.
// (Avant, ce template comptait sur l'enregistrement Calibri de CVTemplate —
// retiré en Étape 2 — d'où l'erreur « Font not registered: Calibri ».)
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

interface CoverLetterTemplateProps {
  data: CoverLetterData;
  personalInfo: PersonalInfo;
}

const CoverLetterTemplate: React.FC<CoverLetterTemplateProps> = ({ data, personalInfo }) => {
  return (
    <Document
      title={`Lettre de Motivation - ${personalInfo.name}`}
      author={personalInfo.name}
    >
      <Page size="A4" style={styles.page}>
        
        {/* SENDER INFO (Top Left) */}
        <View style={styles.senderBlock}>
          <Text style={styles.senderName}>{personalInfo.name}</Text>
          <Text style={styles.senderContact}>{personalInfo.role}</Text>
          <Text style={styles.senderContact}>{personalInfo.email} • {personalInfo.phone}</Text>
          <Text style={styles.senderContact}>{personalInfo.location}</Text>
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
          <Text style={styles.subjectText}>Objet : {data.subject}</Text>
        </View>

        {/* SALUTATION */}
        <Text style={styles.salutation}>{data.salutation}</Text>

        {/* BODY PARAGRAPHS */}
        {data.paragraphs.map((para, i) => (
          <Text key={i} style={styles.paragraph}>
            {para}
          </Text>
        ))}

        {/* SIGN OFF */}
        <View style={styles.signOffBlock}>
          <Text style={styles.signOff}>{data.signOff}</Text>
          <Text style={styles.signatureName}>{personalInfo.name}</Text>
        </View>

      </Page>
    </Document>
  );
};

export default CoverLetterTemplate;
