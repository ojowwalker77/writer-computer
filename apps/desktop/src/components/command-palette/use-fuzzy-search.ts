import { useEffect, useRef, useState } from "react";
import * as tauri from "@/lib/tauri";
import type { SearchResult } from "@/types/fs";

export function useFuzzySearch(query: string, limit = 20) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void tauri.fuzzySearch(query, limit).then(setResults);
    }, 50);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, limit]);

  return results;
}
