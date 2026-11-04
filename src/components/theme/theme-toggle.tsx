"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, THEMES, isTheme, type Theme } from "./theme-constants";

const LABELS: Record<Theme, string> = { system: "Auto", light: "Day", dark: "Night" };
const CHANGE_EVENT = "voyager-theme-change";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system"; // storage blocked (private mode): follow the system setting
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this visit; it just won't be remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Three-way segmented control: follow the system, or force day / night. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => "system" as Theme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex rounded-control bg-raised p-0.5 text-meta ${className}`}
    >
      {THEMES.map((option) => {
        const selected = option === theme;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => applyTheme(option)}
            className={`pressable min-h-8 rounded-[3px] px-2.5 ${
              selected ? "bg-panel text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
