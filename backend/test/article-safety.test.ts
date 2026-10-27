import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeArticle } from "../src/modules/wikipedia/article-parser.js";

test("updated sanitizer preserves playable links and Wikimedia images while removing executable HTML", () => {
  const article = normalizeArticle(
    { pageId: 1, title: "Napoli" },
    `<p>Un articolo <a href="/wiki/Federico_II" onclick="alert(1)">Federico II</a>.</p>
     <a href="javascript:alert(1)">Invalid link</a>
     <script>alert(1)</script>
     <noscript><img src="x" onerror="alert(1)"></noscript>
     <svg><animate attributeName="href" values="javascript:alert(1)"></animate></svg>
     <img src="//upload.wikimedia.org/example.jpg" alt="Università" onerror="alert(1)">
     <img src="https://attacker.example/tracker.jpg">`,
    ["Federico II"],
  );
  assert.deepEqual(article.links, [{ title: "Federico II" }]);
  assert.match(article.contentHtml, /<a data-page-title="Federico II">Federico II<\/a>/);
  assert.match(article.contentHtml, /src="https:\/\/upload.wikimedia.org\/example.jpg"/);
  assert.doesNotMatch(article.contentHtml, /<script|<svg|<animate|onerror|onclick|javascript:|attacker\.example/);
});
