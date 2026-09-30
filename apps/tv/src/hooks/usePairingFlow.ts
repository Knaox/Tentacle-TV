import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { setPreferencesToken, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { uiLanguage, verifyServer } from "@tentacle-tv/shared";
import type { PairingLanguage, ServerError, ServerErrorKey } from "../redesign/screens/pairing/pairingTypes";
import { applyBackendUrl } from "../lib/backendUrls";
import type { PairedAccount } from "./usePairingCode";

/**
 * L'automate du jumelage, commun aux deux téléviseurs — l'écran n'en garde
 * que le rendu (Android TV : ses étapes historiques ; Apple TV : la vue de la
 * refonte). Accueil → code du relais, ou serveur saisi à la main → code du
 * serveur ; puis le succès, et l'accueil de l'app deux secondes plus tard
 * (`onPaired`).
 */

export type PairingFlowStep = "welcome" | "relayCode" | "manualServer" | "manualCode" | "success";

const SERVER_ERROR_KEYS: readonly ServerErrorKey[] = [
  "invalidUrl",
  "connectionTimeout",
  "apiNotFound",
  "serverHttpError",
  "cannotReachServer",
  "serverNotFoundRetry",
];

const toServerError = (key: string | undefined, params?: Record<string, string>): ServerError => ({
  key: SERVER_ERROR_KEYS.find((known) => known === key) ?? "serverNotFoundRetry",
  params,
});

/** Délai du succès avant l'accueil : le temps de lire « Bienvenue ». */
const SUCCESS_DELAY_MS = 2000;
/** La sonde du serveur livré par le relais ne retient jamais le succès. */
const HEALTH_TIMEOUT_MS = 4000;

export function usePairingFlow(onPaired: () => void) {
  const { i18n } = useTranslation();
  const { storage } = useTentacleConfig();
  const jellyfinClient = useJellyfinClient();

  const [step, setStep] = useState<PairingFlowStep>("welcome");
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [serverError, setServerError] = useState<ServerError | null>(null);

  const language: PairingLanguage = uiLanguage(i18n.language);
  const changeLanguage = useCallback((next: string) => {
    i18n.changeLanguage(next);
    storage.setItem("tentacle_language", next);
  }, [i18n, storage]);

  // L'accueil de l'app, deux secondes après le succès — annulé si l'écran part.
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  /** Un jumelage NEUF repart d'un état de lecture directe PROPRE : sans cette
   *  purge, le jeton Jellyfin d'un ANCIEN jumelage pouvait ressortir → 401 sur
   *  le flux alors que le jumelage venait d'être fait. `DirectStreamingSync`
   *  refournit le jeton frais du backend au prochain passage (~2 s). */
  const resetDirectStreaming = useCallback(() => {
    storage.removeItem("tentacle_jellyfin_token");
    storage.removeItem("tentacle_jellyfin_url");
    jellyfinClient.setDirectStreaming(null);
  }, [storage, jellyfinClient]);

  /** Le compte confirmé : la session s'écrit, le succès s'affiche — une fois,
   *  même si la confirmation revient au sondage suivant. */
  const paired = useRef(false);
  const adopt = useCallback((confirmed: PairedAccount) => {
    if (paired.current) return;
    paired.current = true;
    resetDirectStreaming();
    jellyfinClient.setAccessToken(confirmed.token);
    setPreferencesToken(confirmed.token);
    storage.setItem("tentacle_token", confirmed.token);
    storage.setItem("tentacle_user", JSON.stringify({ Id: confirmed.user.id, Name: confirmed.user.name }));
    setAccount(confirmed.user);
    setStep("success");
    successTimer.current = setTimeout(onPaired, SUCCESS_DELAY_MS);
  }, [jellyfinClient, storage, resetDirectStreaming, onPaired]);

  /** Code du relais confirmé : il apporte aussi l'adresse du serveur. */
  const relayConfirming = useRef(false);
  const onRelayConfirmed = useCallback(async (data: RelayStatusResponse) => {
    if (!data.serverUrl || !data.token || !data.user || relayConfirming.current) return;
    relayConfirming.current = true;
    // Sonde bornée : un serveur injoignable n'empêche pas le jumelage — le
    // réseau peut revenir — mais ne retient pas non plus le succès.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    await fetch(`${data.serverUrl}/api/health`, { signal: controller.signal }).catch(() => undefined);
    clearTimeout(timeout);
    storage.setItem("tentacle_server_url", data.serverUrl);
    applyBackendUrl(data.serverUrl);
    jellyfinClient.setBaseUrl(`${data.serverUrl}/api/jellyfin`);
    adopt({ token: data.token, user: data.user });
  }, [storage, jellyfinClient, adopt]);

  /** Serveur saisi à la main : vérifié, il devient le serveur de l'app. */
  const submitServer = useCallback(async () => {
    if (!serverUrl.trim() || testing) return;
    setTesting(true);
    setServerError(null);
    try {
      const result = await verifyServer(serverUrl);
      if (result.success) {
        storage.setItem("tentacle_server_url", result.url);
        applyBackendUrl(result.url);
        jellyfinClient.setBaseUrl(`${result.url}/api/jellyfin`);
        setStep("manualCode");
      } else {
        setServerError(toServerError(result.errorKey, result.errorParams));
      }
    } catch {
      setServerError(toServerError("serverNotFoundRetry"));
    } finally {
      setTesting(false);
    }
  }, [serverUrl, testing, storage, jellyfinClient]);

  const changeUrl = useCallback((next: string) => {
    setServerUrl(next);
    setServerError(null);
  }, []);

  /** Code du serveur → retour à la saisie : le serveur n'est plus retenu. */
  const changeServer = useCallback(() => {
    storage.removeItem("tentacle_server_url");
    setStep("manualServer");
  }, [storage]);

  const backToWelcome = useCallback(() => {
    setServerError(null);
    setStep("welcome");
  }, []);
  const showRelayCode = useCallback(() => setStep("relayCode"), []);
  const manualSetup = useCallback(() => setStep("manualServer"), []);

  return {
    step,
    account,
    language,
    serverUrl,
    testing,
    serverError,
    changeLanguage,
    showRelayCode,
    manualSetup,
    backToWelcome,
    changeUrl,
    submitServer,
    changeServer,
    onRelayConfirmed,
    onServerConfirmed: adopt,
  };
}

export type PairingFlow = ReturnType<typeof usePairingFlow>;
