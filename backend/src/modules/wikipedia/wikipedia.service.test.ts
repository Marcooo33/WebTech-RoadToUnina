import assert from "node:assert/strict";
import { test } from "node:test";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../config/game.js";
import { ArticleParserService } from "./article-parser.service.js";
import { MediaWikiClient } from "./mediawiki.client.js";
import { WikipediaError } from "./wikipedia.errors.js";
import {
  DEFAULT_STARTING_PAGE_FILTER,
  WikipediaService,
} from "./wikipedia.service.js";
import type {
  MediaWikiArticleLinks,
  MediaWikiRandomItem,
  TitleResolution,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

interface FakeClientMethods {
  getRandomArticles?: (limit: number) => Promise<MediaWikiRandomItem[]>;
  getArticleLinks?: (pageId: number) => Promise<MediaWikiArticleLinks>;
  getArticleHtml?: (
    pageId: number,
  ) => Promise<{ pageId: number; title: string; html: string }>;
  resolveTitle?: (title: string) => Promise<WikipediaPageIdentity | null>;
  resolveTitles?: (
    titles: string[],
  ) => Promise<Map<string, TitleResolution>>;
}

function makeFakeClient(methods: FakeClientMethods): MediaWikiClient {
  const getArticleLinks = methods.getArticleLinks;

  // By default the fake article HTML contains every raw link as a plain body
  // link, so link-level filtering and canonical resolution are exercised
  // without any contextual (citation/bibliography) exclusions unless a test
  // supplies its own getArticleHtml.
  const defaultArticleHtml = async (pageId: number) => {
    const links = getArticleLinks ? (await getArticleLinks(pageId)).links : [];
    const html = `<p>${links
      .map((link) => `<a href="/wiki/${link.title}">${link.title}</a>`)
      .join("")}</p>`;
    return { pageId, title: "P", html };
  };

  return {
    resolveTitles: async (titles: string[]) =>
      new Map(titles.map((title) => [title, { kind: "DIRECT" } as TitleResolution])),
    getArticleHtml: defaultArticleHtml,
    ...methods,
  } as unknown as MediaWikiClient;
}

function linksFor(
  pageId: number,
  title: string,
  links: MediaWikiArticleLinks["links"],
  length?: unknown,
): MediaWikiArticleLinks {
  return { pageId, title, length: length as number | undefined, links };
}

function eligibleLinks(): MediaWikiArticleLinks["links"] {
  return [
    { ns: 0, title: "A", pageid: 1 },
    { ns: 0, title: "B", pageid: 2 },
    { ns: 0, title: "C", pageid: 3 },
    { ns: 0, title: "D", pageid: 4 },
    { ns: 0, title: "E", pageid: 5 },
    { ns: 0, title: "F", pageid: 6 },
  ];
}

test("getArticle returns a normalized article with controlled playable links", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "Start",
      html: '<p><a href="/wiki/Target_Page">go</a> and <a href="https://evil.example.com">no</a></p>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "Start", [{ ns: 0, title: "Target Page", pageid: 42 }]),
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.equal(article.pageId, 1);
  assert.equal(article.title, "Start");
  assert.deepEqual(article.links, [{ pageId: 42, title: "Target Page" }]);
  assert.match(article.contentHtml, /data-page-id="42"/);
  assert.doesNotMatch(article.contentHtml, /evil.example.com/);
});

test("getValidInternalLinks excludes red links and non-main-namespace links", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "Article", pageid: 1 },
        { ns: 0, title: "Red link" },
        { ns: 14, title: "Categoria:Cat", pageid: 3 },
        { ns: 1, title: "Discussione:P", pageid: 4 },
      ]),
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [{ pageId: 1, title: "Article" }]);
});

test("getValidInternalLinks filters out linked pages with invalid page IDs", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "Napoli", pageid: 123 },
        { ns: 0, title: "Invalid Zero", pageid: 0 },
        { ns: 0, title: "Invalid Negative", pageid: -10 },
        { ns: 0, title: "Invalid Fraction", pageid: 2.5 },
      ]),
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [{ pageId: 123, title: "Napoli" }]);
});

