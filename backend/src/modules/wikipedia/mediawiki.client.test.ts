import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_LINK_CONTINUATION_REQUESTS,
  MAX_REDIRECT_RESOLUTION_CONCURRENCY,
  MediaWikiClient,
} from "./mediawiki.client.js";
import { WikipediaError } from "./wikipedia.errors.js";

interface CapturedRequest {
  url: string;
  init?: RequestInit;
}

type Responder = (captured: CapturedRequest) => Response | Promise<Response>;

function makeClient(respond: Responder): MediaWikiClient {
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
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

test("getArticleLinks resolves page identity and eligible link targets", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, {
        query: {
          pages: [
            { pageid: 1, ns: 0, title: "Existing" },
            { ns: 0, title: "Red link", missing: true },
            { pageid: 3, ns: 0, title: "Another" },
          ],
        },
      });
    }

    return jsonResponse(200, {
      query: {
        pages: [{ pageid: 200, ns: 0, title: "Current", length: 9999 }],
      },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.equal(result.pageId, 200);
  assert.equal(result.title, "Current");
  assert.equal(result.length, 9999);
  assert.deepEqual(result.links, [
    { ns: 0, title: "Existing", pageid: 1 },
    { ns: 0, title: "Another", pageid: 3 },
  ]);
});

test("getArticleLinks throws PAGE_NOT_FOUND for a missing page", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ ns: 0, title: "Gone", missing: true }] },
    });
  });

  await assert.rejects(
    () => client.getArticleLinks(999),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "PAGE_NOT_FOUND",
  );
});

test("getArticleLinks rejects linked pages with invalid page IDs", async () => {
  for (const pageid of [0, -1, 1.5, "123", null, undefined]) {
    const client = makeClient((req) => {
      if (req.url.includes("generator=links")) {
        return jsonResponse(200, {
          query: { pages: [{ pageid, ns: 0, title: "Bad" }] },
        });
      }

      return jsonResponse(200, {
        query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
      });
    });

    await assert.rejects(
      () => client.getArticleLinks(200),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected pageid ${JSON.stringify(pageid)} to be rejected`,
    );
  }
});

test("getArticleLinks accepts a valid positive-integer linked page ID", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, {
        query: { pages: [{ pageid: 123, ns: 0, title: "Napoli" }] },
      });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.deepEqual(result.links, [{ ns: 0, title: "Napoli", pageid: 123 }]);
});

test("getArticleLinks skips linked pages without an explicit namespace 0", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, {
        query: {
          pages: [
            { pageid: 1, ns: 0, title: "Main" },
            { pageid: 2, title: "Missing ns" },
            { pageid: 3, ns: null, title: "Null ns" },
            { pageid: 4, ns: "0", title: "String ns" },
            { pageid: 5, ns: 1.5, title: "Fractional ns" },
            { pageid: 6, ns: 1, title: "Talk ns" },
            { pageid: 7, ns: 14, title: "Category ns" },
          ],
        },
      });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.deepEqual(result.links, [{ ns: 0, title: "Main", pageid: 1 }]);
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

function continuationResponse(
  pages: Array<Record<string, unknown>>,
  gplcontinue?: string,
): Response {
  const body: Record<string, unknown> = { query: { pages } };
  if (gplcontinue !== undefined) {
    body.continue = { gplcontinue, continue: "-||" };
  }
  return jsonResponse(200, body);
}

test("link fetch without continuation performs a single generator request", async () => {
  let generatorRequests = 0;
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      generatorRequests += 1;
      return continuationResponse([{ pageid: 1, ns: 0, title: "A" }]);
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.equal(generatorRequests, 1);
  assert.deepEqual(result.links, [{ ns: 0, title: "A", pageid: 1 }]);
});

test("link fetch accumulates pages across continuation responses", async () => {
  const batches = [
    { pages: [{ pageid: 1, ns: 0, title: "A" }, { pageid: 2, ns: 0, title: "B" }], next: "TOKEN_1" },
    { pages: [{ pageid: 3, ns: 0, title: "C" }, { pageid: 4, ns: 0, title: "D" }], next: "TOKEN_2" },
    { pages: [{ pageid: 5, ns: 0, title: "E" }] },
  ];
  let gen = 0;
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      const batch = batches[gen];
      gen += 1;
      return continuationResponse(batch.pages, batch.next);
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.deepEqual(
    result.links.map((link) => link.title),
    ["A", "B", "C", "D", "E"],
  );
});

test("continuation parameters are forwarded to subsequent requests", async () => {
  const generatorUrls: string[] = [];
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      generatorUrls.push(req.url);
      if (generatorUrls.length === 1) {
        return continuationResponse(
          [{ pageid: 1, ns: 0, title: "A" }],
          "TOKEN_1",
        );
      }
      return continuationResponse([{ pageid: 2, ns: 0, title: "B" }]);
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  await client.getArticleLinks(200);

  assert.equal(generatorUrls.length, 2);
  const second = new URL(generatorUrls[1]);
  assert.equal(second.searchParams.get("gplcontinue"), "TOKEN_1");
  assert.equal(second.searchParams.get("continue"), "-||");
});

test("duplicate linked pages across continuation responses are returned once", async () => {
  const batches = [
    { pages: [{ pageid: 1, ns: 0, title: "A" }, { pageid: 2, ns: 0, title: "B" }], next: "T1" },
    { pages: [{ pageid: 2, ns: 0, title: "B" }, { pageid: 3, ns: 0, title: "C" }] },
  ];
  let gen = 0;
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      const batch = batches[gen];
      gen += 1;
      return continuationResponse(batch.pages, batch.next);
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.deepEqual(
    result.links.map((link) => link.pageid),
    [1, 2, 3],
  );
});

test("link continuation is bounded and fails on excessive continuation", async () => {
  let generatorRequests = 0;
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      generatorRequests += 1;
      return continuationResponse(
        [{ pageid: 1, ns: 0, title: "A" }],
        "NEVER_ENDING",
      );
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  await assert.rejects(
    () => client.getArticleLinks(200),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );

  assert.equal(generatorRequests, MAX_LINK_CONTINUATION_REQUESTS);
});

test("malformed continuation data fails cleanly", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, {
        query: { pages: [{ pageid: 1, ns: 0, title: "A" }] },
        continue: { foo: "bar" },
      });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  await assert.rejects(
    () => client.getArticleLinks(200),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
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
  const client = makeClient(
    () => new Response("not json", { status: 200 }),
  );

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

test("getArticleLinks rejects an info page without a main namespace", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, title: "Current" }] },
    });
  });

  await assert.rejects(
    () => client.getArticleLinks(200),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("getArticleLinks rejects an info page with a non-main namespace", async () => {
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
      () => client.getArticleLinks(200),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected ns ${JSON.stringify(ns)} to be rejected`,
    );
  }
});

