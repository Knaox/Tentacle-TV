import type { AdminMetadataErrorCode, TmdbKeyTestResult } from "@tentacle-tv/api-client";

/** Le ton d'un message en ligne — même grammaire que les pastilles de statut. */
export type NoticeTone = "success" | "warning" | "error" | "neutral";

/** Un message de la carte TMDB : son ton, sa clé dans l'espace `adminMetadata`. */
export interface Notice {
  tone: NoticeTone;
  key: string;
}

/** Ce que la saisie laisse deviner AVANT tout appel. */
export type TmdbKeyHint = "v4-token" | "format" | null;

const V3_KEY = /^[0-9a-f]{32}$/i;
/** Le jeton v4 est un JWT (« eyJ… »), parfois collé avec son « Bearer ». */
const V4_TOKEN = /^(?:bearer\s+)?eyJ/i;

/**
 * Le jeton v4 collé à la place de la clé v3 est l'erreur la plus fréquente :
 * TMDB affiche les deux sur la même page, le jeton en premier et en plus
 * grand. On le dit dès la saisie, sans bloquer — le serveur reste juge.
 */
export function tmdbKeyHint(raw: string): TmdbKeyHint {
  const key = raw.trim();
  if (!key) return null;
  if (V4_TOKEN.test(key)) return "v4-token";
  return V3_KEY.test(key) ? null : "format";
}

/** Le verdict d'un test, pour la clé saisie ou pour la clé en place. */
export function testNotice(outcome: TmdbKeyTestResult | AdminMetadataErrorCode, saved: boolean): Notice {
  switch (outcome) {
    case "valid":
      return { tone: "success", key: saved ? "testValidSaved" : "testValid" };
    case "invalid":
    case "tmdb-key-invalid":
      return { tone: "error", key: saved ? "testInvalidSaved" : "testInvalid" };
    case "unreachable":
    case "tmdb-unreachable":
      return { tone: "warning", key: "testUnreachable" };
    case "unsupported":
      return { tone: "neutral", key: "testUnsupported" };
    default:
      return { tone: "error", key: "testFailed" };
  }
}

/** Le refus d'un enregistrement : « rien n'a été enregistré », et pourquoi. */
export function saveNotice(code: AdminMetadataErrorCode): Notice {
  if (code === "tmdb-key-invalid") return { tone: "error", key: "saveInvalid" };
  if (code === "tmdb-unreachable") return { tone: "warning", key: "saveUnreachable" };
  return { tone: "error", key: "saveFailed" };
}
