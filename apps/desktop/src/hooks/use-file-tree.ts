import { useWorkspaceStore } from "@/stores/workspace-store";

export function useDirectoryCache() {
  return useWorkspaceStore((s) => s.directoryCache);
}

export function useExpandedDirs() {
  return useWorkspaceStore((s) => s.expandedDirs);
}

export function useToggleDirectory() {
  return useWorkspaceStore((s) => s.toggleDirectory);
}

export function useRefreshDirectory() {
  return useWorkspaceStore((s) => s.refreshDirectory);
}

export function useInvalidatePath() {
  return useWorkspaceStore((s) => s.invalidatePath);
}

export function useRewriteExpandedDir() {
  return useWorkspaceStore((s) => s.rewriteExpandedDir);
}
