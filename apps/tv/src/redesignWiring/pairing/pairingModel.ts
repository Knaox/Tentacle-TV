import type { CodeState, PairingStep } from "../../redesign/screens/pairing/pairingTypes";
import { PAIRING_CODE_TTL, type PairingCode } from "../../hooks/usePairingCode";
import type { PairingFlow } from "../../hooks/usePairingFlow";

/**
 * Ce que la vue du jumelage reçoit, tiré de l'automate partagé
 * (`usePairingFlow`) et des deux codes (`usePairingCode`).
 */

/** Un code tel que la carte le montre. Avant la toute première réponse, il
 *  n'y a ni code ni échec : c'est encore un chargement. */
export function toCodeState(code: PairingCode): CodeState {
  if (code.failed) return { status: "error" };
  if (!code.code) return { status: "loading" };
  if (code.expired) return { status: "expired", code: code.code };
  return { status: "active", code: code.code, remainingSeconds: code.remaining, totalSeconds: PAIRING_CODE_TTL };
}

export function toPairingStep(
  flow: PairingFlow,
  relay: PairingCode,
  server: PairingCode,
  serverUrl: string,
  avatarUri: string | undefined,
): PairingStep {
  switch (flow.step) {
    case "welcome":
      return { kind: "welcome" };
    case "relayCode":
      return { kind: "relayCode", code: toCodeState(relay) };
    case "manualServer":
      return { kind: "manualServer", url: flow.serverUrl, checking: flow.testing, error: flow.serverError };
    case "manualLogin":
      return {
        kind: "manualLogin",
        serverUrl,
        username: flow.login.username,
        password: flow.login.password,
        signingIn: flow.login.signingIn,
        error: flow.login.error,
      };
    case "manualCode":
      return { kind: "serverCode", code: toCodeState(server), serverUrl };
    case "success":
      return { kind: "success", userName: flow.account?.name ?? "", avatarUri };
  }
}
