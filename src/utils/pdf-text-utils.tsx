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

export const DiffText = ({
  oldText,
  newText,
  style,
}: {
  oldText?: string;
  newText: string;
  style?: any;
}) => {
  if (oldText === undefined || oldText === newText) {
    return <Text style={style}>{newText}</Text>;
  }

  const chunks = diffWords(oldText, newText);
  return (
    <Text style={style}>
      {chunks.map((chunk, i) => {
        if (chunk.added) {
          return (
            <Text key={i} style={{ color: "green" }}>
              [+ {chunk.value}]
            </Text>
          );
        }
        if (chunk.removed) {
          return (
            <Text
              key={i}
              style={{
                color: "red",
                textDecoration: "line-through",
              }}
            >
              [- {chunk.value}]
            </Text>
          );
        }
        return <Text key={i}>{chunk.value}</Text>;
      })}
    </Text>
  );
};
