import React from "react";
import { Text } from "@/components/pdf-primitives";
import { diffWords } from "diff";

export const wrapText = (text: string, chars = "/\\-@\\.") => {
  if (!text) return "";
  const zwsp = String.fromCharCode(0x200b);
  const regex = new RegExp(`([${chars}])`, "g");
  return text.replace(regex, "$1" + zwsp);
};

export const formatUrl = (url: string) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
};

export const displayUrl = (url: string, isLinkedIn = false) => {
  if (!url) return "";
  let clean = url.replace(/^(https?:\/\/)?(www\.)?/, "");
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
  style?: any;
  maxTextLength?: number;
}) {
  if (oldText === undefined || oldText === newText || (!oldText && !newText)) {
    return <Text style={style}>{newText}</Text>;
  }

  let chunks;
  try {
    const oldTrunc = oldText.slice(0, maxTextLength);
    const newTrunc = newText.slice(0, maxTextLength);
    const result = diffWords(oldTrunc, newTrunc);
    chunks = result.length > 10000 ? result.slice(0, 10000) : result;
  } catch {
    return <Text style={style}>{newText}</Text>;
  }

  return (
    <Text style={style}>
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