test("getValidInternalLinks rejects a NaN namespace", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "Napoli", pageid: 123 },
        { ns: Number.NaN, title: "NaN ns", pageid: 124 },
      ]),
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [{ pageId: 123, title: "Napoli" }]);
});

test("isValidNavigation reflects membership in the source eligible links", async () => {
  const client = makeFakeClient({
    getArticleLinks: async () =>
      linksFor(1, "P", [{ ns: 0, title: "Target", pageid: 99 }]),
  });
  const service = new WikipediaService({ client });

  assert.equal(await service.isValidNavigation(1, 99), true);
  assert.equal(await service.isValidNavigation(1, 123), false);
});

test("getRandomStartingPage returns the first suitable candidate", async () => {
  const client = makeFakeClient({
    getRandomArticles: async () => [{ id: 10, ns: 0, title: "Good" }],
    getArticleLinks: async (pageId) =>
      linksFor(
        pageId,
        "Good",
        [
          { ns: 0, title: "A", pageid: 1 },
          { ns: 0, title: "B", pageid: 2 },
          { ns: 0, title: "C", pageid: 3 },
          { ns: 0, title: "D", pageid: 4 },
          { ns: 0, title: "E", pageid: 5 },
          { ns: 0, title: "F", pageid: 6 },
        ],
        2000,
      ),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 10, title: "Good" });
});

test("getRandomStartingPage skips a candidate with too few eligible links", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 1, ns: 0, title: "Too few" }],
    [{ id: 2, ns: 0, title: "Enough" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      pageId === 1
        ? linksFor(1, "Too few", [{ ns: 0, title: "Only", pageid: 1 }], 1000)
        : linksFor(
            2,
            "Enough",
            [
              { ns: 0, title: "A", pageid: 1 },
              { ns: 0, title: "B", pageid: 2 },
              { ns: 0, title: "C", pageid: 3 },
              { ns: 0, title: "D", pageid: 4 },
              { ns: 0, title: "E", pageid: 5 },
            ],
            1000,
          ),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 2, title: "Enough" });
});

test("getRandomStartingPage skips a candidate that is too small", async () => {
  const client = makeFakeClient({
    getRandomArticles: async () => [{ id: 9, ns: 0, title: "Stub" }],
    getArticleLinks: async (pageId) =>
      linksFor(
        pageId,
        "Stub",
        [
          { ns: 0, title: "A", pageid: 1 },
          { ns: 0, title: "B", pageid: 2 },
          { ns: 0, title: "C", pageid: 3 },
          { ns: 0, title: "D", pageid: 4 },
          { ns: 0, title: "E", pageid: 5 },
        ],
        120,
      ),
  });
  const service = new WikipediaService({ client });

  await assert.rejects(
    () => service.getRandomStartingPage(),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "NO_SUITABLE_STARTING_PAGE",
  );
});

test("getRandomStartingPage retries are bounded", async () => {
  let calls = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => {
      calls += 1;
      return [{ id: calls, ns: 0, title: `Bad ${calls}` }];
    },
    getArticleLinks: async (pageId) =>
      linksFor(pageId, `Bad ${pageId}`, [{ ns: 0, title: "X", pageid: pageId }], 1000),
  });
  const service = new WikipediaService({ client });

  await assert.rejects(
    () => service.getRandomStartingPage(),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "NO_SUITABLE_STARTING_PAGE",
  );

  assert.equal(calls, 10);
});

test("getRandomStartingPage ignores an empty random result", async () => {
  const results: MediaWikiRandomItem[][] = [[], [{ id: 5, ns: 0, title: "Ok" }]];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => results[call++] ?? [],
    getArticleLinks: async (pageId) =>
      linksFor(
        pageId,
        "Ok",
        [
          { ns: 0, title: "A", pageid: 1 },
          { ns: 0, title: "B", pageid: 2 },
          { ns: 0, title: "C", pageid: 3 },
          { ns: 0, title: "D", pageid: 4 },
          { ns: 0, title: "E", pageid: 5 },
        ],
        1500,
      ),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 5, title: "Ok" });
});

