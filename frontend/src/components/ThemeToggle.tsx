"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/lib/useMounted";

export type Theme = "light" | "dark";

/** Shared with the pre-paint script in layout.tsx — keep the two in step. */
export const THEME_STORAGE_KEY = "picaso-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Day/night switch for the drawing sheet.
 *
 * Nothing here sets colours: it only pins `color-scheme` on <html>, which is
 * what the `light-dark()` tokens in globals.css resolve against. Reads with no
 * stored preference follow the OS and keep following it — the media query below
 * exists so a system change is picked up live rather than at the next reload.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const mounted = useMounted();

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    setTheme(stored === "light" || stored === "dark" ? stored : systemTheme());

    if (stored === "light" || stored === "dark") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(systemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Toggle theme"}
      className="label -m-1 flex items-center p-1 transition-colors duration-500 hover:text-ink"
    >
      {/* Hairline strokes at the same 1px weight as the rules and the grid — a
          drawn symbol, not a filled glyph. currentColor inherits the label's ash
          and its hover to ink, so the icon needs no colours of its own.
          Before mount the stored preference is unknown, so neither symbol is
          honest: a bare circle stands in, the way the chain reads "—". */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {!mounted ? (
          <circle cx="8" cy="8" r="5" />
        ) : theme === "dark" ? (
          <path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53Z" />
        ) : (
          <>
            <circle cx="8" cy="8" r="3.25" />
            <path d="M8 .9v2.1M8 13v2.1M.9 8h2.1M13 8h2.1M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13" />
          </>
        )}
      </svg>
    </button>
  );
}
