/**
 * Les VOLETS du profil miroir — `apps/mobile/src/screens/profile/profilePanes.ts`
 * de l'app, recopié et réduit à ce que le web sait faire. Module pur : les
 * règles de visibilité se testent seules (`panes.test.ts`).
 *
 * Organisation du profil (même ordre au téléphone et sur tablette) :
 *   1. Préférences    — Personnalisation▸ · Lecture▸ · Données▸
 *   2. Apparence      — Thème [Clair|Sombre|Auto] · Langue [Français|Anglais]
 *   3. Appareils      — Jumeler TV (écran) · Appareils appairés▸
 *   4. Administration — Sessions (écran) · Invitations▸
 *   5. Aide           — Support · À propos · Politique de confidentialité ↗
 *   6. Connexion      — Changer de serveur (application de bureau seulement)
 *   7. Compte         — Mot de passe▸ · Déconnexion
 *   8. Zone de danger — Vider le cache · Supprimer mon compte
 *
 * Absents du web, par rapport à l'app : Notifications (push natif), Sur cet
 * appareil / réglages hors ligne (navigateur), Passer hors ligne, Liquid Glass
 * (iOS 26).
 */

export type MirrorPaneId = "personalization" | "playback" | "data" | "devices" | "invites" | "password";

/** L'ordre des volets : celui de la liste, donc celui du choix par défaut. */
export const MIRROR_PANES: readonly MirrorPaneId[] = [
  "personalization",
  "playback",
  "data",
  "devices",
  "invites",
  "password",
];

/** La route plein écran d'un volet (téléphone, liens profonds). */
export function paneRoute(id: MirrorPaneId): string {
  return `/settings/${id}`;
}

/** Le profil tablette, volet choisi (le maître-détail lit `?pane=`). */
export function profilePaneRoute(id: MirrorPaneId): string {
  return `/profile?pane=${id}`;
}

export interface PaneContext {
  /** Hors ligne : ce qui parle au serveur disparaît au lieu d'échouer. */
  offline: boolean;
  isAdmin: boolean;
}

/** Un volet existe-t-il dans ce contexte ? Les lignes du profil suivent la même règle. */
export function isPaneAvailable(id: MirrorPaneId, ctx: PaneContext): boolean {
  switch (id) {
    case "playback":
    case "data":
      return true;
    case "invites":
      return ctx.isAdmin && !ctx.offline;
    default:
      return !ctx.offline;
  }
}

/**
 * Le volet à montrer sur tablette : celui qu'on a choisi s'il existe encore
 * (passer hors ligne en retire), sinon le premier disponible.
 */
export function resolvePane(selected: MirrorPaneId | null, ctx: PaneContext): MirrorPaneId {
  if (selected && isPaneAvailable(selected, ctx)) return selected;
  return MIRROR_PANES.find((id) => isPaneAvailable(id, ctx)) ?? "playback";
}

/**
 * Les anciennes sections `/settings/*` du web qui n'ont plus de page à elles
 * dans le miroir : Sécurité devient le volet Mot de passe (les appareils et
 * le serveur ont leur ligne au profil) ; Apparence vit sur place dans le
 * profil ; « downloads » n'existe pas dans le navigateur.
 */
const LEGACY_PANES: Record<string, MirrorPaneId | null> = {
  security: "password",
  appearance: null,
  downloads: null,
  notifications: null,
  "on-device": null,
};

/**
 * Lit le `:pane` d'une URL : un volet connu, un alias hérité, ou `null`
 * (retour au profil).
 */
export function parsePaneParam(raw: string | undefined | null): MirrorPaneId | null {
  if (!raw) return null;
  if ((MIRROR_PANES as readonly string[]).includes(raw)) return raw as MirrorPaneId;
  return LEGACY_PANES[raw] ?? null;
}

/** Sous cette largeur utile, deux colonnes écraseraient le détail (`SPLIT_MIN_WIDTH` de l'app). */
export const SPLIT_MIN_WIDTH = 720;

/** Le maître-détail : une tablette dont la largeur utile (rail ôté) atteint 720. */
export function isProfileSplit(isTablet: boolean, width: number, railWidth: number): boolean {
  return isTablet && width - railWidth >= SPLIT_MIN_WIDTH;
}

/** Largeur de la liste maîtresse : 34 % de l'écran, bornée 320-400. */
export function masterWidth(width: number): number {
  return Math.round(Math.min(400, Math.max(320, width * 0.34)));
}
