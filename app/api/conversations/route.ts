// app/api/conversations/route.ts
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { listConversations, createConversation } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET() {
  const conversations = await listConversations(pool);
  return NextResponse.json(conversations);
}

export async function POST() {
  const conversation = await createConversation(pool);
  return NextResponse.json(conversation);
}