test("getRandomStartingPage rejects non-main-namespace candidates", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 123, ns: 14, title: "Categoria:Napoli" }],
    [{ id: 123, ns: 1, title: "Discussione:Napoli" }],
    [{ id: 456, ns: 0, title: "Napoli" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      linksFor(
        pageId,
        "Napoli",
        [
          { ns: 0, title: "A", pageid: 1 },
          { ns: 0, title: "B", pageid: 2 },
          { ns: 0, title: "C", pageid: 3 },
          { ns: 0, title: "D", pageid: 4 },
          { ns: 0, title: "E", pageid: 5 },
        ],
        1000,
      ),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 456, title: "Napoli" });
});

test("getRandomStartingPage rejects invalid page IDs", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    { id: 0, ns: 0, title: "Bad" },
    { id: -1, ns: 0, title: "Bad" },
    { id: 1.5, ns: 0, title: "Bad" },
    { id: Number.NaN, ns: 0, title: "Bad" },
    { id: 777, ns: 0, title: "Valid" },
  ].map((candidate) => [candidate]);
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      linksFor(
        pageId,
        "Valid",
        [
          { ns: 0, title: "A", pageid: 1 },
          { ns: 0, title: "B", pageid: 2 },
          { ns: 0, title: "C", pageid: 3 },
          { ns: 0, title: "D", pageid: 4 },
          { ns: 0, title: "E", pageid: 5 },
        ],
        1000,
      ),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 777, title: "Valid" });
});

test("getRandomStartingPage retries stay bounded when all candidates are invalid", async () => {
  let calls = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => {
      calls += 1;
      return [{ id: calls, ns: 14, title: `Categoria:${calls}` }];
    },
    getArticleLinks: async () =>
      linksFor(1, "Never", [{ ns: 0, title: "X", pageid: 1 }], 1000),
  });
  const service = new WikipediaService({ client });

  await assert.rejects(
    () => service.getRandomStartingPage(),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "NO_SUITABLE_STARTING_PAGE",
  );

  assert.equal(calls, 10);
});

test("getRandomStartingPage rejects a candidate with missing length", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 1, ns: 0, title: "No length" }],
    [{ id: 2, ns: 0, title: "Has length" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      pageId === 1
        ? linksFor(1, "No length", eligibleLinks())
        : linksFor(2, "Has length", eligibleLinks(), 2000),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 2, title: "Has length" });
});

test("getRandomStartingPage rejects malformed article lengths", async () => {
  for (const badLength of [null, "5000", Number.NaN, Number.POSITIVE_INFINITY]) {
    const attempts: MediaWikiRandomItem[][] = [
      [{ id: 1, ns: 0, title: "Bad" }],
      [{ id: 2, ns: 0, title: "Good" }],
    ];
    let call = 0;
    const client = makeFakeClient({
      getRandomArticles: async () => attempts[call++] ?? [],
      getArticleLinks: async (pageId) =>
        pageId === 1
          ? linksFor(1, "Bad", eligibleLinks(), badLength)
          : linksFor(2, "Good", eligibleLinks(), 2000),
    });
    const service = new WikipediaService({ client });

    const page = await service.getRandomStartingPage();

    assert.deepEqual(
      page,
      { pageId: 2, title: "Good" },
      `expected malformed length ${String(badLength)} to be rejected`,
    );
  }
});

test("getRandomStartingPage rejects below-minimum length and accepts the minimum", async () => {
  const min = DEFAULT_STARTING_PAGE_FILTER.minArticleLengthBytes;
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 1, ns: 0, title: "Too small" }],
    [{ id: 2, ns: 0, title: "At min" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      pageId === 1
        ? linksFor(1, "Too small", eligibleLinks(), min - 1)
        : linksFor(2, "At min", eligibleLinks(), min),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 2, title: "At min" });
});

