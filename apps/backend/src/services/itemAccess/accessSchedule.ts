/**
 * Les plages horaires d'un compte (`AccessSchedules` de sa politique Jellyfin) :
 * hors plage, le compte ne regarde rien (docs/DROITS-UTILISATEURS.md § 5).
 *
 * Jellyfin ne les vérifie qu'à l'authentification d'un jeton de COMPTE : tout
 * ce que Tentacle sert avec la clé d'administration (TV jumelée, profils,
 * recherche, recommandations) les ignorait. La règle est celle de Jellyfin
 * (`User.IsParentalScheduleAllowed`) : aucune plage = permis ; sinon permis si
 * UNE plage couvre l'instant — son jour (« Everyday », « Weekday » = lundi à
 * vendredi, « Weekend » = samedi et dimanche) et StartHour ≤ heure ≤ EndHour,
 * en heures décimales, à l'heure LOCALE du serveur.
 *
 * Pur : l'instant est donné ; ni réseau, ni horloge.
 */

import type { AccessScheduleDto } from "../../userRights/userRightsContract";
import { getContentPolicy } from "../contentPolicy";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function dayMatches(day: AccessScheduleDto["dayOfWeek"], weekday: number): boolean {
  if (day === "Everyday") return true;
  if (day === "Weekday") return weekday >= 1 && weekday <= 5;
  if (day === "Weekend") return weekday === 0 || weekday === 6;
  return DAY_NAMES[weekday] === day;
}

export function scheduleAllows(schedules: readonly AccessScheduleDto[], now: Date): boolean {
  if (schedules.length === 0) return true;
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return schedules.some((s) => dayMatches(s.dayOfWeek, now.getDay()) && hour >= s.startHour && hour <= s.endHour);
}

/** Ce compte est-il HORS de ses plages horaires, maintenant ? Politique illisible : non (rien à juger). */
export async function outsideAccessSchedule(userId: string, now = new Date()): Promise<boolean> {
  return !scheduleAllows((await getContentPolicy(userId)).accessSchedules, now);
}

/** La réponse d'une porte hors plage : 403, jamais 401 (le client ne se déconnecte pas). */
export const OUTSIDE_SCHEDULE_REPLY = { error: "outside_access_schedule" } as const;
