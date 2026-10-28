import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { arrivingShareLink, useMusicShareLinkImport } from "@tentacle-tv/api-client";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { openPlaylistSheet } from "@/octave/playlists";

/**
 * Octave — `tentacle://octave/import?share=<lien>` : là où mène « Ouvrir dans l'app Tentacle » de la page d'un
 * lien de playlist partagée (la même adresse que celle du web, `/octave/import`). Le lien reconnu, la feuille
 * d'import s'ouvre avec lui déjà collé, sur « Playlists » ; rien ne part sans le geste « Importer ». Sans le
 * droit du partage, rien ne s'ouvre.
 */
export default function OctaveImportRoute() {
  const { share } = useLocalSearchParams<{ share?: string }>();
  // Sans le droit d'importer un lien (règle 15), rien ne s'ouvre : « Playlists » seulement.
  const link = arrivingShareLink(typeof share === "string" ? share : null, useMusicShareLinkImport());
  useEffect(() => {
    if (link) openPlaylistSheet({ kind: "import", prefill: link });
  }, [link]);
  return <Redirect href={octavePaths.playlists as never} />;
}
