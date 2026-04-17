import type { AgentEvent } from "./types";

/**
 * Serialize an AgentEvent as an SSE data line and enqueue it into the stream controller.
 * Format: `data: <JSON>\n\n`
 */
export function emit(
  controller: ReadableStreamDefaultController,
  event: AgentEvent
): void {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(line));
}
