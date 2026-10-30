import { describe, expect, it } from "vitest";
import { octaveAbsenceEstablished, octaveMirrorNote, octaveStayVerdict, octaveSwitchShown, type OctaveModeFacts } from "./octaveStay";

const settled = (available: boolean) => ({ available, settled: true });
const pending = { available: false, settled: false };
/** En ligne, configuration connue, rien d'autre. */
const online = (fresh: OctaveModeFacts["fresh"], extra: Partial<OctaveModeFacts> = {}): OctaveModeFacts => ({
  fresh, failed: false, configKnown: true, offline: false, mirrorAvailable: false, ...extra,
});
/** Démarrage à froid sans réseau : `/api/config` a échoué, capacités vides → « indisponible, réglé ». */
const coldOffline = (extra: Partial<OctaveModeFacts> = {}): OctaveModeFacts => ({
  fresh: settled(false), failed: false, configKnown: false, offline: true, mirrorAvailable: true, ...extra,
});

describe("octaveStayVerdict : rester dans Octave", () => {
  it("disponible : ouvert", () => {
    expect(octaveStayVerdict(online(settled(true)))).toBe("open");
  });

  it("une panne n'est jamais une absence : statut en erreur", () => {
    expect(octaveStayVerdict(online(settled(false), { failed: true }))).toBe("open");
  });

  it("en attente : ouvert si le miroir le dit, sinon on attend", () => {
    expect(octaveStayVerdict(online(pending, { configKnown: false, mirrorAvailable: true }))).toBe("open");
    expect(octaveStayVerdict(online(pending, { configKnown: false }))).toBe("wait");
  });

  it("une absence ÉTABLIE rend la main à Tentacle", () => {
    expect(octaveStayVerdict(online(settled(false), { mirrorAvailable: true }))).toBe("leave");
  });

  it("démarrage à froid HORS LIGNE dans Octave : on reste (cas de Damien, 30/10)", () => {
    expect(octaveStayVerdict(coldOffline())).toBe("open");
    expect(octaveStayVerdict(coldOffline({ mirrorAvailable: false }))).toBe("open");
  });

  it("« Votre musique sur cet appareil » depuis le hors ligne de Tentacle : Octave s'ouvre", () => {
    expect(octaveStayVerdict(coldOffline({ configKnown: true, fresh: settled(false) }))).toBe("open");
  });

  it("configuration finie SANS réponse, appareil cru en ligne (avant la sonde) : une panne", () => {
    expect(octaveStayVerdict(online(settled(false), { configKnown: false }))).toBe("open");
  });
});

describe("octaveAbsenceEstablished", () => {
  it("seul un serveur qui a répondu, appareil en ligne, établit l'absence", () => {
    expect(octaveAbsenceEstablished(online(settled(false)))).toBe(true);
    expect(octaveAbsenceEstablished(online(settled(false), { offline: true }))).toBe(false);
    expect(octaveAbsenceEstablished(online(settled(false), { configKnown: false }))).toBe(false);
    expect(octaveAbsenceEstablished(online(pending))).toBe(false);
  });
});

describe("octaveMirrorNote : le miroir du lancement", () => {
  it("retient une réponse établie", () => {
    expect(octaveMirrorNote(online(settled(true)))).toBe(true);
    expect(octaveMirrorNote(online(settled(false)))).toBe(false);
  });

  it("une panne n'y entre JAMAIS (sinon le prochain lancement ouvrait Tentacle)", () => {
    expect(octaveMirrorNote(coldOffline())).toBeNull();
    expect(octaveMirrorNote(online(settled(false), { configKnown: false }))).toBeNull();
    expect(octaveMirrorNote(online(settled(false), { failed: true }))).toBeNull();
    expect(octaveMirrorNote(online(pending))).toBeNull();
  });
});

describe("octaveSwitchShown : la bascule vers Octave côté Tentacle", () => {
  it("en ligne : la réponse du serveur", () => {
    expect(octaveSwitchShown(online(settled(true)))).toBe(true);
    expect(octaveSwitchShown(online(settled(false), { mirrorAvailable: true }))).toBe(false);
  });

  it("hors ligne : le miroir (Tentacle hors ligne → Octave hors ligne)", () => {
    expect(octaveSwitchShown(coldOffline())).toBe(true);
    expect(octaveSwitchShown(coldOffline({ mirrorAvailable: false }))).toBe(false);
  });
});
