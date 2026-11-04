"use client";

import { useEffect } from "react";

/**
 * Arms section entrances once script is running (content stays visible without it), then reveals
 * each [data-reveal] element the first time it scrolls into view.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Anything already on screen is shown immediately so the first paint never blanks.
    const viewportBottom = window.innerHeight;
    for (const el of targets) {
      if (el.getBoundingClientRect().top < viewportBottom) el.classList.add("is-revealed");
    }
    root.classList.add("reveal-armed");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of targets) if (!el.classList.contains("is-revealed")) observer.observe(el);
    return () => {
      observer.disconnect();
      root.classList.remove("reveal-armed");
    };
  }, []);

  return null;
}
