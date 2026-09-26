/**
 * Les invitations, vues par l'administration : le contrat de `GET /api/invites`,
 * les bornes de création que le serveur applique, et les deux calculs que
 * chaque client refaisait à sa façon — le statut d'une invitation et son lien.
 */

/**
 * Bornes de `POST /api/invites`, appliquées par le serveur. Le formulaire les
 * reprend pour refuser une saisie AVANT l'envoi : hors bornes, le serveur
 * répondait un 400 que l'écran taisait.
 */
export const INVITE_MAX_USES_LIMIT = 100;
/** 30 jours. */
export const INVITE_EXPIRY_HOURS_LIMIT = 720;

export interface AdminInviteUsageDto {
  username: string;
  usedAt: string;
  /** Le compte Jellyfin créé avec l'invitation. Absent d'un serveur antérieur à 1.20.0. */
  jellyfinUserId?: string;
}

export interface AdminInviteDto {
  id: string;
  key: string;
  maxUses: number;
  currentUses: number;
  /** `null` : l'invitation n'expire pas. */
  expiresAt: string | null;
  createdAt: string;
  /**
   * L'administrateur qui l'a créée. `null` pour une invitation créée avant le
   * serveur 1.20.0 (le champ n'était jamais renseigné) ; absent d'un serveur
   * antérieur, qui ne l'expose pas.
   */
  createdBy?: string | null;
  usages: AdminInviteUsageDto[];
}

export interface CreateInviteRequest {
  maxUses: number;
  /** Omis : l'invitation n'expire pas. */
  expiresInHours?: number;
}

/** Réponse de `POST /api/invites` — la même depuis toujours. */
export interface CreatedInviteDto {
  id: string;
  key: string;
  maxUses: number;
  expiresAt: string | null;
}

export type InviteStatus = "active" | "expired" | "exhausted";

/**
 * Le statut d'une invitation à l'instant `now` (ms), avec la règle même du
 * serveur à l'inscription. Épuisée l'emporte sur expirée : elle a servi
 * jusqu'au bout, c'est ce qui la décrit le mieux.
 */
export function inviteStatus(
  invite: Pick<AdminInviteDto, "maxUses" | "currentUses" | "expiresAt">,
  now: number,
): InviteStatus {
  if (invite.currentUses >= invite.maxUses) return "exhausted";
  if (invite.expiresAt !== null && Date.parse(invite.expiresAt) < now) return "expired";
  return "active";
}

/**
 * Le lien que reçoit la personne invitée : la page d'inscription du serveur,
 * clé pré-remplie. `base` est l'origine publique du serveur, jamais celle de
 * l'application — sous Electron, cette dernière vaut `tentacle://app`.
 */
export function buildInviteUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, "")}/register?invite=${encodeURIComponent(key)}`;
}
