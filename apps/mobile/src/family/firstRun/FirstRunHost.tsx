import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { usePathname, useSegments } from "expo-router";
import { useSetHintDismissed, useTentacleConfig } from "@tentacle-tv/api-client";
import { FAMILY_PIN_HINT } from "@tentacle-tv/shared";
import { OwnPinSheet } from "@/components/family/PinSheet";
import { whenNoModal } from "@/components/ui/modalGate";
import { useStoredUser } from "@/auth/useStoredUser";
import { AvatarGallerySheet } from "@/avatars/gallery/AvatarGallerySheet";
import { markSubjectInvited } from "@/avatars/invite/inviteGate";
import { useReportStartupOverlay, useStartupOverlaysQuiet } from "@/startup/useStartupOverlay";
import { FirstRunCard } from "./FirstRunCard";
import { markFirstRunCovered } from "./firstRunCovered";
import { currentStep, reduceFirstRun, startFirstRun, type FirstRunAction, type FirstRunFlow } from "./firstRunFlow";
import { FIRST_RUN_SEEN_KEY, firstRunKey, firstRunPlan, parseFirstRunSeen, withFirstRunSeen, type FirstRunStep } from "./firstRunPlan";
import { useFirstRunInputs } from "./useFirstRunInputs";

/** Au-delà, une réponse qui manque compte pour « non » : le premier lancement ne retient jamais l'app. */
const MAX_WAIT_MS = 6_000;
/** Le calme exigé avant de paraître : un recouvrement qui se referme laisse la place. */
const SETTLE_MS = 800;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * Le PREMIER LANCEMENT d'un profil sur le mobile et l'iPad — après « Qui
 * regarde ? » et son code, l'ordre de la TV : le code PIN conseillé, les
 * rangées de l'accueil, la photo (`firstRunPlan`). Une fois par profil et par
 * appareil ; « Reproposer » du serveur le rouvre (`promptsReset`). Le premier
 * des recouvrements TARDIFS du démarrage : il attend que tout le reste se soit
 * tu, jamais sur le lecteur ni la connexion, et l'invitation aux avatars et le
 * rappel du code PIN passent après lui sans reposer ce qu'il a proposé.
 *
 * Pas à pas (`firstRunFlow`) : une seule surface à la fois ; une feuille (le
 * code, la galerie) ne se présente qu'une fois la carte retirée, et la carte
 * suivante qu'une fois la feuille retirée. Décidé une fois par profil et par
 * lancement : une relecture en cours de route ne fait rien surgir. Hors ligne,
 * rien n'est montré ni marqué : il reviendra.
 */
