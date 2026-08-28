import { describe, expect, it, vi } from "vitest";
import type { StockageAppareil } from "../player/reglagesAppareil";
import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings } from "./playbackSettings";
import {
  CLE_CACHE_REGLAGES,
  creerMagasinReglagesLecture,
  seedFromLegacyDeviceKeys,
} from "./playbackSettingsStore";

function fauxStockage(initial: Record<string, string> = {}): StockageAppareil & {
  donnees: Map<string, string>;
} {
  const donnees = new Map(Object.entries(initial));
  return {
    donnees,
    getItem: (cle) => donnees.get(cle) ?? null,
    setItem: (cle, valeur) => void donnees.set(cle, valeur),
  };
}

const REGLAGES_SERVEUR: PlaybackSettings = {
  ...DEFAULT_PLAYBACK_SETTINGS,
  intro: { action: "button", countdownVisible: true, autoDelayMs: 5_000 },
};

describe("seedFromLegacyDeviceKeys", () => {
  it("clés vierges : les défauts, tels quels", () => {
    expect(seedFromLegacyDeviceKeys(() => null)).toEqual(DEFAULT_PLAYBACK_SETTINGS);
  });

  it("les refus historiques sont convertis — et l'ancienne clé du décompte coupe l'acte aussi", () => {
    const semis = seedFromLegacyDeviceKeys((cle) =>
      cle === "tentacle_auto_skip_intro" || cle === "tentacle_up_next_countdown" ? "false" : null,
    );
    expect(semis.intro.action).toBe("button");
    expect(semis.next).toMatchObject({ nextCountdown: false, nextAutoPlay: false, nextCard: true });
  });
});

describe("creerMagasinReglagesLecture", () => {
  it("répond HORS LIGNE depuis le cache local, sans exiger le serveur", async () => {
    const stockage = fauxStockage({
      [CLE_CACHE_REGLAGES]: JSON.stringify(REGLAGES_SERVEUR),
    });
    const magasin = creerMagasinReglagesLecture({
      stockage,
      lireDistant: async () => {
        throw new Error("hors ligne");
      },
      ecrireDistant: async () => {},
    });
    expect(magasin.lireInstantane().intro.autoDelayMs).toBe(5_000);
    await magasin.resynchroniser(); // ne jette pas, ne change rien
    expect(magasin.lireInstantane().intro.autoDelayMs).toBe(5_000);
  });

  it("resynchroniser aligne sur le serveur et prévient les abonnés", async () => {
    const stockage = fauxStockage();
    const magasin = creerMagasinReglagesLecture({
      stockage,
      lireDistant: async () => ({ stored: true, settings: REGLAGES_SERVEUR }),
      ecrireDistant: async () => {},
    });
    const rappel = vi.fn();
    magasin.sAbonner(rappel);
    await magasin.resynchroniser();
    expect(magasin.lireInstantane()).toEqual(REGLAGES_SERVEUR);
    expect(rappel).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stockage.donnees.get(CLE_CACHE_REGLAGES) ?? "")).toEqual(REGLAGES_SERVEUR);
  });

  it("définir fusionne en profondeur, écrit le cache et pousse au serveur", async () => {
    const ecrits: PlaybackSettings[] = [];
    const stockage = fauxStockage();
    const magasin = creerMagasinReglagesLecture({
      stockage,
      lireDistant: async () => ({ stored: true, settings: DEFAULT_PLAYBACK_SETTINGS }),
      ecrireDistant: async (r) => void ecrits.push(r),
    });
    magasin.definir({ next: { nextAutoPlay: false } });
    await Promise.resolve();
    expect(magasin.lireInstantane().next).toMatchObject({ nextAutoPlay: false, nextCard: true });
    expect(magasin.lireInstantane().intro).toEqual(DEFAULT_PLAYBACK_SETTINGS.intro);
    expect(ecrits).toHaveLength(1);
  });

  it("PUT en échec : la valeur locale reste, et se re-pousse au resync suivant", async () => {
    let panne = true;
    const ecrits: PlaybackSettings[] = [];
    const magasin = creerMagasinReglagesLecture({
      stockage: fauxStockage(),
      lireDistant: async () => ({ stored: true, settings: REGLAGES_SERVEUR }),
      ecrireDistant: async (r) => {
        if (panne) throw new Error("500");
        ecrits.push(r);
      },
    });
    magasin.definir({ outro: { action: "auto" } });
    await Promise.resolve();
    expect(magasin.lireInstantane().outro.action).toBe("auto");

    panne = false;
    await magasin.resynchroniser(); // re-pousse au lieu de se faire écraser
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0].outro.action).toBe("auto");
    expect(magasin.lireInstantane().outro.action).toBe("auto");
  });

  it("semis : un refus hérité est converti et poussé quand le serveur ne connaît rien", async () => {
    const ecrits: PlaybackSettings[] = [];
    const stockage = fauxStockage({ tentacle_up_next_card: "false" });
    const magasin = creerMagasinReglagesLecture({
      stockage,
      lireDistant: async () => ({ stored: false, settings: DEFAULT_PLAYBACK_SETTINGS }),
      ecrireDistant: async (r) => void ecrits.push(r),
    });
    await magasin.resynchroniser();
    expect(magasin.lireInstantane().next.nextCard).toBe(false);
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0].next.nextCard).toBe(false);
  });

  it("semis : des clés vierges ne poussent RIEN — un autre appareil garde le droit de semer", async () => {
    const ecrits: PlaybackSettings[] = [];
    const magasin = creerMagasinReglagesLecture({
      stockage: fauxStockage(),
      lireDistant: async () => ({ stored: false, settings: DEFAULT_PLAYBACK_SETTINGS }),
      ecrireDistant: async (r) => void ecrits.push(r),
    });
    await magasin.resynchroniser();
    expect(magasin.lireInstantane()).toEqual(DEFAULT_PLAYBACK_SETTINGS);
    expect(ecrits).toHaveLength(0);
  });

  it("une réponse méconnaissable ne touche à rien", async () => {
    const stockage = fauxStockage({ [CLE_CACHE_REGLAGES]: JSON.stringify(REGLAGES_SERVEUR) });
    const magasin = creerMagasinReglagesLecture({
      stockage,
      lireDistant: async () => "<html>proxy</html>",
      ecrireDistant: async () => {},
    });
    await magasin.resynchroniser();
    expect(magasin.lireInstantane()).toEqual(REGLAGES_SERVEUR);
  });

  it("rehydrater relit un cache rempli après coup (hydrate() Android TV)", () => {
    const stockage = fauxStockage();
    const magasin = creerMagasinReglagesLecture({
      stockage,
      lireDistant: async () => ({ stored: true, settings: DEFAULT_PLAYBACK_SETTINGS }),
      ecrireDistant: async () => {},
    });
    expect(magasin.lireInstantane()).toEqual(DEFAULT_PLAYBACK_SETTINGS);
    stockage.donnees.set(CLE_CACHE_REGLAGES, JSON.stringify(REGLAGES_SERVEUR));
    magasin.rehydrater();
    expect(magasin.lireInstantane()).toEqual(REGLAGES_SERVEUR);
  });
});
