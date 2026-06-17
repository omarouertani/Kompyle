import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://kompyle:kompyle_dev@localhost:5432/kompyle",
});

export default pool;
