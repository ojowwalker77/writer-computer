import { useSettingsStore } from "@/stores/settings-store";
import * as tauri from "@/lib/tauri";

let activeAudio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;
let activeFinish: (() => void) | null = null;
let requestSequence = 0;

const MAX_TTS_CHARS = 9_500;

function settingString(key: string) {
  const value = useSettingsStore.getState().settings[key];
  return typeof value === "string" ? value : "";
}

function stopCurrentAudio() {
  const finish = activeFinish;
  activeFinish = null;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (activeUrl) {
    URL.revokeObjectURL(activeUrl);
    activeUrl = null;
  }
  finish?.();
}

export function stopReadAloud() {
  requestSequence += 1;
  stopCurrentAudio();
}

export async function readTextAloud(text: string) {
  const normalized = text.trim();
  if (!normalized) return;

  const requestId = ++requestSequence;
  stopCurrentAudio();

  for (const chunk of splitTextForTts(normalized)) {
    const audioBytes = await tauri.textToSpeech(
      chunk,
      settingString("read-aloud.elevenlabs-api-key"),
      settingString("read-aloud.elevenlabs-voice-id"),
      settingString("read-aloud.elevenlabs-model-id"),
    );
    if (requestId !== requestSequence) return;
    await playAudioBytes(audioBytes, requestId);
    if (requestId !== requestSequence) return;
  }
}

async function playAudioBytes(audioBytes: number[], requestId: number) {
  const bytes = new Uint8Array(audioBytes);
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  try {
    await playAudioUrl(url, requestId, true);
  } catch (error) {
    if (!isUnsupportedPlaybackError(error)) throw error;
    const dataUrl = bytesToDataUrl(bytes);
    await playAudioUrl(dataUrl, requestId, false);
  }
}

async function playAudioUrl(url: string, requestId: number, revokeOnStop: boolean) {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;
  activeUrl = url;
  activeAudio = audio;

  const playbackDone = new Promise<void>((resolve, reject) => {
    activeFinish = resolve;
    audio.addEventListener("ended", () => resolve(), { once: true });
    audio.addEventListener("error", () => reject(new Error("Audio playback failed")), {
      once: true,
    });
  });
  try {
    await audio.play();
    await playbackDone;
  } catch (error) {
    if (activeAudio === audio) stopCurrentAudio();
    throw error;
  } finally {
    if (requestId === requestSequence && activeAudio === audio) {
      stopCurrentAudio();
    } else if (revokeOnStop) {
      URL.revokeObjectURL(url);
    }
  }
}

function isUnsupportedPlaybackError(error: unknown) {
  return error instanceof DOMException && error.name === "NotSupportedError";
}

function bytesToDataUrl(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return `data:audio/mpeg;base64,${btoa(binary)}`;
}

function splitTextForTts(text: string) {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_TTS_CHARS) {
    const splitAt = bestSplitIndex(remaining, MAX_TTS_CHARS);
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function bestSplitIndex(text: string, max: number) {
  const slice = text.slice(0, max);
  const paragraph = slice.lastIndexOf("\n\n");
  if (paragraph >= Math.floor(max * 0.5)) return paragraph + 2;

  const sentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentence >= Math.floor(max * 0.5)) return sentence + 2;

  const space = slice.lastIndexOf(" ");
  if (space >= Math.floor(max * 0.5)) return space + 1;

  return max;
}
