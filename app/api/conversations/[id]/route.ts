// data-agent/packages/agent-loop/app/api/conversations/[id]/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getConversation, updateConversation, deleteConversation } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const conversation = getConversation(db, params.id);
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
  const updated = updateConversation(db, params.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const deleted = deleteConversation(db, params.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
