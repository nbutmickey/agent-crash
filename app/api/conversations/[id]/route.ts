// app/api/conversations/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import getPool from "@/lib/db";
import { getConversation, updateConversation, deleteConversation } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const pool = await getPool();
  const conversation = await getConversation(pool, params.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  let patch: { title?: string; messages?: unknown[]; timeline?: unknown[] };
  try {
    patch = (await req.json()) as {
      title?: string;
      messages?: unknown[];
      timeline?: unknown[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const pool = await getPool();
  const updated = await updateConversation(pool, params.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const pool = await getPool();
  const deleted = await deleteConversation(pool, params.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
