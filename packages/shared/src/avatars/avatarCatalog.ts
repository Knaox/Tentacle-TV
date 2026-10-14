/**
 * La troupe des avatars : les personnages qu'on peut prendre pour photo de
 * profil. Leurs images sont dessinées et « imprimées » par `brand/avatars/`
 * (risographie : encres plates, trames, grain) puis servies par le client web
 * sous `/avatars/<id>.webp` ; leurs noms et leurs histoires vivent dans
 * l'espace i18n `avatars` (`characters.<id>.name` / `.story`).
 *
 * Choisir un personnage l'ENVOIE comme photo Jellyfin du compte, comme une
 * photo importée : il suit le compte sur toutes ses applications, sans rien
 * demander au serveur Tentacle — aucune capacité.
 *
 * Les identifiants nomment des fichiers et des clés de traduction : ils ne se
 * renomment pas.
 */

/** Les trois collections, dans l'ordre de la galerie. */
export const AVATAR_COLLECTIONS = ["abyss", "cineclub", "creatures"] as const;
export type AvatarCollection = (typeof AVATAR_COLLECTIONS)[number];

/**
 * Le tempérament d'un personnage : la façon dont il bouge quand on le survole
 * ou le désigne au clavier — flotter, frétiller, sursauter, rebondir, se
 * dandiner, somnoler. Rien au repos.
 */
export type AvatarTemperament = "float" | "wiggle" | "shiver" | "bounce" | "sway" | "doze";

export interface AvatarCharacter {
  id: string;
  collection: AvatarCollection;
  /** La couleur de son fond imprimé : ce qu'on voit le temps que l'image arrive. */
  tone: string;
  temperament: AvatarTemperament;
}

const character = (
  id: string,
  collection: AvatarCollection,
  tone: string,
  temperament: AvatarTemperament,
): AvatarCharacter => ({ id, collection, tone, temperament });

export const AVATAR_CHARACTERS: readonly AvatarCharacter[] = [
  character("huit", "abyss", "#65bfcd", "wiggle"),
  character("lanterne", "abyss", "#4c5e82", "sway"),
  character("jonas", "abyss", "#f5dc15", "float"),
  character("bulle", "abyss", "#7c629b", "shiver"),
  character("fine", "abyss", "#945770", "float"),
  character("machoire", "abyss", "#f56e38", "sway"),
  character("cape", "abyss", "#e9555d", "bounce"),
  character("plaid", "abyss", "#178483", "doze"),
  character("licorne", "abyss", "#b8a1cf", "float"),
  character("pince", "abyss", "#f5ae1d", "bounce"),
  character("valentin", "abyss", "#f44da0", "sway"),
  character("paulette", "abyss", "#87cec1", "float"),
  character("mistigri", "cineclub", "#e8584a", "sway"),
  character("minuit", "cineclub", "#1178ad", "doze"),
  character("bambou", "cineclub", "#f5da13", "bounce"),
  character("goupil", "cineclub", "#14a35b", "wiggle"),
  character("caramel", "cineclub", "#7c568c", "bounce"),
  character("chargement", "cineclub", "#f5550a", "doze"),
  character("smoking", "cineclub", "#9f9a94", "sway"),
  character("coa", "cineclub", "#ea4f9e", "bounce"),
  character("biscuit", "cineclub", "#67bbc4", "shiver"),
  character("zapette", "cineclub", "#eb5735", "wiggle"),
  character("paillette", "cineclub", "#48577f", "wiggle"),
  character("encore", "cineclub", "#86ccc0", "doze"),
  character("comte", "creatures", "#874e67", "sway"),
  character("drap", "creatures", "#118382", "float"),
  character("bandelette", "creatures", "#f58919", "doze"),
  character("glorp", "creatures", "#465a80", "float"),
  character("frankie", "creatures", "#f46f37", "shiver"),
  character("flocon", "creatures", "#147baf", "bounce"),
  character("cassandre", "creatures", "#14a45d", "sway"),
  character("bip", "creatures", "#65bfce", "shiver"),
  character("braise", "creatures", "#7b619a", "wiggle"),
  character("orbite", "creatures", "#3a3535", "float"),
  character("pleinelune", "creatures", "#9a76ac", "sway"),
  character("somnambule", "creatures", "#b7a1ce", "doze"),
];

/** Les personnages d'une collection, dans l'ordre de la galerie. */
export function avatarsOf(collection: AvatarCollection): AvatarCharacter[] {
  return AVATAR_CHARACTERS.filter((avatar) => avatar.collection === collection);
}

export function findAvatar(id: string): AvatarCharacter | undefined {
  return AVATAR_CHARACTERS.find((avatar) => avatar.id === id);
}
