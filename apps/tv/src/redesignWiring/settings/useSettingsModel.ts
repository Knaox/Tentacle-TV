import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset, presetSettings, uiLanguage, type PlaybackPreset } from "@tentacle-tv/shared";
import type {
  ChoiceListModel,
  InterfaceLanguage,
  LibraryPrefModel,
  LibrarySettingKey,
  SettingsAbout,
  SettingsAccount,
  SettingsPlayback,
} from "../../redesign/screens/settings/settingsTypes";
import { useAccountActions } from "../../hooks/useAccountActions";
import { useInterfaceLanguage } from "../../hooks/useInterfaceLanguage";
import { useLibraryTrackPrefs } from "../../hooks/useLibraryTrackPrefs";
import { usePairedAccount } from "../../hooks/usePairedAccount";
import { useVerifiedImage } from "../../hooks/useVerifiedImage";
import {
  exoMatchFrameRateStore,
  exoTunnelingStore,
  useExoMatchFrameRate,
  useExoTunneling,
} from "../../lib/exoSettings";
import { liquidGlassStore } from "../../lib/liquidGlass";
import { TV_PLATFORM_LABEL } from "../../lib/platformLabel";

// Source unique des versions : versions.json à la racine du monorepo (champ tv).
const TV_VERSION: string = require("../../../../../versions.json").tv ?? "0.0.0";

/** Le diamètre du portrait de l'onglet Compte. */
const PORTRAIT = 168;

/**
 * Ce que la vue des réglages reçoit, résolu — sur les hooks partagés avec les
 * réglages d'Android TV (compte, pistes par bibliothèque, langue, actions) —
 * et les gestes qu'elle rend. La liste de choix ouverte est un état d'écran.
 */
export function useSettingsModel() {
  const paired = usePairedAccount(PORTRAIT);
  const portrait = useVerifiedImage(paired.portraitUrl);
  const { logout, changeServer } = useAccountActions();
  const { language, change: changeLanguage } = useInterfaceLanguage();
  const { libraries, choose, reset } = useLibraryTrackPrefs();
  const preset = detectPreset(useOwnPlaybackSettings());
  const tunneling = useExoTunneling();
  const matchFrameRate = useExoMatchFrameRate();

  const name = paired.name ?? "—";
  const account = useMemo<SettingsAccount>(
    () => ({ name, avatarUri: portrait, serverUrl: paired.serverUrl, deviceLabel: TV_PLATFORM_LABEL }),
    [name, portrait, paired.serverUrl],
  );

  const libraryModels = useMemo<LibraryPrefModel[]>(
    () => libraries.map((library) => ({
      id: library.id,
      name: library.name,
      customized: library.customized,
      values: Object.fromEntries(library.settings.map((setting) => [setting.key, setting.value])) as Record<LibrarySettingKey, string>,
    })),
    [libraries],
  );

  const interfaceLanguage: InterfaceLanguage = uiLanguage(language);
  const playback = useMemo<SettingsPlayback>(
    () => ({
      preset,
      interfaceLanguage,
      libraries: libraryModels,
      // Réglages d'APPAREIL du décodeur : ExoPlayer n'existe que sur Android TV.
      device: Platform.OS === "android" ? { tunneling, matchFrameRate } : null,
    }),
    [preset, interfaceLanguage, libraryModels, tunneling, matchFrameRate],
  );

  const about = useMemo<SettingsAbout>(
    () => ({ version: TV_VERSION, serverUrl: paired.serverUrl, userName: name, deviceLabel: TV_PLATFORM_LABEL, year: new Date().getFullYear() }),
    [paired.serverUrl, name],
  );

  // La grande liste de choix d'un réglage de bibliothèque.
  const [open, setOpen] = useState<{ libraryId: string; key: LibrarySettingKey } | null>(null);
  const choiceList = useMemo<ChoiceListModel | null>(() => {
    if (!open) return null;
    const library = libraries.find((entry) => entry.id === open.libraryId);
    const setting = library?.settings.find((entry) => entry.key === open.key);
    if (!library || !setting) return null;
    return { title: setting.label, context: library.name, options: setting.choices, selected: setting.selection };
  }, [open, libraries]);

  const openLibrarySetting = useCallback((libraryId: string, key: LibrarySettingKey) => setOpen({ libraryId, key }), []);
  const closeChoices = useCallback(() => setOpen(null), []);
  const chooseValue = useCallback((value: string) => {
    if (open) choose(open.libraryId, open.key, value);
    setOpen(null);
  }, [open, choose]);

  const selectPreset = useCallback((next: Exclude<PlaybackPreset, "custom">) => {
    setPlaybackSettings(presetSettings(next));
  }, []);

  return {
    account,
    playback,
    about,
    choiceList,
    onChangeServer: changeServer,
    onLogout: logout,
    onSelectPreset: selectPreset,
    onSelectLanguage: changeLanguage,
    onOpenLibrarySetting: openLibrarySetting,
    onResetLibrary: reset,
    onToggleTunneling: exoTunnelingStore.set,
    onToggleMatchFrameRate: exoMatchFrameRateStore.set,
    onToggleLiquidGlass: liquidGlassStore.set,
    onChoose: chooseValue,
    closeChoices,
  };
}

export type SettingsModel = ReturnType<typeof useSettingsModel>;
