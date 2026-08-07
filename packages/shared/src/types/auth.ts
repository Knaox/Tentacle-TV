export interface AuthResponse {
  User: JellyfinUser;
  AccessToken: string;
  ServerId: string;
  /**
   * L'identité d'appareil que le serveur a présentée à Jellyfin en authentifiant
   * ce compte (chemin web : `POST /api/auth/login`). Le client l'ADOPTE pour son
   * propre en-tête `MediaBrowser` — sans quoi Jellyfin voit deux appareils lire
   * le même épisode, l'un sous la graine du navigateur, l'autre sous celle du
   * token. Absente pour les clients qui s'authentifient eux-mêmes à travers le
   * proxy (desktop, mobile, TV) : leur en-tête arrive intact, rien à aligner.
   */
  DeviceId?: string;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  EnableAutoLogin: boolean;
}

export interface InviteKey {
  id: string;
  key: string;
  createdAt: Date;
  usedAt?: Date;
  usedBy?: string;
  maxUses: number;
  currentUses: number;
  expiresAt?: Date;
}

export interface RegisterRequest {
  username: string;
  password: string;
  inviteKey: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}
