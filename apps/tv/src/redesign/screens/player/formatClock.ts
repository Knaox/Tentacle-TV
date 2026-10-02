/**
 * Les temps de l'habillage : « 12:34 », « 1:02:03 », et l'écart signé d'un
 * défilement (« +2:30 », « −0:45 »). Des chiffres seulement : rien à
 * traduire.
 */

export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDelta(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${rounded >= 0 ? "+" : "−"}${formatClock(Math.abs(rounded))}`;
}

/**
 * Le temps RESTANT, comme le lecteur d'Apple : « −12:34 », « −1:02:15 », au
 * signe moins typographique (U+2212). Compté en secondes entières, comme
 * l'écoulé et la durée : écoulé + restant = durée, à la seconde (0:10 lus
 * d'un titre de 1:00 → « −0:50 »). Durée inconnue : rien — un « −0:00 »
 * mentirait.
 */
export function formatRemaining(position: number, duration: number): string {
  if (!(Number.isFinite(duration) && duration > 0)) return "";
  const elapsed = Number.isFinite(position) && position > 0 ? Math.floor(position) : 0;
  return `−${formatClock(Math.max(0, Math.floor(duration) - elapsed))}`;
}

/** La part lue, bornée à [0, 1]. */
export function fractionOf(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, value / total));
}
