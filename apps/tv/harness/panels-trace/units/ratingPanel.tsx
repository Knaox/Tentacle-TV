import { RatingPanel } from "@bench/src/redesign/screens/sheet/RatingPanel";
import { hosts, plain } from "../stubs/record";
import { mount, take } from "./root";

/**
 * L'échelle de la note (`RatingPanel`, `RatingRuler`) : ce qu'elle écrit, ses
 * étoiles, ses crans (distance, retrait, désactivés) et où glisse la règle,
 * selon la note et le focus de ses crans.
 */

type Rating = { current: number | null; pending?: boolean };
type Cell = { onFocusChange?: (focused: boolean) => void; onPress?: () => void };

function cells(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, props] of hosts) if (name.startsWith("cell:")) out[name.slice(5)] = plain(props as Record<string, unknown>);
  return out;
}

export function runRatingPanel(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const scenario = (name: string, steps: Array<[string, (b: ReturnType<typeof mount>) => void]>) => {
    const bench = mount();
    const trace: unknown[] = [];
    for (const [label, fn] of steps) {
      fn(bench);
      trace.push({ step: label, stars: plain((hosts.get("stars") ?? {}) as Record<string, unknown>), cells: cells(), events: take() });
    }
    bench.unmount();
    out[name] = trace;
  };
  const view = (rating: Rating) => <RatingPanel rating={rating} width={1088} onRate={() => undefined} />;
  const aim = (b: ReturnType<typeof mount>, key: string, focused: boolean) =>
    b.run(() => (hosts.get(`cell:${key}`) as Cell | undefined)?.onFocusChange?.(focused));

  scenario("sans note", [
    ["en attente", (b) => b.render(view({ current: null, pending: true }))],
    ["sue : aucune", (b) => b.render(view({ current: null }))],
    ["vise 6", (b) => aim(b, "sheet:scale:6", true)],
    ["6 → 7", (b) => { aim(b, "sheet:scale:6", false); aim(b, "sheet:scale:7", true); }],
    ["flou tardif de 6", (b) => aim(b, "sheet:scale:6", false)],
    ["7 quitté", (b) => aim(b, "sheet:scale:7", false)],
  ]);
  scenario("note 7, retrait, puis retirée", [
    ["posée à 7", (b) => b.render(view({ current: 7 }))],
    ["vise le retrait", (b) => aim(b, "sheet:scale:remove", true)],
    ["note retirée", (b) => b.render(view({ current: null }))],
    ["vise 3", (b) => { aim(b, "sheet:scale:remove", false); aim(b, "sheet:scale:3", true); }],
    ["vise 7 (l'ancienne)", (b) => { aim(b, "sheet:scale:3", false); aim(b, "sheet:scale:7", true); }],
  ]);
  scenario("note posée pendant que l'on vise", [
    ["aucune", (b) => b.render(view({ current: null }))],
    ["vise 9", (b) => aim(b, "sheet:scale:9", true)],
    ["posée à 9", (b) => b.render(view({ current: 9 }))],
    ["vise 10", (b) => { aim(b, "sheet:scale:9", false); aim(b, "sheet:scale:10", true); }],
  ]);
  return out;
}
