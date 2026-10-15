import { useCallback, useEffect, useState } from "react";
import { useSetHintDismissed } from "@tentacle-tv/api-client";
import { FAMILY_PIN_HINT } from "@tentacle-tv/shared";
import { FamilyPinSuggestDialog } from "./FamilyPinSuggestDialog";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/** Le temps de laisser l'application s'installer — un peu plus que l'invitation aux avatars, qui passe avant. */
const SETTLE_MS = 1500;

interface FamilyPinStartupProps {
  /** Un autre recouvrement de démarrage occupe l'écran, va paraître ou n'a pas tranché ; ou l'on est sur le lecteur. */
  busy: boolean;
  /** Ouverte ou refermée : les autres recouvrements attendent qu'elle se taise. */
  onOpenChange: (open: boolean) => void;
}

/**
 * « Action recommandée : posez votre code PIN » au démarrage — le DERNIER des
 * recouvrements (`StartupOverlays`), une fois par lancement au plus.
 *
 * La décision se prend au lancement : elle est figée à la première réponse de
 * la Famille et des rappels du compte. Rejoindre une famille, ou retirer son
 * code, en cours de route ne fait rien paraître ici — l'acceptation a sa
 * propre fenêtre, Réglages › Famille sa carte. « Configurer plus tard » masque
 * le rappel pour le COMPTE (`familyPin`) : plus jamais, sur aucun appareil ;
 * fermer sans répondre ne le tait que pour ce lancement.
 */
export function FamilyPinStartup({ busy, onOpenChange }: FamilyPinStartupProps) {
  const reminder = useFamilyPinReminder();
  const dismissHint = useSetHintDismissed();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"waiting" | "open" | "done">("waiting");

  useEffect(() => {
    if (eligible === null && reminder.settled) setEligible(reminder.startup);
  }, [eligible, reminder.settled, reminder.startup]);

  const due = phase === "waiting" && eligible === true && reminder.startup && !busy;
  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => setPhase("open"), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due]);

  const open = phase === "open";
  useEffect(() => {
    onOpenChange(open);
  }, [open, onOpenChange]);

  const close = useCallback(() => setPhase("done"), []);
  const later = useCallback(() => {
    dismissHint.mutate({ hint: FAMILY_PIN_HINT, dismissed: true });
    setPhase("done");
  }, [dismissHint]);

  if (!open) return null;
  return <FamilyPinSuggestDialog variant="startup" onLater={later} onClose={close} />;
}
