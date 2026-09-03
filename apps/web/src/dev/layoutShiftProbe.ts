/**
 * `__cls()` en console — DÉVELOPPEMENT UNIQUEMENT. Cumule les décalages de
 * mise en page (Layout Instability API) hors interaction : la page
 * Recommandations doit rester sous 0,02 d'un rechargement à l'autre — le
 * chiffre qui dit qu'aucune rangée n'a poussé la page.
 */
interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput?: boolean;
  value?: number;
}

export function installLayoutShiftProbe(): void {
  if (typeof PerformanceObserver === "undefined") return;
  let total = 0;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) total += entry.value ?? 0;
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  } catch {
    return;
  }
  (window as unknown as { __cls: () => number }).__cls = () => Number(total.toFixed(4));
}
