import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { usePathname, useSegments } from "expo-router";
import { useSetHintDismissed } from "@tentacle-tv/api-client";
import { FAMILY_PIN_HINT } from "@tentacle-tv/shared";
import { whenNoModal } from "@/components/ui/modalGate";
import { useReportStartupOverlay, useStartupOverlaysQuiet } from "@/startup/useStartupOverlay";
import { FamilyPinSuggest } from "./FamilyPinSuggest";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/** Le calme exigé avant de paraître : un recouvrement qui se referme laisse la place. */
const SETTLE_MS = 1500;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * « Action recommandée : posez votre code PIN » au démarrage — le DERNIER des
 * recouvrements tardifs (`startup/` : après l'invitation aux avatars, jamais
 * par-dessus elle ni par-dessus un autre), hors du lecteur et de la connexion,
 * une fois par lancement au plus. Monté une fois, à la racine.
 *
 * La décision se prend au lancement, figée à la première réponse de la
 * Famille et des rappels du compte : rejoindre une famille ou retirer son code
 * en cours de route ne fait rien paraître ici (l'acceptation a sa propre
 * fenêtre, l'écran Famille sa carte). « Configurer plus tard » masque le
 * rappel pour le COMPTE (`familyPin`) : plus jamais, nulle part ; fermer sans
 * répondre ne le tait que pour ce lancement.
 */
export function FamilyPinStartupHost() {
  const reminder = useFamilyPinReminder();
  const dismissHint = useSetHintDismissed();
  const overlaysQuiet = useStartupOverlaysQuiet("familyPin");
  const pathname = usePathname();
  const [rootSegment] = useSegments();
  const appActive = useAppActive();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"waiting" | "open" | "done">("waiting");

  useEffect(() => {
    if (eligible === null && reminder.settled) setEligible(reminder.startup);
  }, [eligible, reminder.settled, reminder.startup]);

  const busy = !overlaysQuiet
    || pathname.startsWith("/watch")
    || rootSegment === "watch"
    || rootSegment === "(auth)"
    || !appActive;
  const due = phase === "waiting" && eligible === true && reminder.startup && !busy;
  useReportStartupOverlay("familyPin", phase === "open" || due ? "active" : "quiet");

  useEffect(() => {
    if (!due) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      whenNoModal(() => {
        if (!cancelled) setPhase("open");
      });
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [due]);

  const close = useCallback(() => setPhase("done"), []);
  const later = useCallback(() => {
    dismissHint.mutate({ hint: FAMILY_PIN_HINT, dismissed: true });
    setPhase("done");
  }, [dismissHint]);

  if (phase !== "open") return null;
  return <FamilyPinSuggest variant="startup" onLater={later} onClose={close} />;
}
