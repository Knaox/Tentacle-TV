/**
 * D'où vient l'image d'un personnage : d'abord celle EMBARQUÉE dans l'app,
 * sinon celle que sert le serveur Tentacle (`/avatars/<id>.webp`, servie même
 * interface web coupée depuis la 1.29.0). Un serveur plus ancien peut ne pas
 * l'avoir : l'échec reste alors celui d'aujourd'hui. La lecture embarquée est
 * le point fragile (Android en release, cf. `photoSources`) ; le serveur la
 * rattrape.
 *
 * Module PUR (ni React Native ni Expo) : testé sous vitest, les sources
 * réelles injectées par `photoSources`.
 */

/** Une image prête à partir : l'API attend le corps ENCODÉ base64, avec son type. */
export interface PhotoPayload {
  base64: string;
  mime: string;
}

/** Ce que la chaîne lit d'une réponse HTTP (`fetch`). */
export interface ImageResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CharacterPhotoSources {
  /** L'image embarquée dans l'app. */
  bundled: (id: string) => Promise<PhotoPayload>;
  fetcher: (url: string) => Promise<ImageResponse>;
}

/** La première source qui rend une image ; sinon l'échec de la dernière. */
export async function firstPhoto(sources: ReadonlyArray<() => Promise<PhotoPayload>>): Promise<PhotoPayload> {
  let lastError: unknown = new Error("aucune source d'image");
  for (const source of sources) {
    try {
      return await source();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** L'adresse de l'image entière sur le serveur ; null sans serveur ou pour un identifiant douteux. */
export function serverAvatarUrl(serverUrl: string, id: string): string | null {
  if (!serverUrl || !/^[a-z0-9]+$/.test(id)) return null;
  return `${serverUrl.replace(/\/+$/, "")}/avatars/${id}.webp`;
}

/**
 * L'image d'une réponse du serveur — une IMAGE : un serveur qui n'a pas le
 * fichier peut répondre 200 avec la page du client web.
 */
export async function photoFromResponse(response: ImageResponse): Promise<PhotoPayload> {
  if (!response.ok) throw new Error(`avatar ${response.status}`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!type.startsWith("image/")) throw new Error(`avatar : ${type || "sans type"}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("avatar vide");
  return { base64: bytesToBase64(bytes), mime: type };
}

/** L'image d'un personnage : embarquée, sinon servie par le serveur, sinon l'échec. */
export function characterPhotoFrom(id: string, serverUrl: string, sources: CharacterPhotoSources): Promise<PhotoPayload> {
  return firstPhoto([
    () => sources.bundled(id),
    async () => {
      const url = serverAvatarUrl(serverUrl, id);
      if (url === null) throw new Error("avatar : pas de serveur");
      return photoFromResponse(await sources.fetcher(url));
    },
  ]);
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 standard, avec remplissage (Hermes n'a pas de `Buffer`). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? ALPHABET[triple & 63] : "=";
  }
  return out;
}
