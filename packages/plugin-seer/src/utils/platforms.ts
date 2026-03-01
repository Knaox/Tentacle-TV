export interface StreamingPlatform {
  id: number;
  name: string;
  logoPath?: string;
}

export const PLATFORMS: StreamingPlatform[] = [
  { id: 8, name: "Netflix" },
  { id: 337, name: "Disney+" },
  { id: 9, name: "Amazon Prime Video" },
  { id: 1899, name: "Crunchyroll" },
  { id: 350, name: "Apple TV+" },
  { id: 283, name: "Crunchyroll" },
  { id: 531, name: "Paramount+" },
  { id: 56, name: "OCS" },
  { id: 236, name: "Canal+" },
  { id: 381, name: "Canal+ Series" },
  { id: 119, name: "Amazon Prime Video" },
  { id: 1870, name: "ADN" },
  { id: 444, name: "Wakanim" },
];

export function getPlatformName(providerId: number): string | undefined {
  return PLATFORMS.find((p) => p.id === providerId)?.name;
}
