/**
 * Extraction du texte d'un fichier DOCX SANS dépendance.
 *
 * Un DOCX est une archive ZIP : on lit le répertoire central, on décompresse
 * les parties utiles (`word/document.xml`, en-têtes, pieds de page) avec
 * `DecompressionStream("deflate-raw")` — natif dans les navigateurs récents et
 * dans Node ≥ 18 — puis on transforme le WordprocessingML en texte brut
 * (paragraphes, tabulations, sauts de ligne, puces, cellules de tableau).
 *
 * Volontairement sans DOMParser : le même code tourne dans le navigateur et
 * dans les scripts de test Node.
 */

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

export class DocxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxError";
  }
}

function readEntries(buf: Uint8Array): ZipEntry[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // L'« End of Central Directory » est dans les 64 Ko (+22 octets) de fin.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DocxError("not_a_zip");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || view.getUint32(offset, true) !== SIG_CENTRAL) {
      throw new DocxError("corrupt_zip");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(buf.subarray(offset + 46, offset + 46 + nameLen));
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // Copie dans un ArrayBuffer neuf : le Blob refuse les vues sur SharedArrayBuffer.
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(buf: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lo = entry.localOffset;
  if (lo + 30 > buf.length || view.getUint32(lo, true) !== SIG_LOCAL) throw new DocxError("corrupt_zip");
  const start = lo + 30 + view.getUint16(lo + 26, true) + view.getUint16(lo + 28, true);
  const raw = buf.subarray(start, start + entry.compressedSize);
  let bytes: Uint8Array;
  if (entry.method === 0) bytes = raw;
  else if (entry.method === 8) bytes = await inflateRaw(raw);
  else throw new DocxError("unsupported_compression");
  return new TextDecoder().decode(bytes);
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, code: string) => {
    const c = code.toLowerCase();
    if (c === "lt") return "<";
    if (c === "gt") return ">";
    if (c === "amp") return "&";
    if (c === "quot") return '"';
    if (c === "apos") return "'";
    const n = c.startsWith("#x") ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}

/** WordprocessingML → texte brut. Exporté pour les tests. */
export function wordXmlToText(xml: string): string {
  const cleaned = xml
    // Variante de repli des zones de texte : dupliquerait le contenu de mc:Choice.
    .replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "")
    // Codes de champ (HYPERLINK "…", PAGE…) et texte supprimé (révisions).
    .replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/g, "")
    .replace(/<w:delText\b[\s\S]*?<\/w:delText>/g, "")
    // Propriétés de run : sans texte utile.
    .replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/g, "")
    // Propriétés de paragraphe : on ne garde que l'information « liste à puces »
    // (et on évite les <w:tab> des taquets de tabulation définis dans <w:tabs>).
    .replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/g, (ppr) => (/<w:numPr\b/.test(ppr) ? "<kbullet/>" : ""));

  let out = "";
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>|<\/w:tc>|<\/w:tr>|<kbullet\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const tag = m[0];
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (tag.startsWith("<w:tab")) out += "\t";
    else if (tag === "</w:p>") out += "\n";
    // Tableau : cellules d'une même ligne séparées par une tabulation, une ligne par rangée.
    else if (tag === "</w:tc>") out = out.replace(/\n$/, "") + "\t";
    else if (tag === "</w:tr>") out = out.replace(/\t$/, "") + "\n";
    else if (tag === "<kbullet/>") out += "• ";
    else out += "\n"; // w:br / w:cr
  }
  return out;
}

/** Texte complet d'un DOCX : en-têtes (souvent le nom et le contact), corps, pieds de page. */
export async function extractDocxText(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const entries = readEntries(buf);
  const body = entries.find((e) => e.name === "word/document.xml");
  if (!body) throw new DocxError("not_a_docx");

  const byName = (re: RegExp) => entries.filter((e) => re.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  const parts: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    const t = text.trim();
    // Les en-têtes « première page / paires / impaires » sont souvent identiques.
    if (t && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  };
  for (const e of byName(/^word\/header\d*\.xml$/)) push(wordXmlToText(await readEntry(buf, e)));
  push(wordXmlToText(await readEntry(buf, body)));
  for (const e of byName(/^word\/footer\d*\.xml$/)) push(wordXmlToText(await readEntry(buf, e)));
  return parts.join("\n\n");
}
