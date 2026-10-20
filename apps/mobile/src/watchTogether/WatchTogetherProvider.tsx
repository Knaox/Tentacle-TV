import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  WatchTogetherContext, setWatchTogetherBackendUrl, setWatchTogetherToken, setWtLogger, useTentacleConfig,
  useWatchTogetherSession,
  type WtPlatformPort,
} from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { showToast } from "@/notices/toastStore";
import { useWtAvailability } from "./gate/useWtAvailability";
import { pushWtNotice } from "./notices/wtNotices";
import { useWtResume } from "./resume/useWtResume";
import { isPlayerPath } from "@tentacle-tv/shared";
import { WtHost } from "./WtHost";

/**
 * Watch Together — le fournisseur du mobile, monté UNE fois à la racine et
 * TOUJOURS (une porte qui s'ouvre ne remonte jamais l'app) : la séance
 * partagée (`useWatchTogetherSession`, api-client) avec les gestes du mobile —
 * le routeur d'expo-router, les messages (dans le lecteur : `wtNotices` ;
 * ailleurs : les messages de l'app), le jeton de la socket.
 *
 * Porte fermée (`useWtAvailability` : serveur sans l'adhésion par appareil,
 * compte « interdit », invité de la Famille) : la séance est INERTE
 * (`enabled: false` — ni socket, ni requête, aucun `wt:*` traité, valeur
 * `WT_IDLE_CONTEXT`), même face à un serveur d'avant qui diffuserait encore
 * l'état de la salle du compte à tous ses appareils.
 */
// Développement : le journal du moteur de synchro dans la console de Metro (« [wt:engine] … »).
if (__DEV__) setWtLogger((scope, message, data) => console.log(`[wt:${scope}] ${message}`, data ?? ""));

export function WatchTogetherProvider({ children }: { children: ReactNode }) {
  const { enabled } = useWtAvailability();
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { t } = useTranslation("watchTogether");
  const tRef = useRef(t);
  tRef.current = t;
  const { storage } = useTentacleConfig();
  const token = storage.getItem("tentacle_token");
  const { serverUrl } = useServerUrl();
  // L'adresse et le jeton du REST Watch Together (le mobile n'a pas de
  // localStorage), posés AVANT les requêtes de la séance — et repris à chaque
  // rendu : une connexion, un rafraîchissement de jeton les changent.
  useLayoutEffect(() => {
    if (serverUrl) setWatchTogetherBackendUrl(serverUrl);
    setWatchTogetherToken(token);
  }, [serverUrl, token]);

  const port = useMemo<WtPlatformPort>(() => ({
    enabled,
    socketToken: token,
    // Déjà sur un lecteur : REMPLACER (sinon chaque épisode du groupe s'empile
    // et Retour fait défiler les médias précédents au lieu de quitter).
    navigateToWatch: (itemId) => {
      const href = `/watch/${itemId}` as const;
      if (isPlayerPath(pathRef.current)) router.replace(href);
      else router.push(href);
    },
    isOnWatchPage: (itemId) => pathRef.current === `/watch/${itemId}`,
    isWatching: () => isPlayerPath(pathRef.current),
    toast: (kind, message) => {
      if (isPlayerPath(pathRef.current)) pushWtNotice(kind, message);
      else showToast({ title: message, tone: kind === "error" ? "failure" : kind });
    },
    t: (key, opts) => tRef.current(key, opts) as string,
  }), [enabled, token, router]);

  const value = useWatchTogetherSession(port);
  useWtResume(value.isInGroup);

  return (
    <WatchTogetherContext.Provider value={value}>
      {children}
      {enabled && <WtHost />}
    </WatchTogetherContext.Provider>
  );
}
