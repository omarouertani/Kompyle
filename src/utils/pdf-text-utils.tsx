import React from "react";
import { Text } from "@/components/pdf-primitives";
import { diffWords } from "diff";
import { stripHtml } from "./inline-html";

// Re-export the pure inline-HTML helpers so existing imports keep working.
// The actual parsing/rendering now lives in `inline-html.ts` and is applied
// automatically by the <Text>/<Link> PDF primitives — so every template field
// reflects canvas formatting in the PDF without per-call-site changes.
export { hasInlineHtml, stripHtml, parseInlineHtml } from "./inline-html";

export const wrapText = (text: string, chars = "/\\-@\\.") => {
  if (!text) return "";
  const clean = stripHtml(text);
  const zwsp = String.fromCharCode(0x200b);
  const regex = new RegExp(`([${chars}])`, "g");
  return clean.replace(regex, "$1" + zwsp);
};

/** Renders a string that may contain inline HTML format tags. The <Text>
 *  primitive already auto-parses inline HTML, so this just forwards the value
 *  to it — kept for the call sites (section titles, custom sections) that use
 *  it explicitly. */
export function RichText({ value, style }: { value: string; style?: unknown }) {
  if (!value) return null;
  return <Text style={style as never}>{value}</Text>;
}

export const formatUrl = (url: string) => {
  if (!url) return "";
  const clean = stripHtml(url);
  return clean.startsWith("http") ? clean : `https://${clean}`;
};

export const displayUrl = (url: string, isLinkedIn = false) => {
  if (!url) return "";
  let clean = stripHtml(url).replace(/^(https?:\/\/)?(www\.)?/, "");
  if (isLinkedIn) {
    clean = clean.replace(/^linkedin\.com\/in\//i, "");
  }
  if (clean.endsWith("/")) clean = clean.slice(0, -1);
  return clean;
};

// No React hooks — these components are rendered by @react-pdf/renderer's
// own reconciler (not React DOM), so hooks cause "invalid hook call" errors
// in server-side renderToBuffer. Each PDF is rendered once anyway.

export function DiffText({
  oldText,
  newText,
  style,
  maxTextLength = 50000,
}: {
  oldText?: string;
  newText: string;
  style?: unknown;
  maxTextLength?: number;
}) {
  // Inline format tags (b/i/u/s/span) live in the data after the user toggles
  // formatting in the canvas. Strip them before diffing so additions like
  // "<b>react</b>" don't show up as `[+ <b>][+ react][+ </b>]` chunks.
  const cleanNew = stripHtml(newText);
  const cleanOld = oldText !== undefined ? stripHtml(oldText) : undefined;
  // No diff to show (normal editing — not an AI adaptation comparison): render
  // the value as-is so the <Text> primitive parses per-substring bold/italic/
  // underline/color/size/font set in the canvas, instead of stripping it.
  if (cleanOld === undefined || cleanOld === cleanNew || (!cleanOld && !cleanNew)) {
    return <Text style={style as never}>{newText}</Text>;
  }

  let chunks;
  try {
    const oldTrunc = cleanOld.slice(0, maxTextLength);
    const newTrunc = cleanNew.slice(0, maxTextLength);
    const result = diffWords(oldTrunc, newTrunc);
    chunks = result.length > 10000 ? result.slice(0, 10000) : result;
  } catch {
    return <Text style={style as never}>{cleanNew}</Text>;
  }

  return (
    <Text style={style as never}>
      {chunks.map((chunk, index) => {
        if (chunk.added) {
          return <Text key={index} style={{ color: "green" }}>[+ {chunk.value}]</Text>;
        }
        if (chunk.removed) {
          return <Text key={index} style={{ color: "red", textDecoration: "line-through" }}>[- {chunk.value}]</Text>;
        }
        return <Text key={index}>{chunk.value}</Text>;
      })}
    </Text>
  );
}

export default DiffText;
