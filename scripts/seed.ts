import { Pool } from "pg";
import fs from "fs";
import path from "path";

/**
 * Seed des profils principaux.
 *
 * Les données ne sont plus codées en dur dans l'application (src/data a été
 * supprimé) : elles vivent en base. Ce script rejoue simplement un snapshot SQL
 * (scripts/seed_profiles.sql) exporté depuis la base, ce qui permet de
 * reconstruire une base fraîche sans réintroduire de données dans le bundle.
 *
 * Pour rafraîchir le snapshot après modification des profils en base :
 *   docker compose exec -T postgres pg_dump -U kompyle -d kompyle \
 *     --data-only --table=cv_profiles --column-inserts > scripts/seed_profiles.sql
 */
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://kompyle:kompyle_dev@localhost:5432/kompyle",
});

async function seed() {
  const sqlPath = path.join(__dirname, "seed_profiles.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Snapshot introuvable : ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, "utf-8").trim();
  if (!sql) {
    console.log("Snapshot vide — rien à insérer.");
  } else {
    await pool.query(sql);
    console.log("Profils principaux insérés depuis seed_profiles.sql");
  }

  await pool.end();
  console.log("Done!");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
