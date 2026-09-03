/** Millisecondes jusqu'au prochain minuit UTC (jamais 0 : à minuit pile, le
 *  prochain) — le tirage quotidien des rangées change à ce moment. */
export function msUntilNextUtcMidnight(now = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - now;
}
