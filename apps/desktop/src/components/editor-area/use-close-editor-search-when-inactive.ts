import { useEffect } from "react";
import { closeEditorSearch } from "./editor-search-store";

export function useCloseEditorSearchWhenInactive(isActive: boolean) {
  useEffect(() => {
    if (!isActive) closeEditorSearch();
  }, [isActive]);
}
