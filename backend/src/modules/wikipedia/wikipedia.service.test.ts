import assert from "node:assert/strict";
import { test } from "node:test";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../config/game.js";
import { MediaWikiClient } from "./mediawiki.client.js";
import { WikipediaService } from "./wikipedia.service.js";
import { WikipediaError } from "./wikipedia.errors.js";

function fixture(
  options: {
    html?: string;
    info?: (id: number) => Record<string, unknown>;
    random?: () => unknown[];
    resolution?: (title: string) => unknown;
  } = {},
) {
  const requests: URLSearchParams[] = [];
  const client = new MediaWikiClient({
    fetch: (async (url: string | URL | Request) => {
      const params = new URL(String(url)).searchParams;
      requests.push(params);
      let body: unknown;
      if (params.get("list") === "random") {
        body = {
          query: {
            random: options.random?.() ?? [{ id: 1, ns: 0, title: "Start" }],
          },
        };
      } else if (params.get("prop") === "info") {
        const id = Number(params.get("pageids"));
        body = {
          query: {
            pages: [
              options.info?.(id) ?? {
                pageid: id,
                ns: 0,
                title: "Start",
                length: 1000,
              },
            ],
          },
        };
      } else if (params.get("action") === "parse") {
        body = {
          parse: {
            pageid: Number(params.get("pageid")),
            title: "Start",
            text:
              options.html ??
              '<p><a href="/wiki/Unina">Unina</a><a href="/wiki/Napoli">Napoli</a></p>',
          },
        };
      } else if (params.has("titles")) {
        const title = params.get("titles")!;
        body = options.resolution?.(title) ?? {
          query: {
            redirects:
              title === "Unina" ? [{ from: title, to: TARGET_PAGE_TITLE }] : [],
            pages: [
              {
                pageid: title === "Unina" ? TARGET_PAGE_ID : 2,
                ns: 0,
                title: title === "Unina" ? TARGET_PAGE_TITLE : title,
              },
            ],
          },
        };
      } else {
        assert.fail("Unexpected MediaWiki request: " + params);
      }
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch,
  });
  return { service: new WikipediaService({ client }), requests };
}

test("article loading uses two requests and returns source titles without eager resolution", async () => {
  const { service, requests } = fixture();
  const article = await service.getArticle(1);
  assert.equal(article.pageId, 1);
  assert.equal(article.title, "Start");
  assert.deepEqual(article.links, [{ title: "Unina" }, { title: "Napoli" }]);
  assert.match(article.contentHtml, /data-page-title="Unina"/);
  assert.doesNotMatch(article.contentHtml, /href=|data-page-id/);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].get("prop"), "info");
  assert.equal(requests[1].get("prop"), "text");
});

test("a 6000-link article is complete in two requests without continuation", async () => {
  const html = Array.from(
    { length: 6000 },
    (_, i) => '<a href="/wiki/Title_' + i + '">link</a>',
  ).join("");
  const { service, requests } = fixture({ html });
  const article = await service.getArticle(1);
  assert.equal(article.links.length, 6000);
  assert.deepEqual(article.links[5999], { title: "Title 5999" });
  assert.equal(requests.length, 2);
  assert.equal(
    requests.some(
      (p) => p.has("generator") || p.has("titles") || p.has("gplcontinue"),
    ),
    false,
  );
});

test("a warm move resolves only the clicked redirect and returns its canonical identity", async () => {
  const { service, requests } = fixture();
  await service.getArticle(1);
  requests.length = 0;
  assert.deepEqual(await service.resolveNavigation(1, "unina"), {
    pageId: TARGET_PAGE_ID,
    title: TARGET_PAGE_TITLE,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].get("titles"), "Unina");
  assert.equal(requests[0].get("redirects"), "1");
});

test("a cold move needs at most three requests and works without a cache entry", async () => {
  const { service, requests } = fixture();
  assert.deepEqual(await service.resolveNavigation(1, "Napoli"), {
    pageId: 2,
    title: "Napoli",
  });
  assert.equal(requests.length, 3);
});

test("forged canonical titles cannot bypass validation of the actual clicked alias", async () => {
  const { service, requests } = fixture();
  assert.equal(await service.resolveNavigation(1, TARGET_PAGE_TITLE), null);
  assert.equal(requests.length, 2);
  assert.equal(
    requests.some((p) => p.has("titles")),
    false,
  );
});

test("external, namespace and citation-only destinations are not resolved", async () => {
  const { service, requests } = fixture({
    html: '<a href="https://example.com">External</a><a href="/wiki/Categoria:X">X</a><cite><a href="/wiki/Book">Book</a></cite><a href="/wiki/Normal">N</a>',
  });
  for (const title of ["External", "Categoria:X", "Book", "Forged"]) {
    assert.equal(await service.resolveNavigation(1, title), null);
  }
  assert.equal(requests.length, 2);
});

test("missing and non-main-namespace selected destinations are rejected", async () => {
  for (const page of [
    { ns: 0, title: "Napoli", missing: true },
    { pageid: 7, ns: 14, title: "Categoria:X" },
  ]) {
    const { service } = fixture({
      resolution: () => ({ query: { pages: [page] } }),
    });
    assert.equal(await service.resolveNavigation(1, "Napoli"), null);
  }
});

