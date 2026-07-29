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
      // Before mount the stored preference is unknown, and guessing would print a
      // label contradicting the colours already on screen. The header shows "—"
      // for the chain under the same rule.
      aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : undefined}
      className="label transition-colors duration-500 hover:text-ink"
    >
      {mounted ? (theme === "dark" ? "Dark" : "Light") : "—"}
    </button>
  );
}