test("getRandomStartingPage retries stay bounded when all lengths are invalid", async () => {
  let calls = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => {
      calls += 1;
      return [{ id: calls, ns: 0, title: `Missing ${calls}` }];
    },
    getArticleLinks: async () => linksFor(1, "Missing", eligibleLinks()),
  });
  const service = new WikipediaService({ client });

  await assert.rejects(
    () => service.getRandomStartingPage(),
    (error: unknown) =>
      error instanceof WikipediaError && error.kind === "NO_SUITABLE_STARTING_PAGE",
  );

  assert.equal(calls, 10);
});

test("resolvePage delegates title resolution to the client", async () => {
  const client = makeFakeClient({
    resolveTitle: async (title) =>
      title === "Nope" ? null : { pageId: 42, title: "Resolved" },
  });
  const service = new WikipediaService({ client });

  assert.deepEqual(await service.resolvePage("Anything"), {
    pageId: 42,
    title: "Resolved",
  });
  assert.equal(await service.resolvePage("Nope"), null);
});

test("getArticle uses the real parser by default", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p><a href="/wiki/A">a</a></p>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [{ ns: 0, title: "A", pageid: 1 }]),
  });
  const service = new WikipediaService({ client, parser: new ArticleParserService() });

  const article = await service.getArticle(1);

  assert.match(article.contentHtml, /data-page-id="1"/);
  assert.deepEqual(article.links, [{ pageId: 1, title: "A" }]);
});

test("getValidInternalLinks filters and normalizes malformed link titles", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "  Trimmed  ", pageid: 1 },
        { ns: 0, title: "Underscored_Title", pageid: 2 },
        { ns: 0, title: "", pageid: 3 },
        { ns: 0, title: "   ", pageid: 4 },
        { ns: 0, title: "Good", pageid: 5 },
      ]),
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [
    { pageId: 1, title: "Trimmed" },
    { pageId: 2, title: "Underscored Title" },
    { pageId: 5, title: "Good" },
  ]);
});

test("getValidInternalLinks drops links with non-string titles", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "Good", pageid: 1 },
        { ns: 0, title: 123 as unknown as string, pageid: 2 },
        { ns: 0, title: null as unknown as string, pageid: 3 },
      ]),
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [{ pageId: 1, title: "Good" }]);
});

test("getRandomStartingPage rejects empty and whitespace titles and normalizes valid ones", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 1, ns: 0, title: "" }],
    [{ id: 2, ns: 0, title: "   " }],
    [{ id: 3, ns: 0, title: "  Valid  " }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "Valid", eligibleLinks(), 1500),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 3, title: "Valid" });
});

test("getValidInternalLinks resolves redirect links to canonical identities", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "Unina", pageid: 487631 },
        { ns: 0, title: "Napoli", pageid: 100 },
      ]),
    resolveTitles: async (titles) => {
      const map = new Map<string, TitleResolution>();
      for (const title of titles) {
        if (title === "Unina") {
          map.set(title, {
            kind: "REDIRECT",
            canonical: { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
          });
        } else {
          map.set(title, { kind: "DIRECT" });
        }
      }
      return map;
    },
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [
    { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
    { pageId: 100, title: "Napoli" },
  ]);
});

test("getValidInternalLinks excludes a redirect whose canonical target is missing", async () => {
  const client = makeFakeClient({
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "Unina", pageid: 487631 },
        { ns: 0, title: "Napoli", pageid: 100 },
      ]),
    resolveTitles: async (titles) => {
      const map = new Map<string, TitleResolution>();
      for (const title of titles) {
        if (title === "Unina") {
          map.set(title, { kind: "UNRESOLVED" });
        } else {
          map.set(title, { kind: "DIRECT" });
        }
      }
      return map;
    },
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [{ pageId: 100, title: "Napoli" }]);
});

