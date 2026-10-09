// The web_search tool: web search without an account or API key. Which services and why is described
// in bin/web-search. The plugin loads it as a module instead of running a separate process: that way
// requests go out from the OpenCode process and honour the proxy from HTTPS_PROXY.
import { tool } from "@opencode-ai/plugin"
import { createRequire } from "node:module"

export const WebSearch = async () => {
  const { search, format } = createRequire(import.meta.url)("../bin/web-search")

  return {
    tool: {
      web_search: tool({
        description: [
          "Search the web. Returns the title, link and snippet of each result; read a full page with webfetch.",
          "The query is sent to external services (Keenable, Firecrawl as a fallback). Do not put internal names of",
          "systems and projects, client names, data or document excerpts into it — phrase it in general terms:",
          "\"payment API idempotency\", not the name of our service.",
        ].join("\n"),
        args: {
          query: tool.schema.string().describe("Search query"),
          limit: tool.schema.number().int().min(1).max(20).optional().describe("Number of results, 8 by default"),
        },
        async execute(args, context) {
          // Allowed by default; the rule "web_search": "ask" in opencode.json shows every query before it is sent.
          await context.ask({ permission: "web_search", patterns: [args.query], always: ["*"], metadata: { query: args.query } })
          const result = await search(args.query, { limit: args.limit, signal: context.abort })
          context.metadata({ title: `${args.query} · ${result.provider}` })
          return format(result)
        },
      }),
    },
  }
}
