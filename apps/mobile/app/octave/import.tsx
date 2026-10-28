import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { recognizeTentacleShare } from "@tentacle-tv/shared/music";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { openPlaylistSheet } from "@/octave/playlists";

/**
 * Octave — `tentacle://octave/import?share=<lien>` : là où mène « Ouvrir dans l'app Tentacle » de la page d'un
 * lien de playlist partagée (la même adresse que celle du web, `/octave/import`). Le lien reconnu, la feuille
 * d'import s'ouvre avec lui déjà collé, sur « Playlists » ; rien ne part sans le geste « Importer ».
 */
export default function OctaveImportRoute() {
  const { share } = useLocalSearchParams<{ share?: string }>();
  const link = recognizeTentacleShare(typeof share === "string" ? share : "")?.url ?? null;
  useEffect(() => {
    if (link) openPlaylistSheet({ kind: "import", prefill: link });
  }, [link]);
  return <Redirect href={octavePaths.playlists as never} />;
}
