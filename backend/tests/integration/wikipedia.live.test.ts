import assert from "node:assert/strict";
import { test } from "node:test";
import { WikipediaService } from "../../src/modules/wikipedia/wikipedia.service.js";

const live = process.env.RUN_LIVE_MEDIAWIKI_TESTS === "1";

const skip = !live;

const TARGET_TITLE = "Università degli Studi di Napoli Federico II";

test("resolves the target article to a stable page id", { skip }, async () => {
  const service = new WikipediaService();

  const page = await service.resolvePage(TARGET_TITLE);

  assert.ok(page);
  assert.ok(page.pageId > 0);
  assert.equal(page.title, TARGET_TITLE);
});

test("fetches a normalized article with playable internal links", { skip }, async () => {
  const service = new WikipediaService();
  const target = await service.resolvePage(TARGET_TITLE);
  assert.ok(target);

  const article = await service.getArticle(target.pageId);

  assert.equal(article.pageId, target.pageId);
  assert.equal(article.title, TARGET_TITLE);
  assert.ok(article.contentHtml.length > 0);
  assert.ok(Array.isArray(article.links));
  assert.ok(article.links.length > 0);
  for (const link of article.links) {
    assert.equal("pageId" in link, false);
    assert.ok(link.title.length > 0);
  }
});

test("retrieves a suitable random starting page", { skip }, async () => {
  const service = new WikipediaService();

  const page = await service.getRandomStartingPage();

  assert.ok(page.pageId > 0);
  assert.ok(page.title.length > 0);
});
