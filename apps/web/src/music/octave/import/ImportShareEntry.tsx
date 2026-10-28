/**
 * Octave — `/octave/import?share=<lien>` : là où mène « Importer dans mon Tentacle » de la page d'un lien de
 * playlist partagée (le serveur de l'ami renvoie ici). Le lien reconnu, la boîte d'import s'ouvre avec lui
 * déjà collé, sur « Playlists » ; autre chose, « Playlists » seulement. Rien ne part sans le geste « Importer ».
 */

import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { arrivingShareLink, useMusicShareLinkImport } from "@tentacle-tv/api-client";
import { octavePaths } from "../octavePaths";
import { openImportDialogWith } from "./importStore";

export function ImportShareEntry() {
  const [params] = useSearchParams();
  // Sans le droit d'importer un lien (règle 15), rien ne s'ouvre : « Playlists » seulement.
  const link = arrivingShareLink(params.get("share"), useMusicShareLinkImport());
  useEffect(() => {
    if (link) openImportDialogWith(link);
  }, [link]);
  return <Navigate to={octavePaths.playlists} replace />;
}
