import { Type } from "@mariozechner/pi-ai";
import type { ToolRegistry } from "./registry";

export function registerWebTools(registry: ToolRegistry): void {
  registry.register({
    tool: {
      name: "webSearch",
      description: "Search the web. Returns top results with title, URL, and content. Set TAVILY_API_KEY in .env.local for real results.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
      }),
    },
    rollbackStrategy: "none",
    execute: async (args) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return (
          `[mock — add TAVILY_API_KEY to .env.local for real results]\n` +
          `Query: "${args.query as string}"\n\n` +
          `1. Mock Result A — example.com\n   A snippet about "${args.query}"\n\n` +
          `2. Mock Result B — docs.example.com\n   More information about "${args.query}"\n\n` +
          `3. Mock Result C — blog.example.com\n   An article discussing "${args.query}"`
        );
      }
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey, query: args.query, search_depth: "basic", max_results: 5 }),
        });
        const data = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };
        return (data.results ?? []).map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`).join("\n\n") || "(no results)";
      } catch (e) {
        return `Error: ${e}`;
      }
    },
  });

  registry.register({
    tool: {
      name: "webFetch",
      description: "Fetch the text content of a URL (HTML tags stripped). Returns up to 5000 characters.",
      parameters: Type.Object({
        url: Type.String({ description: "URL to fetch" }),
      }),
    },
    rollbackStrategy: "none",
    execute: async (args) => {
      try {
        const res = await fetch(args.url as string, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentLoopDemo/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await res.text();
        return html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/\s+/g, " ").trim().slice(0, 5000) || "(empty response)";
      } catch (e) {
        return `Error: ${e}`;
      }
    },
  });
}
