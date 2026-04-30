import { useProsemarkEditor } from "./use-prosemark-editor";
import "./prosemark-theme.css";

interface ProseMarkEditorProps {
  filePath: string;
  getScrollContainer?: () => HTMLElement | null;
  autoFocus?: boolean;
}

export function ProseMarkEditor({ filePath, getScrollContainer, autoFocus }: ProseMarkEditorProps) {
  const editorRef = useProsemarkEditor(filePath, getScrollContainer, autoFocus ?? false);
  return <div ref={editorRef} className="h-full" />;
}
