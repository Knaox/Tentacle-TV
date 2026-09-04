/**
 * L'arbitre d'overlay — dont les six cas OBLIGATOIRES de la refonte,
 * nommés tels quels. Le repli chapitres lui-même est couvert par
 * resolveSegments.test.ts ; ici on vérifie qu'un Outro `source: "chapters"`
 * est traité comme n'importe quel autre.
 */

import { describe, expect, it } from "vitest";
import type { ResolvedSegment, SegmentType } from "./segmentTypes";
import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings } from "./playbackSettings";
import { arbitrateOverlay, findSkipCandidate, type ArbiterInput } from "./overlayArbiter";

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

/**
 * ⚠️ `outro` s'applique aux DEUX réglages de générique de fin — celui des
 * épisodes et celui des films. Les cas de ce fichier ont été écrits quand il
 * n'y en avait qu'un, et ils décrivent des règles qui ne dépendent pas du type
 * de média : les scinder ici les rendrait faux sans rien vérifier de plus.
 * `outroFilm` permet de ne viser QUE le film, pour les cas qui l'exigent.
 */
const makeSettings = (patch?: {
  intro?: Partial<PlaybackSettings["intro"]>;
  outro?: Partial<PlaybackSettings["outro"]>;
  outroFilm?: Partial<PlaybackSettings["outro"]>;
  recap?: Partial<PlaybackSettings["recap"]>;
  next?: Partial<PlaybackSettings["next"]>;
}): PlaybackSettings => ({
  intro: { ...DEFAULT_PLAYBACK_SETTINGS.intro, ...patch?.intro },
  outro: { ...DEFAULT_PLAYBACK_SETTINGS.outro, ...patch?.outro },
  outroFilm: { ...DEFAULT_PLAYBACK_SETTINGS.outro, ...patch?.outro, ...patch?.outroFilm },
  recap: { ...DEFAULT_PLAYBACK_SETTINGS.recap, ...patch?.recap },
  preview: { ...DEFAULT_PLAYBACK_SETTINGS.preview },
  next: { ...DEFAULT_PLAYBACK_SETTINGS.next, ...patch?.next },
});

const makeInput = (patch?: Partial<ArbiterInput>): ArbiterInput => ({
  positionMs: 0,
  runtimeMs: RUNTIME_MS,
  hasStarted: true,
  playbackEnded: false,
  segments: [],
  isEpisode: true,
  hasNextEpisode: true,
  settings: makeSettings(),
  dismissed: { segments: {}, nextCard: false, finalCard: false },
  countdowns: { skip: null, next: null },
  ...patch,
});

/** Générique collé à la fin du média. */
const OUTRO_AT_END = seg("Outro", 1_300_000, RUNTIME_MS, { endsAtMediaEnd: true, hasContentAfter: false });
/** Générique suivi d'une scène post-générique. */
const OUTRO_SCENE = seg("Outro", 1_200_000, 1_320_000, { endsAtMediaEnd: false, hasContentAfter: true });

