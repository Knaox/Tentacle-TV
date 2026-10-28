/**
 * Octave (mobile) — ce que rend une adresse d'Octave : l'écran que le registre
 * a pour elle, avec les paramètres de l'adresse DÉCODÉS, derrière son droit
 * (absent : retour à l'accueil d'Octave), sinon la page d'attente. Les fichiers de `app/octave/` ne font qu'appeler ceci.
 */

import { memo, useEffect, useMemo, useRef } from "react";
import { useLocalSearchParams, usePathname, useRouter, type Href } from "expo-router";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { OctaveRequires } from "../registry/OctaveRequires";
import { reportOctaveFirstPage } from "../launch/octaveBootReport";
import { useTranslation } from "react-i18next";
import { octaveScreen } from "../registry/octaveRegistry";
import type { OctaveScreenName } from "../registry/octaveRegistryTypes";
import { OctavePlaceholder } from "./OctavePlaceholder";

/** Le titre de la page d'attente (espace i18n `music`). */
const PLACEHOLDER_TITLE: Record<OctaveScreenName, string> = {
  home: "nav.home", search: "nav.search", library: "nav.library", liked: "nav.liked", playlists: "nav.playlists",
  playlist: "nav.playlists", album: "nav.library", artist: "nav.library", externalPlaylist: "nav.playlists",
  mood: "nav.home", device: "nav.library", settings: "nav.library", profiles: "nav.home", account: "nav.home",
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

/** Un écran sans son droit : retour à l'accueil d'Octave, UNE fois (un `<Redirect>` se relancerait à chaque rendu). */
function BackToOctaveHome() {
  const router = useRouter();
  const gone = useRef(false);
  useEffect(() => {
    if (gone.current) return;
    gone.current = true;
    router.replace(octavePaths.home as Href);
  }, [router]);
  return null;
}

export const OctaveRoute = memo(function OctaveRoute({ name }: { name: OctaveScreenName }) {
  const raw = useLocalSearchParams();
  const { t } = useTranslation("music");
  const params = useMemo(() => Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, decode(value)])), [raw]);
  const pathname = usePathname();
  useEffect(() => reportOctaveFirstPage(pathname), [pathname]);
  const entry = octaveScreen(name);
  if (!entry) return <OctavePlaceholder title={t(PLACEHOLDER_TITLE[name])} />;
  const Screen = entry.component;
  // Droit absent (serveur, extension, compte) : l'écran n'existe pas, son adresse ramène à l'accueil d'Octave.
  const away = name === "home" ? null : <BackToOctaveHome />;
  return (
    <OctaveRequires requires={entry.requires} unmet={away}>
      <Screen params={params} />
    </OctaveRequires>
  );
});
