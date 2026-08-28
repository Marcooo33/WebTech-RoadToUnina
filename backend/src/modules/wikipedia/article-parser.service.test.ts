import assert from "node:assert/strict";
import { test } from "node:test";
import { ArticleParserService } from "./article-parser.service.js";
import type { PlayableLink } from "./wikipedia.types.js";

const parser = new ArticleParserService();
const page = { pageId: 100, title: "Origine" };

function normalize(html: string, links: PlayableLink[]) {
  return parser.normalize(page, html, links);
}

test("rewrites a valid internal link to a controlled playable link", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Target Page" },
  ];
  const result = normalize(
    '<p>See <a href="/wiki/Target_Page">the target</a>.</p>',
    links,
  );

  assert.match(result.contentHtml, /data-page-id="42"/);
  assert.match(result.contentHtml, /data-page-title="Target Page"/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.match(result.contentHtml, />the target<\/a>/);
  assert.deepEqual(result.links, [{ pageId: 42, title: "Target Page" }]);
});

test("decodes URL-encoded and underscore titles", () => {
  const links: PlayableLink[] = [
    { pageId: 7, title: "Università degli Studi di Napoli" },
  ];
  const result = normalize(
    '<a href="/wiki/Universit%C3%A0_degli_Studi_di_Napoli">link</a>',
    links,
  );

  assert.match(result.contentHtml, /data-page-id="7"/);
  assert.match(result.contentHtml, /data-page-title="Università degli Studi di Napoli"/);
});

test("external links are excluded and de-linked", () => {
  const result = normalize(
    '<p><a href="https://example.com/x">example</a> and <a href="//example.com/y">proto</a></p>',
    [],
  );

  assert.equal(result.contentHtml.includes("https://example.com"), false);
  assert.equal(result.contentHtml.includes("example.com"), false);
  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.match(result.contentHtml, /<span>example<\/span>/);
  assert.match(result.contentHtml, /<span>proto<\/span>/);
  assert.deepEqual(result.links, []);
});

test("dangerous URL schemes are removed", () => {
  const result = normalize(
    '<p><a href="javascript:alert(1)">bad</a> <a href="data:text/html,x">data</a></p>',
    [],
  );

  assert.equal(result.contentHtml.includes("javascript:"), false);
  assert.equal(result.contentHtml.includes("data:"), false);
  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.deepEqual(result.links, []);
});

test("category, special, help, talk and user links are excluded", () => {
  const html = [
    '<a href="/wiki/Categoria:Foo">cat</a>',
    '<a href="/wiki/Speciale:Random">special</a>',
    '<a href="/wiki/Aiuto:Help">help</a>',
    '<a href="/wiki/Discussione:Foo">talk</a>',
    '<a href="/wiki/Utente:X">user</a>',
  ].join(" ");

  const result = normalize(html, []);

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.equal(result.contentHtml.includes("Categoria:"), false);
  assert.deepEqual(result.links, []);
});

test("red links (edit/redlink) are excluded", () => {
  const result = normalize(
    '<a href="/wiki/Nonexistent?action=edit&redlink=1" class="new">red</a>',
    [],
  );

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.deepEqual(result.links, []);
});

test("edit/history/action/control query URLs are never playable", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Valid Article" },
  ];

  const urls = [
    "/wiki/Valid_Article?action=edit",
    "/wiki/Valid_Article?action=history",
    "/wiki/Valid_Article?action=submit",
    "/wiki/Valid_Article?veaction=edit",
    "/wiki/Valid_Article?oldid=12345",
    "/wiki/Valid_Article?diff=12345",
    "/wiki/Valid_Article?curid=9999",
  ];

  for (const url of urls) {
    const result = normalize(`<a href="${url}">link</a>`, links);

    assert.doesNotMatch(result.contentHtml, /<a /, url);
    assert.equal(result.contentHtml.includes("data-page-id"), false, url);
    assert.deepEqual(result.links, [], url);
  }
});

