import { render } from "dom-serializer";
import type { Element, Node, Text } from "domhandler";
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

function matchingTitle(link: PlayableLink): string {
  return normalizeTitle(link.sourceTitle ?? link.title);
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

function isExcludedFrame(frame: { tag: string; attribs: Record<string, string> }): boolean {
  return isCitationMarker(frame) || isReferenceList(frame);
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

const BIBLIOGRAPHY_HEADING_KEYWORDS = new Set([
  "bibliografia",
  "bibliography",
  "bibliografiche",
  "bibliografici",
  "riferimenti",
  "references",
  "reference",
  "note",
  "notes",
  "fonti",
  "sources",
]);

function headingLevelOf(tagName: string): number | null {
  const match = /^h([1-6])$/.exec(tagName);
  return match === null ? null : Number(match[1]);
}

function textContentOf(node: Node): string {
  if (node.type === ElementType.Text) {
    return (node as Text).data;
  }

  if (node.type === ElementType.Tag) {
    return (node as Element).children.map(textContentOf).join("");
  }

  return "";
}

function isBibliographyHeading(element: Element): boolean {
  const id = element.attribs.id ?? "";
  const text = textContentOf(element);

  const combined = `${text} ${id}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

  return combined.some((token) => BIBLIOGRAPHY_HEADING_KEYWORDS.has(token));
}

interface BibliographyState {
  inBibliography: boolean;
  bibliographyLevel: number;
}

function processNodes(
  nodes: Node[],
  inCitation: boolean,
  bibliography: BibliographyState,
): void {
  for (const node of nodes) {
    if (node.type !== ElementType.Tag) {
      continue;
    }

    const element = node as Element;
    const tagName = element.name;

    // A heading either opens a bibliography/reference section or, when it sits
    // at the same or a higher level, closes the current one.
    const headingLevel = headingLevelOf(tagName);
    if (headingLevel !== null) {
      if (isBibliographyHeading(element)) {
        bibliography.inBibliography = true;
        bibliography.bibliographyLevel = headingLevel;
      } else if (
        bibliography.inBibliography &&
        headingLevel <= bibliography.bibliographyLevel
      ) {
        bibliography.inBibliography = false;
      }
      continue;
    }

    const hereIsCitation =
      inCitation ||
      bibliography.inBibliography ||
      isCitationContextElement(element);

    if (tagName === "a" && hereIsCitation) {
      delete element.attribs.href;
    }

    processNodes(element.children, hereIsCitation, bibliography);
  }
}

function neutralizeCitationAnchors(html: string): string {
  const document = parseDocument(html);
  processNodes(document.children, false, {
    inBibliography: false,
    bibliographyLevel: 0,
  });
  return render(document);
}

export class ArticleParserService {
  // First-pass: collect the normalized, contextually playable source titles
  // present in the raw article HTML. Citation/reference/bibliography contexts
  // are excluded using the same rules as `normalize`, so the collected targets
  // cannot drift from what gets rendered as playable.
  collectPlayableTitles(html: string): string[] {
    const titles = new Set<string>();

    sanitizeHtml(neutralizeCitationAnchors(html), {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: {},
      allowedSchemes: [],
      allowProtocolRelative: false,
      transformTags: {
        a: (_tagName, attribs) => {
          const title = extractArticleTitle(attribs.href);
          if (title !== null) {
            titles.add(title);
          }
          return { tagName: "span", attribs: {} };
        },
      },
      exclusiveFilter: (frame) => isExcludedFrame(frame),
    });

    return [...titles];
  }

  normalize(
    page: WikipediaPageIdentity,
    html: string,
    links: PlayableLink[],
  ): NormalizedArticle {
    const linksByTitle = new Map<string, PlayableLink>();
    for (const link of links) {
      linksByTitle.set(matchingTitle(link), link);
    }

    const usedTitles = new Set<string>();
    const contentHtml = sanitizeHtml(
      neutralizeCitationAnchors(html),
      this.options(linksByTitle, usedTitles),
    );

    const playableLinks = links
      .filter((link) => usedTitles.has(matchingTitle(link)))
      .map((link) => ({ pageId: link.pageId, title: link.title }));

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
      exclusiveFilter: (frame) => isExcludedFrame(frame),
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

    usedTitles.add(matchingTitle(link));

    return {
      tagName: "a",
      attribs: {
        "data-page-id": String(link.pageId),
        "data-page-title": link.title,
      },
    };
  }
}
