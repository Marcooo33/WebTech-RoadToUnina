import assert from "node:assert/strict";
import { test } from "node:test";
import { MediaWikiClient } from "./mediawiki.client.js";
import { WikipediaError } from "./wikipedia.errors.js";

interface CapturedRequest {
  url: string;
  init?: RequestInit;
}

type Responder = (captured: CapturedRequest) => Response | Promise<Response>;

function makeClient(respond: Responder): MediaWikiClient {
  const fetchImpl = async (
    url: string,
    init?: RequestInit,
  ): Promise<Response> => {
    const captured: CapturedRequest = { url, init };
    const result = respond(captured);
    return result instanceof Response ? result : await result;
  };

  return new MediaWikiClient({
    fetch: fetchImpl as typeof fetch,
    baseUrl: "https://it.wikipedia.org/w/api.php",
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("getRandomArticles requests main-namespace non-redirect random pages", async () => {
  let captured: CapturedRequest | undefined;
  const client = makeClient((req) => {
    captured = req;
    return jsonResponse(200, {
      query: { random: [{ id: 123, ns: 0, title: "Foo" }] },
    });
  });

  const result = await client.getRandomArticles(1);

  assert.equal(captured?.url.includes("action=query"), true);
  assert.equal(captured?.url.includes("list=random"), true);
  assert.equal(captured?.url.includes("rnnamespace=0"), true);
  assert.equal(captured?.url.includes("rnfilterredir=nonredirects"), true);
  assert.equal(captured?.url.includes("formatversion=2"), true);
  assert.deepEqual(result, [{ id: 123, ns: 0, title: "Foo" }]);
});

test("getRandomArticles filters out malformed items", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        random: [
          { id: 123, ns: 0, title: "Foo" },
          { id: "bad", ns: 0, title: "Bar" },
          null,
        ],
      },
    }),
  );

  const result = await client.getRandomArticles(3);

  assert.deepEqual(result, [{ id: 123, ns: 0, title: "Foo" }]);
});

test("getPageInfo throws PAGE_NOT_FOUND for a missing page", async () => {
  const client = makeClient((req) => {
    return jsonResponse(200, {
      query: { pages: [{ ns: 0, title: "Gone", missing: true }] },
    });
  });

  await assert.rejects(
    () => client.getPageInfo(999),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "PAGE_NOT_FOUND",
  );
});

test("resolveTitle rejects malformed page IDs", async () => {
  for (const pageid of [0, -1, 1.5, "123", null]) {
    const client = makeClient(() =>
      jsonResponse(200, {
        query: { pages: [{ pageid, ns: 0, title: "X" }] },
      }),
    );

    await assert.rejects(
      () => client.resolveTitle("X"),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected pageid ${JSON.stringify(pageid)} to be rejected`,
    );
  }
});

test("getArticleHtml extracts parse text for both formatversions", async () => {
  const asString = makeClient(() =>
    jsonResponse(200, {
      parse: { pageid: 5, title: "T", text: "<p>hello</p>" },
    }),
  );
  assert.equal((await asString.getArticleHtml(5)).html, "<p>hello</p>");

  const asObject = makeClient(() =>
    jsonResponse(200, {
      parse: { pageid: 6, title: "T2", text: { "*": "<p>hi</p>" } },
    }),
  );
  assert.equal((await asObject.getArticleHtml(6)).html, "<p>hi</p>");
});

test("getArticleHtml throws PAGE_NOT_FOUND when parse is empty", async () => {
  const client = makeClient(() => jsonResponse(200, {}));

  await assert.rejects(
    () => client.getArticleHtml(1),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "PAGE_NOT_FOUND",
  );
});

test("getArticleHtml accepts a valid positive-integer parse pageid", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      parse: { pageid: 123, title: "Napoli", text: "<p>x</p>" },
    }),
  );

  const result = await client.getArticleHtml(123);

  assert.equal(result.pageId, 123);
  assert.equal(result.title, "Napoli");
  assert.equal(result.html, "<p>x</p>");
});

test("getArticleHtml rejects malformed parse pageids", async () => {
  for (const pageid of [0, -1, 1.5, "123", null, undefined]) {
    const client = makeClient(() =>
      jsonResponse(200, {
        parse: { pageid, title: "Napoli", text: "<p>x</p>" },
      }),
    );

    await assert.rejects(
      () => client.getArticleHtml(123),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected pageid ${JSON.stringify(pageid)} to be rejected`,
    );
  }
});

test("resolveTitle follows redirects and returns the canonical page", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        normalized: [{ from: "federico ii", to: "Federico II" }],
        redirects: [{ from: "Federico II", to: "Federico II di Napoli" }],
        pages: [{ pageid: 77, ns: 0, title: "Federico II di Napoli" }],
      },
    }),
  );

  const result = await client.resolveTitle("federico ii");

  assert.deepEqual(result, { pageId: 77, title: "Federico II di Napoli" });
});

test("resolveTitle returns null for a missing page", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: { pages: [{ ns: 0, title: "Nope", missing: true }] },
    }),
  );

  assert.equal(await client.resolveTitle("Nope"), null);
});