test("a plain article URL still becomes a playable ROADTOUNINA link", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Valid Article" },
  ];
  const result = normalize(
    '<a href="/wiki/Valid_Article">link</a>',
    links,
  );

  assert.match(result.contentHtml, /data-page-id="42"/);
  assert.match(result.contentHtml, /data-page-title="Valid Article"/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.deepEqual(result.links, [{ pageId: 42, title: "Valid Article" }]);
});

test("a canonical /wiki/Napoli path is eligible", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Napoli" },
  ];
  const result = normalize('<a href="/wiki/Napoli">napoli</a>', links);

  assert.match(result.contentHtml, /data-page-id="42"/);
  assert.deepEqual(result.links, [{ pageId: 42, title: "Napoli" }]);
});

test("malformed path prefixes containing /wiki/ are rejected", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Napoli" },
  ];
  const urls = [
    "/untrusted/wiki/Napoli",
    "/foo/wiki/Napoli",
    "/foo/bar/wiki/Napoli",
  ];

  for (const url of urls) {
    const result = normalize(`<a href="${url}">napoli</a>`, links);

    assert.doesNotMatch(result.contentHtml, /data-page-id/, url);
    assert.doesNotMatch(result.contentHtml, /data-page-title/, url);
    assert.deepEqual(result.links, [], url);
  }
});

test("an empty article path /wiki/ is rejected", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Napoli" },
  ];
  const result = normalize('<a href="/wiki/">x</a>', links);

  assert.doesNotMatch(result.contentHtml, /data-page-id/);
  assert.deepEqual(result.links, []);
});

test("absolute and foreign-host URLs are rejected even with /wiki/ paths", () => {
  const links: PlayableLink[] = [
    { pageId: 42, title: "Napoli" },
  ];
  const urls = [
    "https://it.wikipedia.org/wiki/Napoli",
    "https://example.com/wiki/Napoli",
    "https://evil.example/wiki/Napoli",
    "https://it.wikipedia.org/untrusted/wiki/Napoli",
  ];

  for (const url of urls) {
    const result = normalize(`<a href="${url}">napoli</a>`, links);

    assert.doesNotMatch(result.contentHtml, /data-page-id/, url);
    assert.doesNotMatch(result.contentHtml, /href=/, url);
    assert.deepEqual(result.links, [], url);
  }
});

test("fragment-only links are excluded", () => {
  const result = normalize(
    '<p>Jump to <a href="#Section">section</a>.</p>',
    [],
  );

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.deepEqual(result.links, []);
});

test("reference/citation markers and reference lists are removed", () => {
  const html = [
    '<p>Text<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">[1]</a></sup></p>',
    '<div class="references"><ol class="references"><li id="cite_note-1"><a href="https://ref.example.com">Ref</a></li></ol></div>',
  ].join("");

  const result = normalize(html, []);

  assert.equal(result.contentHtml.includes("reference"), false);
  assert.equal(result.contentHtml.includes("cite_note"), false);
  assert.equal(result.contentHtml.includes("ref.example.com"), false);
});

