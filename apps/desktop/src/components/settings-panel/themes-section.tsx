import { useEffect, useMemo, useRef, useState } from "react";
import { useAllSettings, useSetSetting } from "@/hooks/use-settings";
import {
  getPrimaryDefs,
  matchesPreset,
  presetKey,
  PRESET_NAMES,
  readPrimaries,
  suffixOf,
  THEME_PRESETS,
  type PresetName,
  type PrimarySet,
  type PrimarySuffix,
  type SettingDef,
  type ThemeMode,
} from "@/lib/settings-schema";
import { Control } from "./setting-control";

const PRESET_OPTIONS: (PresetName | "custom")[] = [...PRESET_NAMES, "custom"];

export function ThemesSection() {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[13px] font-medium text-[var(--text-muted)]">Themes</h2>
      <div className="flex flex-col gap-3">
        <ThemeCard mode="light" />
        <ThemeCard mode="dark" />
      </div>
    </section>
  );
}

function ThemeCard({ mode }: { mode: ThemeMode }) {
  const settings = useAllSettings();
  const setSetting = useSetSetting();
  const primaryDefs = useMemo(() => getPrimaryDefs(mode), [mode]);
  const primaries = useMemo(() => readPrimaries(mode, settings), [mode, settings]);
  const storedPresetRaw = settings[presetKey(mode)];
  const storedPreset = typeof storedPresetRaw === "string" ? storedPresetRaw : "Codex";
  const activePreset = useMemo<PresetName | "custom">(() => {
    for (const name of PRESET_NAMES) {
      if (matchesPreset(primaries, name, mode)) return name;
    }
    return "custom";
  }, [primaries, mode]);

  function setPrimary(suffix: PrimarySuffix, value: string | number) {
    void setSetting(`theme.${mode}.${suffix}`, value);
    // If the new value doesn't match the active preset, mark the preset as custom.
    const next: PrimarySet = { ...primaries, [suffix]: value };
    const stillMatches = PRESET_NAMES.some((p) => matchesPreset(next, p, mode));
    if (!stillMatches && storedPreset !== "custom") {
      void setSetting(presetKey(mode), "custom");
    }
  }

  function applyPreset(name: PresetName | "custom") {
    if (name === "custom") {
      void setSetting(presetKey(mode), "custom");
      return;
    }
    const p = THEME_PRESETS[name][mode];
    for (const def of primaryDefs) {
      const suffix = suffixOf(mode, def.key);
      void setSetting(def.key, p[suffix]);
    }
    void setSetting(presetKey(mode), name);
  }

  return (
    <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
      <header className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h3 className="text-[13px] font-medium text-[var(--text-primary)]">
          {mode === "light" ? "Light theme" : "Dark theme"}
        </h3>
        <div className="flex items-center gap-3">
          <PresetSelect value={activePreset} onChange={applyPreset} />
        </div>
      </header>

      {primaryDefs.map((def) => {
        const suffix = suffixOf(mode, def.key);
        return (
          <Row key={def.key} label={def.label}>
            <PrimaryControl
              def={def}
              value={primaries[suffix]}
              onChange={(v) => setPrimary(suffix, v as string | number)}
            />
          </Row>
        );
      })}
    </div>
  );
}

/** Wraps the generic Control dispatcher with a buffered string variant so that
 *  font fields don't lose focus or thrash on every keystroke (each setSetting
 *  round-trips and re-renders the row). */
function PrimaryControl({
  def,
  value,
  onChange,
}: {
  def: SettingDef;
  value: string | number;
  onChange: (v: unknown) => void;
}) {
  if (def.type === "string") {
    return <BufferedStringInput value={String(value)} onChange={(v) => onChange(v)} />;
  }
  return <Control def={def} value={value} onChange={onChange} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--line-subtler)] px-4 py-3">
      <span className="text-[13px] text-[var(--text-primary)]">{label}</span>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

function PresetSelect({
  value,
  onChange,
}: {
  value: PresetName | "custom";
  onChange: (next: PresetName | "custom") => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PresetName | "custom")}
      className="h-8 appearance-none rounded-lg border border-transparent bg-[var(--surface-input)] bg-[length:12px_12px] bg-[position:right_8px_center] bg-no-repeat pl-2.5 pr-7 text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none bg-[image:var(--select-chevron)]"
    >
      {PRESET_OPTIONS.map((name) => (
        <option key={name} value={name}>
          {name === "custom" ? "Custom" : name}
        </option>
      ))}
    </select>
  );
}

function BufferedStringInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Local buffer so the user can type intermediate states without losing focus on
  // every keystroke (each setSetting round-trips and re-renders the row).
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value);
  }, [value]);
  return (
    <input
      ref={ref}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onChange(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      spellCheck={false}
      className="h-9 w-44 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
    />
  );
}
