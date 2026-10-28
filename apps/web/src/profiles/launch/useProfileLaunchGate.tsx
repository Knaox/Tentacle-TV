import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { TentacleApiError, appConfigQuery, useJellyfinClient } from "@tentacle-tv/api-client";
import { pickerStayState, resolveServerCapabilities, type PickerProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { accountUserId, readActiveProfile } from "../../auth/profileSession";
import { endProfileSession, readPickerRequest } from "../../auth/profileEnded";
import { dropAllSessions } from "../../auth/dropSessions";
import { getBackendBase } from "../../lib/backendBase";
import { NoPersonalSession, loadPickerProfiles, pickerProfilesKey } from "../api/pickerGateway";
import { WhoIsWatchingView } from "../picker/WhoIsWatchingView";
import { PICKER_CAPABILITY } from "../pickerPlatform";
import { afterFresh, initialGate, type FreshAnswer, type GateState } from "./gateMachine";
import { LAUNCH_CHECK_BUDGET_MS, launchVerdict } from "./launchDecision";
import { launchPassed, noteFreshLogin, noteLoggedOut, readLaunchMirror, writeLaunchMirror } from "./launchState";
import { ProfileLaunchScreen } from "./ProfileLaunchScreen";
import { forgetStayOnDevice, readStayOnDevice, readStayOnThisServer } from "./stayOnDevice";
import { LaunchSplash } from "./LaunchSplash";
import { usePickerExits } from "./usePickerExits";
import { publishStartupWindow, usePublishStartupWindow } from "../../startup/startupStore";
import { octaveGateStep } from "../../music/octave/mode/octaveLaunch";
import { isTentacleHeld } from "../../music/octave/mode/octaveLaunchStore";
import { OctaveLaunchBackdrop } from "../../music/octave/mode/OctaveLaunchBackdrop";
import { OctavePinSheet } from "../../music/octave/profiles/OctavePinSheet";

/**
 * « Qui regarde ? » à l'ouverture du BUREAU et du NAVIGATEUR — la porte qu'`App.tsx` consulte
 * avant TOUT le reste (fournisseurs, liaisons, routes) : tant qu'elle rend un
 * écran, rien de l'application n'est monté, aucune requête ne part pour un
 * profil qu'on ne choisira peut-être pas. `null` : l'application.
 *
 * Décision immédiate depuis le miroir (`launchDecision.ts`), puis la réponse
 * fraîche du serveur (`gateMachine.ts`) — seule la fin d'un profil fait
 * attendre (`LaunchSplash`) ; une connexion par mot de passe dans
 * cette exécution vaut choix fait (session personnelle, sans sélecteur). Le
 * navigateur suit le bureau, derrière SA capacité (`pickerPlatform.ts`) : le
 * miroir n'y existe que si le serveur l'a. Le client LG ne la compile pas
 * (substituée, `apps/tv-webos/config/substitutionTableSession.ts`).
 */
export function useProfileLaunchGate(authed: boolean): ReactElement | null {
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const [initialListing] = useState(() => readLaunchMirror()?.listing ?? null);
  // Lancement en Octave : jamais le sélecteur (sauf la sécurité) — l'identité gardée, ou la feuille de son code.
  const [initial] = useState(() => octaveInitial(initialState(authed), initialListing));
  const [gate, setGate] = useState<GateState>(initial.gate);
  const [octavePin, setOctavePin] = useState<PickerProfileDto | null>(initial.pin);
  // Le miroir ouvrait l'identité : on attend la réponse fraîche (la sécurité du serveur), bornée.
  const [octaveAwaiting, setOctaveAwaiting] = useState(initial.awaiting);
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const eligible = useRef(authed);
  // L'attente bornée : l'application s'ouvre sur la foi du miroir (`late`), et
  // la réponse du serveur peut encore imposer le sélecteur — qui démonterait
  // tout. Tant qu'elle court, aucune fenêtre du démarrage ne paraît
  // (`startup/startupOrder.ts`). Publiée dès le premier rendu d'`App`, avant que
  // l'application, et donc ces fenêtres, ne soient montées.
  const [lateHold, setLateHold] = useState(() => {
    const hold = eligible.current && gate.phase === "app" && gate.mode === "late";
    if (hold) publishStartupWindow(LAUNCH_SOURCE, "profile", "undecided");
    return hold;
  });
  usePublishStartupWindow(LAUNCH_SOURCE, "profile", lateHold && gate.phase === "app" ? "undecided" : "done");

  // Une connexion par mot de passe pendant cette exécution : la session
  // personnelle, sans « Qui regarde ? » (contrat du serveur). Une sortie, par
  // où qu'elle passe (écran hors ligne, bandeau du serveur muet, changement de
  // serveur — qui ignorent les clés du profil), et la connexion suivante
  // oublient ce qui restait d'une session de profil : la réserve d'un compte
  // ne survit jamais à sa déconnexion.
  const wasAuthed = useRef(authed);
  useEffect(() => {
    if (authed && !wasAuthed.current) noteFreshLogin();
    else if (!authed && wasAuthed.current) noteLoggedOut();
    wasAuthed.current = authed;
  }, [authed]);

  const logout = useCallback(() => dropAllSessions(client, queryClient), [client, queryClient]);

  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (!lateHold) return;
    const timer = setTimeout(() => setLateHold(false), Math.max(0, LAUNCH_CHECK_BUDGET_MS - (Date.now() - startedAt.current)));
    return () => clearTimeout(timer);
  }, [lateHold]);

  const apply = useCallback((answer: FreshAnswer) => {
    setLateHold(false);
    if (answer.kind === "listing") settleStay(answer.listing);
    const late = Date.now() - startedAt.current > LAUNCH_CHECK_BUDGET_MS;
    const step = afterFresh(gateRef.current, answer, late);
    if (step.logout) logout();
    if (step.endProfile && endProfileSession("ended")) return;
    setOctaveAwaiting(false);
    const { heldProfileId, stay, requested } = gateRef.current;
    const octave = octaveGateStep(step.phase, answer.kind === "listing" ? answer.listing : null, heldProfileId, stay, Date.now(), isTentacleHeld(), requested);
    setOctavePin(octave.pinProfile);
    setGate((current) => (octave.opened ? { ...current, phase: "app", mode: "verify" } : { ...current, phase: octave.phase }));
  }, [logout]);

  const check = useCallback(() => {
    void freshAnswer(queryClient).then(apply);
  }, [queryClient, apply]);

  // La réponse fraîche, une fois, à l'ouverture (l'attente bornée se juge à son arrivée).
  useEffect(() => {
    if (eligible.current) check();
  }, [check]);

  // Pas de réponse dans l'attente bornée (serveur lent, hors ligne) : l'identité gardée s'ouvre, comme hors d'Octave.
  useEffect(() => {
    if (!octaveAwaiting) return;
    const timer = setTimeout(() => {
      setOctaveAwaiting(false);
      setGate((current) => (current.phase === "check" ? { ...current, phase: "app", mode: "late" } : current));
    }, Math.max(0, LAUNCH_CHECK_BUDGET_MS - (Date.now() - startedAt.current)));
    return () => clearTimeout(timer);
  }, [octaveAwaiting]);

  // La feuille du code (lancement en Octave) : son propre profil s'ouvre sans rechargement ; sinon la page repart.
  const onOctaveOpened = useCallback((result: "stay" | "reload") => {
    if (result !== "stay") return;
    setOctavePin(null);
    setGate((current) => ({ ...current, phase: "app", mode: "verify" }));
  }, []);

  const onDone = useCallback((landing?: string) => {
    setGate((current) => ({ ...current, phase: "app", mode: "verify" }));
    if (landing) navigate(landing);
  }, [navigate]);

  if (!authed || gate.phase === "app") return null;
  if (octavePin) {
    return (
      <>
        <OctaveLaunchBackdrop />
        <OctavePinSheet profile={octavePin} onOpened={onOctaveOpened} onStale={check} />
      </>
    );
  }
  if (gate.phase === "picker") {
    return <ProfileLaunchScreen initialListing={initialListing} ended={gate.requested} onDone={onDone} onAccountLost={logout} />;
  }
  if (gate.phase === "error") return <ErrorScreen onRetry={check} onEnterApp={onDone} onSignOut={logout} />;
  return isTentacleHeld() ? <OctaveLaunchBackdrop /> : <LaunchSplash />;
}

