import { useTranslation } from "react-i18next";
import { uiLanguage } from "@tentacle-tv/shared";
import { PairingView, type PairingStep } from "../../../src/redesign/screens/pairing/PairingView";
import { patchBench } from "../control/benchRemote";
import type { BenchData } from "../data/benchData";
import {
  RELAY_CODE,
  SERVER_CODE,
  SERVER_ERRORS,
  TYPED_SERVER,
  activeCode,
  manualServer,
  successOf,
} from "../data/pairingModels";
import { DEV_SERVER } from "../data/settingsModels";
import type { BenchScene } from "./types";

/**
 * Le jumelage, étape par étape et état par état : accueil (avec la langue),
 * code du relais (chargement, actif, erreur, expiré), serveur saisi à la main
 * (vide, vérification, les cinq erreurs), code du serveur, succès. Au banc,
 * choisir une langue sur l'accueil bascule la langue du banc.
 */

function PairingScene({ step }: { step: PairingStep }) {
  const { i18n } = useTranslation();
  return (
    <PairingView
      step={step}
      language={uiLanguage(i18n.language)}
      onChangeLanguage={(lang) => patchBench({ lang })}
    />
  );
}

const scene = (
  id: string,
  label: string,
  step: PairingStep | ((data: BenchData) => PairingStep),
  focusKeys: string[] = [],
  settleMs = 1100,
  images?: BenchScene["images"],
): BenchScene => ({
  id: `jumelage/${id}`,
  group: "Jumelage",
  label,
  focusKeys,
  settleMs,
  images,
  render: (data) => <PairingScene step={typeof step === "function" ? step(data) : step} />,
});

const serverError = (id: keyof typeof SERVER_ERRORS, label: string) =>
  scene(`serveur-erreur-${id}`, label, manualServer(SERVER_ERRORS[id].url, { error: SERVER_ERRORS[id].error }), ["pairing:url", "pairing:check"]);

export const PAIRING_SCENES: BenchScene[] = [
  scene("accueil", "Accueil (langue)", { kind: "welcome" }, ["pairing:showCode", "pairing:manual", "pairing:lang:fr", "pairing:lang:en"]),
  scene("code-chargement", "Code du relais — chargement", { kind: "relayCode", code: { status: "loading" } }, ["pairing:cancel"]),
  scene("code-actif", "Code du relais — actif", { kind: "relayCode", code: activeCode(RELAY_CODE) }, ["pairing:cancel"]),
  scene("code-erreur", "Code du relais — erreur", { kind: "relayCode", code: { status: "error" } }, ["pairing:retry", "pairing:manual", "pairing:cancel"]),
  scene("code-expire", "Code du relais — expiré", { kind: "relayCode", code: { status: "expired", code: RELAY_CODE } }, ["pairing:regenerate", "pairing:cancel"]),
  scene("serveur", "Serveur manuel — vide", manualServer(""), ["pairing:url", "pairing:check", "pairing:back"]),
  scene("serveur-verification", "Serveur manuel — vérification", manualServer(TYPED_SERVER, { checking: true }), ["pairing:check"]),
  serverError("url", "Serveur manuel — URL invalide"),
  serverError("delai", "Serveur manuel — délai dépassé"),
  serverError("api", "Serveur manuel — API introuvable"),
  serverError("http", "Serveur manuel — erreur HTTP"),
  serverError("injoignable", "Serveur manuel — injoignable"),
  scene("code-serveur", "Code du serveur — actif", { kind: "serverCode", code: activeCode(SERVER_CODE, 187), serverUrl: DEV_SERVER }, ["pairing:changeServer"]),
  scene("code-serveur-erreur", "Code du serveur — erreur", { kind: "serverCode", code: { status: "error" }, serverUrl: DEV_SERVER }, ["pairing:retry", "pairing:changeServer"]),
  scene("code-serveur-expire", "Code du serveur — expiré", { kind: "serverCode", code: { status: "expired", code: SERVER_CODE }, serverUrl: DEV_SERVER }, ["pairing:regenerate"]),
  scene("succes", "Succès", successOf, [], 1500, (data) => {
    const step = successOf(data);
    return step.kind === "success" && step.avatarUri ? [step.avatarUri] : [];
  }),
];
