/**
 * Les VOLETS du profil : les sous-pages de réglage qu'un téléphone ouvre en
 * plein écran (`/settings/*`) et qu'une tablette pose dans la colonne de
 * détail, à droite de la liste. Module pur — ni React ni expo — pour que les
 * règles de visibilité se testent seules et se recopient telles quelles sur
 * le web mobile.
 *
 * Organisation du profil (même ordre partout, téléphone comme tablette) :
 *   1. Préférences      — Personnalisation▸ · Lecture▸ · Notifications▸ · Données▸
 *   2. Apparence        — Thème [Clair|Sombre|Auto] · Langue [Français|Anglais] · Liquid Glass (iOS 26)
 *   3. Sur cet appareil — Mes titres hors ligne (écran) · Réglages hors ligne▸
 *   4. Appareils        — Jumeler TV (écran) · Appareils appairés▸
 *   5. Administration   — Sessions (écran) · Invitations▸
 *   6. Aide             — Support (écran) · À propos (écran) · Politique de confidentialité ↗
 *   7. Connexion        — Changer de serveur · Passer hors ligne
 *   8. Compte           — Mot de passe▸ · Déconnexion
 *   9. Zone de danger   — Vider le cache · Supprimer mon compte
 * (▸ = volet ; « écran » = page plein écran, identique sur les deux formats.)
 */

export type ProfilePaneId =
  | "personalization"
  | "playback"
  | "notifications"
  | "data"
  | "onDevice"
  | "devices"
  | "invites"
  | "password";

/** L'ordre des volets : celui de la liste, et donc celui du choix par défaut. */
export const PROFILE_PANES: readonly ProfilePaneId[] = [
  "personalization",
  "playback",
  "notifications",
  "data",
  "onDevice",
  "devices",
  "invites",
  "password",
];

/** La route plein écran de chaque volet (téléphone, liens profonds). */
export const PROFILE_PANE_ROUTES = {
  personalization: "/settings/personalization",
  playback: "/settings/playback",
  notifications: "/settings/notifications",
  data: "/settings/data",
  onDevice: "/settings/on-device",
  devices: "/settings/devices",
  invites: "/settings/invites",
  password: "/settings/password",
} as const satisfies Record<ProfilePaneId, string>;

export interface PaneContext {
  /** Hors ligne : tout ce qui parle au serveur disparaît au lieu d'échouer. */
  offline: boolean;
  isAdmin: boolean;
  /** Droit de garder des titres, ou du contenu déjà sur l'appareil. */
  offlineVisible: boolean;
}

/** Un volet existe-t-il dans ce contexte ? Les lignes du profil suivent la même règle. */
export function isPaneAvailable(id: ProfilePaneId, ctx: PaneContext): boolean {
  switch (id) {
    case "playback":
    case "data":
      return true;
    case "onDevice":
      return ctx.offlineVisible;
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
export function resolvePane(selected: ProfilePaneId | null, ctx: PaneContext): ProfilePaneId {
  if (selected && isPaneAvailable(selected, ctx)) return selected;
  return PROFILE_PANES.find((id) => isPaneAvailable(id, ctx)) ?? "playback";
}