/**
 * Le lancement en Octave, d'après le miroir : le sélecteur devient l'identité
 * gardée, rouverte sans son code — la feuille du code seulement si la session
 * d'un profil a pris fin (`requested` : on retombe sur une autre identité). En
 * ouvrant, l'ATTENTE de la réponse fraîche (`check`, fond d'Octave, bornée) :
 * la sécurité (le serveur dit un autre profil) est jugée avant que rien de
 * l'identité ne paraisse.
 */
function octaveInitial(gate: GateState, listing: PickerProfilesDto | null): { gate: GateState; pin: PickerProfileDto | null; awaiting: boolean } {
  const step = octaveGateStep(gate.phase, listing, gate.heldProfileId, gate.stay, Date.now(), isTentacleHeld(), gate.requested);
  return { gate: step.opened ? { ...gate, phase: "check" } : gate, pin: step.pinProfile, awaiting: step.opened };
}

/** La source de la première fenêtre du démarrage que tient cette porte. */
const LAUNCH_SOURCE = "profileLaunch";

function initialState(authed: boolean): GateState {
  const requested = readPickerRequest() !== null;
  // La session d'un profil a pris fin (retiré, code changé…) : comme la TV,
  // l'appareil ne le retient plus — le sélecteur arrive case décochée.
  if (requested) forgetStayOnDevice();
  const heldProfileId = readActiveProfile()?.id ?? null;
  const passed = launchPassed();
  const server = getBackendBase();
  const accountId = accountUserId();
  const stay = readStayOnDevice(server, accountId);
  const verdict = launchVerdict({
    authed,
    passed,
    requested,
    server,
    accountId,
    heldProfileId,
    mirror: readLaunchMirror(),
    stay,
    now: Date.now(),
  });
  return initialGate(verdict, requested, heldProfileId, passed, stay);
}