describe("les six cas obligatoires", () => {
  it("1. Outro finissant à la fin du média → la carte, action épisode suivant — aucun bouton", () => {
    const overlay = arbitrateOverlay(makeInput({ segments: [OUTRO_AT_END], positionMs: 1_310_000 }));
    expect(overlay).toEqual({ kind: "nextCard", countdownSeconds: null, final: false });
  });

  it("2. Outro finissant avant la fin → seek à la fin du générique, la scène n'est jamais sautée", () => {
    const overlay = arbitrateOverlay(makeInput({ segments: [OUTRO_SCENE], positionMs: 1_250_000 }));
    expect(overlay).toMatchObject({
      kind: "skip",
      segmentType: "Outro",
      labelKey: "skipToPostCredits",
      action: { kind: "seek", toMs: 1_320_000 },
    });
  });

  it("3. Outro venu des chapitres → traité comme un segment ordinaire", () => {
    const chapter = seg("Outro", 1_300_000, RUNTIME_MS, {
      source: "chapters",
      endsAtMediaEnd: true,
      hasContentAfter: false,
    });
    const overlay = arbitrateOverlay(makeInput({ segments: [chapter], positionMs: 1_310_000 }));
    expect(overlay.kind).toBe("nextCard");
  });

  it("4. Ni segment ni chapitre → aucun bouton, carte au repli temporel seulement", () => {
    const before = arbitrateOverlay(makeInput({ segments: [], positionMs: 1_300_000 }));
    expect(before).toEqual({ kind: "none" });

    // Le seuil global livré est 98 % de la durée — 28,8 s avant la fin ici.
    const near = arbitrateOverlay(makeInput({ segments: [], positionMs: RUNTIME_MS - 20_000 }));
    expect(near).toEqual({ kind: "nextCard", countdownSeconds: null, final: false });
  });

  it("5. Décompte désactivé mais fiche activée → la fiche s'affiche quand même, sans échéance", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_AT_END],
        positionMs: 1_310_000,
        settings: makeSettings({ next: { nextCountdown: false } }),
        countdowns: { skip: null, next: 10 },
      }),
    );
    expect(overlay).toEqual({ kind: "nextCard", countdownSeconds: null, final: false });
  });

  it("6. Film au générique sans scène derrière → RIEN — l'écran de fin arrive tout seul", () => {
    // « Terminer la lecture » n'apportait rien qu'attendre ne donne pas, et en
    // Watch Together il fermait la lecture d'un membre au milieu de la séance.
    const during = arbitrateOverlay(
      makeInput({ segments: [OUTRO_AT_END], positionMs: 1_310_000, isEpisode: false, hasNextEpisode: false }),
    );
    expect(during).toEqual({ kind: "none" });

    const ended = arbitrateOverlay(
      makeInput({ playbackEnded: true, isEpisode: false, hasNextEpisode: false }),
    );
    expect(ended).toEqual({ kind: "none" });
  });

  it("6bis. DERNIER ÉPISODE au générique sans suite → le bouton dit encore « Terminer »", () => {
    const during = arbitrateOverlay(
      makeInput({ segments: [OUTRO_AT_END], positionMs: 1_310_000, hasNextEpisode: false }),
    );
    expect(during).toMatchObject({
      kind: "skip",
      labelKey: "endPlayback",
      action: { kind: "endOfPlayback" },
    });
  });
});

