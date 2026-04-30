import { SettingsPanel } from "@/components/settings-panel";
import { definePageKind } from "./types";

export type SettingsLocation = { kind: "settings" };

export const settingsKind = definePageKind<"settings", SettingsLocation>({
  kind: "settings",
  title: () => "Settings",
  description: "App preferences",
  Component: ({ isActive }) => <SettingsPanel isActive={isActive} />,
  keepAlive: true,
});