/** Le profil retenu par l'appareil a quitté la famille, ou son code a changé d'état : oublié. */
function settleStay(listing: PickerProfilesDto): void {
  const stay = readStayOnThisServer(accountUserId());
  if (stay && pickerStayState(listing, stay, Date.now()) === "stale") forgetStayOnDevice();
}

/** Le serveur, maintenant : sa capacité, puis la famille du compte (miroir mis à jour). */
async function freshAnswer(queryClient: QueryClient): Promise<FreshAnswer> {
  const accountId = accountUserId();
  const server = getBackendBase();
  if (!accountId) return { kind: "accountLost" };
  try {
    const config = await queryClient.fetchQuery(appConfigQuery());
    const capable = resolveServerCapabilities(config).has(PICKER_CAPABILITY) && config.features?.family !== undefined;
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

/**
 * Le sélecteur EXIGÉ (fin d'un profil) et un serveur muet : Réessayer — jamais le compte EN LIGNE sans son code ;
 * mais aussi le hors ligne du compte (le sien, comme quand la connexion tombe pendant un profil) et la
 * déconnexion (`usePickerExits`) : jamais bloqué.
 */
function ErrorScreen({ onRetry, onEnterApp, onSignOut }: { onRetry: () => void; onEnterApp: () => void; onSignOut: () => void }) {
  const { t } = useTranslation("profilePicker");
  const exits = usePickerExits(true, onEnterApp, onSignOut);
  return (
    <WhoIsWatchingView
      exits={exits}
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
