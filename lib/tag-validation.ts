export type NormalizedTag = { name: string; slug: string };

export function normalizeTagName(value: unknown): NormalizedTag | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 60) return null;
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
  return slug ? { name, slug } : null;
}
