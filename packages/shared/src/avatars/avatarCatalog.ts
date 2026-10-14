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
  character("lanterne", "abyss", "#3b5079", "sway"),
  character("huit", "abyss", "#5bbccd", "wiggle"),
  character("bulle", "abyss", "#725595", "shiver"),
  character("fine", "abyss", "#8c4966", "float"),
  character("valentin", "abyss", "#f5449f", "sway"),
  character("pince", "abyss", "#f5aa0f", "bounce"),
  character("paulette", "abyss", "#7dcbbe", "float"),
  character("licorne", "abyss", "#b39bce", "float"),
  character("jonas", "abyss", "#f5da00", "float"),
  character("cape", "abyss", "#e84b56", "bounce"),
  character("plaid", "abyss", "#007b7b", "doze"),
  character("machoire", "abyss", "#f5652a", "sway"),
  character("mistigri", "cineclub", "#e84b56", "sway"),
  character("minuit", "cineclub", "#0071ab", "doze"),
  character("chargement", "cineclub", "#f5aa0f", "doze"),
  character("goupil", "cineclub", "#009f52", "wiggle"),
  character("encore", "cineclub", "#7dcbbe", "doze"),
  character("caramel", "cineclub", "#9773bb", "bounce"),
  character("zapette", "cineclub", "#f5652a", "wiggle"),
  character("biscuit", "cineclub", "#5bbccd", "shiver"),
  character("coa", "cineclub", "#f5449f", "bounce"),
  character("bambou", "cineclub", "#f5da00", "bounce"),
  character("smoking", "cineclub", "#7a7778", "sway"),
  character("paillette", "cineclub", "#3b5079", "wiggle"),
  character("drap", "creatures", "#007b7b", "float"),
  character("comte", "creatures", "#8c4966", "sway"),
  character("bandelette", "creatures", "#f5aa0f", "doze"),
  character("bip", "creatures", "#5bbccd", "shiver"),
  character("glorp", "creatures", "#3b5079", "float"),
  character("flocon", "creatures", "#0071ab", "bounce"),
  character("braise", "creatures", "#725595", "wiggle"),
  character("pleinelune", "creatures", "#9773bb", "sway"),
  character("orbite", "creatures", "#262224", "float"),
  character("frankie", "creatures", "#f5652a", "shiver"),
  character("cassandre", "creatures", "#009f52", "sway"),
  character("somnambule", "creatures", "#b39bce", "doze"),
];

/** Les personnages d'une collection, dans l'ordre de la galerie. */
export function avatarsOf(collection: AvatarCollection): AvatarCharacter[] {
  return AVATAR_CHARACTERS.filter((avatar) => avatar.collection === collection);
}

export function findAvatar(id: string): AvatarCharacter | undefined {
  return AVATAR_CHARACTERS.find((avatar) => avatar.id === id);
}
