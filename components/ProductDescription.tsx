"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { getDescriptionView } from "@/lib/description";

const DURATION_MS = 320;

/** One description paragraph that expands in place, with a smooth height animation; short descriptions get no toggle. */
export default function ProductDescription({ description, initiallyExpanded = false }: { description: string; initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const textId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const startHeight = useRef<number | null>(null);
  const view = getDescriptionView(description, expanded);

  function toggle() {
    // Remember the current height so the next render can animate from it to the new one.
    startHeight.current = boxRef.current?.offsetHeight ?? null;
    setExpanded((open) => !open);
  }

  useLayoutEffect(() => {
    const box = boxRef.current;
    const from = startHeight.current;
    startHeight.current = null;
    if (!box || from === null) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const to = box.offsetHeight;
    if (reduced || from === to) return;
    box.style.overflow = "hidden";
    box.style.height = `${from}px`;
    box.getBoundingClientRect(); // force a reflow so the starting height is applied before animating
    box.style.transition = `height ${DURATION_MS}ms ease`;
    box.style.height = `${to}px`;
    const finish = () => { box.style.height = ""; box.style.overflow = ""; box.style.transition = ""; };
    const timer = window.setTimeout(finish, DURATION_MS + 60);
    return () => { window.clearTimeout(timer); finish(); };
  }, [expanded]);

  return <>
    <div ref={boxRef}><p className="product-description" id={textId}>{view.text}</p></div>
    {view.collapsible && <button type="button" className="description-toggle" aria-expanded={expanded} aria-controls={textId} onClick={toggle}>{expanded ? "Show less" : "Read full description"}</button>}
  </>;
}
