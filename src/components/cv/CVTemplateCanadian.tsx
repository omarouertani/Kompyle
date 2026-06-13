import React from "react";
import CVTemplate from "./CVTemplate";
import type { CVData } from "@/types/cv";

interface CVTemplateCanadianProps {
  data: CVData;
  originalData?: CVData;
}

/**
 * CV au format canadien (nord-américain) : sobre, monochrome, sans photo et
 * sans information personnelle (âge, date de naissance, statut…). Mise en page
 * sur UNE seule colonne pleine largeur, optimisée pour les ATS, avec un en-tête
 * minimaliste (nom + titre + ligne de coordonnées : téléphone · email ·
 * LinkedIn · ville/province) et l'ordre Résumé → Compétences → Expériences →
 * Éducation.
 *
 * Réutilise le moteur du template classique via la variante "canadian" (zéro
 * duplication de logique de rendu/pagination) ; la structure mono-colonne et
 * l'en-tête de coordonnées sont pilotés par `canadianLayout()` et la branche
 * canadienne de `CVTemplate`.
 */
const CVTemplateCanadian: React.FC<CVTemplateCanadianProps> = ({ data, originalData }) => (
  <CVTemplate data={data} originalData={originalData} variant="canadian" />
);

export default CVTemplateCanadian;
