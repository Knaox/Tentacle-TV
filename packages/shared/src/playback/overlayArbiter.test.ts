/**
 * L'arbitre d'overlay — dont les six cas OBLIGATOIRES de la refonte,
 * nommés tels quels. Le repli chapitres lui-même est couvert par
 * resolveSegments.test.ts ; ici on vérifie qu'un Outro `source: "chapters"`
 * est traité comme n'importe quel autre.
 */

import { describe, expect, it } from "vitest";
import type { ResolvedSegment, SegmentType } from "./segmentTypes";
import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings } from "./playbackSettings";
import { arbitrateOverlay, type ArbiterInput } from "./overlayArbiter";

const RUNTIME_MS = 1_440_000;

const seg = (
  type: SegmentType,
  startMs: number,
  endMs: number,
  extra?: Partial<ResolvedSegment>,
): ResolvedSegment => ({
  type,
  startMs,
  endMs,
  source: "jellyfin",
  endsAtMediaEnd: extra?.endsAtMediaEnd ?? false,
  hasContentAfter: extra?.hasContentAfter ?? !(extra?.endsAtMediaEnd ?? false),
  ...extra,
});

const reglages = (patch?: {
  intro?: Partial<PlaybackSettings["intro"]>;
  outro?: Partial<PlaybackSettings["outro"]>;
  recap?: Partial<PlaybackSettings["recap"]>;
  next?: Partial<PlaybackSettings["next"]>;
}): PlaybackSettings => ({
  intro: { ...DEFAULT_PLAYBACK_SETTINGS.intro, ...patch?.intro },
  outro: { ...DEFAULT_PLAYBACK_SETTINGS.outro, ...patch?.outro },
  recap: { ...DEFAULT_PLAYBACK_SETTINGS.recap, ...patch?.recap },
  preview: { ...DEFAULT_PLAYBACK_SETTINGS.preview },
  next: { ...DEFAULT_PLAYBACK_SETTINGS.next, ...patch?.next },
});

const entree = (patch?: Partial<ArbiterInput>): ArbiterInput => ({
  positionMs: 0,
  runtimeMs: RUNTIME_MS,
  hasStarted: true,
  playbackEnded: false,
  segments: [],
  isEpisode: true,
  hasNextEpisode: true,
  settings: reglages(),
  serverAutoplayEnabled: true,
  dismissed: { segments: {}, nextCard: false },
  countdowns: { skip: null, next: null },
  ...patch,
});

/** Générique collé à la fin du média. */
const OUTRO_FIN = seg("Outro", 1_300_000, RUNTIME_MS, { endsAtMediaEnd: true, hasContentAfter: false });
/** Générique suivi d'une scène post-générique. */
const OUTRO_SCENE = seg("Outro", 1_200_000, 1_320_000, { endsAtMediaEnd: false, hasContentAfter: true });

describe("les six cas obligatoires", () => {
  it("1. Outro finissant à la fin du média → la carte, action épisode suivant — aucun bouton", () => {
    const overlay = arbitrateOverlay(entree({ segments: [OUTRO_FIN], positionMs: 1_310_000 }));
    expect(overlay).toEqual({ kind: "nextCard", countdownSeconds: null, final: false });
  });

  it("2. Outro finissant avant la fin → seek à la fin du générique, la scène n'est jamais sautée", () => {
    const overlay = arbitrateOverlay(entree({ segments: [OUTRO_SCENE], positionMs: 1_250_000 }));
    expect(overlay).toMatchObject({
      kind: "skip",
      segmentType: "Outro",
      labelKey: "skipToPostCredits",
      action: { kind: "seek", toMs: 1_320_000 },
    });
  });

  it("3. Outro venu des chapitres → traité comme un segment ordinaire", () => {
    const chapitre = seg("Outro", 1_300_000, RUNTIME_MS, {
      source: "chapters",
      endsAtMediaEnd: true,
      hasContentAfter: false,
    });
    const overlay = arbitrateOverlay(entree({ segments: [chapitre], positionMs: 1_310_000 }));
    expect(overlay.kind).toBe("nextCard");
  });

  it("4. Ni segment ni chapitre → aucun bouton, carte au repli temporel seulement", () => {
    const avant = arbitrateOverlay(entree({ segments: [], positionMs: 1_300_000 }));
    expect(avant).toEqual({ kind: "none" });

    const proche = arbitrateOverlay(entree({ segments: [], positionMs: RUNTIME_MS - 40_000 }));
    expect(proche).toEqual({ kind: "nextCard", countdownSeconds: null, final: false });
  });

  it("5. Décompte désactivé mais fiche activée → la fiche s'affiche quand même, sans échéance", () => {
    const overlay = arbitrateOverlay(
      entree({
        segments: [OUTRO_FIN],
        positionMs: 1_310_000,
        settings: reglages({ next: { nextCountdown: false } }),
        countdowns: { skip: null, next: 10 },
      }),
    );
    expect(overlay).toEqual({ kind: "nextCard", countdownSeconds: null, final: false });
  });

  it("6. Film sans épisode suivant → « passer le générique » termine la lecture", () => {
    const pendant = arbitrateOverlay(
      entree({ segments: [OUTRO_FIN], positionMs: 1_310_000, isEpisode: false, hasNextEpisode: false }),
    );
    expect(pendant).toMatchObject({
      kind: "skip",
      labelKey: "skipCredits",
      action: { kind: "endOfPlayback" },
    });

    const fini = arbitrateOverlay(
      entree({ playbackEnded: true, isEpisode: false, hasNextEpisode: false }),
    );
    expect(fini).toEqual({ kind: "none" });
  });
});

