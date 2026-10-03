import { OfflineOverlay } from "@bench/src/redesign/screens/overlays/OfflineOverlay";
import { hosts, note, plain } from "../stubs/record";
import { mount, take } from "./root";

/**
 * Le voile hors ligne (`OfflineOverlay`) : le double appui de « Déjumeler
 * cet appareil » — armer, désarmer en partant, exécuter — et ses clés.
 */

type Pill = { onPress?: () => void; onFocusChange?: (focused: boolean) => void };

export function runOffline(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const scenario = (name: string, initialArmed: boolean, gestures: string[]) => {
    const bench = mount();
    bench.render(<OfflineOverlay serverUrl="http://serveur" initialArmed={initialArmed} onRetry={() => note({ retry: true })} onUnpair={() => note({ unpair: true })} />);
    const trace: unknown[] = [];
    const snap = () => ({
      unpair: plain((hosts.get("confirm:offline:unpair") ?? {}) as Record<string, unknown>),
      retry: plain((hosts.get("pill:offline:retry") ?? {}) as Record<string, unknown>),
    });
    trace.push({ step: "ouvert", ...snap(), events: take() });
    for (const gesture of gestures) {
      const pill = hosts.get("confirm:offline:unpair") as Pill | undefined;
      bench.run(() => {
        if (gesture === "ok") pill?.onPress?.();
        if (gesture === "part") pill?.onFocusChange?.(false);
        if (gesture === "revient") pill?.onFocusChange?.(true);
      });
      trace.push({ step: gesture, ...snap(), events: take() });
    }
    bench.unmount();
    out[name] = trace;
  };
  scenario("arme puis exécute", false, ["revient", "ok", "ok"]);
  scenario("arme, part, revient : désarmé", false, ["revient", "ok", "part", "revient", "ok"]);
  scenario("armé à l'ouverture (banc)", true, ["ok"]);
  scenario("trois OK", false, ["ok", "ok", "ok"]);
  return out;
}
