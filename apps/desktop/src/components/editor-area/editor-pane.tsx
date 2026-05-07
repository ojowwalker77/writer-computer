import { ProseMarkEditor } from "./prosemark-editor";
import { FrontmatterPanel } from "./frontmatter-panel";
import { EditorScrollContainer } from "./editor-scroll-container";
import { EditorSearchOverview } from "./editor-search-overview";
import { ReadAloudButton } from "./read-aloud-button";
import { useCloseEditorSearchWhenInactive } from "./use-close-editor-search-when-inactive";
import { useEditorSettingsRef } from "./use-editor-settings";
import { useIsFileLoading } from "@/hooks/use-tabs";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function AsciiSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span>{SPINNER_FRAMES[frame]}</span>;
}

interface EditorPaneProps {
  path: string;
  isActive: boolean;
}

export const EditorPane = memo(function EditorPane({ path, isActive }: EditorPaneProps) {
  const isLoading = useIsFileLoading(path);
  const editorSettingsRef = useEditorSettingsRef();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useCloseEditorSearchWhenInactive(isActive);

  const getScrollContainer = useCallback(() => scrollContainerRef.current, []);

  if (isLoading) {
    return (
      <div
        className={
          isActive ? "relative z-10 h-full" : "absolute inset-0 invisible pointer-events-none"
        }
      >
        <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">
          <AsciiSpinner />
        </div>
      </div>
    );
  }

  return (
    <div
      data-pane
      className={
        isActive ? "relative z-10 h-full" : "absolute inset-0 invisible pointer-events-none"
      }
    >
      {isActive && (
        <div className="pointer-events-none absolute right-5 top-20 z-30 md:right-8 md:top-24">
          <ReadAloudButton filePath={path} />
        </div>
      )}
      <EditorScrollContainer ref={scrollContainerRef}>
        <div
          className="mx-auto w-full pt-32 pb-6 md:pt-[9rem]"
          style={{
            maxWidth: "var(--writer-editor-outer-width)",
            boxSizing: "border-box",
            paddingLeft: "var(--writer-editor-side-padding)",
            paddingRight: "var(--writer-editor-side-padding)",
          }}
        >
          <FrontmatterPanel filePath={path} />
        </div>
        <div ref={editorSettingsRef}>
          <ProseMarkEditor
            filePath={path}
            getScrollContainer={getScrollContainer}
            autoFocus={isActive}
          />
        </div>
      </EditorScrollContainer>
      {isActive && <EditorSearchOverview scrollContainerRef={scrollContainerRef} />}
    </div>
  );
});
