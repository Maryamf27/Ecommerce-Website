"use client";

import { useId, useState } from "react";
import { getDescriptionView } from "@/lib/description";

/** One description paragraph that expands in place; short descriptions get no toggle. */
export default function ProductDescription({ description, initiallyExpanded = false }: { description: string; initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const textId = useId();
  const view = getDescriptionView(description, expanded);
  return <>
    <p className="product-description" id={textId}>{view.text}</p>
    {view.collapsible && <button type="button" className="description-toggle" aria-expanded={expanded} aria-controls={textId} onClick={() => setExpanded((open) => !open)}>{expanded ? "Show less" : "Read full description"}</button>}
  </>;
}