describe("priorités et gardes", () => {
  const INTRO = seg("Intro", 30_000, 120_000);

  it("le bouton de saut bat la carte quand les deux sont éligibles", () => {
    const overlay = arbitrateOverlay(
      entree({
        segments: [INTRO],
        positionMs: 60_000,
        settings: reglages({ next: { nextTrigger: "beforeEnd", nextBeforeEndSeconds: 300 } }),
        runtimeMs: 100_000 + 200_000,
      }),
    );
    expect(overlay.kind).toBe("skip");
  });

  it("l'intro en auto affiche le décompte du réducteur, pas en mode bouton", () => {
    const auto = arbitrateOverlay(
      entree({ segments: [INTRO], positionMs: 60_000, countdowns: { skip: 3, next: null } }),
    );
    expect(auto).toMatchObject({ kind: "skip", labelKey: "skipIntro", countdownSeconds: 3 });

    const bouton = arbitrateOverlay(
      entree({
        segments: [INTRO],
        positionMs: 60_000,
        settings: reglages({ intro: { action: "button" } }),
        countdowns: { skip: 3, next: null },
      }),
    );
    expect(bouton).toMatchObject({ countdownSeconds: null });

    const sansDecompte = arbitrateOverlay(
      entree({
        segments: [INTRO],
        positionMs: 60_000,
        settings: reglages({ intro: { countdownVisible: false } }),
        countdowns: { skip: 3, next: null },
      }),
    );
    expect(sansDecompte).toMatchObject({ countdownSeconds: null });
  });

  it("un segment désactivé ou refusé ne montre rien — et le refus du générique rend la main à la carte", () => {
    const eteint = arbitrateOverlay(
      entree({ segments: [INTRO], positionMs: 60_000, settings: reglages({ intro: { action: "off" } }) }),
    );
    expect(eteint).toEqual({ kind: "none" });

    const refuse = arbitrateOverlay(
      entree({
        segments: [OUTRO_SCENE],
        positionMs: 1_250_000,
        dismissed: { segments: { Outro: true }, nextCard: false },
      }),
    );
    expect(refuse.kind).toBe("nextCard");
  });

  it("le récap ne fait rien par défaut, et devient un bouton une fois activé", () => {
    const RECAP = seg("Recap", 0, 30_000);
    const defaut = arbitrateOverlay(entree({ segments: [RECAP], positionMs: 10_000 }));
    expect(defaut).toEqual({ kind: "none" });

    const active = arbitrateOverlay(
      entree({ segments: [RECAP], positionMs: 10_000, settings: reglages({ recap: { action: "button" } }) }),
    );
    expect(active).toMatchObject({ kind: "skip", labelKey: "skipRecap", action: { kind: "seek", toMs: 30_000 } });
  });

  it("Commercial est résolu mais sans réglage : aucun overlay", () => {
    const overlay = arbitrateOverlay(
      entree({ segments: [seg("Commercial", 600_000, 630_000)], positionMs: 610_000 }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });

  it("générique désactivé : la carte occupe le générique dès son début", () => {
    const overlay = arbitrateOverlay(
      entree({
        segments: [OUTRO_SCENE],
        positionMs: 1_250_000,
        settings: reglages({ outro: { action: "off" } }),
      }),
    );
    expect(overlay.kind).toBe("nextCard");
  });

  it("la carte ne se pose jamais par-dessus la scène post-générique", () => {
    const overlay = arbitrateOverlay(
      entree({
        segments: [OUTRO_SCENE],
        positionMs: 1_400_000,
        settings: reglages({ outro: { action: "off" } }),
      }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });

  it("la garde serveur coupe la carte, jamais les boutons de saut", () => {
    const carte = arbitrateOverlay(
      entree({ segments: [OUTRO_FIN], positionMs: 1_310_000, serverAutoplayEnabled: false }),
    );
    expect(carte).toEqual({ kind: "none" });

    const bouton = arbitrateOverlay(
      entree({ segments: [INTRO], positionMs: 60_000, serverAutoplayEnabled: false }),
    );
    expect(bouton.kind).toBe("skip");
  });

  it("fiche refusée : ni carte pendant le générique, ni écran de fin", () => {
    const pendant = arbitrateOverlay(
      entree({
        segments: [OUTRO_FIN],
        positionMs: 1_310_000,
        dismissed: { segments: {}, nextCard: true },
      }),
    );
    expect(pendant).toEqual({ kind: "none" });

    const fin = arbitrateOverlay(
      entree({ playbackEnded: true, dismissed: { segments: {}, nextCard: true } }),
    );
    expect(fin).toEqual({ kind: "none" });
  });

  it("l'écran de fin ignore le réglage de la fiche — autre surface, autre moment", () => {
    const overlay = arbitrateOverlay(
      entree({
        playbackEnded: true,
        settings: reglages({ next: { nextCard: false } }),
        countdowns: { skip: null, next: 10 },
      }),
    );
    expect(overlay).toEqual({ kind: "nextCard", countdownSeconds: 10, final: true });
  });

  it("rien ne s'affiche avant la première image", () => {
    const overlay = arbitrateOverlay(
      entree({ segments: [seg("Intro", 0, 90_000)], positionMs: 0, hasStarted: false }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });
});
