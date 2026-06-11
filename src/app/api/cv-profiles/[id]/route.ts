import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { rows } = await pool.query(
    "SELECT * FROM cv_profiles WHERE id = $1",
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { slug, name, locale, template, cv_data } = body;

  const { rows } = await pool.query(
    `UPDATE cv_profiles
     SET slug = COALESCE($2, slug),
         name = COALESCE($3, name),
         locale = COALESCE($4, locale),
         template = COALESCE($5, template),
         cv_data = COALESCE($6, cv_data),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, slug, name, locale, template, cv_data ? JSON.stringify(cv_data) : null]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { rowCount } = await pool.query(
    "DELETE FROM cv_profiles WHERE id = $1",
    [id]
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
