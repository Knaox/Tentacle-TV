import { describe, expect, it } from "vitest";
import type { AudioBridgeSource } from "./audioBridgeContract";
import { entryOptions } from "./audioEngineOps";
import { chainFor } from "./audioEngineOutput";
import { LEVEL_FILTER } from "./audioLevel";
import { formatFileOptions } from "./audioOptions";
import type { QueueEntry } from "./audioQueue";
import { cutSteps, deckChain, fadeInExpr, fadeOutExpr, gainCommand, lavfiEscape, type FadedSource } from "./crossfadeFilter";
import { armDecision, deckTimeline } from "./crossfadeTiming";
import { freshFlags, NO_PROPS } from "./audioEngineState";

const source = (extra: Partial<FadedSource> = {}): FadedSource => ({
  url: "http://s/a.flac", origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, replayGain: null, expiresAt: null, ...extra,
});
const entry = (src: AudioBridgeSource): QueueEntry => ({
  mpvId: 1, kind: "start", track: { trackKey: "a", albumKey: "A", durationMs: 200_000, format: null }, source: src, startS: null, neighbours: [], fromKey: null, edlFromS: null,
});

describe("transition douce — le filtre de mpv", () => {
  it("le gain du fondu, puis la mesure du niveau ; les virgules de l'expression échappées pour lavfi", () => {
    expect(deckChain()).toBe(`@xf:lavfi=[asetnsamples=n=256:p=0,volume=volume=1:eval=frame],${LEVEL_FILTER}`);
    expect(deckChain(fadeInExpr(6))).toBe(
      `@xf:lavfi=[asetnsamples=n=256:p=0,volume=volume=if(lt(t\\,6.000000)\\,sin(PI/2*max(t\\,0)/6.000000)\\,1):eval=frame],${LEVEL_FILTER}`,
    );
  });

  it("courbe de sortie à l'instant voulu ; commande sans `@`, cible `volume` (refusée sinon, mesuré)", () => {
    expect(fadeOutExpr(34, 6)).toBe("if(lt(t,34.000000),1,if(lt(t,34.000000+6.000000),cos(PI/2*(t-34.000000)/6.000000),0))");
    expect(gainCommand("1")).toEqual(["af-command", "xf", "volume", "1", "volume"]);
  });

  it("la chaîne suit le mode exclusif : rien, la mesure seule, ou la mesure et le gain", () => {
    expect(chainFor(true, "1")).toBe("");
    expect(chainFor(false, null)).toBe(LEVEL_FILTER);
    expect(chainFor(false, "1")).toBe(deckChain("1"));
  });

  it("la courbe d'entrée part dans les options du FICHIER, protégée par %longueur%", () => {
    expect(entryOptions(entry(source()), "off")).not.toHaveProperty("af");
    const options = entryOptions(entry(source({ fadeInS: 6 })), "off");
    expect(options["af"]).toBe(deckChain(fadeInExpr(6)));
    expect(formatFileOptions(options)).toMatch(/(^|,)af=%\d+%@xf:lavfi=\[/);
  });

  it("la sortie courte d'un geste : 15 pas en demi-cosinus, jusqu'au silence", () => {
    const steps = cutSteps(150);
    expect(steps).toHaveLength(15);
    expect(steps[0]).toBeCloseTo(0.989, 3);
    expect(steps.at(-1)).toBeCloseTo(0, 12);
    for (let i = 1; i < steps.length; i += 1) expect(steps[i]).toBeLessThan(steps[i - 1] as number);
  });
});

describe("transition douce — quand fondre", () => {
  const tl = (positionS: number, extra = {}) => ({ positionS, offsetS: 0, durationS: 200, complete: true, playing: true, loaded: true, ended: false, ...extra });

  it("arme deux secondes avant le départ du fondu, moins la mise en route du suivant", () => {
    expect(armDecision(tl(190), 6)).toEqual({ kind: "wait" });
    expect(armDecision(tl(192.5), 6)).toEqual({ kind: "arm", startS: 194, delayMs: 1470 });
    expect(armDecision(tl(193.8), 6)).toEqual({ kind: "late" });
  });

  it("attend un fichier complet, une lecture en cours, une durée connue", () => {
    expect(armDecision(tl(193, { complete: false }), 6).kind).toBe("wait");
    expect(armDecision(tl(193, { playing: false }), 6).kind).toBe("wait");
    expect(armDecision(tl(193, { durationS: null }), 6).kind).toBe("wait");
  });

  it("vise la chronologie de l'ENTRÉE mpv (une bascule EDL qui commence à 60 s)", () => {
    expect(armDecision(tl(192.5, { offsetS: 60 }), 6)).toMatchObject({ kind: "arm", startS: 134 });
  });

  it("la durée mesurée par mpv l'emporte sur l'annoncée (fichier complet, hors EDL)", () => {
    const current = entry(source());
    expect(deckTimeline(current, { ...NO_PROPS, timePos: 10, mpvDuration: 199.37 }, freshFlags(false), 10).durationS).toBe(199.37);
    expect(deckTimeline(current, { ...NO_PROPS, timePos: 10 }, freshFlags(false), 10)).toMatchObject({ durationS: 200, playing: true, loaded: true });
    expect(deckTimeline(current, { ...NO_PROPS }, freshFlags(true), 0)).toMatchObject({ playing: false, loaded: false });
  });
});

describe("échappement d'une expression dans la chaîne lavfi", () => {
  it("la barre oblique inverse d'abord, puis la virgule ; une expression des fondus est inchangée hors virgules", () => {
    expect(lavfiEscape("if(lt(t,1),0,1)")).toBe("if(lt(t\\,1)\\,0\\,1)");
    expect(lavfiEscape("a\\,b")).toBe("a\\\\\\,b");
    expect(deckChain(fadeInExpr(2))).toContain(`volume=volume=${lavfiEscape(fadeInExpr(2))}:eval=frame`);
  });
});
