/**
 * Octave (mobile) — ce que rend une adresse d'Octave : l'écran que le registre
 * a pour elle, avec les paramètres de l'adresse DÉCODÉS, sinon la page
 * d'attente. Les fichiers de `app/octave/` ne font qu'appeler ceci.
 */

import { memo, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { octaveScreen } from "../registry/octaveRegistry";
import type { OctaveScreenName } from "../registry/octaveRegistryTypes";
import { OctavePlaceholder } from "./OctavePlaceholder";

/** Le titre de la page d'attente (espace i18n `music`). */
const PLACEHOLDER_TITLE: Record<OctaveScreenName, string> = {
  home: "nav.home", search: "nav.search", library: "nav.library", liked: "nav.liked", playlists: "nav.playlists",
  playlist: "nav.playlists", album: "nav.library", artist: "nav.library", externalPlaylist: "nav.playlists",
  mood: "nav.home", device: "nav.library", settings: "nav.library", profiles: "nav.home",
};

function decode(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const OctaveRoute = memo(function OctaveRoute({ name }: { name: OctaveScreenName }) {
  const raw = useLocalSearchParams();
  const { t } = useTranslation("music");
  const params = useMemo(() => Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, decode(value)])), [raw]);
  const Screen = octaveScreen(name);
  return Screen ? <Screen params={params} /> : <OctavePlaceholder title={t(PLACEHOLDER_TITLE[name])} />;
});
