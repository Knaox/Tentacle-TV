import type { CodeState, LoginError, PairingStep, ServerError } from "../../../src/redesign/screens/pairing/PairingView";
import type { BenchData } from "./benchData";

/**
 * Les étapes du jumelage, telles que l'intégration les tiendra. Les codes
 * suivent le vrai format (4 caractères, alphabet sans ambiguïté du relais :
 * ni I, ni L, ni O, ni 0, ni 1), la durée de vie est celle de l'app (5 min).
 */

export const CODE_TTL = 300;
export const RELAY_CODE = "K7QM";
export const SERVER_CODE = "4HX9";
/** L'adresse qu'un utilisateur saisit : son serveur sur le réseau local. */
export const TYPED_SERVER = "http://192.168.1.20:3001";

export const activeCode = (code: string, remainingSeconds = 272): CodeState => ({
  status: "active",
  code,
  remainingSeconds,
  totalSeconds: CODE_TTL,
});

/** Les cinq erreurs de `verifyServer`, avec l'adresse qui les provoque. */
export const SERVER_ERRORS: Record<string, { url: string; error: ServerError }> = {
  url: { url: "tentacle maison", error: { key: "invalidUrl" } },
  delai: { url: TYPED_SERVER, error: { key: "connectionTimeout" } },
  api: { url: "http://192.168.1.20:8096", error: { key: "apiNotFound" } },
  http: { url: TYPED_SERVER, error: { key: "serverHttpError", params: { status: "502" } } },
  injoignable: { url: "https://tentacle.example.com", error: { key: "cannotReachServer" } },
};

export const manualServer = (url: string, extra: Partial<Extract<PairingStep, { kind: "manualServer" }>> = {}): PairingStep => ({
  kind: "manualServer",
  url,
  checking: false,
  error: null,
  ...extra,
});

/** Un mot de passe de banc — jamais un vrai : il ne paraît qu'en points. */
export const BENCH_PASSWORD = "banc-banc-banc";

export const manualLogin = (serverUrl: string, extra: Partial<Extract<PairingStep, { kind: "manualLogin" }>> = {}): PairingStep => ({
  kind: "manualLogin",
  serverUrl,
  username: "",
  password: "",
  signingIn: false,
  error: null,
  ...extra,
});

/** Les refus de la connexion (`pairWithPassword`), un par message. */
export const LOGIN_ERRORS: Record<string, { label: string; error: LoginError }> = {
  identifiants: { label: "identifiants faux", error: { key: "invalidCredentials", status: 401 } },
  compte: { label: "compte refusé par Jellyfin", error: { key: "accountRefused", status: 400 } },
  essais: { label: "trop de tentatives", error: { key: "tooManyAttempts", status: 429 } },
  jumelages: { label: "trop de jumelages", error: { key: "tooManyPairings", status: 429 } },
  jellyfin: { label: "Jellyfin injoignable", error: { key: "jellyfinUnreachable", status: 502 } },
  delai: { label: "délai dépassé", error: { key: "connectionTimeout" } },
  injoignable: { label: "serveur injoignable", error: { key: "cannotReachServer" } },
  serveur: { label: "erreur du serveur", error: { key: "serverError", status: 500 } },
  illisible: { label: "réponse illisible", error: { key: "serverError" } },
};

/** Le succès, sur le vrai compte : son nom et son portrait. */
export function successOf(data: BenchData): PairingStep {
  const profile = data.snapshot.profile;
  return {
    kind: "success",
    userName: profile?.name ?? data.snapshot.account,
    avatarUri: profile?.image ? data.imageFile(profile.image) : undefined,
  };
}
