export interface WikipediaPageIdentity {
  pageId: number;
  title: string;
}

// A source-link target submitted for canonical resolution. `pageId` is the
// generator/random-page id, retained as metadata for the caller; the resolution
// result carries its own authoritative canonical identity.
export interface TitleResolutionSource {
  pageId: number;
  title: string;
}

// Outcome of resolving a single source-link title against MediaWiki redirects.
// `DIRECT` and `REDIRECT` both carry the authoritative canonical identity that
// was validated by the latest resolution request. `UNRESOLVED` means the title
// could not be trusted (missing/malformed/non-main namespace canonical target)
// and must be excluded.
export type TitleResolution =
  | { kind: "DIRECT"; canonical: WikipediaPageIdentity }
  | { kind: "REDIRECT"; canonical: WikipediaPageIdentity }
  | { kind: "UNRESOLVED" };

export interface PlayableLink {
  pageId: number;
  title: string;
  sourceTitle?: string;
}

export interface NormalizedArticle {
  pageId: number;
  title: string;
  contentHtml: string;
  links: PlayableLink[];
}

export interface MediaWikiApiError {
  code: string;
  info: string;
}

export interface MediaWikiRedirect {
  from: string;
  to: string;
}

export interface MediaWikiNormalized {
  from: string;
  to: string;
}

export interface MediaWikiLink {
  ns: number;
  title: string;
  pageid?: number;
}

export interface MediaWikiPage {
  pageid?: number;
  ns?: number;
  title?: string;
  missing?: boolean;
  length?: number;
  links?: MediaWikiLink[];
}

export interface MediaWikiRandomItem {
  id: number;
  ns: number;
  title: string;
}

export interface MediaWikiContinue {
  continue?: string;
  gplcontinue?: string;
  [key: string]: string | undefined;
}

export interface MediaWikiQueryResponse {
  query?: {
    pages?: MediaWikiPage[];
    random?: MediaWikiRandomItem[];
    redirects?: MediaWikiRedirect[];
    normalized?: MediaWikiNormalized[];
  };
  continue?: MediaWikiContinue;
  error?: MediaWikiApiError;
}

export interface MediaWikiParseResponse {
  parse?: {
    pageid: number;
    title: string;
    text?: string | { "*": string };
    redirects?: MediaWikiRedirect[];
  };
  error?: MediaWikiApiError;
}

export interface MediaWikiArticleLinks {
  pageId: number;
  title: string;
  length?: number;
  links: MediaWikiLink[];
}
