import { WikipediaError } from "./wikipedia.errors.js";
import {
  isValidMediaWikiPageId,
  normalizeMediaWikiTitle,
} from "./wikipedia.validation.js";
import type {
  MediaWikiArticleLinks,
  MediaWikiPage,
  MediaWikiParseResponse,
  MediaWikiQueryResponse,
  MediaWikiRandomItem,
  TitleResolution,
  TitleResolutionSource,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

export const DEFAULT_MEDIAWIKI_API_URL = "https://it.wikipedia.org/w/api.php";

const DEFAULT_USER_AGENT = "ROADTOUNINA/1.0 (university web project; it.wikipedia.org)";
const DEFAULT_TIMEOUT_MS = 10_000;

// Defensive bound on how many continuation requests the client will follow
// while collecting linked pages. `gpllimit=max` already returns up to 500
// pages per request, so this covers every realistic article many times over.
// This is an implementation safety limit, not a ROADTOUNINA game rule.
export const MAX_LINK_CONTINUATION_REQUESTS = 5;

// MediaWiki resolves at most 50 titles/pageids per query for regular users.
// Redirect resolution is therefore performed in bounded chunks.
export const MAX_REDIRECT_RESOLUTION_PER_REQUEST = 50;

// Cap on how many redirect-resolution chunks may be in flight at once. This
// bounds the latency of a single gameplay action instead of allowing a long,
// strictly sequential chain of external requests.
export const MAX_REDIRECT_RESOLUTION_CONCURRENCY = 4;

export interface MediaWikiClientOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
}

// MediaWiki is an untrusted external boundary. A playable article must live in
// the main namespace (`ns === 0`). A missing, non-numeric, fractional, NaN or
// non-zero namespace must never be defaulted to zero.
function isMainNamespace(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value === 0;
}

// Runs `worker` over `items` with at most `limit` promises in flight, while
// preserving result order. This keeps redirect-resolution latency bounded
// without flooding MediaWiki with an unbounded number of concurrent requests.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const run = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index]);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => run()));

  return results;
}

function toValidRandomItem(raw: unknown): MediaWikiRandomItem | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const { id, ns, title } = raw as Partial<MediaWikiRandomItem>;
  if (!isValidMediaWikiPageId(id)) {
    return null;
  }
  if (!isMainNamespace(ns)) {
    return null;
  }

  const normalized = normalizeMediaWikiTitle(title);
  if (normalized === null) {
    return null;
  }

  return { id, ns, title: normalized };
}