describe("priorités et gardes", () => {
  const INTRO = seg("Intro", 30_000, 120_000);

  it("le bouton de saut bat la carte quand les deux sont éligibles", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [INTRO],
        positionMs: 60_000,
        settings: makeSettings({
          next: { nextTrigger: "beforeEnd", beforeEndDefault: { mode: "seconds", value: 300 } },
        }),
        runtimeMs: 100_000 + 200_000,
      }),
    );
    expect(overlay.kind).toBe("skip");
  });

  it("l'intro en auto affiche le décompte du réducteur, pas en mode bouton", () => {
    const auto = arbitrateOverlay(
      makeInput({ segments: [INTRO], positionMs: 60_000, countdowns: { skip: 3, next: null } }),
    );
    expect(auto).toMatchObject({ kind: "skip", labelKey: "skipIntro", countdownSeconds: 3 });

    const button = arbitrateOverlay(
      makeInput({
        segments: [INTRO],
        positionMs: 60_000,
        settings: makeSettings({ intro: { action: "button" } }),
        countdowns: { skip: 3, next: null },
      }),
    );
    expect(button).toMatchObject({ countdownSeconds: null });

    const withoutCountdown = arbitrateOverlay(
      makeInput({
        segments: [INTRO],
        positionMs: 60_000,
        settings: makeSettings({ intro: { countdownVisible: false } }),
        countdowns: { skip: 3, next: null },
      }),
    );
    expect(withoutCountdown).toMatchObject({ countdownSeconds: null });
  });

  it("un segment désactivé ou refusé ne montre rien — et le refus du générique rend la main à la PILULE", () => {
    const off = arbitrateOverlay(
      makeInput({ segments: [INTRO], positionMs: 60_000, settings: makeSettings({ intro: { action: "off" } }) }),
    );
    expect(off).toEqual({ kind: "none" });

    // Le candidat existe toujours (le refus d'affichage ne le supprime pas),
    // donc ni carte ni minuteur ne s'engouffrent dans la fenêtre — seule la
    // pilule, qui n'arme rien, reste atteignable. L'état « refusé sans
    // sourdine » est d'ailleurs inatteignable depuis la coquille
    // (`dismissOverlay` met toujours en sourdine) : ce cas ne documente que
    // l'arbitre pris isolément.
    const dismissedOutro = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_SCENE],
        positionMs: 1_250_000,
        dismissed: { segments: { Outro: true }, nextCard: false, finalCard: false },
      }),
    );
    expect(dismissedOutro).toEqual({ kind: "nextButton", dismissible: true });
  });

  it("le récap est PROPOSÉ par défaut, et se tait une fois éteint", () => {
    const RECAP = seg("Recap", 0, 30_000);
    const byDefault = arbitrateOverlay(makeInput({ segments: [RECAP], positionMs: 10_000 }));
    expect(byDefault).toMatchObject({
      kind: "skip",
      labelKey: "skipRecap",
      action: { kind: "seek", toMs: 30_000 },
    });

    const off = arbitrateOverlay(
      makeInput({ segments: [RECAP], positionMs: 10_000, settings: makeSettings({ recap: { action: "off" } }) }),
    );
    expect(off).toEqual({ kind: "none" });
  });

  it("Commercial est résolu mais sans réglage : aucun overlay", () => {
    const overlay = arbitrateOverlay(
      makeInput({ segments: [seg("Commercial", 600_000, 630_000)], positionMs: 610_000 }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });

  it("générique désactivé : la carte occupe le générique dès son début", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_SCENE],
        positionMs: 1_250_000,
        settings: makeSettings({ outro: { action: "off" } }),
      }),
    );
    expect(overlay.kind).toBe("nextCard");
  });

  it("la carte ne se pose jamais par-dessus la scène post-générique", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_SCENE],
        positionMs: 1_400_000,
        settings: makeSettings({ outro: { action: "off" } }),
      }),
    );
    // La pilule, elle, a le droit d'y être : elle ne couvre pas l'image et ne
    // décompte rien. C'est la CARTE qu'on ne veut pas voir ici.
    expect(overlay).toEqual({ kind: "nextButton", dismissible: true });
  });

  it("fiche refusée : plus de carte pendant le générique — mais l'écran de fin reste dû", () => {
    const during = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_AT_END],
        positionMs: 1_310_000,
        dismissed: { segments: {}, nextCard: true, finalCard: false },
      }),
    );
    expect(during).toEqual({ kind: "none" });

    // Écarter la carte disait « dégage de mon image », pas « renonce à la
    // suite » : à l'EOF, l'affiche garde son tour.
    const endScreen = arbitrateOverlay(
      makeInput({ playbackEnded: true, dismissed: { segments: {}, nextCard: true, finalCard: false } }),
    );
    expect(endScreen).toMatchObject({ kind: "nextCard", final: true });
  });

  it("l'affiche de fin refusée : plus rien à l'EOF — la sortie appartient au lecteur", () => {
    const endScreen = arbitrateOverlay(
      makeInput({ playbackEnded: true, dismissed: { segments: {}, nextCard: false, finalCard: true } }),
    );
    expect(endScreen).toEqual({ kind: "none" });

    // Et le refus de l'affiche ne touche pas la carte du générique.
    const during = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_AT_END],
        positionMs: 1_310_000,
        dismissed: { segments: {}, nextCard: false, finalCard: true },
      }),
    );
    expect(during).toMatchObject({ kind: "nextCard", final: false });
  });

  it("le réglage « affiche de fin » éteint la supprime — celui de la fiche reste intact", () => {
    const endScreen = arbitrateOverlay(
      makeInput({
        playbackEnded: true,
        settings: makeSettings({ next: { nextFinalCard: false } }),
      }),
    );
    expect(endScreen).toEqual({ kind: "none" });

    const during = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_AT_END],
        positionMs: 1_310_000,
        settings: makeSettings({ next: { nextFinalCard: false } }),
      }),
    );
    expect(during).toMatchObject({ kind: "nextCard", final: false });
  });

  it("l'écran de fin ignore le réglage de la fiche — autre surface, autre moment", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        playbackEnded: true,
        settings: makeSettings({ outro: { action: "off" }, next: { nextCard: false } }),
        countdowns: { skip: null, next: 10 },
      }),
    );
    expect(overlay).toEqual({ kind: "nextCard", countdownSeconds: 10, final: true });
  });

  it("rien ne s'affiche avant la première image", () => {
    const overlay = arbitrateOverlay(
      makeInput({ segments: [seg("Intro", 0, 90_000)], positionMs: 0, hasStarted: false }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });
});

