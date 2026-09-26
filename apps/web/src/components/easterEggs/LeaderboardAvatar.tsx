/**
 * L'avatar d'un compte vit désormais dans `components/ui/UserAvatar` : il sert
 * bien au-delà du classement (sessions en direct, administration, profil).
 * Cet ancien chemin reste exporté pour le code qui l'importe encore.
 */
export { UserAvatar as LeaderboardAvatar } from "../ui/UserAvatar";
