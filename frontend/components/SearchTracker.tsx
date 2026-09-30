"use client";

import { useEffect } from "react";
import { trackStoreEvent } from "@/lib/client-tracking";

export default function SearchTracker({ query }: { query: string }) {
  useEffect(() => {
    if (!query) return;
    trackStoreEvent("Search", { search_string: query }).catch(() => undefined);
  }, [query]);
  return null;
}
