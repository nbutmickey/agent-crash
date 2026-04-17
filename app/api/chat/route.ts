import { runAgentLoop } from "@/lib/agent-loop";
import { emit } from "@/lib/sse";
import type { Message } from "@mariozechner/pi-ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const messages: Message[] = body.messages ?? [];

  const readable = new ReadableStream({
    async start(controller) {
      try {
        await runAgentLoop(messages, controller);
      } catch (err) {
        emit(controller, { type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
