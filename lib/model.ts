import type { Model } from "@mariozechner/pi-ai";

// MiniMax M2.7 via anthropic-messages API (global endpoint)
export const model: Model<"anthropic-messages"> = {
  id: "MiniMax-M2.7",
  name: "MiniMax M2.7",
  api: "anthropic-messages",
  provider: "minimax",
  baseUrl: "https://api.minimax.io/anthropic",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000000,
  maxTokens: 8192,
  headers: {
    "x-api-key": process.env.MINIMAX_API_KEY ?? "",
    "anthropic-version": "2023-06-01",
  },
};
