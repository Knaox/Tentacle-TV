import type { CodeState, PairingStep, ServerError } from "../../../src/redesign/screens/pairing/PairingView";
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

/** Le succès, sur le vrai compte : son nom et son portrait. */
export function successOf(data: BenchData): PairingStep {
  const profile = data.snapshot.profile;
  return {
    kind: "success",
    userName: profile?.name ?? data.snapshot.account,
    avatarUri: profile?.image ? data.imageFile(profile.image) : undefined,
  };
}
