import { EditorPane } from "../editor-pane";
import { DocumentFooter } from "../document-footer";
import { getFileName } from "@/lib/paths";
import { definePageKind } from "./types";

export type FileLocation = { kind: "file"; path: string };

export const fileKind = definePageKind<"file", FileLocation>({
  kind: "file",
  title: (l) => getFileName(l.path),
  description: "Open file",
  Component: ({ location, isActive }) => <EditorPane path={location.path} isActive={isActive} />,
  keepAlive: true,
  supportsFileContextMenu: true,
  fromPayload: (data) => (typeof data.path === "string" ? { kind: "file", path: data.path } : null),
  paths: (l) => [l.path],
  primaryPath: (l) => l.path,
  rewritePath: (l, from, to) => (l.path === from ? { ...l, path: to } : l),
  removePath: (l, path) => (l.path === path ? null : l),
  serialize: (l) => ({ path: l.path }),
  renderFooter: (l) => <DocumentFooter filePath={l.path} />,
});
