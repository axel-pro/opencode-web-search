# opencode-web-search

An [OpenCode](https://opencode.ai) plugin that adds the `web_search` tool: the agent searches the web and gets
a list of results — title, link and snippet. No account, API key or MCP server is required.

Search goes to [Keenable](https://keenable.ai); if it returns an error or its limit is exhausted, the plugin falls
back to [Firecrawl](https://www.firecrawl.dev). Both offer a free keyless entry point with a per-IP limit.
The agent reads full pages with OpenCode's built-in `webfetch`.

## Installation

Add the plugin to `opencode.json` (in the project or in `~/.config/opencode/`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-web-search"]
}
```

OpenCode installs it on the next start. Requirements: OpenCode 1.18+ and Node.js 22.13+.

## The `web_search` tool

| Argument | Description |
|---|---|
| `query` | Search query |
| `limit` | Number of results, 1–20, 8 by default |

Example result:

```
1. Pattern: Saga
   https://microservices.io/patterns/data/saga.html
   Implement each business transaction that spans multiple services as a saga…
```

If Keenable failed and the results come from Firecrawl, the reason is shown on the first line.
If neither service responded, the tool returns an error with the reason from each.

- **Privacy.** Queries are sent to external services (both in the USA). The tool description tells the agent
  not to put internal system names, client names, data or document excerpts into queries. To review every
  query before it is sent, add a permission rule to `opencode.json`:

  ```json
  { "permission": { "web_search": "ask" } }
  ```

- **Proxy.** Requests are sent from the OpenCode process itself, so the proxy from `HTTPS_PROXY` is honoured.
- **Limits.** Keenable allows 1000 requests per hour per IP; a team behind one external address shares it.
  Firecrawl does not publish its keyless limit.

## Why these services

The goal was search without sign-up that also works from Russia (checked in October 2026 from a Russian IP):

- Exa and Parallel block Russia (Cloudflare returns 403);
- DuckDuckGo, Bing, Yandex and Google answer automated requests with a captcha or off-topic results;
- Tavily's terms prohibit use from Russia; Brave requires an API key.

Keenable is the primary service: its terms do not prohibit this use and its limit is published. Firecrawl gives
better results (primary sources rather than SEO articles), but its terms (section 5.d.1) prohibit commercial use
without explicit permission, so it is only a fallback. An empty Keenable result is not treated as an error and
does not trigger Firecrawl.

A free keyless entry point can be closed or cut down at any time. If search stops working, run the command line
tool below — it shows which service answered what.

## Command line

The same search is available as the `web-search` command:

```sh
npx opencode-web-search saga pattern
```

```
web-search [-n <count>] <query>
```

Exit codes: `0` — done (including when nothing is found); `1` — no service responded; `2` — invalid invocation.
Errors go to stderr.

## Development

```sh
npm install
npm test
```

Tests never go online: `fetch` is replaced with a stub that returns preset responses for each service.

To try a local checkout in OpenCode, point the plugin at the directory:

```json
{ "plugin": ["../opencode-web-search"] }
```

## Releasing

Publishing is done by the `Publish to npm` GitHub Actions workflow when a `v*` tag is pushed.
The tag must match the version in `package.json`.

```sh
npm version patch        # bumps package.json, commits and creates the v* tag
git push --follow-tags
```

One-time setup: create an npm access token (Automation or Granular with publish rights) and add it to the
repository secrets as `NPM_TOKEN`.

## License

[MIT](LICENSE)
