import { useDismissedHints, useFamilyOverview, useUserId } from "@tentacle-tv/api-client";
import { familyPinReminder, type FamilyPinReminder } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../useFamilyAvailability";

export interface FamilyPinReminderState extends FamilyPinReminder {
  /** La Famille ET les rappels du compte ont répondu : la règle a tranché. */
  settled: boolean;
  /**
   * On sait s'il y aura un rappel : la règle a tranché, ou il n'y en aura pas
   * — Famille absente (serveur d'avant, hors ligne, session d'un profil) ou
   * lecture en échec. Ce qui passe APRÈS le rappel au démarrage attend ce
   * signal (`startup/startupOrder.ts`).
   */
  decided: boolean;
}

/**
 * La règle partagée (`shared` › `familyPinReminder`) branchée sur le web et le
 * bureau : la Famille (`GET /api/family`, déjà en cache pour l'affiche et la
 * page) et les rappels masqués du compte. Rien hors Famille disponible — ni
 * hors ligne, ni dans la session d'un profil du bureau.
 */
export function useFamilyPinReminder(): FamilyPinReminderState {
  const { available, settled: availabilitySettled } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });
  const hints = useDismissedHints({ enabled: available });
  const userId = useUserId();
  const rule = familyPinReminder({
    overview: available ? overview.data : undefined,
    hints: hints.data,
    userId,
  });
  const settled = available && overview.data !== undefined && hints.data !== undefined;
  const failed = overview.isError || hints.isError;
  return { ...rule, settled, decided: availabilitySettled && (!available || settled || failed) };
}