test("getArticleLinks accepts an info response matching the requested page", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 123, ns: 0, title: "Requested", length: 500 }] },
    });
  });

  const result = await client.getArticleLinks(123);

  assert.equal(result.pageId, 123);
  assert.equal(result.title, "Requested");
  assert.equal(result.length, 500);
});

test("getArticleLinks rejects an info response for a different page", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 456, ns: 0, title: "Other" }] },
    });
  });

  await assert.rejects(
    () => client.getArticleLinks(123),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("getArticleLinks rejects malformed article lengths", async () => {
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
      () => client.getArticleLinks(200),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected length ${String(length)} to be rejected`,
    );
  }
});

test("getArticleLinks accepts zero and missing article lengths", async () => {
  const zero = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current", length: 0 }] },
    });
  });

  const zeroResult = await zero.getArticleLinks(200);
  assert.equal(zeroResult.length, 0);

  const missing = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const missingResult = await missing.getArticleLinks(200);
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
  for (const ns of [undefined, 1, 14, null, "0", 1.5]) {
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

test("link fetch rejects a response missing query", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, {});
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  await assert.rejects(
    () => client.getArticleLinks(200),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("link fetch rejects malformed query.pages structures", async () => {
  const malformedPages: unknown[] = [
    undefined,
    null,
    {},
    [null],
    [1, "a", true],
  ];

  for (const pages of malformedPages) {
    const client = makeClient((req) => {
      if (req.url.includes("generator=links")) {
        return jsonResponse(200, { query: { pages } });
      }

      return jsonResponse(200, {
        query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
      });
    });

    await assert.rejects(
      () => client.getArticleLinks(200),
      (error: unknown) =>
        error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
      `expected pages ${JSON.stringify(pages)} to be rejected`,
    );
  }
});

test("link fetch accepts an empty pages array", async () => {
  const client = makeClient((req) => {
    if (req.url.includes("generator=links")) {
      return jsonResponse(200, { query: { pages: [] } });
    }

    return jsonResponse(200, {
      query: { pages: [{ pageid: 200, ns: 0, title: "Current" }] },
    });
  });

  const result = await client.getArticleLinks(200);

  assert.deepEqual(result.links, []);
});

test("resolveTitles resolves redirects to canonical identities in a batch", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [
          { from: "Unina", to: "Università degli Studi di Napoli Federico II" },
        ],
        pages: [
          { pageid: 2930935, ns: 0, title: "Università degli Studi di Napoli Federico II" },
          { pageid: 100, ns: 0, title: "Napoli" },
        ],
      },
    }),
  );

  const result = await client.resolveTitles([
    { pageId: 487631, title: "Unina" },
    { pageId: 100, title: "Napoli" },
  ]);

  assert.deepEqual(
    result,
    new Map([
      [
        "Unina",
        {
          kind: "REDIRECT",
          canonical: { pageId: 2930935, title: "Università degli Studi di Napoli Federico II" },
        },
      ],
      ["Napoli", { kind: "DIRECT", canonical: { pageId: 100, title: "Napoli" } }],
    ]),
  );
});

test("resolveTitles marks missing pages as UNRESOLVED", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        pages: [
          { pageid: 100, ns: 0, title: "Napoli" },
          { ns: 0, title: "Missing", missing: true },
        ],
      },
    }),
  );

  const result = await client.resolveTitles([
    { pageId: 100, title: "Napoli" },
    { pageId: 0, title: "Missing" },
  ]);

  assert.deepEqual(
    result,
    new Map([
      ["Napoli", { kind: "DIRECT", canonical: { pageId: 100, title: "Napoli" } }],
      ["Missing", { kind: "UNRESOLVED" }],
    ]),
  );
});

test("resolveTitles follows redirect chains", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [
          { from: "A", to: "B" },
          { from: "B", to: "C" },
        ],
        pages: [{ pageid: 7, ns: 0, title: "C" }],
      },
    }),
  );

  const result = await client.resolveTitles([{ pageId: 1, title: "A" }]);

  assert.deepEqual(
    result,
    new Map([["A", { kind: "REDIRECT", canonical: { pageId: 7, title: "C" } }]]),
  );
});

test("resolveTitles marks a redirect to a missing target as UNRESOLVED", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [{ from: "Unina", to: "Gone" }],
        pages: [{ ns: 0, title: "Gone", missing: true }],
      },
    }),
  );

  const result = await client.resolveTitles([{ pageId: 487631, title: "Unina" }]);

  assert.deepEqual(result, new Map([["Unina", { kind: "UNRESOLVED" }]]));
});

test("resolveTitles marks a redirect to a non-main namespace as UNRESOLVED", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [{ from: "Unina", to: "Categoria:Napoli" }],
        pages: [{ pageid: 42, ns: 14, title: "Categoria:Napoli" }],
      },
    }),
  );

  const result = await client.resolveTitles([{ pageId: 487631, title: "Unina" }]);

  assert.deepEqual(result, new Map([["Unina", { kind: "UNRESOLVED" }]]));
});

test("resolveTitles marks a redirect without a trustworthy canonical target as UNRESOLVED", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: {
        redirects: [{ from: "Unina", to: "Elsewhere" }],
        pages: [],
      },
    }),
  );

  const result = await client.resolveTitles([{ pageId: 487631, title: "Unina" }]);

  assert.deepEqual(result, new Map([["Unina", { kind: "UNRESOLVED" }]]));
});

test("resolveTitles rejects malformed redirects data", async () => {
  const client = makeClient(() =>
    jsonResponse(200, {
      query: { redirects: "not-an-array", pages: [] },
    }),
  );

  await assert.rejects(
    () => client.resolveTitles([{ pageId: 1, title: "A" }]),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});

test("resolveTitles chunks requests above the per-request limit", async () => {
  let requests = 0;
  const client = makeClient((req) => {
    requests += 1;
    const url = new URL(req.url);
    const titles = (url.searchParams.get("titles") ?? "").split("|");
    const pages = titles.map((title, index) => ({
      pageid: index + 1,
      ns: 0,
      title,
    }));
    return jsonResponse(200, { query: { pages } });
  });

  const sources = Array.from({ length: 120 }, (_, i) => ({
    pageId: 1000 + i,
    title: `Title${i}`,
  }));
  const result = await client.resolveTitles(sources);

  assert.equal(requests, 3);
  assert.equal(result.size, 120);
  assert.deepEqual(result.get("Title0"), {
    kind: "DIRECT",
    canonical: { pageId: 1, title: "Title0" },
  });
  assert.deepEqual(result.get("Title119"), {
    kind: "DIRECT",
    canonical: { pageId: 20, title: "Title119" },
  });
});

test("resolveTitles bounds concurrent resolution requests", async () => {
  let active = 0;
  let maxActive = 0;
  let requests = 0;

  const client = makeClient(async (req) => {
    requests += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setImmediate(resolve));
    const url = new URL(req.url);
    const titles = (url.searchParams.get("titles") ?? "").split("|");
    const pages = titles.map((title, index) => ({
      pageid: index + 1,
      ns: 0,
      title,
    }));
    active -= 1;
    return jsonResponse(200, { query: { pages } });
  });

  const sources = Array.from({ length: 400 }, (_, i) => ({
    pageId: 1000 + i,
    title: `Title${i}`,
  }));
  const result = await client.resolveTitles(sources);

  assert.equal(requests, 8);
  assert.equal(result.size, 400);
  assert.ok(
    maxActive <= MAX_REDIRECT_RESOLUTION_CONCURRENCY,
    `observed concurrency ${maxActive} exceeded limit ${MAX_REDIRECT_RESOLUTION_CONCURRENCY}`,
  );
  assert.ok(maxActive > 1, "resolution should proceed concurrently, not strictly serially");
});

test("resolveTitles rejects a malformed response", async () => {
  const client = makeClient(() => jsonResponse(200, {}));

  await assert.rejects(
    () => client.resolveTitles([{ pageId: 1, title: "A" }]),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "INVALID_RESPONSE",
  );
});
