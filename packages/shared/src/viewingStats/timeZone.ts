/**
 * Le fuseau de l'appareil, à envoyer au serveur pour que les jours et les
 * heures des statistiques soient ceux de l'utilisateur.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` donne le nom IANA
 * (« Europe/Paris ») sur le web et sur Hermes quand il le sait. À défaut, on
 * retombe sur un fuseau fixe « Etc/GMT±N » tiré du décalage courant — juste
 * pour aujourd'hui, approché d'une heure l'autre moitié de l'année, mais
 * toujours meilleur que l'heure du serveur. (Le signe des « Etc/GMT » est
 * inversé par convention POSIX : UTC+2 s'écrit « Etc/GMT-2 ».)
 */
export function deviceTimeZone(now: Date = new Date()): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof zone === "string" && zone.length > 0) return zone;
  } catch {
    // Intl absent ou incomplet : repli sur le décalage.
  }
  const offsetMinutes = now.getTimezoneOffset();
  if (offsetMinutes === 0 || offsetMinutes % 60 !== 0) return "UTC";
  const hours = offsetMinutes / 60;
  return `Etc/GMT${hours > 0 ? "+" : "-"}${Math.abs(hours)}`;
}
