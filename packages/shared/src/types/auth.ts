export interface AuthResponse {
  User: JellyfinUser;
  AccessToken: string;
  ServerId: string;
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