test("getValidInternalLinks excludes citation-only links", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p>Body <a href="/wiki/B">B</a>.</p><span class="citation">See <a href="/wiki/C">C</a>.</span>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "B", pageid: 2 },
        { ns: 0, title: "C", pageid: 3 },
      ]),
  });
  const service = new WikipediaService({ client });

  const links = await service.getValidInternalLinks(1);

  assert.deepEqual(links, [{ pageId: 2, title: "B" }]);
});

test("isValidNavigation rejects a citation-only link", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p>Body <a href="/wiki/B">B</a>.</p><span class="citation">See <a href="/wiki/C">C</a>.</span>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "B", pageid: 2 },
        { ns: 0, title: "C", pageid: 3 },
      ]),
  });
  const service = new WikipediaService({ client });

  assert.equal(await service.isValidNavigation(1, 2), true);
  assert.equal(await service.isValidNavigation(1, 3), false);
});

test("getRandomStartingPage rejects a candidate whose raw links are bibliography-only", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 1, ns: 0, title: "Bibliography heavy" }],
    [{ id: 2, ns: 0, title: "Good" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      pageId === 1
        ? linksFor(
            1,
            "Bibliography heavy",
            [
              { ns: 0, title: "B1", pageid: 101 },
              { ns: 0, title: "B2", pageid: 102 },
              { ns: 0, title: "B3", pageid: 103 },
              { ns: 0, title: "B4", pageid: 104 },
              { ns: 0, title: "B5", pageid: 105 },
            ],
            1500,
          )
        : linksFor(2, "Good", eligibleLinks(), 1500),
    getArticleHtml: async (pageId) => {
      if (pageId === 1) {
        return {
          pageId,
          title: "Bibliography heavy",
          html:
            '<h2 id="Bibliografia">Bibliografia</h2><ul>' +
            ["B1", "B2", "B3", "B4", "B5"]
              .map((title) => `<li><a href="/wiki/${title}">${title}</a></li>`)
              .join("") +
            "</ul>",
        };
      }
      return {
        pageId,
        title: "Good",
        html: eligibleLinks()
          .map((link) => `<a href="/wiki/${link.title}">${link.title}</a>`)
          .join(""),
      };
    },
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 2, title: "Good" });
});

test("getArticle resolves a playable link beyond the old 500-link cutoff", async () => {
  const rawLinks = Array.from({ length: 600 }, (_, i) => ({
    ns: 0,
    title: `T${i}`,
    pageid: 1000 + i,
  }));
  rawLinks[550] = { ns: 0, title: "Target", pageid: 501 };

  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p><a href="/wiki/Target">go</a></p>',
    }),
    getArticleLinks: async (pageId) => linksFor(pageId, "P", rawLinks),
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.deepEqual(article.links, [{ pageId: 501, title: "Target" }]);
});

test("getArticle resolves all playable links without an arbitrary truncation", async () => {
  const rawLinks = Array.from({ length: 600 }, (_, i) => ({
    ns: 0,
    title: `T${i}`,
    pageid: i + 1,
  }));
  const htmlLinks = rawLinks
    .map((link) => `<a href="/wiki/${link.title}">${link.title}</a>`)
    .join("");

  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: `<p>${htmlLinks}</p>`,
    }),
    getArticleLinks: async (pageId) => linksFor(pageId, "P", rawLinks),
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.equal(article.links.length, 600);
});

test("getArticle still excludes a citation-only link beyond the old cutoff", async () => {
  const rawLinks = Array.from({ length: 600 }, (_, i) => ({
    ns: 0,
    title: `T${i}`,
    pageid: 1000 + i,
  }));
  rawLinks[550] = { ns: 0, title: "C", pageid: 501 };

  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p>Body <a href="/wiki/B">B</a>.</p><span class="citation">See <a href="/wiki/C">C</a>.</span>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "B", pageid: 2 },
        ...rawLinks,
      ]),
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.deepEqual(article.links, [{ pageId: 2, title: "B" }]);
});

