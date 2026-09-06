import { KeepOfflineSheet } from "./KeepOfflineSheet";

/**
 * L'hôte du dialogue « Garder hors ligne » : monté une fois dans
 * `OfflineShell`, il présente la feuille dès qu'un point d'entrée appelle
 * `openKeepOffline`. Rien d'autre à faire ici — le magasin porte la requête.
 */
export function KeepOfflineHost() {
  return <KeepOfflineSheet />;
}
