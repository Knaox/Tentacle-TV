import { useCallback, useEffect, useState } from "react";
import { useSetHintDismissed } from "@tentacle-tv/api-client";
import { FAMILY_PIN_HINT } from "@tentacle-tv/shared";
import type { StartupWindowState } from "../../startup/startupOrder";
import { useStartupTurn } from "../../startup/startupStore";
import { FamilyPinSuggestDialog } from "./FamilyPinSuggestDialog";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/** Le temps de laisser l'application s'installer (et le rideau d'un profil se lever). */
const SETTLE_MS = 1500;

/**
 * « Action recommandée : posez votre code PIN » au démarrage — la DEUXIÈME
 * fenêtre (`startup/startupOrder.ts`), juste après « Qui regarde ? », une fois
 * par lancement au plus. Tant qu'elle n'a pas tranché, les nouveautés,
 * l'affiche de la Famille, la mise à jour et l'invitation aux avatars attendent.
 *
 * La décision se prend au lancement : elle est figée à la première réponse de
 * la Famille et des rappels du compte. Rejoindre une famille, ou retirer son
 * code, en cours de route ne fait rien paraître ici — l'acceptation a sa
 * propre fenêtre, Réglages › Famille sa carte. « Configurer plus tard » masque
 * le rappel pour le COMPTE (`familyPin`) : plus jamais, sur aucun appareil ;
 * fermer sans répondre ne le tait que pour ce lancement.
 */
export function FamilyPinStartup() {
  const reminder = useFamilyPinReminder();
  const dismissHint = useSetHintDismissed();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"waiting" | "open" | "done">("waiting");

  useEffect(() => {
    if (eligible === null && reminder.decided) setEligible(reminder.settled && reminder.startup);
  }, [eligible, reminder.decided, reminder.settled, reminder.startup]);

  const wanted = phase === "waiting" && eligible === true && reminder.startup;
  const state: StartupWindowState = phase === "open" ? "open" : eligible === null ? "undecided" : wanted ? "pending" : "done";
  const turn = useStartupTurn("familyPin", state);

  const due = wanted && turn;
  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => setPhase("open"), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due]);

  const close = useCallback(() => setPhase("done"), []);
  const later = useCallback(() => {
    dismissHint.mutate({ hint: FAMILY_PIN_HINT, dismissed: true });
    setPhase("done");
  }, [dismissHint]);

  if (phase !== "open") return null;
  return <FamilyPinSuggestDialog variant="startup" onLater={later} onClose={close} />;
}