export function FirstRunHost() {
  const inputs = useFirstRunInputs();
  const { storage } = useTentacleConfig();
  const user = useStoredUser();
  const dismissHint = useSetHintDismissed();
  const pathname = usePathname();
  const [rootSegment] = useSegments();
  const appActive = useAppActive();
  const quietBefore = useStartupOverlaysQuiet("firstRun");
  const [timedOut, setTimedOut] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ subject: string; steps: FirstRunStep[] } | null>(null);
  const [flow, setFlow] = useState<FirstRunFlow | null>(null);
  const [visible, setVisible] = useState(false);
  const dispatch = useCallback((action: FirstRunAction) => setFlow((current) => (current ? reduceFirstRun(current, action) : current)), []);

  const subject = inputs.subjectId;
  const late = timedOut === subject;
  const plan = firstRunPlan(late ? {
    ...inputs, pinDue: inputs.pinDue ?? false, homeReady: inputs.homeReady ?? false, photoDue: inputs.photoDue ?? false,
  } : inputs);
  const planKind = plan.kind;
  const planSteps = plan.kind === "show" ? plan.steps.join(",") : "";

  // La borne d'attente, par profil.
  useEffect(() => {
    if (!subject || decision?.subject === subject) return;
    const timer = setTimeout(() => setTimedOut(subject), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [subject, decision?.subject]);

  // La décision, figée par profil — après la demande « Reproposer » du serveur.
  useEffect(() => {
    if (!subject || decision?.subject === subject) return;
    if (!inputs.resetSettled && !late) return;
    if (planKind === "pending") return;
    setDecision({ subject, steps: planSteps ? (planSteps.split(",") as FirstRunStep[]) : [] });
  }, [subject, decision?.subject, inputs.resetSettled, late, planKind, planSteps]);

  const ours = decision !== null && decision.subject === subject && decision.steps.length > 0;
  const busy = !quietBefore || pathname.startsWith("/watch") || rootSegment === "watch" || rootSegment === "(auth)" || !appActive;

  // Le départ : tout le reste s'est tu, puis aucune modale à l'écran.
  useEffect(() => {
    if (!ours || flow !== null || busy || !decision) return;
    let cancelled = false;
    const timer = setTimeout(() => whenNoModal(() => {
      if (!cancelled) setFlow(startFirstRun(decision.steps));
    }), SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ours, flow, busy, decision]);

  // Les passages entre surfaces : la suivante attend que la précédente soit retirée.
  const surface = flow?.surface;
  useEffect(() => {
    if (surface !== "toSheet" && surface !== "toCard") return;
    let cancelled = false;
    whenNoModal(() => {
      if (!cancelled) dispatch("presented");
    });
    return () => {
      cancelled = true;
    };
  }, [surface, dispatch]);

  // La fin : le profil a vu son premier lancement ici.
  const finished = useRef<string | null>(null);
  useEffect(() => {
    if (surface !== "done" || !decision || !inputs.serverUrl || finished.current === decision.subject) return;
    finished.current = decision.subject;
    const key = firstRunKey(inputs.serverUrl, decision.subject);
    storage.setItem(FIRST_RUN_SEEN_KEY, JSON.stringify(withFirstRunSeen(parseFirstRunSeen(storage.getItem(FIRST_RUN_SEEN_KEY)), key)));
  }, [surface, decision, inputs.serverUrl, storage]);

  const step = flow ? currentStep(flow) : null;
  const running = ours && flow !== null && flow.surface !== "done";
  const waiting = ours && flow === null;
  useReportStartupOverlay("firstRun", running || waiting ? "active" : decision?.subject === subject || !subject ? "quiet" : "pending");

  useEffect(() => {
    setVisible(running && flow?.surface === "card");
  }, [running, flow?.surface]);

  const onPrimary = useCallback(() => {
    if (step === "pinSetup") markFirstRunCovered("pin");
    if (step === "photoSetup" && subject) {
      markFirstRunCovered("photo");
      markSubjectInvited(storage, subject);
    }
    dispatch(step === "railSetup" ? "next" : "openSheet");
  }, [step, subject, storage, dispatch]);

  const onSkip = useCallback(() => {
    if (step === "pinSetup") {
      markFirstRunCovered("pin");
      // « Passer » vaut « Configurer plus tard » : le rappel du COMPTE se tait (« Reproposer » le rouvre).
      dismissHint.mutate({ hint: FAMILY_PIN_HINT, dismissed: true });
    }
    if (step === "photoSetup" && subject) {
      markFirstRunCovered("photo");
      markSubjectInvited(storage, subject);
    }
    dispatch("next");
  }, [step, subject, storage, dismissHint, dispatch]);

  const closeSheet = useCallback(() => dispatch("sheetClosed"), [dispatch]);
  const current = useMemo(() => ({ uri: null, initial: (user?.Name ?? "?").charAt(0).toUpperCase() }), [user?.Name]);

  if (!running || !flow || !step) return null;
  if (flow.surface === "sheet" && step === "pinSetup") return <OwnPinSheet hasPin={false} onClose={closeSheet} />;
  if (flow.surface === "sheet" && step === "photoSetup") return <AvatarGallerySheet visible mode="invite" current={current} onClose={closeSheet} />;
  if (!visible) return null;
  return (
    <FirstRunCard
      step={step}
      position={flow.index + 1}
      total={flow.steps.length}
      onPrimary={onPrimary}
      onSkip={step === "railSetup" ? undefined : onSkip}
    />
  );
}
