// app/api/conversations/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import getPool from "@/lib/db";
import { listConversations, createConversation } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET() {
  const pool = await getPool();
  const conversations = await listConversations(pool);
  return NextResponse.json(conversations);
}

export async function POST() {
  const pool = await getPool();
  const conversation = await createConversation(pool);
  return NextResponse.json(conversation);
}
