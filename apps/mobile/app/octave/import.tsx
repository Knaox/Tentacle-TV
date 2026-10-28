import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { arrivingShareLink, useMusicShareLinkImport } from "@tentacle-tv/api-client";
import { recognizeTentacleShare } from "@tentacle-tv/shared/music";
import { octavePaths, sharedImportLink } from "@tentacle-tv/shared/octave/mode";
import { setOctaveMode } from "@/octave/mode/octaveModeStore";
import { openPlaylistSheet } from "@/octave/playlists";

/**
 * Octave — `tentacle://octave/import`, deux arrivées :
 * - `?share=<lien>` : « Ouvrir dans l'app Tentacle » de la page d'un lien de playlist partagée (la même
 *   adresse que celle du web). La feuille d'import s'ouvre avec lui déjà collé ; rien ne part sans le geste
 *   « Importer ».
 * - `?shared=<texte>` : le PARTAGE SYSTÈME vers Tentacle TV (feuille de partage d'iOS, intent `SEND`
 *   d'Android, qui rendent le texte reçu tel quel). Le lien de playlist qu'il contient (`sharedImportLink`)
 *   part aussitôt : le partage est le geste.
 * Dans les deux cas, l'app passe en mode Octave et s'ouvre sur la Bibliothèque (Playlists). Un lien d'un autre
 * Tentacle sans le droit du partage (règle 15) : rien ne s'ouvre.
 */
export default function OctaveImportRoute() {
  const { share, shared } = useLocalSearchParams<{ share?: string; shared?: string }>();
  const allowed = useMusicShareLinkImport();
  const fromPage = arrivingShareLink(typeof share === "string" ? share : null, allowed);
  const fromSystem = sharedImportLink(typeof shared === "string" ? shared : null);
  const systemLink = fromSystem && (allowed || !recognizeTentacleShare(fromSystem)) ? fromSystem : null;
  const link = fromPage ?? systemLink;
  const autoStart = !fromPage && !!systemLink;
  useEffect(() => {
    if (!link) return;
    setOctaveMode(true);
    openPlaylistSheet({ kind: "import", prefill: link, autoStart });
  }, [autoStart, link]);
  return <Redirect href={octavePaths.library as never} />;
}
