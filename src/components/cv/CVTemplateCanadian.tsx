import React from "react";
import CVTemplate from "./CVTemplate";
import type { CVData } from "@/types/cv";

interface CVTemplateCanadianProps {
  data: CVData;
  originalData?: CVData;
}

/**
 * CV au format canadien (nord-américain) : sobre, sans photo, accent anthracite,
 * mise en page épurée. Réutilise le moteur du template classique via la
 * variante "canadian" (zéro duplication de logique de rendu/pagination).
 */
const CVTemplateCanadian: React.FC<CVTemplateCanadianProps> = ({ data, originalData }) => (
  <CVTemplate data={data} originalData={originalData} variant="canadian" />
);

export default CVTemplateCanadian;
