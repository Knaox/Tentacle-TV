// Android TV refondu : ce que l'Apple TV n'a pas — les touches d'Avance et de
// Retour rapides —, vérifié par assertions (aucune trace de référence : le
// geste n'existe pas sur la Siri Remote). Le reste se compare aux traces de
// l'Apple TV (`trace.test.ts`, mode `androidtv`).
import { describe, expect, it } from "vitest";
import { run, type Step } from "./driver";
import type { Entry } from "./rig";

const W = (ms: number): Step => ({ wait: ms });
const K = (key: string, a: number): Step => ({ key, a });
const HIDE = W(5600);

/** Une touche tenue `ms` : l'enfoncement, les répétitions d'Android (500 ms, puis toutes les 50 ms), le relâchement. */
function held(key: string, ms: number): Step[] {
  const steps: Step[] = [K(key, 0), W(500)];
  for (let t = 500; t < ms; t += 50) steps.push(K(key, 0), W(50));
  steps.push(K(key, 1));
  return steps;
}

type State = { scrub?: boolean; speed?: string | null; target?: number | null };
const states = (entries: Entry[]) => entries.filter((e) => e.ev === "state").map((e) => ({ t: e.t, ...(e.v as State) }));
const firstAt = (entries: Entry[], pick: (s: State) => boolean) => states(entries).find(pick)?.t ?? null;

const mode = process.env.TRACE_PLATFORM === "androidtv";

describe.runIf(mode)("Android TV refondu — Avance et Retour rapides", () => {
  it("⏩ tenu 2,5 s : défilement dès l'enfoncement, accélération, arrêt AU RELÂCHEMENT, reprise à la cible", async () => {
    const entries = await run({ id: "atv-media-held", title: "", steps: [HIDE, ...held("fastForward", 2500), W(7000)] });
    const pressedAt = 5650;
    expect(firstAt(entries, (s) => s.scrub === true)).toBe(pressedAt);
    expect(states(entries).some((s) => typeof s.speed === "string" && s.speed.startsWith(">>"))).toBe(true);
    // Lâchée à 5650 + 2500 : la vitesse s'efface à cet instant, pas après le silence des répétitions (700 ms).
    const releasedAt = pressedAt + 2500;
    const speedCleared = states(entries).filter((s) => s.t >= pressedAt && s.speed === null).map((s) => s.t);
    expect(speedCleared).toContain(releasedAt);
    const seek = entries.find((e) => e.ev === "seek" && e.t > releasedAt);
    expect(seek && (seek.v as number) > 0).toBe(true);
  });

  it("⏪ isolé : ouvre le défilement d'un pas en arrière, sans accélérer", async () => {
    const entries = await run({ id: "atv-media-tap", title: "", steps: [HIDE, K("rewind", 0), W(80), K("rewind", 1), W(1000)] });
    expect(firstAt(entries, (s) => s.scrub === true)).toBe(5650);
    expect(states(entries).some((s) => typeof s.speed === "string")).toBe(false);
  });
});