test("the selected title's latest canonical ID is used without caching resolutions", async () => {
  let id = 2;
  const { service, requests } = fixture({
    resolution: (title) => ({
      query: { pages: [{ pageid: id++, ns: 0, title }] },
    }),
  });
  assert.equal((await service.resolveNavigation(1, "Napoli"))?.pageId, 2);
  assert.equal((await service.resolveNavigation(1, "Napoli"))?.pageId, 3);
  assert.equal(requests.length, 4);
});

test("concurrent/repeated article calls share one load and cannot mutate cached links", async () => {
  const { service, requests } = fixture();
  const [a, b] = await Promise.all([
    service.getArticle(1),
    service.getArticle(1),
  ]);
  a.links.push({ title: "Forged" });
  assert.equal(b.links.length, 2);
  assert.equal(await service.resolveNavigation(1, "Forged"), null);
  assert.equal(requests.length, 2);
});

test("article TTL expiry refetches and validates the fresh link set", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const { service, requests } = fixture();
  await service.getArticle(1);
  t.mock.timers.setTime(60_001);
  await service.getArticle(1);
  assert.equal(requests.length, 4);
});

test("article cache evicts least recently used entries after 32 pages", async () => {
  const { service, requests } = fixture();
  for (let id = 1; id <= 32; id++) await service.getArticle(id);
  await service.getArticle(1);
  await service.getArticle(33);
  await service.getArticle(1);
  assert.equal(requests.length, 66);
  await service.getArticle(2);
  assert.equal(requests.length, 68);
});

test("failed article loads are not cached", async () => {
  let first = true;
  const { service, requests } = fixture({
    info: (id) => {
      if (first) {
        first = false;
        return { pageid: id, ns: 14, title: "Bad" };
      }
      return { pageid: id, ns: 0, title: "Start", length: 1000 };
    },
  });
  await assert.rejects(() => service.getArticle(1), WikipediaError);
  assert.equal((await service.getArticle(1)).pageId, 1);
  assert.equal(requests.length, 3);
});

const eligibleHtml = ["A", "B", "C", "D", "E"]
  .map((title) => '<a href="/wiki/' + title + '">' + title + "</a>")
  .join("");

test("random selection uses three requests and reuses the accepted article", async () => {
  const { service, requests } = fixture({ html: eligibleHtml });
  assert.deepEqual(await service.getRandomStartingPage(), {
    pageId: 1,
    title: "Start",
  });
  assert.equal(requests.length, 3);
  await service.getArticle(1);
  assert.equal(requests.length, 3);
});

test("random selection rejects target, redirects, short and missing lengths before parsing", async () => {
  let attempt = 0;
  const ids = [TARGET_PAGE_ID, 2, 3, 4, 5];
  const { service, requests } = fixture({
    html: eligibleHtml,
    random: () => [{ id: ids[attempt++], ns: 0, title: "Start" }],
    info: (id) => ({
      pageid: id,
      ns: 0,
      title: "Start",
      length: id === 3 ? 499 : id === 4 ? undefined : 500,
      redirect: id === 2,
    }),
  });
  assert.equal((await service.getRandomStartingPage()).pageId, 5);
  assert.equal(requests.filter((p) => p.get("action") === "parse").length, 1);
  assert.equal(
    requests.some((p) => p.has("titles")),
    false,
  );
});

test("random selection rejects malformed candidates and empty random results", async () => {
  let attempt = 0;
  const candidates = [
    [],
    [{ id: 1, ns: 14, title: "Categoria:X" }],
    [{ id: -1, ns: 0, title: "X" }],
    [{ id: 1, ns: 0, title: "" }],
    [{ id: 1, ns: 0, title: "Start" }],
  ];
  const { service } = fixture({
    html: eligibleHtml,
    random: () => candidates[attempt++],
  });
  assert.equal((await service.getRandomStartingPage()).pageId, 1);
  assert.equal(attempt, 5);
});

test("random attempts remain bounded and bibliography links do not satisfy eligibility", async () => {
  let id = 0;
  const { service, requests } = fixture({
    html: "<h2>Bibliografia</h2>" + eligibleHtml,
    random: () => [{ id: ++id, ns: 0, title: "Start" }],
  });
  await assert.rejects(
    () => service.getRandomStartingPage(),
    (error: unknown) =>
      error instanceof WikipediaError &&
      error.kind === "NO_SUITABLE_STARTING_PAGE",
  );
  assert.equal(requests.filter((p) => p.get("list") === "random").length, 10);
  assert.equal(requests.length, 30);
});

test("repeated random candidates do not cause repeated article retrieval", async () => {
  const { service, requests } = fixture({ html: "<p>No playable links</p>" });
  await assert.rejects(() => service.getRandomStartingPage(), WikipediaError);
  assert.equal(requests.filter((p) => p.get("list") === "random").length, 10);
  assert.equal(requests.filter((p) => p.get("action") === "parse").length, 1);
  assert.equal(requests.length, 12);
});

test("random selection does not retry upstream failures as new random attempts", async () => {
  const { service, requests } = fixture({
    info: () => ({ ns: 0, title: "Gone", missing: true }),
  });
  await assert.rejects(() => service.getRandomStartingPage(), WikipediaError);
  assert.equal(requests.length, 2);
});
