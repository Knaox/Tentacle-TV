import { useCallback, useEffect, useRef, useState } from "react";
import { useSetHintDismissed } from "@tentacle-tv/api-client";
import {
  FAMILY_PIN_HINT, FIRST_RUN_SEEN_KEY, currentStep, firstRunKey, firstRunPlan, firstRunStepOf, parseFirstRunSeen,
  reduceFirstRun, startFirstRun, withFirstRunSeen, type FirstRunAction, type FirstRunFlow, type FirstRunStep,
} from "@tentacle-tv/shared";
import { OwnPinDialog } from "../../family/page/PinEditors";
import { markSubjectInvited } from "../../profiles/avatarGallery/inviteRule";
import { useAvatarGallery } from "../../profiles/avatarGallery/useAvatarGallery";
import type { StartupWindowState } from "../../startup/startupOrder";
import { useStartupTurn } from "../../startup/startupStore";
import { FirstRunCard } from "./FirstRunCard";
import { useWebFirstRunInputs } from "./useWebFirstRunInputs";

/** Au-delà, une réponse qui manque compte pour « non » : le premier lancement ne retient jamais l'app. */
const MAX_WAIT_MS = 6_000;
/** Le calme exigé avant de paraître (le rideau d'un profil, la fenêtre d'avant). */
const SETTLE_MS = 800;

/**
 * Le PREMIER LANCEMENT d'un profil sur le web étroit (téléphone, iPad) — le
 * `FirstRunHost` du mobile, d'après le MÊME catalogue (shared `firstRun/`) :
 * le code PIN conseillé, les rangées de l'accueil, la photo, une fois par
 * profil et par navigateur (`FIRST_RUN_SEEN_KEY`), rouvert par « Reproposer »
 * du serveur. Il prend la place des fenêtres « code PIN conseillé » et
 * « invitation aux avatars » du bureau (`StartupOverlays` ne les monte pas
 * dans le miroir) : son rang est celui du code PIN, juste après « Qui
 * regarde ? » ; nouveautés, affiche de la Famille et mise à jour attendent.
 *
 * Pas à pas (`firstRunFlow`) : une seule surface à la fois — la carte, OU le
 * dialogue qu'elle ouvre (le code, la galerie). Décidé une fois par profil et
 * par lancement ; hors ligne, rien n'est montré ni marqué : il reviendra.
 */
export function MirrorFirstRun() {
  const inputs = useWebFirstRunInputs();
  const dismissHint = useSetHintDismissed();
  const [timedOut, setTimedOut] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ subject: string; steps: FirstRunStep[] } | null>(null);
  const [flow, setFlow] = useState<FirstRunFlow | null>(null);
  const dispatch = useCallback((action: FirstRunAction) => setFlow((current) => (current ? reduceFirstRun(current, action) : current)), []);
  const closeSheet = useCallback(() => dispatch("sheetClosed"), [dispatch]);
  const gallery = useAvatarGallery("invite", closeSheet);

  const subject = inputs.subjectId;
  const late = timedOut === subject;
  const plan = firstRunPlan(late ? {
    ...inputs, pinDue: inputs.pinDue ?? false, homeReady: inputs.homeReady ?? false, photoDue: inputs.photoDue ?? false,
  } : inputs);
  const planSteps = plan.kind === "show" ? plan.steps.join(",") : "";

  useEffect(() => {
    if (!subject || decision?.subject === subject) return;
    const timer = setTimeout(() => setTimedOut(subject), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [subject, decision?.subject]);

  // La décision, figée par profil — après la demande « Reproposer » du serveur.
  useEffect(() => {
    if (!subject || decision?.subject === subject) return;
    if ((!inputs.resetSettled && !late) || plan.kind === "pending") return;
    setDecision({ subject, steps: planSteps ? (planSteps.split(",") as FirstRunStep[]) : [] });
  }, [subject, decision?.subject, inputs.resetSettled, late, plan.kind, planSteps]);

  const ours = decision !== null && decision.subject === subject && decision.steps.length > 0;
  const running = ours && flow !== null && flow.surface !== "done";
  const state: StartupWindowState = running ? "open" : ours && flow === null ? "pending" : decision?.subject === subject || !subject ? "done" : "undecided";
  const turn = useStartupTurn("familyPin", state, "firstRun");

  useEffect(() => {
    if (!ours || flow !== null || !turn || !decision) return;
    const timer = setTimeout(() => setFlow(startFirstRun(decision.steps)), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ours, flow, turn, decision]);

  // Le web n'a pas de pile de modales native : les passages entre surfaces sont immédiats.
  const surface = flow?.surface;
  const step = flow ? currentStep(flow) : null;
  useEffect(() => {
    if (surface === "toSheet" || surface === "toCard") dispatch("presented");
  }, [surface, dispatch]);
  const { openGallery } = gallery;
  useEffect(() => {
    if (surface === "sheet" && step === "photoSetup") openGallery();
  }, [surface, step, openGallery]);

  // La fin : ce profil a vu son premier lancement dans ce navigateur.
  const finished = useRef<string | null>(null);
  useEffect(() => {
    if (surface !== "done" || !decision || !inputs.serverUrl || finished.current === decision.subject) return;
    finished.current = decision.subject;
    try {
      const key = firstRunKey(inputs.serverUrl, decision.subject);
      localStorage.setItem(FIRST_RUN_SEEN_KEY, JSON.stringify(withFirstRunSeen(parseFirstRunSeen(localStorage.getItem(FIRST_RUN_SEEN_KEY)), key)));
    } catch {
      // Stockage refusé (navigation privée) : il reviendra, sans rien casser.
    }
  }, [surface, decision, inputs.serverUrl]);

  const markPhoto = useCallback(() => {
    if (step === "photoSetup" && subject) markSubjectInvited(subject);
  }, [step, subject]);
  const onPrimary = useCallback(() => {
    markPhoto();
    dispatch(step && firstRunStepOf(step).sheet ? "openSheet" : "next");
  }, [step, markPhoto, dispatch]);
  const onSkip = useCallback(() => {
    // « Passer » le code vaut « Configurer plus tard » : le rappel du COMPTE se tait (« Reproposer » le rouvre).
    if (step === "pinSetup") dismissHint.mutate({ hint: FAMILY_PIN_HINT, dismissed: true });
    markPhoto();
    dispatch("next");
  }, [step, markPhoto, dismissHint, dispatch]);

  if (!running || !flow || !step) return gallery.dialog;
  if (flow.surface === "sheet" && step === "pinSetup") return <OwnPinDialog hasPin={false} onClose={closeSheet} />;
  if (flow.surface === "sheet") return gallery.dialog;
  return (
    <>
      {gallery.dialog}
      <FirstRunCard
        step={step}
        position={flow.index + 1}
        total={flow.steps.length}
        onPrimary={onPrimary}
        onSkip={firstRunStepOf(step).skippable ? onSkip : undefined}
      />
    </>
  );
}
