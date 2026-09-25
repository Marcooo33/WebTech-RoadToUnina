import { WikipediaError } from "./wikipedia.errors.js";

const API_URL = "https://it.wikipedia.org/w/api.php";
// Wikimedia heavily rate-limits clients whose User-Agent has no contact info
// (HTTP 429 after ~10 requests), so it must include the project URL.
const USER_AGENT = "ROADTOUNINA/1.0 (https://github.com/Marcooo33/WebTech-RoadToUnina)";
const TIMEOUT_MS = 10_000;

export interface ParsedPage {
  pageId: number;
  title: string;
  html: string;
  // Titles of existing main-namespace articles linked from the page.
  linkTitles: string[];
}

export interface RandomPage {
  pageId: number;
  title: string;
  length: number;
}

interface ParseResponse {
  parse: {
    pageid: number;
    title: string;
    text: string;
    links: { ns: number; title: string; exists?: boolean }[];
  };
}

interface RandomResponse {
  query?: {
    pages: { pageid: number; title: string; length: number }[];
  };
}

export class MediaWikiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  // Parses an article by id, or by title following redirects. Returns null
  // when the page does not exist.
  async parse(page: { pageId: number } | { title: string }): Promise<ParsedPage | null> {
    const body = await this.request<ParseResponse>({
      action: "parse",
      ...("pageId" in page
        ? { pageid: String(page.pageId) }
        : { page: page.title, redirects: "1" }),
      prop: "text|links",
      disableeditsection: "1",
      disabletoc: "1",
      disablelimitreport: "1",
    });
    if (body === null) return null;

    const { pageid, title, text, links } = body.parse;
    return {
      pageId: pageid,
      title,
      html: text,
      linkTitles: links
        .filter((link) => link.ns === 0 && link.exists)
        .map((link) => link.title),
    };
  }

  async randomPages(limit: number): Promise<RandomPage[]> {
    const body = await this.request<RandomResponse>({
      action: "query",
      generator: "random",
      grnnamespace: "0",
      grnfilterredir: "nonredirects",
      grnlimit: String(limit),
      prop: "info",
    });
    return (body?.query?.pages ?? []).map((page) => ({
      pageId: page.pageid,
      title: page.title,
      length: page.length,
    }));
  }

  // Returns null when MediaWiki reports a missing page.
  private async request<T>(params: Record<string, string>): Promise<T | null> {
    const query = new URLSearchParams({ ...params, format: "json", formatversion: "2" });

    let response: Response;
    try {
      response = await this.fetchImpl(`${API_URL}?${query}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new WikipediaError("UNAVAILABLE", "Failed to reach MediaWiki", { cause: error });
    }

    if (!response.ok) {
      throw new WikipediaError("UNAVAILABLE", `MediaWiki returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as T & { error?: { code: string } };
    if (body.error) {
      if (body.error.code === "missingtitle" || body.error.code === "nosuchpageid") {
        return null;
      }
      throw new WikipediaError("UNAVAILABLE", `MediaWiki error: ${body.error.code}`);
    }
    return body;
  }
}
