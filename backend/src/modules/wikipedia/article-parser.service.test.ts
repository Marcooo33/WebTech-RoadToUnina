import assert from "node:assert/strict";
import { test } from "node:test";
import { ArticleParserService } from "./article-parser.service.js";

const parser = new ArticleParserService();
const page = { pageId: 100, title: "Origine" };

function normalize(html: string) {
  return parser.normalize(page, html);
}

test("rewrites a valid internal link to a controlled playable link", () => {
  const result = normalize(
    '<p>See <a href="/wiki/Target_Page">the target</a>.</p>',
  );

  assert.match(result.contentHtml, /data-page-title="Target Page"/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.match(result.contentHtml, />the target<\/a>/);
  assert.deepEqual(result.links, [{ title: "Target Page" }]);
});

test("decodes URL-encoded and underscore titles", () => {
  const result = normalize(
    '<a href="/wiki/Universit%C3%A0_degli_Studi_di_Napoli">link</a>',
  );

  assert.match(
    result.contentHtml,
    /data-page-title="Università degli Studi di Napoli"/,
  );
});

test("external links are excluded and de-linked", () => {
  const result = normalize(
    '<p><a href="https://example.com/x">example</a> and <a href="//example.com/y">proto</a></p>',
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

  const result = normalize(html);

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.equal(result.contentHtml.includes("Categoria:"), false);
  assert.deepEqual(result.links, []);
});

test("red links (edit/redlink) are excluded", () => {
  const result = normalize(
    '<a href="/wiki/Nonexistent?action=edit&redlink=1" class="new">red</a>',
  );

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.deepEqual(result.links, []);
});

test("edit/history/action/control query URLs are never playable", () => {
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
    const result = normalize(`<a href="${url}">link</a>`);

    assert.doesNotMatch(result.contentHtml, /<a /, url);
    assert.equal(result.contentHtml.includes("data-page-title"), false, url);
    assert.deepEqual(result.links, [], url);
  }
});

test("a plain article URL still becomes a playable ROADTOUNINA link", () => {
  const result = normalize('<a href="/wiki/Valid_Article">link</a>');

  assert.match(result.contentHtml, /data-page-title="Valid Article"/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.deepEqual(result.links, [{ title: "Valid Article" }]);
});

test("a canonical /wiki/Napoli path is eligible", () => {
  const result = normalize('<a href="/wiki/Napoli">napoli</a>');

  assert.match(result.contentHtml, /data-page-title="Napoli"/);
  assert.deepEqual(result.links, [{ title: "Napoli" }]);
});

test("malformed path prefixes containing /wiki/ are rejected", () => {
  const urls = [
    "/untrusted/wiki/Napoli",
    "/foo/wiki/Napoli",
    "/foo/bar/wiki/Napoli",
  ];

  for (const url of urls) {
    const result = normalize(`<a href="${url}">napoli</a>`);

    assert.doesNotMatch(result.contentHtml, /data-page-title/, url);
    assert.doesNotMatch(result.contentHtml, /data-page-title/, url);
    assert.deepEqual(result.links, [], url);
  }
});

test("an empty article path /wiki/ is rejected", () => {
  const result = normalize('<a href="/wiki/">x</a>');

  assert.doesNotMatch(result.contentHtml, /data-page-title/);
  assert.deepEqual(result.links, []);
});

test("absolute and foreign-host URLs are rejected even with /wiki/ paths", () => {
  const urls = [
    "https://it.wikipedia.org/wiki/Napoli",
    "https://example.com/wiki/Napoli",
    "https://evil.example/wiki/Napoli",
    "https://it.wikipedia.org/untrusted/wiki/Napoli",
  ];

  for (const url of urls) {
    const result = normalize(`<a href="${url}">napoli</a>`);

    assert.doesNotMatch(result.contentHtml, /data-page-title/, url);
    assert.doesNotMatch(result.contentHtml, /href=/, url);
    assert.deepEqual(result.links, [], url);
  }
});

test("fragment-only links are excluded", () => {
  const result = normalize('<p>Jump to <a href="#Section">section</a>.</p>');

  assert.doesNotMatch(result.contentHtml, /<a /);
  assert.deepEqual(result.links, []);
});

test("assigns safe unique ROADTOUNINA ids to sanitized headings", () => {
  const result = normalize([
    '<h2 id="source-id" onclick="bad()">Storia</h2>',
    '<h3 id="storia">Storia</h3>',
    '<h4 id="&quot; onmouseover=&quot;bad()"><span></span></h4>',
  ].join(""));

  assert.match(result.contentHtml, /<h2 id="rtu-section-storia">Storia<\/h2>/);
  assert.match(result.contentHtml, /<h3 id="rtu-section-storia-2">Storia<\/h3>/);
  assert.match(result.contentHtml, /<h4 id="rtu-section-3"><span><\/span><\/h4>/);
  assert.doesNotMatch(result.contentHtml, /source-id|on(?:click|mouseover)/);
});

test("reference/citation markers and reference lists are removed", () => {
  const html = [
    '<p>Text<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">[1]</a></sup></p>',
    '<div class="references"><ol class="references"><li id="cite_note-1"><a href="https://ref.example.com">Ref</a></li></ol></div>',
  ].join("");

  const result = normalize(html);

  assert.equal(result.contentHtml.includes("reference"), false);
  assert.equal(result.contentHtml.includes("cite_note"), false);
  assert.equal(result.contentHtml.includes("ref.example.com"), false);
});

test("links inside <cite> are de-linked and never playable", () => {
  const result = normalize(
    '<p>Normal article text.</p><cite><a href="/wiki/Bibliography_Page">book</a></cite>',
  );

  assert.doesNotMatch(result.contentHtml, /data-page-title/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.match(result.contentHtml, />book<\/span>/);
  assert.deepEqual(result.links, []);
});

test("normal prose link to a citation destination remains playable", () => {
  const result = normalize(
    '<p>See <a href="/wiki/Bibliography_Page">this article</a>.</p>',
  );

  assert.match(result.contentHtml, /data-page-title="Bibliography Page"/);
  assert.deepEqual(result.links, [{ title: "Bibliography Page" }]);
});

test("same destination in prose vs citation is handled contextually", () => {
  const result = normalize(
    '<p><a href="/wiki/Same_Page">normal link</a></p><cite><a href="/wiki/Same_Page">citation link</a></cite>',
  );

  assert.match(result.contentHtml, /data-page-title="Same Page"/);
  assert.match(result.contentHtml, />normal link<\/a>/);
  assert.match(result.contentHtml, />citation link<\/span>/);
  assert.deepEqual(result.links, [{ title: "Same Page" }]);
});

test("links inside reference-list containers never become playable", () => {
  const result = normalize(
    '<div class="references"><ol class="references"><li><a href="/wiki/History_of_Naples">ref</a></li></ol></div>',
  );

  assert.doesNotMatch(result.contentHtml, /data-page-title/);
  assert.equal(result.contentHtml.includes("History_of_Naples"), false);
  assert.deepEqual(result.links, []);
});

test("links inside citation-class elements are de-linked", () => {
  const result = normalize(
    '<span class="citation">See <a href="/wiki/Author">Author</a>.</span>',
  );

  assert.doesNotMatch(result.contentHtml, /data-page-title/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.deepEqual(result.links, []);
});

test("links inside nested citation contexts are de-linked", () => {
  const result = normalize(
    '<cite><span class="citation"><a href="/wiki/Nested">nested</a></span></cite>',
  );

  assert.doesNotMatch(result.contentHtml, /data-page-title/);
  assert.doesNotMatch(result.contentHtml, /href=/);
  assert.deepEqual(result.links, []);
});

test("dangerous HTML is stripped", () => {
  const html = [
    "<script>alert(1)</script>",
    '<iframe src="https://evil.example.com"></iframe>',
    '<form action="/submit"><input type="text"></form>',
    '<img src="https://evil.example.com/x.png" onerror="alert(2)">',
    '<div onclick="steal()">click me</div>',
    "<p>Safe <b>text</b></p>",
  ].join("");

  const result = normalize(html);

  assert.equal(result.contentHtml.includes("script"), false);
  assert.equal(result.contentHtml.includes("iframe"), false);
  assert.equal(result.contentHtml.includes("form"), false);
  assert.equal(result.contentHtml.includes("onerror"), false);
  assert.equal(result.contentHtml.includes("onclick"), false);
  assert.equal(result.contentHtml.includes("evil.example.com"), false);
  assert.match(result.contentHtml, /Safe <b>text<\/b>/);
});

test("normalized output contains only controlled playable links", () => {
  const result = normalize('<a href="/wiki/Present">here</a>');

  assert.deepEqual(result.links, [{ title: "Present" }]);
  assert.doesNotMatch(result.contentHtml, /href=/);
});

test("non-playable anchors are de-linked but keep their text", () => {
  const result = normalize(
    '<p><a href="https://example.com/Article">keep me</a></p>',
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

  const result = normalize(html);

  assert.match(result.contentHtml, /<h2 id="rtu-section-heading">Heading<\/h2>/);
  assert.match(result.contentHtml, /<em>emphasis<\/em>/);
  assert.match(result.contentHtml, /<strong>bold<\/strong>/);
  assert.match(result.contentHtml, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(result.contentHtml, /<table>/);
});

test("heading-delimited bibliography links are excluded while later sections remain playable", () => {
  const html = [
    '<h2 id="Bibliografia">Bibliografia</h2>',
    '<ul><li><a href="/wiki/Bibliography_Book">book</a></li></ul>',
    '<h2 id="Voci_correlate">Voci correlate</h2>',
    '<p>See <a href="/wiki/Later_Article">later</a>.</p>',
  ].join("");

  const result = normalize(html);

  assert.deepEqual(result.links, [{ title: "Later Article" }]);
  assert.doesNotMatch(
    result.contentHtml,
    /data-page-title="Bibliography Book"/,
  );
  assert.match(result.contentHtml, /data-page-title="Later Article"/);
});

test("a reference section delimited by a heading excludes nested links", () => {
  const html = [
    "<h2>Note</h2>",
    '<ol class="references"><li><a href="/wiki/Reference_Target">ref</a></li></ol>',
  ].join("");

  const result = normalize(html);

  assert.deepEqual(result.links, []);
  assert.doesNotMatch(result.contentHtml, /data-page-title="Reference Target"/);
});

test("a heading containing 'fonti' but not a bibliography section keeps links playable", () => {
  const html = [
    '<h2 id="Fonti_rinnovabili">Fonti rinnovabili</h2>',
    '<p>See <a href="/wiki/Fonti_Rinnovabili_Link">detail</a>.</p>',
  ].join("");

  const result = normalize(html);

  assert.deepEqual(result.links, [{ title: "Fonti Rinnovabili Link" }]);
  assert.match(result.contentHtml, /data-page-title="Fonti Rinnovabili Link"/);
});

test("a heading containing 'note' but not a references section keeps links playable", () => {
  const html = [
    '<h2 id="Note_storiche">Note storiche</h2>',
    '<p>See <a href="/wiki/Note_Storiche_Link">history</a>.</p>',
  ].join("");

  const result = normalize(html);

  assert.deepEqual(result.links, [{ title: "Note Storiche Link" }]);
  assert.match(result.contentHtml, /data-page-title="Note Storiche Link"/);
});

test("a heading containing 'riferimenti' but not a references section keeps links playable", () => {
  const html = [
    '<h2 id="Riferimenti_normativi">Riferimenti normativi</h2>',
    '<p>See <a href="/wiki/Riferimenti_Normativi_Link">law</a>.</p>',
  ].join("");

  const result = normalize(html);

  assert.deepEqual(result.links, [{ title: "Riferimenti Normativi Link" }]);
  assert.match(
    result.contentHtml,
    /data-page-title="Riferimenti Normativi Link"/,
  );
});

test("an exact 'Riferimenti' heading still excludes nested links", () => {
  const html = [
    "<h2>Riferimenti</h2>",
    '<p><a href="/wiki/Reference_Entry">entry</a></p>',
  ].join("");

  const result = normalize(html);

  assert.deepEqual(result.links, []);
  assert.doesNotMatch(result.contentHtml, /data-page-title="Reference Entry"/);
});

test("title extraction skips heading-delimited bibliography targets", () => {
  const parser = new ArticleParserService();
  const html = [
    '<p><a href="/wiki/Normal_Article">normal</a></p>',
    '<h2 id="Bibliografia">Bibliografia</h2>',
    '<ul><li><a href="/wiki/Bibliography_Book">book</a></li></ul>',
  ].join("");

  assert.deepEqual(
    parser.normalize(page, html).links.map((link) => link.title),
    ["Normal Article"],
  );
});

test("normalizes first letter, whitespace and Unicode without folding the rest of the title", () => {
  const result = normalize(
    '<a href="/wiki/universit%C3%A0__di_Napoli">a</a><a href="/wiki/Universit%C3%A0_di_Napoli#Storia">b</a>',
  );
  assert.deepEqual(result.links, [{ title: "Università di Napoli" }]);
});

test("rejects forged annotations, redlink classes and interwiki anchors", () => {
  const result = normalize(
    '<a data-page-title="Forged">x</a><a class="new" href="/wiki/Missing">x</a><a class="extiw" href="/wiki/Foreign">x</a><a class="interwiki" href="/wiki/en:History">x</a>',
  );
  assert.deepEqual(result.links, []);
  assert.doesNotMatch(result.contentHtml, /data-page-title|href=/);
});

test("invalid encodings, empty titles and multi-title delimiters are excluded", () => {
  for (const href of [
    "/wiki/%FF",
    "/wiki/___",
    "/wiki/A%7CB",
    "/wiki/%23Section",
  ]) {
    assert.deepEqual(normalize('<a href="' + href + '">x</a>').links, []);
  }
});

test("links removed with script, style or citation containers never enter the DTO", () => {
  const result = normalize(
    '<script><a href="/wiki/Hidden">x</a></script><style><a href="/wiki/Styled">x</a></style><div class="references"><a href="/wiki/Reference">x</a></div>',
  );
  assert.deepEqual(result.links, []);
});

test("ordinary article titles containing a colon remain playable", () => {
  assert.deepEqual(
    normalize('<a href="/wiki/Star_Trek:_Voyager">x</a>').links,
    [{ title: "Star Trek: Voyager" }],
  );
  assert.deepEqual(normalize('<a href="/wiki/CSI:_Miami">x</a>').links, [
    { title: "CSI: Miami" },
  ]);
});

test("Italian namespace aliases, drafts, modules and events are excluded", () => {
  for (const prefix of [
    "Bozza",
    "Evento",
    "Event",
    "Modulo",
    "Discussioni modulo",
    "TimedText talk",
    "WP",
    "DW",
    "T",
    "CAT",
    "DP",
    "Image talk",
  ]) {
    assert.deepEqual(
      normalize('<a href="/wiki/' + prefix + ':X">x</a>').links,
      [],
      prefix,
    );
  }
});

test("preserves infobox structure and only its playable article links", () => {
  for (const classes of ["infobox sinottico unrelated", "sinottico unrelated"]) {
    const result = normalize(`
      <table class="${classes}" style="float:right">
        <caption>University</caption>
        <thead><tr class="template-header"><th colspan="2" scope="colgroup">Details</th></tr></thead>
        <tbody><tr><th rowspan="2" scope="row">Location</th>
          <td><a href="/wiki/Napoli"><b>Napoli</b></a></td></tr>
          <tr><td><a href="/wiki/File:Campus.jpg"><img src="https://upload.wikimedia.org/wikipedia/commons/a/ab/Campus.jpg" alt="Campus"></a></td></tr>
          <tr><td colspan="0" rowspan="-1">Text</td><th scope="invalid">Label</th></tr>
        </tbody>
      </table>`);
    assert.match(result.contentHtml, /<table class="(?:infobox )?sinottico">/);
    assert.match(result.contentHtml, /<caption>University<\/caption>/);
    assert.match(result.contentHtml, /<thead><tr><th colspan="2" scope="colgroup">Details<\/th><\/tr><\/thead>/);
    assert.match(result.contentHtml, /<tbody><tr><th rowspan="2" scope="row">Location<\/th>/);
    assert.match(result.contentHtml, /<a data-page-title="Napoli"><b>Napoli<\/b><\/a>/);
    assert.match(result.contentHtml, /<span><img [^>]+><\/span>/);
    assert.match(result.contentHtml, /<td>Text<\/td><th>Label<\/th>/);
    assert.doesNotMatch(result.contentHtml, /unrelated|template-header|style=|href=|data-page-title="File:/);
    assert.deepEqual(result.links, [{ title: "Napoli" }]);
  }
});

test("preserves approved Wikimedia images with only safe attributes", () => {
  for (const source of [
    "https://upload.wikimedia.org/wikipedia/commons/a/ab/Campus.jpg",
    "//thumb.wikimedia.org/wikipedia/it/thumb/a/ab/Campus.jpg/260px-Campus.jpg",
  ]) {
    const result = normalize(`<img src="${source}" alt="Campus &amp; garden" width="260" height="177"
      srcset="https://evil.example/x.png 2x" style="position:fixed" onerror="alert(1)" data-extra="x" loading="eager">`);
    assert.match(result.contentHtml, /<img src="https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\//);
    assert.match(result.contentHtml, /alt="Campus &amp; garden"/);
    assert.match(result.contentHtml, /width="260" height="177"/);
    assert.match(result.contentHtml, /loading="lazy"/);
    assert.doesNotMatch(result.contentHtml, /srcset|style=|onerror|data-extra|evil\.example|eager/);
    assert.deepEqual(result.links, []);
  }
  for (const source of [
    "https://evil.example/wikipedia/x.png",
    "https://upload.wikimedia.org.evil.example/wikipedia/x.png",
    "http://upload.wikimedia.org/wikipedia/x.png",
    "data:image/png;base64,AAAA",
    "https://user:password@upload.wikimedia.org/wikipedia/x.png",
    "https://upload.wikimedia.org:444/wikipedia/x.png",
    "https://upload.wikimedia.org/other/x.png",
    "https://upload.wikimedia.org/wikipedia/../other/x.png",
    "https://upload.wikimedia.org/wikipedia/%FF.png",
    "https://[invalid/wikipedia/x.png",
    "https:/upload.wikimedia.org/wikipedia/x.png",
    "https:///upload.wikimedia.org/wikipedia/x.png",
    "",
  ]) {
    assert.doesNotMatch(normalize(`<img src="${source}">`).contentHtml, /<img/, source);
  }
  assert.doesNotMatch(normalize('<img alt="No source">').contentHtml, /<img/);
  assert.doesNotMatch(
    normalize('<img src="https://upload.wikimedia.org/wikipedia/x.png" width="-1" height="1.5">').contentHtml,
    /width=|height=/,
  );
});

test("excludes anchor class tokens surrounded by other classes", () => {
  for (const token of ["extiw", "new", "external", "interwiki"]) {
    const result = normalize(`<a class="other ${token}\tlast" href="/wiki/Foreign">foreign</a>`);
    assert.deepEqual(result.links, []);
    assert.equal(result.contentHtml, "<span>foreign</span>");
  }
});
