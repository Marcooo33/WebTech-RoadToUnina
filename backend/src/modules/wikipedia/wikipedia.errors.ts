export type WikipediaErrorKind =
  | "NETWORK"
  | "INVALID_RESPONSE"
  | "PAGE_NOT_FOUND"
  | "NO_SUITABLE_STARTING_PAGE";

export class WikipediaError extends Error {
  constructor(
    public readonly kind: WikipediaErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "WikipediaError";
  }
}
