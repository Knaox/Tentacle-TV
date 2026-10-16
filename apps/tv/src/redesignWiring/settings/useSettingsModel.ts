import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import { setPlaybackSettings, useOwnPlaybackSettings, useServerCapability, useStillWatchingSettings, useUserId } from "@tentacle-tv/api-client";
import { detectPreset, presetSettings, uiLanguage, type PlaybackPreset } from "@tentacle-tv/shared";
import { SCRUB_COUNTDOWN_DELAYS } from "@tentacle-tv/tv-core";
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
import { useDevicePhotoAccess } from "../avatars/devicePhotoAccess";
import { useOwnPhotoState } from "../avatars/ownPhoto";
import {
  exoMatchFrameRateStore,
  exoTunnelingStore,
  useExoMatchFrameRate,
  useExoTunneling,
} from "../../lib/exoSettings";
import { liquidGlassStore } from "../../lib/liquidGlass";
import { useScrubCountdownSettings } from "../../lib/scrubCountdownSettings";
import { TV_PLATFORM_LABEL } from "../../lib/platformLabel";
import {
  trailerPreviewDelayStore,
  trailerPreviewSoundStore,
  trailerPreviewsStore,
  useTrailerPreviewDelay,
  useTrailerPreviewSound,
  useTrailerPreviewsEnabled,
} from "../../lib/trailerPreviewSettings";

// Source unique des versions : versions.json à la racine du monorepo (champ tv).
const TV_VERSION: string = require("../../../../../versions.json").tv ?? "0.0.0";

/**
 * Ce que la vue des réglages reçoit, résolu — sur les hooks partagés avec les
 * réglages d'Android TV (compte, pistes par bibliothèque, langue, actions) —
 * et les gestes qu'elle rend. La liste de choix ouverte est un état d'écran.
 */
export function useSettingsModel() {
  const paired = usePairedAccount();
  const portrait = useVerifiedImage(paired.portraitUrl);
  const { logout, changeServer } = useAccountActions();
  const { language, change: changeLanguage } = useInterfaceLanguage();
  const { libraries, choose, reset } = useLibraryTrackPrefs();
  const preset = detectPreset(useOwnPlaybackSettings());
  const tunneling = useExoTunneling();
  const matchFrameRate = useExoMatchFrameRate();
  const scrub = useScrubCountdownSettings();
  const scrubSettings = scrub.settings;
  const updateScrub = scrub.update;
  const previewCapable = useServerCapability("trailers.preview");
  const previewsEnabled = useTrailerPreviewsEnabled();
  const previewSound = useTrailerPreviewSound();
  const previewDelay = useTrailerPreviewDelay();
  // « Vous regardez encore ? » : réglage du COMPTE, écrit au serveur (copie locale pour le hors ligne).
  const stillWatching = useStillWatchingSettings();
  const stillWatchingSettings = stillWatching.available ? stillWatching.settings : null;

  // La galerie des avatars : rien face à un serveur qui ne déclare pas `avatars.devicePhoto`,
  // ni pour le compte de démonstration (revue Apple), dont la photo ne change pas.
  const photoCapable = useDevicePhotoAccess() === true;
  const userId = useUserId();
  const ownPhoto = useOwnPhotoState(photoCapable ? userId : null);
  const photo = photoCapable ? (ownPhoto === false ? "choose" : "change") : null;

  const name = paired.name ?? "—";
  const account = useMemo<SettingsAccount>(
    () => ({ name, avatarUri: portrait, serverUrl: paired.serverUrl, deviceLabel: TV_PLATFORM_LABEL, photo }),
    [name, portrait, paired.serverUrl, photo],
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
      // L'avance rapide réglable n'existe que sur le lecteur d'Apple TV.
      scrubCountdown: Platform.OS === "ios"
        ? { outcome: scrubSettings.outcome, delaySeconds: scrubSettings.delaySeconds, delays: SCRUB_COUNTDOWN_DELAYS }
        : null,
      // Les aperçus au focus : rien à régler face à un serveur qui n'en sert pas.
      trailerPreviews: previewCapable ? { enabled: previewsEnabled, sound: previewSound, delay: previewDelay } : null,
      // Rien face à un serveur qui ne déclare pas `playback.stillWatching`.
      stillWatching: stillWatchingSettings,
    }),
    [preset, interfaceLanguage, libraryModels, tunneling, matchFrameRate, scrubSettings, previewCapable, previewsEnabled, previewSound, previewDelay, stillWatchingSettings],
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

  const selectScrubOutcome = useCallback((outcome: "return" | "resume") => updateScrub({ outcome }), [updateScrub]);
  const selectScrubDelay = useCallback((seconds: number) => {
    const delay = SCRUB_COUNTDOWN_DELAYS.find((offered) => offered === seconds);
    if (delay !== undefined) updateScrub({ delaySeconds: delay });
  }, [updateScrub]);

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
    onSelectScrubOutcome: selectScrubOutcome,
    onSelectScrubDelay: selectScrubDelay,
    onChangeStillWatching: stillWatching.set,
    onToggleTrailerPreviews: trailerPreviewsStore.set,
    onToggleTrailerPreviewSound: trailerPreviewSoundStore.set,
    onSelectTrailerPreviewDelay: trailerPreviewDelayStore.set,
    onToggleLiquidGlass: liquidGlassStore.set,
    onChoose: chooseValue,
    closeChoices,
  };
}

export type SettingsModel = ReturnType<typeof useSettingsModel>;
