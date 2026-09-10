export function isValidMediaWikiPageId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function normalizeMediaWikiTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  // Titles are decoded from URLs by the parser, not by the REST boundary.
  // Reject MediaWiki's multi-title delimiter and invalid title characters.
  if (/[\u0000-\u001f\u007f|#<>\[\]{}]/u.test(value)) return null;
  const normalized = value
    .normalize("NFC")
    .replace(/_/g, " ")
    .replace(/ +/g, " ")
    .trim();
  if (normalized.length === 0 || Buffer.byteLength(normalized, "utf8") > 255)
    return null;
  return normalized.charAt(0).toLocaleUpperCase("it") + normalized.slice(1);
}