describe("quitter la lecture n'est jamais automatique", () => {
  it("réglage « auto » sur le générique : un film n'affiche plus RIEN du tout", () => {
    // Plus fort qu'avant : le candidat n'existe même plus — « Terminer la
    // lecture » a disparu des films (demandé le 30.08), l'écran de fin arrive
    // tout seul.
    const candidate = findSkipCandidate({
      segments: [OUTRO_AT_END],
      positionMs: 1_310_000,
      hasStarted: true,
      isEpisode: false,
      hasNextEpisode: false,
      settings: makeSettings({ outro: { action: "auto", countdownVisible: true, autoDelayMs: 3_000 } }),
    });
    expect(candidate).toBeNull();
  });

  it("réglage « auto » sur le générique : le DERNIER ÉPISODE ne se ferme pas tout seul", () => {
    const candidate = findSkipCandidate({
      segments: [OUTRO_AT_END],
      positionMs: 1_310_000,
      hasStarted: true,
      isEpisode: true,
      hasNextEpisode: false,
      settings: makeSettings({ outro: { action: "auto", countdownVisible: true, autoDelayMs: 3_000 } }),
    });
    expect(candidate?.action).toEqual({ kind: "endOfPlayback" });
    // Le réglage dit « auto » ; l'arbitre impose le bouton. Un décompte qui
    // quitte la lecture au bout de trois secondes de générique ne se rattrape pas.
    expect(candidate?.settings.action).toBe("button");
  });

  it("une scène post-générique, elle, reste un vrai saut — et peut être automatique", () => {
    const withScene = { ...OUTRO_AT_END, endMs: 1_350_000, endsAtMediaEnd: false, hasContentAfter: true };
    const candidate = findSkipCandidate({
      segments: [withScene],
      positionMs: 1_310_000,
      hasStarted: true,
      isEpisode: false,
      hasNextEpisode: false,
      settings: makeSettings({ outro: { action: "auto", countdownVisible: true, autoDelayMs: 3_000 } }),
    });
    expect(candidate?.labelKey).toBe("skipToPostCredits");
    expect(candidate?.action).toEqual({ kind: "seek", toMs: 1_350_000 });
    expect(candidate?.settings.action).toBe("auto");
  });
});

describe("la pilule « épisode suivant » — le trou de la scène post-générique", () => {
  const OUTRO_WITH_SCENE: ResolvedSegment = {
    type: "Outro",
    startMs: 1_200_000,
    endMs: 1_380_000,
    source: "jellyfin",
    endsAtMediaEnd: false,
    hasContentAfter: true,
  };

  it("pendant la scène : la pilule est là, habillage ou non, tant qu'on l'accepte", () => {
    const base = { segments: [OUTRO_WITH_SCENE], positionMs: 1_390_000 };
    expect(arbitrateOverlay(makeInput(base))).toEqual({ kind: "nextButton", dismissible: true });
    expect(arbitrateOverlay(makeInput({ ...base, controlsVisible: true }))).toEqual({
      kind: "nextButton",
      dismissible: true,
    });
  });

  it("pendant le générique, le BOUTON DE SAUT bat tout le reste", () => {
    const overlay = arbitrateOverlay(
      makeInput({ segments: [OUTRO_WITH_SCENE], positionMs: 1_250_000, controlsVisible: true }),
    );
    expect(overlay).toMatchObject({ kind: "skip", labelKey: "skipToPostCredits" });
  });

  it("sans bouton de saut, c'est la FICHE qui parle — la pilule ne double pas", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_WITH_SCENE],
        positionMs: 1_250_000,
        controlsVisible: true,
        settings: makeSettings({ outro: { action: "off" } }),
      }),
    );
    expect(overlay.kind).toBe("nextCard");
  });

  it("fiche éteinte ou refusée : la pilule prend le relais", () => {
    const eteinte = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_WITH_SCENE],
        positionMs: 1_250_000,
        controlsVisible: true,
        settings: makeSettings({ outro: { action: "off" }, next: { nextCard: false } }),
      }),
    );
    expect(eteinte).toEqual({ kind: "nextButton", dismissible: true });

    const refusee = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_WITH_SCENE],
        positionMs: 1_250_000,
        controlsVisible: true,
        settings: makeSettings({ outro: { action: "off" } }),
        dismissed: { segments: {}, nextCard: true, finalCard: false },
      }),
    );
    // Refusée, elle n'existe plus que dans l'habillage — et sans croix.
    expect(refusee).toEqual({ kind: "nextButton", dismissible: false });
  });

  it("avant le générique, rien — un bouton « suivant » en plein épisode n'a aucun sens", () => {
    expect(
      arbitrateOverlay(
        makeInput({ segments: [OUTRO_WITH_SCENE], positionMs: 600_000, controlsVisible: true }),
      ),
    ).toEqual({ kind: "none" });
  });

  it("sans épisode suivant, jamais de pilule", () => {
    expect(
      arbitrateOverlay(
        makeInput({
          segments: [OUTRO_WITH_SCENE],
          positionMs: 1_390_000,
          controlsVisible: true,
          hasNextEpisode: false,
          isEpisode: false,
        }),
      ),
    ).toEqual({ kind: "none" });
  });
});