test("non-2xx responses raise INVALID_RESPONSE", async () => {
  const client = makeClient(() => jsonResponse(500, {}));

  await assert.rejects(
    () => client.getRandomArticles(1),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("malformed JSON raises INVALID_RESPONSE", async () => {
  const client = makeClient(() => new Response("not json", { status: 200 }));

  await assert.rejects(
    () => client.getRandomArticles(1),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("structurally invalid top-level JSON raises INVALID_RESPONSE", async () => {
  for (const body of [null, [], "unexpected", 123, true]) {
    const client = makeClient(() => jsonResponse(200, body));

    await assert.rejects(
      () => client.getRandomArticles(1),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected body ${JSON.stringify(body)} to be rejected`,
    );
  }
});

test("a valid object response is unaffected by top-level shape validation", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: { random: [{ id: 123, ns: 0, title: "Foo" }] },
    }),
  );

  const result = await client.getRandomArticles(1);

  assert.deepEqual(result, [{ id: 123, ns: 0, title: "Foo" }]);
});

test("MediaWiki error field raises INVALID_RESPONSE", async () => {
  const client = makeClient(() =>
    jsonResponse(200, { error: { code: "badvalue", info: "boom" } }),
  );

  await assert.rejects(
    () => client.getRandomArticles(1),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("network failures raise NETWORK without leaking internals", async () => {
  const client = makeClient(() => {
    throw new Error("connection refused: 192.0.2.1:443");
  });

  await assert.rejects(
    () => client.getRandomArticles(1),
    (error: unknown) => {
      if (!(error instanceof WikipediaError)) {
        return false;
      }
      assert.equal(error.kind, "NETWORK");
      assert.equal(error.message.includes("192.0.2.1"), false);
      return true;
    },
  );
});

test("missing query.random raises INVALID_RESPONSE", async () => {
  const client = makeClient(() => jsonResponse(200, { query: {} }));

  await assert.rejects(
    () => client.getRandomArticles(1),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("getRandomArticles rejects empty and whitespace-only titles", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        random: [
          { id: 1, ns: 0, title: "" },
          { id: 2, ns: 0, title: "   " },
          { id: 3, ns: 0, title: "Good" },
        ],
      },
    }),
  );

  const result = await client.getRandomArticles(3);

  assert.deepEqual(result, [{ id: 3, ns: 0, title: "Good" }]);
});

test("getRandomArticles normalizes titles with surrounding whitespace and underscores", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        random: [
          { id: 1, ns: 0, title: "  Foo  " },
          { id: 2, ns: 0, title: "Bar_Baz" },
        ],
      },
    }),
  );

  const result = await client.getRandomArticles(2);

  assert.deepEqual(result, [
    { id: 1, ns: 0, title: "Foo" },
    { id: 2, ns: 0, title: "Bar Baz" },
  ]);
});

test("getPageInfo rejects an info page without a main namespace", async () => {
  const client = makeClient((req) => {
    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, title: "Current" }] },
    });
  });

  await assert.rejects(
    () => client.getPageInfo(200),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("getPageInfo rejects an info page with a non-main namespace", async () => {
  for (const ns of [1, 14, null, "0", 1.5]) {
    const client = makeClient((req) => {
      if (req.url.includes("generator=links")) {
        return jsonResponse(200, { query: { pages: [] } });
      }

      return jsonResponse(200, {
        query: { pages: [{ pageid: 200, ns, title: "Current" }] },
      });
    });

    await assert.rejects(
      () => client.getPageInfo(200),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected ns ${JSON.stringify(ns)} to be rejected`,
    );
  }
});

test("getPageInfo accepts an info response matching the requested page", async () => {
  const client = makeClient((req) => {
    return jsonResponse(200, {
      query: {
        pages: [{ pageid: 123, ns: 0, title: "Requested", length: 500 }],
      },
    });
  });

  const result = await client.getPageInfo(123);

  assert.equal(result.pageId, 123);
  assert.equal(result.title, "Requested");
  assert.equal(result.length, 500);
});

test("getPageInfo rejects an info response for a different page", async () => {
  const client = makeClient((req) => {
    return jsonResponse(200, {
      query: { pages: [{ pageid: 456, ns: 0, title: "Other" }] },
    });
  });

  await assert.rejects(
    () => client.getPageInfo(123),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("getPageInfo rejects malformed article lengths", async () => {
  for (const length of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const client = makeClient((req) => {
      if (req.url.includes("generator=links")) {
        return jsonResponse(200, { query: { pages: [] } });
      }

      return jsonResponse(200, {
        query: { pages: [{ pageid: 200, ns: 0, title: "Current", length }] },
      });
    });

    await assert.rejects(
      () => client.getPageInfo(200),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected length ${String(length)} to be rejected`,
    );
  }
});

test("getPageInfo accepts zero and missing article lengths", async () => {
  const zero = makeClient((req) => {
    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current", length: 0 }] },
    });
  });

  const zeroResult = await zero.getPageInfo(200);
  assert.equal(zeroResult.length, 0);

  const missing = makeClient((req) => {
    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const missingResult = await missing.getPageInfo(200);
  assert.equal(missingResult.length, undefined);
});

test("getArticleHtml rejects a parse response for a different page", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      parse: { pageid: 999, title: "Other", text: "<p>x</p>" },
    }),
  );

  await assert.rejects(
    () => client.getArticleHtml(123),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("getArticleHtml rejects empty and whitespace-only titles", async () => {
  for (const title of ["", "   "]) {
    const client = makeClient(() =>
      jsonResponse(200, {
        parse: { pageid: 123, title, text: "<p>x</p>" },
      }),
    );

    await assert.rejects(
      () => client.getArticleHtml(123),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected title ${JSON.stringify(title)} to be rejected`,
    );
  }
});

test("resolveTitle requires a main-namespace page", async () => {
  for (const ns of [undefined, null, "0", 1.5]) {
    const client = makeClient(() =>
      jsonResponse(200, {
        query: { pages: [{ pageid: 7, ns, title: "X" }] },
      }),
    );

    await assert.rejects(
      () => client.resolveTitle("X"),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected ns ${JSON.stringify(ns)} to be rejected`,
    );
  }
});

test("resolveTitle rejects a result that does not match the redirect target", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [{ from: "X", to: "Y" }],
        pages: [{ pageid: 7, ns: 0, title: "Z" }],
      },
    }),
  );

  await assert.rejects(
    () => client.resolveTitle("X"),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("resolveTitle rejects a result that does not match the normalized title", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        normalized: [{ from: "x", to: "X" }],
        pages: [{ pageid: 7, ns: 0, title: "Different" }],
      },
    }),
  );

  await assert.rejects(
    () => client.resolveTitle("x"),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("resolveTitle rejects whitespace-only returned titles", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: { pages: [{ pageid: 7, ns: 0, title: "   " }] },
    }),
  );

  await assert.rejects(
    () => client.resolveTitle("   "),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("resolveTitle rejects a malformed page entry", async () => {
  const client = makeClient(() =>
    jsonResponse(200, { query: { pages: [null] } }),
  );

  await assert.rejects(
    () => client.resolveTitle("X"),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("selected redirect chains resolve in one request, independent of mapping order", async () => {
  let requests = 0;
  const client = makeClient(() => {
    requests++;
    return jsonResponse(200, {
      query: {
        redirects: [
          { from: "B", to: "C" },
          { from: "A", to: "B" },
        ],
        pages: [{ pageid: 7, ns: 0, title: "C" }],
      },
    });
  });
  assert.deepEqual(await client.resolveTitle("A"), { pageId: 7, title: "C" });
  assert.equal(requests, 1);
});

test("selected redirects to non-articles are not playable", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [{ from: "A", to: "Categoria:X" }],
        pages: [{ pageid: 7, ns: 14, title: "Categoria:X" }],
      },
    }),
  );
  assert.equal(await client.resolveTitle("A"), null);
});

test("unrelated and cyclic redirect mappings fail closed", async () => {
  for (const redirects of [
    [{ from: "Unrelated", to: "C" }],
    [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ],
  ]) {
    const client = makeClient(() =>
      jsonResponse(200, {
        query: {
          redirects,
          pages: [{ pageid: 7, ns: 0, title: "C" }],
        },
      }),
    );
    await assert.rejects(() => client.resolveTitle("A"), WikipediaError);
  }
});

test("resolution rejects multi-title injection before any HTTP request", async () => {
  const client = makeClient(() => {
    assert.fail("must not request multiple titles");
  });
  await assert.rejects(() => client.resolveTitle("A|B"), WikipediaError);
});

test("HTTP 429 retries stop after three attempts with bounded backoff", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let requests = 0;
  const client = makeClient(() => {
    requests++;
    return jsonResponse(429, {});
  });
  const result = assert.rejects(() => client.resolveTitle("A"), /HTTP 429/);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(requests, 1);
  t.mock.timers.tick(1000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(requests, 2);
  t.mock.timers.tick(2000);
  await result;
  assert.equal(requests, 3);
});

test("HTTP 429 respects numeric and HTTP-date Retry-After", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  for (const retryAfter of ["3", "Thu, 01 Jan 1970 00:00:03 GMT"]) {
    t.mock.timers.setTime(0);
    let requests = 0;
    const client = makeClient(() => {
      requests++;
      return requests === 1
        ? new Response("", {
            status: 429,
            headers: { "Retry-After": retryAfter },
          })
        : jsonResponse(200, {
            query: { pages: [{ pageid: 7, ns: 0, title: "A" }] },
          });
    });
    const result = client.resolveTitle("A");
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(2999);
    assert.equal(requests, 1);
    t.mock.timers.tick(1);
    assert.deepEqual(await result, { pageId: 7, title: "A" });
    assert.equal(requests, 2);
  }
});

test("a long Retry-After fails without retrying prematurely", async () => {
  let requests = 0;
  const client = makeClient(() => {
    requests++;
    return new Response("", { status: 429, headers: { "Retry-After": "120" } });
  });
  await assert.rejects(() => client.resolveTitle("A"), /HTTP 429/);
  assert.equal(requests, 1);
});
