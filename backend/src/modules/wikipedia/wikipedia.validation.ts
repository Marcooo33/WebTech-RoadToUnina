export function isValidMediaWikiPageId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

export function normalizeMediaWikiTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/_/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}
