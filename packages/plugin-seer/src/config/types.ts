export interface SeerConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
  autoApprove: boolean;
  userLimit: number;
}

export interface SeerStatus {
  configured: boolean;
  connected: boolean;
  url?: string;
  error?: string;
}
