"use client";

import React from "react";
import { PT_TO_PX, SELECTION_COLOR } from "../cv-canvas-primitives";
import type { SnapGuide } from "./snap";

/** Couleur des cotes de distance (rose, comme Figma) — distincte des lignes
 *  d'alignement (indigo) pour les différencier d'un coup d'œil. */
const DISTANCE_COLOR = "#f43f5e";

const px = (pt: number) => pt * PT_TO_PX;

/** Couche de guides : lignes d'alignement (bords/centres) + cotes chiffrées
 *  vers les blocs voisins. Rendue à l'intérieur de la page, en coordonnées pt. */
export function SnapGuides({ guides }: { guides: SnapGuide[] }) {
  return (
    <>
      {guides.map((g, i) => {
        if (g.kind === "align") {
          return g.orientation === "vertical" ? (
            <div
              key={`a-${i}`}
              className="absolute w-px z-40 pointer-events-none"
              style={{ left: px(g.position), top: px(g.start), height: px(g.end - g.start), backgroundColor: SELECTION_COLOR }}
            />
          ) : (
            <div
              key={`a-${i}`}
              className="absolute h-px z-40 pointer-events-none"
              style={{ top: px(g.position), left: px(g.start), width: px(g.end - g.start), backgroundColor: SELECTION_COLOR }}
            />
          );
        }

        // Cote de distance : segment + 2 embouts + badge chiffré.
        const len = px(g.end - g.start);
        const mid = px((g.start + g.end) / 2);
        if (g.orientation === "vertical") {
          const left = px(g.position);
          return (
            <div key={`d-${i}`} className="absolute z-40 pointer-events-none" style={{ left, top: px(g.start), height: len }}>
              <div className="absolute top-0 bottom-0 w-px" style={{ backgroundColor: DISTANCE_COLOR }} />
              <div className="absolute left-[-3px] top-0 w-[7px] h-px" style={{ backgroundColor: DISTANCE_COLOR }} />
              <div className="absolute left-[-3px] bottom-0 w-[7px] h-px" style={{ backgroundColor: DISTANCE_COLOR }} />
              <span
                className="absolute left-1 -translate-y-1/2 px-1 py-px rounded text-[8px] font-semibold font-mono text-white whitespace-nowrap"
                style={{ top: mid - px(g.start), backgroundColor: DISTANCE_COLOR }}
              >
                {g.label}
              </span>
            </div>
          );
        }
        const top = px(g.position);
        return (
          <div key={`d-${i}`} className="absolute z-40 pointer-events-none" style={{ top, left: px(g.start), width: len }}>
            <div className="absolute left-0 right-0 h-px" style={{ backgroundColor: DISTANCE_COLOR }} />
            <div className="absolute top-[-3px] left-0 h-[7px] w-px" style={{ backgroundColor: DISTANCE_COLOR }} />
            <div className="absolute top-[-3px] right-0 h-[7px] w-px" style={{ backgroundColor: DISTANCE_COLOR }} />
            <span
              className="absolute top-1 -translate-x-1/2 px-1 py-px rounded text-[8px] font-semibold font-mono text-white whitespace-nowrap"
              style={{ left: mid - px(g.start), backgroundColor: DISTANCE_COLOR }}
            >
              {g.label}
            </span>
          </div>
        );
      })}
    </>
  );
}
