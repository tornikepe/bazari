"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the server a page was opened. Nothing else.
 *
 * One `sendBeacon` per navigation, carrying the path and nothing that
 * identifies anybody: no cookie is read or set, no id is minted, and the
 * request is fire-and-forget so a slow answer can never slow the page. The
 * server counts it against the day — see `lib/traffic.ts` for what is kept,
 * which is a number.
 *
 * Off when the browser asks not to be tracked. There is nothing here that
 * tracks, but the reader who set that flag did not set it to be argued with.
 */
export function TrafficBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;
    if (navigator.doNotTrack === "1") return;

    navigator.sendBeacon(
      "/api/hit",
      new Blob([JSON.stringify({ path: pathname })], { type: "application/json" }),
    );
  }, [pathname]);

  return null;
}