describe("la scène post-générique n'est jamais couverte", () => {
  it("le bouton SAUTÉ ne passe pas la main à la fiche dans sa dernière seconde", () => {
    // Le bouton cède sa fenêtre une seconde avant la fin du segment ; sans
    // garde symétrique, la fiche s'y posait — juste avant la scène. Ici le
    // passage est SAUTÉ, pas refusé (aucune sourdine) : la pilule a donc le
    // droit d'être là, la carte non.
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_SCENE],
        positionMs: 1_319_500,
        dismissed: { segments: { Outro: true }, nextCard: false, finalCard: false },
      }),
    );
    expect(overlay).toEqual({ kind: "nextButton", dismissible: true });
  });

  it("la scène revendiquée fait taire la FICHE, jamais l'accès à la suite", () => {
    const claimed = { segments: [OUTRO_SCENE], postCreditsClaimed: true };
    // C'est la carte qui couvrirait la scène ; la pilule, elle, reste offerte —
    // c'est même tout son objet.
    expect(arbitrateOverlay(makeInput({ ...claimed, positionMs: 1_330_000 }))).toEqual({
      kind: "nextButton",
      dismissible: true,
    });
    expect(
      arbitrateOverlay(makeInput({ ...claimed, positionMs: 1_330_000, controlsVisible: true })),
    ).toEqual({ kind: "nextButton", dismissible: true });
  });

  it("la revendication n'atteint pas l'écran de fin — il n'y a plus rien à regarder", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [OUTRO_SCENE],
        positionMs: RUNTIME_MS,
        playbackEnded: true,
        postCreditsClaimed: true,
      }),
    );
    expect(overlay).toMatchObject({ kind: "nextCard", final: true });
  });

  it("un SECOND générique bat la revendication : la scène est passée", () => {
    const segments = [OUTRO_SCENE, seg("Outro", 1_400_000, RUNTIME_MS, { endsAtMediaEnd: true, hasContentAfter: false })];
    const overlay = arbitrateOverlay(
      makeInput({ segments, positionMs: 1_405_000, postCreditsClaimed: false }),
    );
    expect(overlay).toMatchObject({ kind: "nextCard", final: false });
  });
});

describe("la croix — quand elle existe, et quand elle n'a plus d'office", () => {
  it("passage neuf : la croix est là, habillage affiché OU non", () => {
    const base = { segments: [seg("Intro", 30_000, 90_000)], positionMs: 40_000 };
    expect(arbitrateOverlay(makeInput(base))).toMatchObject({ kind: "skip", dismissible: true });
    expect(arbitrateOverlay(makeInput({ ...base, controlsVisible: true })))
      .toMatchObject({ kind: "skip", dismissible: true });
  });

  it("passage EN SOURDINE : le bouton n'existe plus que dans l'habillage, sans croix", () => {
    const muted = new Set<SegmentType>(["Intro"]);
    const base = {
      segments: [seg("Intro", 30_000, 90_000)],
      positionMs: 40_000,
      mutedSegments: muted,
    };
    // Image nue : rien. C'est tout l'objet de la sourdine.
    expect(arbitrateOverlay(makeInput({ ...base, dismissed: { segments: { Intro: true }, nextCard: false, finalCard: false } })))
      .toEqual({ kind: "none" });
    // Habillage affiché : le bouton revient, mais sa croix n'a plus rien à faire.
    expect(arbitrateOverlay(makeInput({ ...base, controlsVisible: true })))
      .toMatchObject({ kind: "skip", segmentType: "Intro", dismissible: false });
  });
});

