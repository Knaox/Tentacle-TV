import { useTranslation } from "react-i18next";
import { uiLanguage } from "@tentacle-tv/shared";
import { PairingView, type PairingStep } from "../../../src/redesign/screens/pairing/PairingView";
import { patchBench } from "../control/benchRemote";
import type { BenchData } from "../data/benchData";
import {
  BENCH_PASSWORD,
  LOGIN_ERRORS,
  RELAY_CODE,
  SERVER_CODE,
  SERVER_ERRORS,
  TYPED_SERVER,
  activeCode,
  manualLogin,
  manualServer,
  successOf,
} from "../data/pairingModels";
import { DEV_SERVER } from "../data/settingsModels";
import type { BenchScene } from "./types";

/**
 * Le jumelage, étape par étape et état par état : accueil (avec la langue),
 * code du relais (chargement, actif, erreur, expiré), serveur saisi à la main
 * (vide, vérification, les cinq erreurs), identifiant et mot de passe (vides,
 * remplis, connexion en cours, chaque refus), code du serveur (avec sa croix
 * quand il suit les identifiants), succès. Au banc, choisir une langue sur
 * l'accueil bascule la langue du banc.
 */

const noop = () => {};

function PairingScene({ step, codeBack = false }: { step: PairingStep; codeBack?: boolean }) {
  const { i18n } = useTranslation();
  return (
    <PairingView
      step={step}
      language={uiLanguage(i18n.language)}
      onChangeLanguage={(lang) => patchBench({ lang })}
      onServerCodeBack={codeBack ? noop : undefined}
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

/** Un refus de la connexion : l'identifiant reste, le mot de passe est vidé. */
const loginError = (id: string) =>
  scene(
    `identifiants-erreur-${id}`,
    `Identifiants — ${LOGIN_ERRORS[id].label}`,
    (data) => manualLogin(DEV_SERVER, { username: data.snapshot.account, error: LOGIN_ERRORS[id].error }),
    ["pairing:password", "pairing:signIn"],
  );

/** Le code du serveur atteint depuis les identifiants : la croix y ramène. */
const serverCodeFromLogin: BenchScene = {
  id: "jumelage/code-serveur-croix",
  group: "Jumelage",
  label: "Code du serveur — depuis les identifiants",
  focusKeys: ["pairing:changeServer", "pairing:back"],
  settleMs: 1100,
  render: () => <PairingScene step={{ kind: "serverCode", code: activeCode(SERVER_CODE, 187), serverUrl: DEV_SERVER }} codeBack />,
};

export const PAIRING_SCENES: BenchScene[] = [
  scene("accueil", "Accueil (langue)", { kind: "welcome" }, ["pairing:showCode", "pairing:manual", "pairing:lang:fr", "pairing:lang:en"]),
  scene("code-chargement", "Code du relais — chargement", { kind: "relayCode", code: { status: "loading" } }, ["pairing:back"]),
  scene("code-actif", "Code du relais — actif", { kind: "relayCode", code: activeCode(RELAY_CODE) }, ["pairing:back"]),
  scene("code-erreur", "Code du relais — erreur", { kind: "relayCode", code: { status: "error" } }, ["pairing:retry", "pairing:manual", "pairing:back"]),
  scene("code-expire", "Code du relais — expiré", { kind: "relayCode", code: { status: "expired", code: RELAY_CODE } }, ["pairing:regenerate", "pairing:back"]),
  scene("serveur", "Serveur manuel — vide", manualServer(""), ["pairing:url", "pairing:check", "pairing:back"]),
  scene("serveur-verification", "Serveur manuel — vérification", manualServer(TYPED_SERVER, { checking: true }), ["pairing:check"]),
  serverError("url", "Serveur manuel — URL invalide"),
  serverError("delai", "Serveur manuel — délai dépassé"),
  serverError("api", "Serveur manuel — API introuvable"),
  serverError("http", "Serveur manuel — erreur HTTP"),
  serverError("injoignable", "Serveur manuel — injoignable"),
  scene("identifiants", "Identifiants — vides", manualLogin(DEV_SERVER), ["pairing:username", "pairing:password", "pairing:signIn", "pairing:useCode", "pairing:back"]),
  scene(
    "identifiants-remplis",
    "Identifiants — remplis",
    (data) => manualLogin(DEV_SERVER, { username: data.snapshot.account, password: BENCH_PASSWORD }),
    ["pairing:password", "pairing:signIn"],
  ),
  scene(
    "identifiants-connexion",
    "Identifiants — connexion en cours",
    (data) => manualLogin(DEV_SERVER, { username: data.snapshot.account, signingIn: true }),
    ["pairing:signIn"],
  ),
  ...Object.keys(LOGIN_ERRORS).map(loginError),
  serverCodeFromLogin,
  scene("code-serveur", "Code du serveur — actif", { kind: "serverCode", code: activeCode(SERVER_CODE, 187), serverUrl: DEV_SERVER }, ["pairing:changeServer"]),
  scene("code-serveur-erreur", "Code du serveur — erreur", { kind: "serverCode", code: { status: "error" }, serverUrl: DEV_SERVER }, ["pairing:retry", "pairing:changeServer"]),
  scene("code-serveur-expire", "Code du serveur — expiré", { kind: "serverCode", code: { status: "expired", code: SERVER_CODE }, serverUrl: DEV_SERVER }, ["pairing:regenerate"]),
  scene("succes", "Succès", successOf, [], 1500, (data) => {
    const step = successOf(data);
    return step.kind === "success" && step.avatarUri ? [step.avatarUri] : [];
  }),
];
