import { render } from "dom-serializer";
import type { Element, Node } from "domhandler";
import { ElementType, parseDocument } from "htmlparser2";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import type {
  NormalizedArticle,
  PlayableLink,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

const ALLOWED_TAGS = [
  "a",
  "p",
  "br",
  "hr",
  "div",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "s",
  "del",
  "u",
  "small",
  "sub",
  "sup",
  "blockquote",
  "cite",
  "code",
  "pre",
  "abbr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "figure",
  "figcaption",
];

const ARTICLE_PATH_PREFIX = "/wiki/";

function normalizeTitle(title: string): string {
  return title.replace(/_/g, " ").trim();
}

function extractArticleTitle(href: string | undefined): string | null {
  if (typeof href !== "string") {
    return null;
  }

  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Fragment-only references do not navigate to another article.
  if (trimmed.startsWith("#")) {
    return null;
  }

  // Protocol-relative and scheme-qualified URLs point outside the controlled
  // sandbox; only relative article paths are eligible.
  if (trimmed.startsWith("//")) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }

  // Separate the pathname from any fragment (section anchor).
  const fragmentIndex = trimmed.indexOf("#");
  const withoutFragment =
    fragmentIndex === -1 ? trimmed : trimmed.slice(0, fragmentIndex);

  // Separate the pathname from any query string. Ordinary article navigation
  // links are plain `/wiki/Title` paths; a query string on a `/wiki/` URL
  // signals MediaWiki control/action semantics (action=, veaction=, oldid=,
  // diff=, curid=, redlink=, ...) which must never become playable.
  const queryIndex = withoutFragment.indexOf("?");
  if (queryIndex !== -1) {
    return null;
  }

  const pathname = withoutFragment;

  // The pathname must begin exactly with the canonical article prefix.
  if (!pathname.startsWith(ARTICLE_PATH_PREFIX)) {
    return null;
  }

  const rawTitle = pathname.slice(ARTICLE_PATH_PREFIX.length);
  if (rawTitle.length === 0) {
    return null;
  }

  let title: string;
  try {
    title = decodeURIComponent(rawTitle);
  } catch {
    return null;
  }

  title = normalizeTitle(title);
  return title.length > 0 ? title : null;
}

function isCitationMarker(frame: { tag: string; attribs: Record<string, string> }): boolean {
  const cls = frame.attribs.class ?? "";
  const id = frame.attribs.id ?? "";

  return (
    frame.tag === "sup" &&
    (/\breference\b/.test(cls) || /^cite_/.test(id))
  );
}

function isReferenceList(frame: { tag: string; attribs: Record<string, string> }): boolean {
  const cls = frame.attribs.class ?? "";

  return /\breferences\b|\breflist\b|mw-references/.test(cls);
}

const CITATION_CLASS_TOKENS = new Set([
  "bibliography",
  "citation",
  "mw-references",
  "mw-references-wrap",
  "reference",
  "reference-text",
  "references",
  "reflist",
]);

function isCitationContextElement(element: Element): boolean {
  if (element.name === "cite") {
    return true;
  }

  const classAttr = element.attribs.class;
  if (typeof classAttr !== "string" || classAttr.length === 0) {
    return false;
  }

  return classAttr
    .split(/\s+/)
    .some((token) => CITATION_CLASS_TOKENS.has(token.toLowerCase()));
}

function walkNodes(nodes: Node[], inCitation: boolean): void {
  for (const node of nodes) {
    if (node.type !== ElementType.Tag) {
      continue;
    }

    const element = node as Element;
    const hereIsCitation = inCitation || isCitationContextElement(element);

    if (element.name === "a" && hereIsCitation) {
      delete element.attribs.href;
    }

    walkNodes(element.children, hereIsCitation);
  }
}

function neutralizeCitationAnchors(html: string): string {
  const document = parseDocument(html);
  walkNodes(document.children, false);
  return render(document);
}

export class ArticleParserService {
  normalize(
    page: WikipediaPageIdentity,
    html: string,
    links: PlayableLink[],
  ): NormalizedArticle {
    const linksByTitle = new Map<string, PlayableLink>();
    for (const link of links) {
      linksByTitle.set(normalizeTitle(link.title), link);
    }

    const usedTitles = new Set<string>();
    const contentHtml = sanitizeHtml(
      neutralizeCitationAnchors(html),
      this.options(linksByTitle, usedTitles),
    );

    const playableLinks = links.filter((link) =>
      usedTitles.has(normalizeTitle(link.title)),
    );

    return {
      pageId: page.pageId,
      title: page.title,
      contentHtml,
      links: playableLinks,
    };
  }

  private options(
    linksByTitle: Map<string, PlayableLink>,
    usedTitles: Set<string>,
  ): IOptions {
    return {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: {
        a: ["data-page-id", "data-page-title"],
      },
      allowedSchemes: [],
      allowProtocolRelative: false,
      transformTags: {
        a: (_tagName, attribs) => this.transformAnchor(attribs, linksByTitle, usedTitles),
      },
      exclusiveFilter: (frame) =>
        isCitationMarker(frame) || isReferenceList(frame),
    };
  }

  private transformAnchor(
    attribs: Record<string, string>,
    linksByTitle: Map<string, PlayableLink>,
    usedTitles: Set<string>,
  ): { tagName: string; attribs: Record<string, string> } {
    const title = extractArticleTitle(attribs.href);
    const link = title ? linksByTitle.get(normalizeTitle(title)) : undefined;

    if (!link) {
      return { tagName: "span", attribs: {} };
    }

    usedTitles.add(normalizeTitle(link.title));

    return {
      tagName: "a",
      attribs: {
        "data-page-id": String(link.pageId),
        "data-page-title": link.title,
      },
    };
  }
}
