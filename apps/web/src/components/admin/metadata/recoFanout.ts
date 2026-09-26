import type { AdminRecoFanout } from "@tentacle-tv/api-client";

/** Ce que la page dit du calcul des recommandations de tous les comptes. */
export type FanoutView =
  | { kind: "preparing" }
  | { kind: "running"; processed: number; total: number }
  | { kind: "done"; upToDate: number; failed: number; finishedAt: string }
  | { kind: "interrupted"; processed: number; total: number; finishedAt: string };

/**
 * L'état du fan-out mis en mots. Pendant la passe : « préparation » tant que
 * les comptes ne sont pas comptés (lecture Jellyfin), puis un compteur. Après :
 * le bilan de la dernière passe — si elle a porté sur au moins un compte et
 * que son heure de fin se lit (un serveur d'avant le bilan n'en donne pas).
 */
export function fanoutView(fanout: AdminRecoFanout | undefined): FanoutView | null {
  if (!fanout) return null;
  if (fanout.running) {
    return fanout.total > 0
      ? { kind: "running", processed: Math.min(fanout.processed, fanout.total), total: fanout.total }
      : { kind: "preparing" };
  }
  const finishedAt = fanout.finishedAt;
  if (!finishedAt || !Number.isFinite(Date.parse(finishedAt)) || fanout.total === 0) return null;
  if (fanout.processed < fanout.total) {
    return { kind: "interrupted", processed: fanout.processed, total: fanout.total, finishedAt };
  }
  const failed = Math.min(fanout.failed ?? 0, fanout.processed);
  return { kind: "done", upToDate: fanout.processed - failed, failed, finishedAt };
}

/**
 * « il y a 5 minutes », « il y a 3 heures », « hier » — dans la langue de
 * l'interface. `null` sous la minute : l'appelant dit « à l'instant », que
 * `Intl.RelativeTimeFormat` rendrait « maintenant ».
 */
export function relativeWhen(iso: string, now: number, locale: string): string | null {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (seconds > -60) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}
