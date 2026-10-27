"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

// useLayoutEffect warns during server rendering; fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Resets the window scroll position to the top whenever the route changes, so a new page
 * never opens at the scroll offset of the previous one. Rendered once in the root layout,
 * which covers every page.
 *
 * - The browser's own scroll restoration is switched off so back/forward also start at the top.
 * - Links that point at a #section are left alone so anchor navigation keeps working.
 * - The jump is instant; the global `scroll-behavior: smooth` would otherwise animate it.
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
