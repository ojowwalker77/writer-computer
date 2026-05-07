import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeHighIcon } from "@hugeicons/core-free-icons";
import { useFileContent, useFileSelectedText } from "@/hooks/use-tabs";
import { readTextAloud, stopReadAloud } from "@/hooks/read-aloud-api";

interface ReadAloudButtonProps {
  filePath: string;
}

export function ReadAloudButton({ filePath }: ReadAloudButtonProps) {
  const content = useFileContent(filePath);
  const selectedText = useFileSelectedText(filePath);
  const [isReading, setIsReading] = useState(false);
  const selection = selectedText.trim();
  const textToRead = selection || content;
  const readLabel = selection ? "Read selection" : "Read";

  async function handleClick() {
    if (isReading) {
      stopReadAloud();
      setIsReading(false);
      return;
    }

    try {
      setIsReading(true);
      await readTextAloud(textToRead);
    } catch (error) {
      console.error("[read-aloud] Failed to read document:", error);
    } finally {
      setIsReading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!textToRead.trim()}
      aria-label={isReading ? "Stop reading" : readLabel}
      title={isReading ? "Stop reading" : readLabel}
      className="pointer-events-auto inline-flex h-[var(--chrome-control-height)] items-center gap-1.5 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-card)] px-2.5 text-[13px] font-medium text-[var(--text-muted)] backdrop-blur-xl transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-40"
    >
      <HugeiconsIcon icon={VolumeHighIcon} size={15} color="currentColor" strokeWidth={2} />
      <span>{isReading ? "Stop" : readLabel}</span>
    </button>
  );
}
