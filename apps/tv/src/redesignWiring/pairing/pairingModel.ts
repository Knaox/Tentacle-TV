import type { CodeState, PairingStep } from "../../redesign/screens/pairing/pairingTypes";
import { PAIRING_CODE_TTL, type PairingCode } from "../../hooks/usePairingCode";
import type { PairingFlow } from "../../hooks/usePairingFlow";

/** La croix Retour du jumelage (`PairingView`), relais et serveur manuel. */
export const PAIRING_BACK_KEY = "pairing:back";

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
    case "manualCode":
      return { kind: "serverCode", code: toCodeState(server), serverUrl };
    case "success":
      return { kind: "success", userName: flow.account?.name ?? "", avatarUri };
  }
}

/**
 * L'élément qui prend le focus à l'arrivée sur une étape, ou quand l'état de
 * son code change : l'action principale, sinon la sortie — la croix Retour du
 * relais, quand le code s'affiche ou se prépare : la seule chose à faire. Le
 * succès n'a rien à focaliser (l'accueil s'ouvre seul).
 */
export function entryKeyOf(step: PairingStep): string | null {
  switch (step.kind) {
    case "welcome":
      return "pairing:showCode";
    case "manualServer":
      return "pairing:url";
    case "relayCode":
    case "serverCode": {
      if (step.code.status === "error") return "pairing:retry";
      if (step.code.status === "expired") return "pairing:regenerate";
      return step.kind === "relayCode" ? PAIRING_BACK_KEY : "pairing:changeServer";
    }
    case "success":
      return null;
  }
}
