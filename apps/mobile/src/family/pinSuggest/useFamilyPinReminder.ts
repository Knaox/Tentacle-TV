import { useDismissedHints, useFamilyOverview, useUserId } from "@tentacle-tv/api-client";
import { familyPinReminder, type FamilyPinReminder } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../useFamilyAvailability";

export interface FamilyPinReminderState extends FamilyPinReminder {
  /** La Famille est lisible ici (serveur, session, en ligne). */
  available: boolean;
  /** La Famille ET les rappels du compte ont répondu : la règle a tranché. */
  settled: boolean;
}

/**
 * La règle partagée (`shared` › `familyPinReminder`) branchée sur le mobile :
 * la Famille (`GET /api/family`, déjà en cache pour l'affiche et l'écran) et
 * les rappels masqués du compte. Le mobile n'ouvre que des sessions
 * personnelles ; hors ligne ou sans Famille, rien.
 */
export function useFamilyPinReminder(): FamilyPinReminderState {
  const { available } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });
  const hints = useDismissedHints({ enabled: available });
  const userId = useUserId();
  const rule = familyPinReminder({
    overview: available ? overview.data : undefined,
    hints: hints.data,
    userId,
  });
  return { ...rule, available, settled: available && overview.data !== undefined && hints.data !== undefined };
}
