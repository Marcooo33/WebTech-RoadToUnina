# Wikipedia integration audit and refactor

Date: 2026-09-10.

## Root cause and previous request flow

The source used `generator=links` (the generator form of the links query),
not just `prop=links`. `fetchLinkTargets()` followed `gplcontinue` until
exhaustion or a hard limit of five HTTP requests. Large articles could exceed
that limit. Raising it would have increased traffic.

Each article load performed:

1. One `parse&prop=text` request.
2. One `query&prop=info` request.
3. `L` link-generator requests, up to five before failure.
4. Local HTML title extraction and cross-reference against generator page IDs.
5. `ceil(P / 50)` redirect-resolution queries for the `P` displayed titles,
   with up to four batches in flight.
6. Another parser/sanitizer pass to render canonical link IDs.

Thus a successful article required `2 + L + ceil(P / 50)` requests. Loading
an article with hundreds of links could require many requests even when only
one link would ever be clicked. The error for excessive continuation was a
direct consequence of enumerating the complete source link list.

Move validation called `getValidInternalLinks()`, which called `getArticle()`
and repeated the whole flow. No article cache existed in the audited source.
The frontend fetched the destination article separately after the move.
Random selection added one random request and one candidate-resolution request
before this same expensive article flow, per candidate. Candidates were
sequential, not massively parallel. There were no HTTP retries in the old
client; HTTP 429 was surfaced immediately. The batch concurrency and duplicated
article work increased upstream pressure, though an individual 429 can also
reflect upstream/shared-IP throttling.

## Implemented flow

An uncached article fetches namespace/identity/size with `prop=info`, then HTML
with `parse&prop=text`. The parser neutralizes citation/bibliography links,
filters relative article URLs and Italian namespaces, strips unsafe markup and
attributes, and emits `data-page-title` anchors without `href`. The DTO's
unique titles are collected from the HTML that actually survives sanitization.
There is no external request for any displayed link.

The service has one bounded in-memory article cache: 32 entries, 60-second TTL,
LRU eviction, shared in-flight loads, removal on failure. The app shares the
same service between random selection and game navigation. Returned articles
are copied so callers cannot mutate the cached authoritative link set.

A move normalizes the requested title, loads the current article (cache or
bounded fresh load), and verifies exact membership in its playable titles.
An absent/forged title returns `INVALID_MOVE` without resolving it. Only the
clicked reachable title is then resolved using `query&titles=...&redirects=1`.
Normalization/redirect mappings are followed locally, without fetching each hop.
Missing or non-main-namespace destinations are invalid. Canonical ID/title are
persisted in the existing transaction; victory compares the canonical ID.

Random selection keeps the existing 500-byte and five-link thresholds. It checks
one non-redirect main-namespace candidate at a time, rejects the target, checks
metadata before HTML, skips duplicate candidates within the operation and stops
after ten attempts. Accepted article content is cached for the first render.

| Operation | Normal HTTP requests, excluding throttling retries |
| --- | --- |
| Article, uncached | 2 |
| Article, cached | 0 |
| Valid move, source cached | 1 |
| Valid move, source uncached | 3 |
| Forged title, source cached / uncached | 0 / 2 |
| First suitable random candidate | 3 |
| Render destination after move | Separate article load: 0 or 2 |

Each HTTP request has at most two retries on 429, with 1/2-second fallback
backoff. Numeric and HTTP-date Retry-After are respected. A requested delay
above ten seconds returns the upstream failure instead of retrying early or
holding the operation open indefinitely. No recursive retry, batch fan-out,
outer random-selection retry on upstream errors, or graph prefetch remains.

## Contract and removals

`POST /api/games/:gameId/moves` now accepts `{ "toTitle": "Informatica" }`.
There is no version field. Old `toPageId` requests and unknown fields are rejected.
`ArticleDto.links` contains only `{ title }`; redirect links retain their source
title until selected. Angular models, click handling, service payloads, styling
selectors, fixtures and tests use titles consistently.

Page IDs remain in the article's own identity, game current/start/target pages,
paths, persisted moves and completion detection. No Prisma schema or migration
changed, and no dependency was added.

Removed: `fetchLinkTargets()`, `getArticleLinks()`, exhaustive link continuation,
`resolveTitles()`, `resolveChunk()`, batching/concurrency constants,
`mapWithConcurrency()`, the title-resolution result types, source-title/ID
cross-referencing and the separate preliminary playable-title extraction pass.
The service's redundant link-list/boolean-validation wrappers were replaced by
one selected-navigation operation.

