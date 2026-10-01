import { resolve } from "node:path";
import { CLIENT, WEB } from "./substitutionPaths";

/**
 * Ce que la cible téléviseur remplace dans ce qu'`apps/web` adresse au COMPTE
 * plutôt qu'au catalogue. Extraite de `substitutionTable.ts`, qui la fusionne
 * dans sa table des fichiers : données pures, mêmes règles, même greffon.
 */
export const SESSION_FILES: Record<string, string> = {
  // Les messages de l'administrateur : un bandeau focalisable volerait le
  // focus au film. Ils s'effacent seuls, une barre qui se vide le dit.
  [resolve(WEB, "components/session/SessionMessageHost.tsx")]:
    resolve(CLIENT, "ui/session/SessionMessageHostTv.tsx"),

  // Le voile hors ligne : on n'y « déconnecte » pas, on y DÉJUMELLE — le
  // déjumelage commun de la LG (`auth/unpairTv.ts`), marqueur d'abord, qui
  // survit au rechargement du mode « serveur absent au démarrage », et
  // révocation dès le retour du serveur. Même rendu que le web.
  [resolve(WEB, "components/OfflineBanner.tsx")]: resolve(CLIENT, "ui/screens/OfflineBannerTv.tsx"),
};