test("getArticle deduplicates repeated playable targets before canonical resolution", async () => {
  let resolvedTitles: string[] = [];
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p><a href="/wiki/Napoli">1</a><a href="/wiki/Napoli">2</a><a href="/wiki/Napoli">3</a><a href="/wiki/Napoli">4</a></p>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [{ ns: 0, title: "Napoli", pageid: 100 }]),
    resolveTitles: async (titles) => {
      resolvedTitles = titles;
      return new Map(titles.map((title) => [title, { kind: "DIRECT" } as TitleResolution]));
    },
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.deepEqual(resolvedTitles, ["Napoli"]);
  assert.deepEqual(article.links, [{ pageId: 100, title: "Napoli" }]);
});

test("getArticle resolves redirect links and annotates canonical identities", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p><a href="/wiki/Unina">Unina</a></p>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [{ ns: 0, title: "Unina", pageid: 487631 }]),
    resolveTitles: async (titles) => {
      const map = new Map<string, TitleResolution>();
      for (const title of titles) {
        if (title === "Unina") {
          map.set(title, {
            kind: "REDIRECT",
            canonical: { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
          });
        }
      }
      return map;
    },
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.equal(article.pageId, 1);
  assert.deepEqual(article.links, [
    { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
  ]);
  assert.match(article.contentHtml, new RegExp(`data-page-id="${TARGET_PAGE_ID}"`));
  assert.match(article.contentHtml, /data-page-title="Università degli Studi di Napoli Federico II"/);
});

test("getArticle excludes a redirect whose canonical target failed resolution", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p><a href="/wiki/Unina">Unina</a></p>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [{ ns: 0, title: "Unina", pageid: 487631 }]),
    resolveTitles: async () =>
      new Map([["Unina", { kind: "UNRESOLVED" } as TitleResolution]]),
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.deepEqual(article.links, []);
});

test("getArticle excludes citation-only links from the playable link set", async () => {
  const client = makeFakeClient({
    getArticleHtml: async (pageId) => ({
      pageId,
      title: "P",
      html: '<p>Normal <a href="/wiki/B">B</a>.</p><span class="citation">See <a href="/wiki/C">C</a>.</span>',
    }),
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "P", [
        { ns: 0, title: "B", pageid: 2 },
        { ns: 0, title: "C", pageid: 3 },
      ]),
  });
  const service = new WikipediaService({ client });

  const article = await service.getArticle(1);

  assert.deepEqual(article.links, [{ pageId: 2, title: "B" }]);
});

test("getRandomStartingPage rejects the target page as a starting page", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: TARGET_PAGE_ID, ns: 0, title: TARGET_PAGE_TITLE }],
    [{ id: 2, ns: 0, title: "Good" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "Good", eligibleLinks(), 1500),
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 2, title: "Good" });
});

test("getRandomStartingPage rejects a candidate that redirects to the target", async () => {
  const attempts: MediaWikiRandomItem[][] = [
    [{ id: 487631, ns: 0, title: "Unina" }],
    [{ id: 2, ns: 0, title: "Good" }],
  ];
  let call = 0;
  const client = makeFakeClient({
    getRandomArticles: async () => attempts[call++] ?? [],
    getArticleLinks: async (pageId) =>
      linksFor(pageId, "Good", eligibleLinks(), 1500),
    resolveTitles: async (titles) => {
      const map = new Map<string, TitleResolution>();
      for (const title of titles) {
        if (title === "Unina") {
          map.set(title, {
            kind: "REDIRECT",
            canonical: { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
          });
        } else {
          map.set(title, { kind: "DIRECT" });
        }
      }
      return map;
    },
  });
  const service = new WikipediaService({ client });

  const page = await service.getRandomStartingPage();

  assert.deepEqual(page, { pageId: 2, title: "Good" });
});
