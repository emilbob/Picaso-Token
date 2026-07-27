"use client";

import { useEffect, useState } from "react";

/**
 * False during the server render and the first client render, true after.
 *
 * Wallet state cannot exist in prerendered HTML, so any component that renders
 * it directly is guaranteed to fail hydration — the page then re-renders from
 * scratch on the client. Gate on this and render the server's markup until
 * mounted. React reports only the first mismatch it hits, so a component that
 * skips this hides the next one rather than being correct.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
