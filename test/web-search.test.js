// Tests for bin/web-search. They never go online: fetch is replaced with a stub that answers for each
// service with a preset response and records the requests.
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.join(__dirname, "..", "bin", "web-search");
const { search, format } = require(SCRIPT);

const KEENABLE = {
  results: [
    {
      title: "The saga pattern",
      url: "https://example.org/saga",
      description: "",
      snippet: "## A saga is local steps\nA **saga** breaks [the transaction](https://example.org/tx) into steps.",
      published_at: "2026-08-09T15:22:34Z",
    },
  ],
};
const FIRECRAWL = {
  success: true,
  data: { web: [{ url: "https://microservices.io/saga", title: "Pattern: Saga", description: "# Pattern: Saga" }] },
};

// answers: { keenable, firecrawl } — an object with the JSON response, a number (HTTP error code) or an Error (network failure).
function fakeFetch(answers) {
  const calls = [];
  const fetch = async (url, init) => {
    const name = url.includes("keenable") ? "keenable" : "firecrawl";
    calls.push({ name, url, headers: init.headers, body: JSON.parse(init.body) });
    const answer = answers[name];
    if (answer instanceof Error) throw answer;
    if (typeof answer === "number") return new Response("Too Many Requests", { status: answer });
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  return { fetch, calls };
}

test("searches Keenable and sends only the query and the application name", async () => {
  const { fetch, calls } = fakeFetch({ keenable: KEENABLE, firecrawl: FIRECRAWL });
  const result = await search("  saga pattern  ", { limit: 3, fetch });
  assert.equal(result.provider, "Keenable");
  assert.equal(calls.length, 1, "Firecrawl is not called when Keenable responds");
  assert.deepEqual(calls[0].body, { query: "saga pattern", max_results: 3 });
  assert.deepEqual(calls[0].headers, { "Content-Type": "application/json", "X-Keenable-Title": "opencode-web-search" });

  const text = format(result);
  assert.match(text, /^1\. The saga pattern \(2026-08-09\)\n {3}https:\/\/example\.org\/saga\n {3}A saga is local steps A saga breaks the transaction into steps\.$/m);
});

test("Keenable error or limit — the query goes to Firecrawl and the reason is shown", async () => {
  for (const keenable of [429, new Error("ECONNRESET")]) {
    const { fetch, calls } = fakeFetch({ keenable, firecrawl: FIRECRAWL });
    const result = await search("saga", { fetch });
    assert.equal(result.provider, "Firecrawl");
    assert.deepEqual(calls.map((c) => c.name), ["keenable", "firecrawl"]);
    assert.deepEqual(calls[1].body, { query: "saga", limit: 8 });
    const text = format(result);
    assert.match(text, /^Keenable: (HTTP 429 Too Many Requests|ECONNRESET) — results from Firecrawl\./);
    assert.match(text, /^1\. Pattern: Saga\n {3}https:\/\/microservices\.io\/saga\n {3}Pattern: Saga$/m);
  }
});

test("an empty Keenable result is not an error, Firecrawl is not called", async () => {
  const { fetch, calls } = fakeFetch({ keenable: { results: [] }, firecrawl: FIRECRAWL });
  const result = await search("no such thing", { fetch });
  assert.equal(calls.length, 1);
  assert.equal(format(result), "Nothing found.\n");
});

test("no service responded — the error lists reasons from both", async () => {
  const { fetch } = fakeFetch({ keenable: 503, firecrawl: 429 });
  await assert.rejects(search("saga", { fetch }), /Keenable: HTTP 503[\s\S]*Firecrawl: HTTP 429/);
});

test("invalid command-line invocation — exit code 2", () => {
  const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  assert.equal(run([]).status, 2);
  assert.equal(run(["--bad"]).status, 2);
  assert.equal(run(["-n", "0", "saga"]).status, 2);
  assert.equal(run(["-h"]).status, 0);
});
