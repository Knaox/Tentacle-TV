import { useDismissedHints, useFamilyOverview, useUserId } from "@tentacle-tv/api-client";
import { familyPinReminder, type FamilyPinReminder } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../useFamilyAvailability";

export interface FamilyPinReminderState extends FamilyPinReminder {
  /** La Famille ET les rappels du compte ont répondu : la règle a tranché. */
  settled: boolean;
}

/**
 * La règle partagée (`shared` › `familyPinReminder`) branchée sur le web et le
 * bureau : la Famille (`GET /api/family`, déjà en cache pour l'affiche et la
 * page) et les rappels masqués du compte. Rien hors Famille disponible — ni
 * hors ligne, ni dans la session d'un profil du bureau.
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
  return { ...rule, settled: available && overview.data !== undefined && hints.data !== undefined };
}
