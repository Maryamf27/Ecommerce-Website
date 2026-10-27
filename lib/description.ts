export const DESCRIPTION_PREVIEW_LIMIT = 280;

export type DescriptionView = {
  /** The text to display right now (preview or full). */
  text: string;
  /** True when the description is longer than the limit, i.e. a toggle is needed. */
  collapsible: boolean;
};

/** Returns the single text to show for a description, and whether it can be expanded. */
export function getDescriptionView(raw: string, expanded: boolean, limit = DESCRIPTION_PREVIEW_LIMIT): DescriptionView {
  const description = raw.trim();
  if (description.length <= limit) return { text: description, collapsible: false };
  if (expanded) return { text: description, collapsible: true };
  // Cut at the last whole word and add an ellipsis (same preview as before).
  return { text: `${description.slice(0, limit).replace(/\s+\S*$/, "")}…`, collapsible: true };
}
