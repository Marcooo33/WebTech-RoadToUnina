import { WikipediaError } from "./wikipedia.errors.js";
import {
  isValidMediaWikiPageId,
  normalizeMediaWikiTitle,
} from "./wikipedia.validation.js";
import type {
  MediaWikiPage,
  MediaWikiParseResponse,
  MediaWikiQueryResponse,
  MediaWikiRandomItem,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

export const DEFAULT_MEDIAWIKI_API_URL = "https://it.wikipedia.org/w/api.php";

const DEFAULT_USER_AGENT =
  "ROADTOUNINA/1.0 (university web project; it.wikipedia.org)";
const DEFAULT_TIMEOUT_MS = 10_000;

const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 10_000;

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
    const normalized = normalizeMediaWikiTitle(title);
    if (normalized === null) {
      throw new WikipediaError("INVALID_RESPONSE", "Invalid article title");
    }
    title = normalized;
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
    if (
      typeof page.ns === "number" &&
      Number.isInteger(page.ns) &&
      page.ns !== 0
    ) {
      return null;
    }
    this.requireMainNamespace(page);

    if (this.expectedCanonicalTitle(body, title) !== resolvedTitle) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "MediaWiki resolution does not correspond to the requested title",
      );
    }

    return { pageId, title: resolvedTitle };
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    const query = new URLSearchParams(params);
    const url = `${this.baseUrl}?${query.toString()}`;

    let response!: Response;
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
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

      if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
        break;
      }
      const retryAfter = response.headers.get("Retry-After");
      let delay = 1000 * 2 ** attempt;
      if (retryAfter !== null) {
        const seconds = /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
          ? Number(retryAfter)
          : NaN;
        const requestedDelay = Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(requestedDelay))
          delay = Math.max(delay, requestedDelay);
      }
      // Do not retry earlier than a long Retry-After, or hold an API request open
      // indefinitely. Return the upstream error and let the player retry later.
      if (delay > MAX_RETRY_WAIT_MS) break;
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!response.ok) {
      await response.body?.cancel();
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

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
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

  async getPageInfo(
    pageId: number,
  ): Promise<{
    pageId: number;
    title: string;
    length?: number;
    redirect: boolean;
  }> {
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
      redirect: page.redirect === true,
    };
  }

  private singlePage(body: MediaWikiQueryResponse): MediaWikiPage {
    const pages = this.requirePagesArray(body);
    if (pages.length !== 1) {
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
    const hops = new Map<string, string>();
    for (const entries of [body.query?.normalized, body.query?.redirects]) {
      if (entries === undefined) continue;
      if (!Array.isArray(entries)) {
        throw new WikipediaError(
          "INVALID_RESPONSE",
          "Malformed title mappings",
        );
      }
      for (const entry of entries) {
        const from = normalizeMediaWikiTitle(entry?.from);
        const to = normalizeMediaWikiTitle(entry?.to);
        if (from === null || to === null) {
          throw new WikipediaError(
            "INVALID_RESPONSE",
            "Malformed title mapping",
          );
        }
        if (from !== to) hops.set(from, to);
      }
    }
    let title = requestedTitle;
    const seen = new Set<string>();
    while (hops.has(title)) {
      if (seen.has(title)) {
        throw new WikipediaError("INVALID_RESPONSE", "Cyclic title mapping");
      }
      seen.add(title);
      title = hops.get(title)!;
    }
    return title;
  }
}