## Validation

| Directory | Command | Result |
| --- | --- | --- |
| backend | `npm test` | 185 passed |
| backend | `npm run build` | Passed |
| backend | `npm run typecheck:tests` | Passed |
| backend | `npm run test:integration` | 92 passed; 3 opt-in live tests skipped |
| frontend | `npm test -- --watch=false` | 79 passed |
| frontend | `npm run build` | Passed |
| e2e | `npm test` | 13 Chromium scenarios passed |
| repository | `git diff --check` | Passed |

No lint script is configured. Existing migrations were applied by the test
runners only to disposable local test databases.

Deterministic coverage includes a 6,000-link article with exactly two HTTP
requests, warm/cold moves, forged canonical titles behind reachable aliases,
redirect chains, canonical IDs persisted through the real REST/game path,
victory, citation filtering, sandbox escapes, cache expiry/eviction/failure,
random rejection and bounded 429 retries.

A separate read-only live check through the refactored service loaded Napoli
(page ID 2986) with 1,758 playable titles in exactly two requests, then resolved
the selected Campania link to canonical page ID 1512148 in one request.
The real Italian Wikipedia siteinfo response was also inspected for namespace
names and aliases. These observations are a smoke test, not an availability
guarantee. The HTTP behavior follows the official
[parse API](https://www.mediawiki.org/wiki/API:Parsing_wikitext) and
[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette) documentation.

## Remaining limits

- The article snapshot can be up to 60 seconds old; it is not a persistent
  revision snapshot. A missing cache entry causes a fresh load.
- A displayed redirect may prove missing/non-playable when clicked, because
  redirects are deliberately resolved only on selection.
- Metadata and HTML fetched across a page rename fail closed. If a persisted
  current page is later deleted or turned into a redirect, loading reports an
  upstream error instead of silently rewriting game history.
- Namespace names/aliases are local Italian-Wikipedia filtering data; selected
  targets are also checked against MediaWiki's actual namespace. Interwiki
  links are excluded by external URLs and MediaWiki's class/rel markers.
- Genuine upstream throttling remains possible, including Retry-After values
  too long for an inline retry. Random selection can exhaust ten candidates.
- The REST change requires deploying frontend and backend together. Existing
  page-ID-based persisted games need no migration.

## Files

Created: this report. Modified files:

- `backend/src/app.ts`
- `backend/src/modules/games/games.service.ts`
- `backend/src/modules/games/games.types.ts`
- `backend/src/modules/games/games.validation.test.ts`
- `backend/src/modules/games/games.validation.ts`
- `backend/src/modules/games/wikipedia.starting-page.provider.ts`
- `backend/src/modules/wikipedia/article-parser.service.test.ts`
- `backend/src/modules/wikipedia/article-parser.service.ts`
- `backend/src/modules/wikipedia/mediawiki.client.test.ts`
- `backend/src/modules/wikipedia/mediawiki.client.ts`
- `backend/src/modules/wikipedia/wikipedia.service.test.ts`
- `backend/src/modules/wikipedia/wikipedia.service.ts`
- `backend/src/modules/wikipedia/wikipedia.types.ts`
- `backend/src/modules/wikipedia/wikipedia.validation.ts`
- `backend/src/testing/e2e-wikipedia.ts`
- `backend/tests/integration/games.navigation.test.ts`
- `backend/tests/integration/games.timing.test.ts`
- `backend/tests/integration/wikipedia.live.test.ts`
- `docs/api.md`
- `docs/architecture.md`
- `e2e/support/api.ts`
- `e2e/tests/backtracking.spec.ts`
- `e2e/tests/completion.spec.ts`
- `e2e/tests/navigation.spec.ts`
- `e2e/tests/public.spec.ts`
- `e2e/tests/resume.spec.ts`
- `frontend/src/app/core/services/games.service.spec.ts`
- `frontend/src/app/core/services/games.service.ts`
- `frontend/src/app/features/game/game-page/game-page.spec.ts`
- `frontend/src/app/features/game/game-page/game-page.ts`
- `frontend/src/app/features/game/wikipedia-article/wikipedia-article.css`
- `frontend/src/app/features/game/wikipedia-article/wikipedia-article.spec.ts`
- `frontend/src/app/features/game/wikipedia-article/wikipedia-article.ts`
- `frontend/src/app/shared/models/article.model.ts`