test("links inside <cite> are de-linked and never playable", () => {
  const links: PlayableLink[] = [
    { pageId: 2, title: "Bibliography Page" },
  ];
  const result = normalize(
    '<p>Normal article text.</p><cite><a href="/wiki/Bibliography_Page">book</a></cite>',
    links,
  );

  assert.doesNotMatch(result.contentHtml, /data-page-id/);
  assert.doesNotMatch(result.contentHtml, /data-page-title/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.match(result.contentHtml, />book<\/span>/);
  assert.deepEqual(result.links, []);
});

test("normal prose link to a citation destination remains playable", () => {
  const links: PlayableLink[] = [
    { pageId: 2, title: "Bibliography Page" },
  ];
  const result = normalize(
    '<p>See <a href="/wiki/Bibliography_Page">this article</a>.</p>',
    links,
  );

  assert.match(result.contentHtml, /data-page-id="2"/);
  assert.match(result.contentHtml, /data-page-title="Bibliography Page"/);
  assert.deepEqual(result.links, [{ pageId: 2, title: "Bibliography Page" }]);
});

test("same destination in prose vs citation is handled contextually", () => {
  const links: PlayableLink[] = [
    { pageId: 7, title: "Same Page" },
  ];
  const result = normalize(
    '<p><a href="/wiki/Same_Page">normal link</a></p><cite><a href="/wiki/Same_Page">citation link</a></cite>',
    links,
  );

  assert.match(result.contentHtml, /data-page-id="7"/);
  assert.match(result.contentHtml, />normal link<\/a>/);
  assert.match(result.contentHtml, />citation link<\/span>/);
  assert.deepEqual(result.links, [{ pageId: 7, title: "Same Page" }]);
});

test("links inside reference-list containers never become playable", () => {
  const links: PlayableLink[] = [
    { pageId: 9, title: "History of Naples" },
  ];
  const result = normalize(
    '<div class="references"><ol class="references"><li><a href="/wiki/History_of_Naples">ref</a></li></ol></div>',
    links,
  );

  assert.doesNotMatch(result.contentHtml, /data-page-id/);
  assert.equal(result.contentHtml.includes("History_of_Naples"), false);
  assert.deepEqual(result.links, []);
});

test("links inside citation-class elements are de-linked", () => {
  const links: PlayableLink[] = [
    { pageId: 5, title: "Author" },
  ];
  const result = normalize(
    '<span class="citation">See <a href="/wiki/Author">Author</a>.</span>',
    links,
  );

  assert.doesNotMatch(result.contentHtml, /data-page-id/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.deepEqual(result.links, []);
});

test("links inside nested citation contexts are de-linked", () => {
  const links: PlayableLink[] = [
    { pageId: 3, title: "Nested" },
  ];
  const result = normalize(
    '<cite><span class="citation"><a href="/wiki/Nested">nested</a></span></cite>',
    links,
  );

  assert.doesNotMatch(result.contentHtml, /data-page-id/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.deepEqual(result.links, []);
});

test("dangerous HTML is stripped", () => {
  const html = [
    '<script>alert(1)</script>',
    '<iframe src="https://evil.example.com"></iframe>',
    '<form action="/submit"><input type="text"></form>',
    '<img src="https://evil.example.com/x.png" onerror="alert(2)">',
    '<div onclick="steal()">click me</div>',
    '<p>Safe <b>text</b></p>',
  ].join("");

  const result = normalize(html, []);

  assert.equal(result.contentHtml.includes("script"), false);
  assert.equal(result.contentHtml.includes("iframe"), false);
  assert.equal(result.contentHtml.includes("form"), false);
  assert.equal(result.contentHtml.includes("onerror"), false);
  assert.equal(result.contentHtml.includes("onclick"), false);
  assert.equal(result.contentHtml.includes("evil.example.com"), false);
  assert.match(result.contentHtml, /Safe <b>text<\/b>/);
});

test("normalized output contains only controlled playable links", () => {
  const links: PlayableLink[] = [
    { pageId: 1, title: "Present" },
    { pageId: 2, title: "Absent" },
  ];
  const result = normalize('<a href="/wiki/Present">here</a>', links);

  assert.deepEqual(result.links, [{ pageId: 1, title: "Present" }]);
  assert.doesNotMatch(result.contentHtml, /href=/);
});

test("non-playable anchors are de-linked but keep their text", () => {
  const result = normalize(
    '<p><a href="/wiki/Only_Title_Without_Id">keep me</a></p>',
    [],
  );

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.match(result.contentHtml, /<span>keep me<\/span>/);
});

test("preserves structural and text markup for readability", () => {
  const html = [
    "<h2>Heading</h2>",
    "<p>Paragraph with <em>emphasis</em> and <strong>bold</strong>.</p>",
    "<ul><li>one</li><li>two</li></ul>",
    "<table><tr><th>Col</th></tr><tr><td>val</td></tr></table>",
  ].join("");

  const result = normalize(html, []);

  assert.match(result.contentHtml, /<h2>Heading<\/h2>/);
  assert.match(result.contentHtml, /<em>emphasis<\/em>/);
  assert.match(result.contentHtml, /<strong>bold<\/strong>/);
  assert.match(result.contentHtml, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(result.contentHtml, /<table>/);
});
