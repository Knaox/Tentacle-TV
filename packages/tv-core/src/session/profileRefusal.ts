/**
 * Les refus du serveur de la Famille, lus pour l'écran — la règle vit dans
 * shared (`family/familyProfileRefusal.ts`), commune à la TV et au bureau ;
 * ré-exportée ici pour les importeurs de tv-core.
 */
export { profileRefusalOf, refusalReloadsProfiles, type ProfileRefusal } from "@tentacle-tv/shared";
