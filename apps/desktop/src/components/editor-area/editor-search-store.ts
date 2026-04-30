import { create } from "zustand";
import { closeSearchPanel, openSearchPanel, SearchQuery, setSearchQuery } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";

interface EditorSearchState {
  isOpen: boolean;
  view: EditorView | null;
  openVersion: number;
  // Bumped on every doc/selection change so the overlay can recompute the
  // match count without subscribing to CodeMirror state directly.
  docVersion: number;
  bumpDocVersion: (view: EditorView) => void;
}

export const useEditorSearchStore = create<EditorSearchState>((set) => ({
  isOpen: false,
  view: null,
  openVersion: 0,
  docVersion: 0,
  bumpDocVersion: (view) =>
    set((s) => {
      if (!s.isOpen || s.view !== view) return s;
      return { docVersion: s.docVersion + 1 };
    }),
}));

export function openEditorSearch(view: EditorView) {
  const currentView = useEditorSearchStore.getState().view;
  if (currentView && currentView !== view) closeSearchPanel(currentView);

  openSearchPanel(view);
  useEditorSearchStore.setState((s) => ({ isOpen: true, view, openVersion: s.openVersion + 1 }));
}

export function closeEditorSearch({
  view,
  restoreFocus = false,
}: { view?: EditorView; restoreFocus?: boolean } = {}) {
  const currentView = useEditorSearchStore.getState().view;
  if (view && currentView !== view) return;

  if (currentView) closeSearchPanel(currentView);
  useEditorSearchStore.setState({ isOpen: false, view: null });
  if (restoreFocus) currentView?.focus();
}

export function applyEditorSearchQuery(view: EditorView, query: string, replaceText: string) {
  view.dispatch({
    effects: setSearchQuery.of(
      new SearchQuery({
        search: query,
        caseSensitive: false,
        regexp: false,
        replace: replaceText,
      }),
    ),
  });
}
