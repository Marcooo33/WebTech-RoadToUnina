import sanitizeHtml from "sanitize-html";
import { normalizeMediaWikiTitle } from "./wikipedia.validation.js";
import type {
  NormalizedArticle,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

const ALLOWED_TAGS = [
  "a", "p", "br", "hr", "div", "span", "b", "strong", "i", "em", "s", "del",
  "u", "small", "sub", "sup", "blockquote", "code", "pre", "abbr",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "figure", "figcaption", "img",
];

// Footnote markers, reference lists and citation templates only add noise to
// the game (and links to sources), so they are removed entirely.
const REFERENCE_CLASS = /(?:^|\s)(?:reference|references|reflist|mw-references-wrap|citation|mw-cite-backlink)(?:\s|$)/;

// Returns the linked article title for a plain `/wiki/Title` href, or null.
function titleFromHref(href: string | undefined): string | null {
  if (!href?.startsWith("/wiki/") || href.includes("?")) return null;
  try {
    return normalizeMediaWikiTitle(decodeURIComponent(href.slice(6).split("#")[0]));
  } catch {
    return null;
  }
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Keeps a safe subset of the MediaWiki HTML. An anchor becomes a playable
// `<a data-page-title>` only if it points to one of `linkTitles` (existing
// main-namespace articles, as reported by MediaWiki); every other anchor
// becomes a plain span.
export function normalizeArticle(
  page: WikipediaPageIdentity,
  html: string,
  linkTitles: string[],
): NormalizedArticle {
  const playable = new Set(linkTitles.map(normalizeMediaWikiTitle));
  const heading = (tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => ({
    tagName,
    // Prefixed so article ids cannot clash with ids used by the app.
    attribs: attribs.id ? { id: `rtu-section-${attribs.id}` } : {},
  });

  const contentHtml = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["data-page-title"],
      table: ["class"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      img: ["src", "alt", "width", "height", "loading"],
      h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    },
    allowedClasses: { table: ["infobox", "sinottico"] },
    allowedSchemes: [],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      h2: heading, h3: heading, h4: heading, h5: heading, h6: heading,
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const title = titleFromHref(attribs.href);
        return title !== null && playable.has(title)
          ? { tagName: "a", attribs: { "data-page-title": title } }
          : { tagName: "span", attribs: {} };
      },
      // Only Wikimedia-hosted images; MediaWiki uses protocol-relative URLs.
      img: (_tagName, attribs): sanitizeHtml.Tag => {
        const src = /^\/\/(upload|thumb)\.wikimedia\.org\//.test(attribs.src ?? "")
          ? `https:${attribs.src}`
          : undefined;
        return {
          tagName: "img",
          attribs: src ? { ...attribs, src, loading: "lazy" } : {},
        };
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === "cite" ||
      REFERENCE_CLASS.test(frame.attribs.class ?? "") ||
      (frame.tag === "img" && !frame.attribs.src),
  });

  // Collect the anchors that survived sanitization (not those inside removed
  // references), so `links` matches exactly what the player can click.
  const titles = new Set(
    [...contentHtml.matchAll(/<a data-page-title="([^"]*)"/g)].map((match) =>
      decodeAttribute(match[1]),
    ),
  );

  return {
    ...page,
    contentHtml,
    links: [...titles].map((title) => ({ title })),
  };
}
