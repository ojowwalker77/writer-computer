import { useWorkspaceStore } from "@/stores/workspace-store";

export function useWorkspace() {
  const root = useWorkspaceStore((s) => s.root);
  const isIndexing = useWorkspaceStore((s) => s.isIndexing);
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace);
  const closeWorkspace = useWorkspaceStore((s) => s.closeWorkspace);
  const recentWorkspaces = useWorkspaceStore((s) => s.recentWorkspaces);
  const removeRecentWorkspace = useWorkspaceStore((s) => s.removeRecentWorkspace);
  return {
    root,
    isIndexing,
    openWorkspace,
    closeWorkspace,
    recentWorkspaces,
    removeRecentWorkspace,
  };
}

export function useIsStartupResolved() {
  return useWorkspaceStore((s) => s.isStartupResolved);
}

export function useWorkspaceRoot() {
  return useWorkspaceStore((s) => s.root);
}
