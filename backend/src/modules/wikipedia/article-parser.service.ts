import { render } from "dom-serializer";
import type { Element, Node, Text } from "domhandler";
import { ElementType, parseDocument } from "htmlparser2";
import sanitizeHtml from "sanitize-html";
import { normalizeMediaWikiTitle } from "./wikipedia.validation.js";
import type {
  NormalizedArticle,
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
  "img",
];

const ARTICLE_PATH_PREFIX = "/wiki/";
const IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

function normalizeImageSource(source: string | undefined): string | null {
  if (!source || /[\s\u0000-\u001f\u007f\\]/u.test(source)) return null;
  const absolute = source.startsWith("//") ? `https:${source}` : source;
  if (!/^https:\/\/[^/]/.test(absolute)) return null;

  try {
    decodeURI(absolute);
    const url = new URL(absolute);
    if (
      url.protocol !== "https:" ||
      !IMAGE_HOSTS.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith("/wikipedia/")
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function positiveInteger(value: string | undefined): string | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? String(number) : undefined;
}

function normalizeCell(tagName: string, attribs: Record<string, string>) {
  const normalized = { ...attribs };
  for (const name of ["colspan", "rowspan"]) {
    const value = positiveInteger(attribs[name]);
    if (value === undefined) delete normalized[name];
    else normalized[name] = value;
  }
  if (!["row", "col", "rowgroup", "colgroup"].includes(attribs.scope ?? "")) {
    delete normalized.scope;
  }
  return { tagName, attribs: normalized };
}

// Italian Wikipedia namespace names, canonical names and aliases from siteinfo.
// This is local filtering only; the selected page's namespace is checked by the client.
const NON_ARTICLE_PREFIXES = new Set([
  "media",
  "speciale",
  "special",
  "discussione",
  "talk",
  "utente",
  "user",
  "discussioni utente",
  "user talk",
  "wikipedia",
  "project",
  "wp",
  "discussioni wikipedia",
  "project talk",
  "wikipedia talk",
  "dw",
  "file",
  "image",
  "immagine",
  "discussioni file",
  "file talk",
  "discussioni immagine",
  "image talk",
  "mediawiki",
  "discussioni mediawiki",
  "mediawiki talk",
  "template",
  "t",
  "discussioni template",
  "template talk",
  "aiuto",
  "help",
  "discussioni aiuto",
  "help talk",
  "categoria",
  "category",
  "cat",
  "discussioni categoria",
  "category talk",
  "portale",
  "discussioni portale",
  "progetto",
  "discussioni progetto",
  "dp",
  "bozza",
  "discussioni bozza",
  "timedtext",
  "timedtext talk",
  "modulo",
  "module",
  "discussioni modulo",
  "module talk",
  "evento",
  "event",
  "discussioni evento",
  "event talk",
]);

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

  const normalized = normalizeMediaWikiTitle(title);
  if (normalized === null || normalized.startsWith(":")) return null;
  const colon = normalized.indexOf(":");
  if (
    colon !== -1 &&
    NON_ARTICLE_PREFIXES.has(normalized.slice(0, colon).toLowerCase())
  )
    return null;
  return normalized;
}

function isCitationMarker(frame: {
  tag: string;
  attribs: Record<string, string>;
}): boolean {
  const cls = frame.attribs.class ?? "";
  const id = frame.attribs.id ?? "";

  return (
    frame.tag === "sup" && (/\breference\b/.test(cls) || /^cite_/.test(id))
  );
}

function isReferenceList(frame: {
  tag: string;
  attribs: Record<string, string>;
}): boolean {
  const cls = frame.attribs.class ?? "";

  return /\breferences\b|\breflist\b|mw-references/.test(cls);
}

function isExcludedFrame(frame: {
  tag: string;
  attribs: Record<string, string>;
}): boolean {
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

// Complete normalized bibliography/reference headings. Only an exact match on
// the whole heading (or its MediaWiki id) counts, so legitimate sections whose
// titles merely contain a word like "fonti", "note" or "riferimenti" (e.g.
// "Fonti rinnovabili", "Note storiche", "Riferimenti normativi") are never
// suppressed.
const BIBLIOGRAPHY_HEADINGS = new Set([
  "bibliografia",
  "bibliografia e sitografia",
  "bibliography",
  "fonti",
  "fonti bibliografiche",
  "fonti e note",
  "note",
  "note a piè di pagina",
  "note e riferimenti",
  "notes",
  "references",
  "reference",
  "riferimenti",
  "riferimenti bibliografici",
  "riferimenti e note",
  "sitografia",
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

function normalizeHeading(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

// MediaWiki heading ids use underscores for spaces and may carry a numeric
// suffix when the same heading occurs twice (e.g. "Note_2").
function normalizedHeadingId(value: string): string {
  return normalizeHeading(value.replace(/_/g, " ")).replace(/\s+\d+$/, "");
}

function isBibliographyHeading(element: Element): boolean {
  const text = normalizeHeading(textContentOf(element));
  const id = normalizedHeadingId(element.attribs.id ?? "");

  return BIBLIOGRAPHY_HEADINGS.has(text) || BIBLIOGRAPHY_HEADINGS.has(id);
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
  normalize(page: WikipediaPageIdentity, html: string): NormalizedArticle {
    const contentHtml = sanitizeHtml(neutralizeCitationAnchors(html), {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: {
        a: ["data-page-title"],
        table: ["class"],
        th: ["colspan", "rowspan", "scope"],
        td: ["colspan", "rowspan"],
        img: ["src", "alt", "width", "height", "loading"],
      },
      allowedClasses: { table: ["infobox", "sinottico"] },
      allowedSchemes: [],
      allowedSchemesByTag: { img: ["https"] },
      allowProtocolRelative: false,
      transformTags: {
        th: normalizeCell,
        td: normalizeCell,
        img: (_tagName, attribs) => {
          const src = normalizeImageSource(attribs.src);
          const safe: Record<string, string> = {};
          if (src !== null) {
            safe.src = src;
            safe.loading = "lazy";
            if (attribs.alt !== undefined) safe.alt = attribs.alt;
            for (const name of ["width", "height"]) {
              const value = positiveInteger(attribs[name]);
              if (value !== undefined) safe[name] = value;
            }
          }
          return { tagName: "img", attribs: safe };
        },
        a: (
          _tagName,
          attribs,
        ): { tagName: string; attribs: Record<string, string> } => {
          const excluded =
            /(?:^|\s)(?:new|extiw|external|interwiki)(?:\s|$)/i.test(
              attribs.class ?? "",
            ) || /Interwiki/i.test(attribs.rel ?? "");
          const title = excluded ? null : extractArticleTitle(attribs.href);
          return title === null
            ? { tagName: "span", attribs: {} }
            : { tagName: "a", attribs: { "data-page-title": title } };
        },
      },
      exclusiveFilter: (frame) =>
        isExcludedFrame(frame) || (frame.tag === "img" && !frame.attribs.src),
    });

    // Collect only anchors that actually survived sanitization, including
    // removal of script/style and reference containers.
    const titles = new Set<string>();
    const collect = (nodes: Node[]): void => {
      for (const node of nodes) {
        if (node.type !== ElementType.Tag) continue;
        const element = node as Element;
        if (element.name === "a" && element.attribs["data-page-title"]) {
          titles.add(element.attribs["data-page-title"]);
        }
        collect(element.children);
      }
    };
    collect(parseDocument(contentHtml).children);
    return {
      ...page,
      contentHtml,
      links: [...titles].map((title) => ({ title })),
    };
  }
}
