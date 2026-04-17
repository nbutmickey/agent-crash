import { stream } from "@mariozechner/pi-ai";
import type { Context, Message } from "@mariozechner/pi-ai";
import { model } from "./model";
import { createTools, makeToolResultMessage, extractToolCalls } from "./tools";
import { emit } from "./sse";

const SYSTEM_PROMPT = `You are a capable assistant with access to a rich set of tools. Use them to complete tasks effectively.

Available tools:
- read: read a file's content (path relative to project root)
- grep: search for patterns in files (regex, with line numbers)
- glob: find files matching a pattern (e.g. "demo/*.txt", "**/*.ts")
- bash: execute shell commands (runs in project root, 15s timeout)
- write: write or overwrite a file
- edit: replace an exact string in a file
- TodoWrite: manage a task list (always pass the complete list)
- webSearch: search the web (mock if SERPER_API_KEY not set)
- webFetch: fetch and read the text content of a URL

Guidelines:
- Use glob/grep to explore before reading files
- Break complex tasks into todos with TodoWrite
- Be concise — briefly explain what you're doing before each tool call`;

/**
 * Core agent loop.
 * Creates a fresh tool set per request (so TodoWrite state is per-conversation).
 * Streams token deltas and emits tool_call / tool_result events via SSE.
 * Exits when stopReason !== "toolUse".
 */
export async function runAgentLoop(
  messages: Message[],
  controller: ReadableStreamDefaultController
): Promise<void> {
  const { TOOLS, executeTool } = createTools();

  const context: Context = {
    systemPrompt: SYSTEM_PROMPT,
    messages: [...messages],
    tools: TOOLS,
  };

  while (true) {
    // Stream this turn — forward text_delta events to the client
    const eventStream = stream(model, context);
    for await (const event of eventStream) {
      if (event.type === "text_delta") {
        emit(controller, { type: "text_delta", delta: event.delta });
      }
    }

    // Get the complete AssistantMessage to inspect stopReason and tool calls
    // (result() is safe to call here — finalResultPromise is already resolved)
    const response = await eventStream.result();
    context.messages.push(response);

    if (
      response.stopReason === "stop" ||
      response.stopReason === "length" ||
      response.stopReason === "error" ||
      response.stopReason === "aborted"
    ) {
      emit(controller, { type: "context_update", messages: context.messages as unknown[] });
      emit(controller, { type: "done" });
      break;
    }

    if (response.stopReason === "toolUse") {
      const toolCalls = extractToolCalls(response.content);
      for (const toolCall of toolCalls) {
        emit(controller, { type: "tool_call", name: toolCall.name, args: toolCall.arguments });
        const result = await executeTool(toolCall);
        emit(controller, { type: "tool_result", name: toolCall.name, result });
        context.messages.push(makeToolResultMessage(toolCall, result));
      }
    }
  }
}
