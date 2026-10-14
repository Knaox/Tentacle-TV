import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { TentacleApiError, appConfigQuery, useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveServerCapabilities } from "@tentacle-tv/shared";
import { accountUserId, readActiveProfile } from "../../auth/profileSession";
import { endProfileSession, readPickerRequest } from "../../auth/profileEnded";
import { dropAllSessions } from "../../auth/dropSessions";
import { isDesktopApp } from "../../desktop/detect";
import { getBackendBase } from "../../lib/backendBase";
import { NoPersonalSession, loadPickerProfiles, pickerProfilesKey } from "../api/pickerGateway";
import { WhoIsWatchingView } from "../picker/WhoIsWatchingView";
import { afterFresh, initialGate, type FreshAnswer, type GateState } from "./gateMachine";
import { LAUNCH_CHECK_BUDGET_MS, launchVerdict } from "./launchDecision";
import { launchPassed, noteFreshLogin, readLaunchMirror, writeLaunchMirror } from "./launchState";
import { ProfileLaunchScreen } from "./ProfileLaunchScreen";
import { LaunchSplash } from "./LaunchSplash";

/**
 * « Qui regarde ? » à l'ouverture du BUREAU — la porte qu'`App.tsx` consulte
 * avant TOUT le reste (fournisseurs, liaisons, routes) : tant qu'elle rend un
 * écran, rien de l'application n'est monté, aucune requête ne part pour un
 * profil qu'on ne choisira peut-être pas. `null` : l'application.
 *
 * Décision immédiate depuis le miroir (`launchDecision.ts`), puis la réponse
 * fraîche du serveur (`gateMachine.ts`) — seule la fin d'un profil fait
 * attendre (`LaunchSplash`) ; une connexion par mot de passe dans
 * cette exécution vaut choix fait (session personnelle, sans sélecteur). Hors
 * du bureau : `null`, sans rien lire. Le client LG ne la compile pas
 * (substituée, `apps/tv-webos/config/substitutionTableSession.ts`).
 */
export function useProfileLaunchGate(authed: boolean): ReactElement | null {
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const [gate, setGate] = useState<GateState>(() => initialState(authed));
  const [initialListing] = useState(() => readLaunchMirror()?.listing ?? null);
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const eligible = useRef(isDesktopApp() && authed);

  // Une connexion par mot de passe pendant cette exécution : la session
  // personnelle, sans « Qui regarde ? » (contrat du serveur). Ce qui restait
  // d'une session de profil (une sortie qui ignorait ces clés : déconnexion
  // depuis l'écran hors ligne, changement de serveur…) est oublié — la réserve
  // d'un AUTRE compte ne doit jamais survivre à une connexion.
  const wasAuthed = useRef(authed);
  useEffect(() => {
    if (authed && !wasAuthed.current) noteFreshLogin();
    wasAuthed.current = authed;
  }, [authed]);

  const logout = useCallback(() => dropAllSessions(client, queryClient), [client, queryClient]);

  const startedAt = useRef(Date.now());
  const apply = useCallback((answer: FreshAnswer) => {
    const late = Date.now() - startedAt.current > LAUNCH_CHECK_BUDGET_MS;
    const step = afterFresh(gateRef.current, answer, late);
    if (step.logout) logout();
    if (step.endProfile && endProfileSession("ended")) return;
    setGate((current) => ({ ...current, phase: step.phase }));
  }, [logout]);

  const check = useCallback(() => {
    void freshAnswer(queryClient).then(apply);
  }, [queryClient, apply]);

  // La réponse fraîche, une fois, à l'ouverture (l'attente bornée se juge à son arrivée).
  useEffect(() => {
    if (eligible.current) check();
  }, [check]);

  const onDone = useCallback((landing?: string) => {
    setGate((current) => ({ ...current, phase: "app", mode: "verify" }));
    if (landing) navigate(landing);
  }, [navigate]);

  if (!authed || gate.phase === "app") return null;
  if (gate.phase === "picker") {
    return <ProfileLaunchScreen initialListing={initialListing} ended={gate.requested} onDone={onDone} onAccountLost={logout} />;
  }
  if (gate.phase === "error") return <ErrorScreen onRetry={check} />;
  return <LaunchSplash />;
}

function initialState(authed: boolean): GateState {
  const requested = readPickerRequest() !== null;
  const heldProfileId = readActiveProfile()?.id ?? null;
  const passed = launchPassed();
  const verdict = launchVerdict({
    desktop: isDesktopApp(),
    authed,
    passed,
    requested,
    server: getBackendBase(),
    accountId: accountUserId(),
    heldProfileId,
    mirror: readLaunchMirror(),
  });
  return initialGate(verdict, requested, heldProfileId, passed);
}

/** Le serveur, maintenant : sa capacité, puis la famille du compte (miroir mis à jour). */
async function freshAnswer(queryClient: QueryClient): Promise<FreshAnswer> {
  const accountId = accountUserId();
  const server = getBackendBase();
  if (!accountId) return { kind: "accountLost" };
  try {
    const config = await queryClient.fetchQuery(appConfigQuery());
    const capable = resolveServerCapabilities(config).has("family.desktopProfiles") && config.features?.family !== undefined;
    if (!capable) {
      writeLaunchMirror({ server, accountId, capable: false, listing: null });
      return { kind: "incapable" };
    }
    const listing = await queryClient.fetchQuery({
      queryKey: pickerProfilesKey(accountId),
      queryFn: ({ signal }) => loadPickerProfiles(signal),
      staleTime: 0,
      retry: false,
    });
    writeLaunchMirror({ server, accountId, capable: true, listing });
    return { kind: "listing", listing };
  } catch (error) {
    if (error instanceof NoPersonalSession) return { kind: "accountLost" };
    if (error instanceof TentacleApiError && error.status === 401) return { kind: "accountLost" };
    return { kind: "failed" };
  }
}

/** Le sélecteur EXIGÉ (fin d'un profil) et un serveur muet : Réessayer, jamais le compte sans son code. */
function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("profilePicker");
  return (
    <WhoIsWatchingView
      model={{ kind: "error", message: t("refusal.offline") }}
      onPick={noop}
      onManage={noop}
      onRetry={onRetry}
      onDigit={noop}
      onErase={noop}
      onBack={noop}
    />
  );
}

function noop(): void {}
