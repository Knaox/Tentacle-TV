/**
 * Le réglage « Tenir à jour les playlists gardées » : ALLUMÉ par défaut, de
 * l'appareil, et se coupe ; la tenue à jour ne tourne qu'allumée, avec le droit de garder et
 * en ligne — jamais pour une session de profil ni au web (le réglage n'y paraît pas).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_MUSIC_OFFLINE, type MusicOfflineSurface } from "@tentacle-tv/offline-core/music";

const h = vi.hoisted(() => ({ surface: null as unknown as MusicOfflineSurface, store: new Map<string, string>() }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tentacle-tv/ui", () => ({ SettingsSection: ({ children }: { children: unknown }) => <section>{children as never}</section> }));
vi.mock("../offlineSurfaceContext", () => ({ useOfflineSurface: () => h.surface }));
vi.mock("../../../../offline/useConnectivity", () => ({ useConnectivity: () => ({ state: "online" }) }));
vi.mock("../../mode/useOctaveProvider", () => ({ useOctaveProvider: () => null }));
vi.stubGlobal("localStorage", {
  getItem: (k: string) => h.store.get(k) ?? null,
  setItem: (k: string, v: string) => void h.store.set(k, v),
  removeItem: (k: string) => void h.store.delete(k),
});

import { AutoSyncSetting } from "./AutoSyncSetting";
import { AUTOSYNC_STORAGE_KEY, isAutoSyncOn, setAutoSync } from "./autoSyncStore";
import { autoSyncActive } from "./useKeptAutoSync";

const CAN_KEEP: MusicOfflineSurface = { visible: true, library: true, externalFrom: null };

beforeEach(() => {
  h.store.clear();
  h.surface = CAN_KEEP;
});

describe("tenue à jour des playlists gardées", () => {
  it("allumée par défaut (rien d'enregistré) ; coupée, c'est l'appareil qui le retient", () => {
    expect(isAutoSyncOn()).toBe(true);
    setAutoSync(false);
    expect(h.store.get(AUTOSYNC_STORAGE_KEY)).toBe("0");
    expect(isAutoSyncOn()).toBe(false);
    setAutoSync(true);
    expect(isAutoSyncOn()).toBe(true);
  });

  it("coupée : la tenue à jour ne tourne pas — rien ne change sur l'appareil", () => {
    setAutoSync(false);
    expect(autoSyncActive(isAutoSyncOn(), CAN_KEEP, "online")).toBe(false);
  });

  it("ne tourne qu'allumée, avec le droit, en ligne", () => {
    expect(autoSyncActive(false, CAN_KEEP, "online")).toBe(false);
    expect(autoSyncActive(true, CAN_KEEP, "online")).toBe(true);
    expect(autoSyncActive(true, CAN_KEEP, "offline-auto")).toBe(false);
    // Une session de profil, le web, un compte sans le droit : la porte ne donne pas `library`.
    expect(autoSyncActive(true, NO_MUSIC_OFFLINE, "online")).toBe(false);
  });

  it("le réglage paraît avec le droit, jamais sans", () => {
    expect(renderToStaticMarkup(<AutoSyncSetting variant="section" />)).toContain("autosync.label");
    expect(renderToStaticMarkup(<AutoSyncSetting variant="inline" />)).toContain('role="switch"');
    h.surface = NO_MUSIC_OFFLINE;
    expect(renderToStaticMarkup(<AutoSyncSetting variant="section" />)).toBe("");
  });
});
