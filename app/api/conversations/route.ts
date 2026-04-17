// data-agent/packages/agent-loop/app/api/conversations/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { listConversations, createConversation } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET() {
  const conversations = listConversations(db);
  return NextResponse.json(conversations);
}

export async function POST() {
  const conversation = createConversation(db);
  return NextResponse.json(conversation);
}
