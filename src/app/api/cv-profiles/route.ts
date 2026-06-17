import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale");
  const slug = req.nextUrl.searchParams.get("slug");

  let query = "SELECT id, slug, name, locale, template, cv_data, cover_letter, original_cv, is_adaptation, parent_id, created_at, updated_at FROM cv_profiles";
  const conditions: string[] = [];
  const params: string[] = [];

  if (locale) {
    params.push(locale);
    conditions.push(`locale = $${params.length}`);
  }
  if (slug) {
    params.push(slug);
    conditions.push(`slug = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY name, locale";

  const { rows } = await pool.query(query, params);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, name, locale, template, cv_data, cover_letter, original_cv, is_adaptation, parent_id } = body;

  if (!slug || !name || !cv_data) {
    return NextResponse.json({ error: "slug, name, and cv_data are required" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO cv_profiles (slug, name, locale, template, cv_data, cover_letter, original_cv, is_adaptation, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        slug,
        name,
        locale || "fr",
        template || "default",
        JSON.stringify(cv_data),
        cover_letter ? JSON.stringify(cover_letter) : null,
        original_cv ? JSON.stringify(original_cv) : null,
        is_adaptation || false,
        parent_id || null,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[cv-profiles POST] error:", err);
    return NextResponse.json({ error: "Could not save the profile to the database." }, { status: 500 });
  }
}