export class MediaWikiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor(options: MediaWikiClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_MEDIAWIKI_API_URL;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getRandomArticles(limit: number): Promise<MediaWikiRandomItem[]> {
    const body = await this.request<MediaWikiQueryResponse>({
      action: "query",
      list: "random",
      rnnamespace: "0",
      rnlimit: String(limit),
      rnfilterredir: "nonredirects",
      format: "json",
      formatversion: "2",
    });

    const random = body.query?.random;
    if (!Array.isArray(random)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki random response missing query.random",
      );
    }

    const items: MediaWikiRandomItem[] = [];
    for (const raw of random) {
      const item = toValidRandomItem(raw);
      if (item !== null) {
        items.push(item);
      }
    }

    return items;
  }

  async getArticleLinks(pageId: number): Promise<MediaWikiArticleLinks> {
    const [info, targets] = await Promise.all([
      this.fetchPageInfo(pageId),
      this.fetchLinkTargets(pageId),
    ]);

    const seen = new Set<number>();
    const links: { ns: number; title: string; pageid: number }[] = [];

    for (const page of targets) {
      if (page.missing) {
        continue;
      }

      const id = this.requirePageId(page);
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);

      // A playable link must be a main-namespace article. A missing or
      // malformed namespace must not be treated as namespace 0.
      if (!isMainNamespace(page.ns)) {
        continue;
      }

      links.push({
        ns: page.ns,
        title: this.requireTitle(page),
        pageid: id,
      });
    }

    return {
      pageId: info.pageId,
      title: info.title,
      length: info.length,
      links,
    };
  }

  async getArticleHtml(
    pageId: number,
  ): Promise<{ pageId: number; title: string; html: string }> {
    const body = await this.request<MediaWikiParseResponse>({
      action: "parse",
      pageid: String(pageId),
      prop: "text",
      format: "json",
      formatversion: "2",
    });

    const parse = body.parse;
    if (!parse) {
      throw new WikipediaError(
        "PAGE_NOT_FOUND",
        `MediaWiki could not parse article ${pageId}`,
      );
    }

    if (!isValidMediaWikiPageId(parse.pageid)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki parse response missing valid pageid",
      );
    }

    if (parse.pageid !== pageId) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki parse response does not match the requested page",
      );
    }

    const title = normalizeMediaWikiTitle(parse.title);
    if (title === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki parse response missing title",
      );
    }

    const rawText = parse.text;
    const html =
      typeof rawText === "string"
        ? rawText
        : typeof rawText === "object" && rawText !== null
          ? rawText["*"]
          : undefined;

    if (typeof html !== "string") {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki parse response missing article text",
      );
    }

    return { pageId: parse.pageid, title, html };
  }

  async resolveTitle(title: string): Promise<WikipediaPageIdentity | null> {
    const body = await this.request<MediaWikiQueryResponse>({
      action: "query",
      titles: title,
      redirects: "1",
      format: "json",
      formatversion: "2",
    });

    const page = this.singlePage(body);
    if (page.missing) {
      return null;
    }

    const pageId = this.requirePageId(page);
    const resolvedTitle = this.requireTitle(page);
    this.requireMainNamespace(page);

    if (this.expectedCanonicalTitle(body, title) !== resolvedTitle) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki resolution does not correspond to the requested title",
      );
    }

    return { pageId, title: resolvedTitle };
  }

  // Resolves redirects for a batch of source-link targets. Returns a resolution
  // per unique requested title, distinguishing DIRECT articles and redirects
  // (both carrying their authoritative canonical identity) from UNRESOLVED
  // titles that must be excluded.
  async resolveTitles(
    sources: TitleResolutionSource[],
  ): Promise<Map<string, TitleResolution>> {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const source of sources) {
      if (!seen.has(source.title)) {
        seen.add(source.title);
        unique.push(source.title);
      }
    }

    const chunks: string[][] = [];
    for (
      let offset = 0;
      offset < unique.length;
      offset += MAX_REDIRECT_RESOLUTION_PER_REQUEST
    ) {
      chunks.push(unique.slice(offset, offset + MAX_REDIRECT_RESOLUTION_PER_REQUEST));
    }

    const chunkResults = await mapWithConcurrency(
      chunks,
      MAX_REDIRECT_RESOLUTION_CONCURRENCY,
      (chunk) => this.resolveChunk(chunk),
    );

    const result = new Map<string, TitleResolution>();
    for (const chunkResult of chunkResults) {
      for (const [title, resolution] of chunkResult) {
        result.set(title, resolution);
      }
    }

    return result;
  }

  private async resolveChunk(
    chunk: string[],
  ): Promise<Map<string, TitleResolution>> {
    const body = await this.request<MediaWikiQueryResponse>({
      action: "query",
      titles: chunk.join("|"),
      redirects: "1",
      format: "json",
      formatversion: "2",
    });

    const redirects = body.query?.redirects;
    if (redirects !== undefined && !Array.isArray(redirects)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki redirects data is malformed",
      );
    }
    const normalized = body.query?.normalized;
    if (normalized !== undefined && !Array.isArray(normalized)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki normalized data is malformed",
      );
    }

    // Single hop map combining title normalization and redirect substitution.
    // Redirect edges override normalization edges for the same source title.
    const hopMap = new Map<string, string>();
    const redirectFroms = new Set<string>();

    for (const entry of normalized ?? []) {
      const from = normalizeMediaWikiTitle(entry.from);
      const to = normalizeMediaWikiTitle(entry.to);
      if (from !== null && to !== null) {
        hopMap.set(from, to);
      }
    }
    for (const entry of redirects ?? []) {
      const from = normalizeMediaWikiTitle(entry.from);
      const to = normalizeMediaWikiTitle(entry.to);
      if (from !== null && to !== null) {
        hopMap.set(from, to);
        redirectFroms.add(from);
      }
    }

    const canonicalByTitle = new Map<string, WikipediaPageIdentity>();
    for (const page of this.requirePagesArray(body)) {
      if (page.missing) {
        continue;
      }

      const id = page.pageid;
      const title = normalizeMediaWikiTitle(page.title);
      if (!isValidMediaWikiPageId(id) || title === null) {
        continue;
      }
      if (!isMainNamespace(page.ns)) {
        continue;
      }

      canonicalByTitle.set(title, { pageId: id, title });
    }

    const resolutions = new Map<string, TitleResolution>();
    for (const original of chunk) {
      let target = original;
      let wasRedirect = false;
      const seen = new Set<string>();

      while (hopMap.has(target) && !seen.has(target)) {
        seen.add(target);
        if (redirectFroms.has(target)) {
          wasRedirect = true;
        }
        target = hopMap.get(target) as string;
      }

      const canonical = canonicalByTitle.get(target);

      if (!canonical) {
        resolutions.set(original, { kind: "UNRESOLVED" });
        continue;
      }

      resolutions.set(
        original,
        wasRedirect
          ? { kind: "REDIRECT", canonical }
          : { kind: "DIRECT", canonical },
      );
    }

    return resolutions;
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    const query = new URLSearchParams(params);
    const url = `${this.baseUrl}?${query.toString()}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new WikipediaError(
        "NETWORK",
        "Failed to reach the MediaWiki API",
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        `MediaWiki API returned HTTP ${response.status}`,
      );
    }

    let body: unknown;
    try {
      body = (await response.json()) as unknown;
    } catch (error) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki API returned malformed JSON",
        { cause: error },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki API returned a malformed response body",
      );
    }

    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object") {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki API reported an error",
      );
    }

    return body as T;
  }

  private async fetchPageInfo(
    pageId: number,
  ): Promise<{ pageId: number; title: string; length?: number }> {
    const body = await this.request<MediaWikiQueryResponse>({
      action: "query",
      pageids: String(pageId),
      prop: "info",
      format: "json",
      formatversion: "2",
    });

    const page = this.singlePage(body);
    this.assertNotMissing(page);

    const id = this.requirePageId(page);
    if (id !== pageId) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki returned a page that does not match the requested page",
      );
    }

    const title = this.requireTitle(page);
    this.requireMainNamespace(page);

    return {
      pageId: id,
      title,
      length: this.requireLength(page),
    };
  }

  private async fetchLinkTargets(pageId: number): Promise<MediaWikiPage[]> {
    const baseParams: Record<string, string> = {
      action: "query",
      generator: "links",
      pageids: String(pageId),
      gplnamespace: "0",
      gpllimit: "max",
      format: "json",
      formatversion: "2",
    };

    const pages: MediaWikiPage[] = [];
    let params = baseParams;
    let requests = 0;

    for (;;) {
      requests += 1;
      if (requests > MAX_LINK_CONTINUATION_REQUESTS) {
        throw new WikipediaError(
          "INVALID_RESPONSE",
          "MediaWiki link continuation exceeded the allowed number of requests",
        );
      }

      const body = await this.request<MediaWikiQueryResponse>(params);
      for (const page of this.requirePagesArray(body)) {
        pages.push(page);
      }

      const continuation = body.continue;
      if (!continuation) {
        break;
      }

      if (typeof continuation !== "object" || continuation === null) {
        throw new WikipediaError(
          "INVALID_RESPONSE",
          "MediaWiki continuation data is malformed",
        );
      }

      const gplcontinue = continuation.gplcontinue;
      if (typeof gplcontinue !== "string" || gplcontinue.length === 0) {
        throw new WikipediaError(
          "INVALID_RESPONSE",
          "MediaWiki continuation token is missing",
        );
      }

      const nextParams: Record<string, string> = {
        ...baseParams,
        gplcontinue,
      };

      if (typeof continuation.continue === "string") {
        nextParams.continue = continuation.continue;
      }

      params = nextParams;
    }

    return pages;
  }

  private singlePage(body: MediaWikiQueryResponse): MediaWikiPage {
    const pages = this.requirePagesArray(body);
    if (pages.length === 0) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki query response missing pages",
      );
    }

    return pages[0];
  }

  private assertNotMissing(page: MediaWikiPage): void {
    if (page.missing) {
      throw new WikipediaError(
        "PAGE_NOT_FOUND",
        "MediaWiki article does not exist",
      );
    }
  }

  private requirePageId(page: MediaWikiPage): number {
    if (!isValidMediaWikiPageId(page.pageid)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki page missing pageid",
      );
    }

    return page.pageid;
  }

  private requireTitle(page: MediaWikiPage): string {
    const title = normalizeMediaWikiTitle(page.title);
    if (title === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki page missing title",
      );
    }

    return title;
  }

  private requireMainNamespace(page: MediaWikiPage): void {
    if (!isMainNamespace(page.ns)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki page is not a main-namespace article",
      );
    }
  }

  private requireLength(page: MediaWikiPage): number | undefined {
    if (page.length === undefined) {
      return undefined;
    }

    if (
      typeof page.length !== "number" ||
      !Number.isInteger(page.length) ||
      page.length < 0
    ) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki page has a malformed length",
      );
    }

    return page.length;
  }

  private requirePagesArray(body: MediaWikiQueryResponse): MediaWikiPage[] {
    if (typeof body !== "object" || body === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki query response is malformed",
      );
    }

    const query = body.query;
    if (typeof query !== "object" || query === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki query response missing query",
      );
    }

    const pages = query.pages;
    if (!Array.isArray(pages)) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki query response missing pages",
      );
    }

    for (const entry of pages) {
      if (typeof entry !== "object" || entry === null) {
        throw new WikipediaError(
          "INVALID_RESPONSE",
          "MediaWiki query response contains a malformed page entry",
        );
      }
    }

    return pages;
  }

  private expectedCanonicalTitle(
    body: MediaWikiQueryResponse,
    requestedTitle: string,
  ): string {
    const redirects = body.query?.redirects;
    if (Array.isArray(redirects) && redirects.length > 0) {
      return this.resolveTitleTarget(redirects);
    }

    const normalized = body.query?.normalized;
    if (Array.isArray(normalized) && normalized.length > 0) {
      return this.resolveTitleTarget(normalized);
    }

    const requested = normalizeMediaWikiTitle(requestedTitle);
    if (requested === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki resolution returned an invalid title",
      );
    }

    return requested;
  }

  private resolveTitleTarget(entries: unknown[]): string {
    const last = entries[entries.length - 1];
    if (typeof last !== "object" || last === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki resolution returned a malformed title mapping",
      );
    }

    const to = normalizeMediaWikiTitle((last as { to?: unknown }).to);
    if (to === null) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki resolution returned an invalid target title",
      );
    }

    return to;
  }
}