describe("refuser un saut ne doit JAMAIS emporter vers l'épisode suivant", () => {
  const muted = new Set<SegmentType>(["Outro"]);
  const inOutro = { segments: [OUTRO_SCENE], positionMs: 1_250_000, mutedSegments: muted };

  it("LE DÉFAUT VÉCU — croiser la pilule du générique ne fait plus paraître la carte", () => {
    // Image nue : la sourdine masque le bouton, et RIEN ne prend sa place.
    expect(
      arbitrateOverlay(makeInput({ ...inOutro, dismissed: { segments: { Outro: true }, nextCard: false, finalCard: false } })),
    ).toEqual({ kind: "none" });
  });

  it("le bouton revient dans l'habillage, sans croix — et toujours pas de carte", () => {
    expect(arbitrateOverlay(makeInput({ ...inOutro, controlsVisible: true })))
      .toMatchObject({ kind: "skip", segmentType: "Outro", dismissible: false });
  });

  it("mais l'écran de FIN reste dû : le média est terminé, il n'y a plus rien à regarder", () => {
    expect(
      arbitrateOverlay(makeInput({ ...inOutro, positionMs: RUNTIME_MS, playbackEnded: true })),
    ).toMatchObject({ kind: "nextCard", final: true });
  });
});

describe("la pilule « épisode suivant » suit la règle commune", () => {
  // Après un saut vers la scène post-générique : la carte s'est retirée, la
  // pilule prend le relais. C'est ce moment-là que l'utilisateur a signalé.
  const afterSkip = {
    segments: [OUTRO_SCENE],
    positionMs: 1_340_000,
    postCreditsClaimed: true,
  };

  it("non refusée, elle se montre sur l'image NUE, avec sa croix", () => {
    expect(arbitrateOverlay(makeInput(afterSkip)))
      .toEqual({ kind: "nextButton", dismissible: true });
  });

  it("non refusée, elle est là aussi dans l'habillage", () => {
    expect(arbitrateOverlay(makeInput({ ...afterSkip, controlsVisible: true })))
      .toEqual({ kind: "nextButton", dismissible: true });
  });

  it("REFUSÉE, elle quitte l'image nue", () => {
    expect(
      arbitrateOverlay(makeInput({ ...afterSkip, dismissed: { segments: {}, nextCard: true, finalCard: false } })),
    ).toEqual({ kind: "none" });
  });

  it("refusée, elle reste atteignable dans l'habillage — et sans croix", () => {
    expect(
      arbitrateOverlay(makeInput({
        ...afterSkip, controlsVisible: true, dismissed: { segments: {}, nextCard: true, finalCard: false },
      })),
    ).toEqual({ kind: "nextButton", dismissible: false });
  });
});

describe("le générique de fin d'un FILM a son propre réglage", () => {
  /** Générique principal, la scène derrière, puis le générique FINAL. */
  const MAIN = seg("Outro", 1_200_000, 1_320_000, { endsAtMediaEnd: false, hasContentAfter: true });
  const FINAL = seg("Outro", 1_360_000, RUNTIME_MS, { endsAtMediaEnd: true, hasContentAfter: false });
  const film = { isEpisode: false, hasNextEpisode: false };

  it("un film lit `outroFilm`, pas `outro`", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        ...film,
        segments: [MAIN],
        positionMs: 1_250_000,
        settings: makeSettings({ outro: { action: "off" }, outroFilm: { action: "button" } }),
      }),
    );
    expect(overlay).toMatchObject({ kind: "skip", labelKey: "skipToPostCredits" });
  });

  it("un épisode lit `outro`, pas `outroFilm`", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        segments: [MAIN],
        positionMs: 1_250_000,
        settings: makeSettings({ outro: { action: "off" }, outroFilm: { action: "button" } }),
      }),
    );
    // Aucun bouton : le réglage de l'épisode dit « ne rien faire ». C'est la
    // fiche « à suivre » qui occupe le générique, comme il se doit.
    expect(overlay.kind).not.toBe("skip");
  });

  it("le générique PRINCIPAL d'un film n'affiche plus rien — même en automatique", () => {
    // Fermer un film pendant son générique — sa musique, un plan qu'aucun
    // détecteur n'a vu — ne se rattrape pas ; et le bouton lui-même n'apportait
    // rien qu'attendre ne donne pas. Plus aucune trace de « Terminer » sur un
    // film (demandé le 30.08).
    const overlay = arbitrateOverlay(
      makeInput({
        ...film,
        segments: [OUTRO_AT_END],
        positionMs: 1_310_000,
        settings: makeSettings({ outroFilm: { action: "auto" } }),
        countdowns: { skip: 4, next: null },
      }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });

  it("le générique FINAL d'après la scène se tait pareil", () => {
    const overlay = arbitrateOverlay(
      makeInput({
        ...film,
        segments: [MAIN, FINAL],
        positionMs: 1_370_000,
        settings: makeSettings({ outroFilm: { action: "auto" } }),
        countdowns: { skip: 4, next: null },
      }),
    );
    expect(overlay).toEqual({ kind: "none" });
  });
});
