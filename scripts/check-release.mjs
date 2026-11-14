// Vérifie release.json avant une publication : `npm run release:check`.
//  - versions « x.y.z », la plus récente EN HAUT, sans doublon ;
//  - type "feature" ou "fix", résumé FR + EN ;
//  - fonctionnalités : id unique, titre / texte FR + EN, cible data-tour existante ;
//  - version de package.json = version la plus récente de release.json.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "release.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const errors = [];

const cmp = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
const localized = (v, where) => {
  if (!v || typeof v.fr !== "string" || !v.fr.trim() || typeof v.en !== "string" || !v.en.trim()) errors.push(`${where}: texte FR et EN requis`);
};

// Cibles data-tour présentes dans le code (pour repérer une faute de frappe).
const targets = new Set();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) for (const m of fs.readFileSync(p, "utf8").matchAll(/data-tour(?:=\{[^}]*?)?=?"([a-z0-9-]+)"/g)) targets.add(m[1]);
  }
};
walk(path.join(root, "src"));

const releases = manifest.releases ?? [];
if (!releases.length) errors.push("releases: au moins une version requise");
const ids = new Set();
releases.forEach((r, i) => {
  const at = `releases[${i}] (${r.version})`;
  if (!/^\d+\.\d+\.\d+$/.test(r.version ?? "")) errors.push(`${at}: version « x.y.z » requise`);
  if (i > 0 && cmp(releases[i - 1].version, r.version) <= 0) errors.push(`${at}: les versions doivent être triées, la plus récente en haut`);
  if (r.type !== "feature" && r.type !== "fix") errors.push(`${at}: type "feature" ou "fix"`);
  localized(r.summary, `${at}.summary`);
  for (const f of r.features ?? []) {
    if (r.type === "fix") errors.push(`${at}: une release "fix" ne liste pas de fonctionnalités`);
    if (!f.id || ids.has(f.id)) errors.push(`${at}: feature id manquant ou en double (${f.id})`);
    ids.add(f.id);
    localized(f.title, `${at}.${f.id}.title`);
    localized(f.body, `${at}.${f.id}.body`);
    if (f.target && !targets.has(f.target)) errors.push(`${at}.${f.id}: cible data-tour="${f.target}" introuvable dans src/`);
  }
});
if (releases[0] && pkg.version !== releases[0].version) {
  errors.push(`package.json (${pkg.version}) ≠ release.json (${releases[0].version}) : alignez les deux versions`);
}

if (errors.length) {
  console.error("release.json invalide :\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`release.json OK — version ${releases[0].version} (${releases[0].type}), ${ids.size} fonctionnalité(s) annoncée(s).`);
