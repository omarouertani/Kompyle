import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://kompyle:kompyle_dev@localhost:5432/kompyle",
});

const dataDir = path.join(__dirname, "..", "src", "data");

const profiles = [
  { slug: "omar", name: "Omar Ouertani", locale: "fr", template: "default", file: "cv_data_fr.json" },
  { slug: "omar", name: "Omar Ouertani", locale: "en", template: "default", file: "cv_data_en.json" },
  { slug: "chaima", name: "Chaima Dkhil", locale: "fr", template: "chaima", file: "cv_data_chaima_fr.json" },
  { slug: "chaima", name: "Chaima Dkhil", locale: "en", template: "chaima", file: "cv_data_chaima_en.json" },
];

async function seed() {
  for (const p of profiles) {
    const raw = fs.readFileSync(path.join(dataDir, p.file), "utf-8");
    const cvData = JSON.parse(raw);

    await pool.query(
      `INSERT INTO cv_profiles (slug, name, locale, template, cv_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug, locale) DO UPDATE SET
         name = EXCLUDED.name,
         template = EXCLUDED.template,
         cv_data = EXCLUDED.cv_data,
         updated_at = now()`,
      [p.slug, p.name, p.locale, p.template, JSON.stringify(cvData)]
    );

    console.log(`Seeded: ${p.name} (${p.locale})`);
  }

  await pool.end();
  console.log("Done!");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
