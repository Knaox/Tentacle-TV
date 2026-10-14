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

  // « Qui regarde ? » à l'ouverture du BUREAU : la LG n'a pas de profils de la
  // Famille, sa porte ne rend jamais rien. Avec l'invitation aux avatars (plus
  // bas), ce sont les seules portes du dossier `profiles/` d'`apps/web` dans le
  // graphe du téléviseur — il quitte donc aussi la feuille
  // (`EXCLUDED_WEB_DIRECTORIES`).
  [resolve(WEB, "profiles/launch/useProfileLaunchGate.tsx")]: resolve(CLIENT, "shims/noProfileLaunchGate.ts"),

  // L'invitation unique à choisir un avatar, montée par les recouvrements de
  // démarrage (`StartupOverlays`) : la LG ne change pas la photo du compte. Sa
  // galerie vit dans `profiles/`, que la feuille ne balaie pas.
  [resolve(WEB, "profiles/avatarGallery/AvatarInvite.tsx")]: resolve(CLIENT, "shims/noAvatarInvite.ts"),
};
