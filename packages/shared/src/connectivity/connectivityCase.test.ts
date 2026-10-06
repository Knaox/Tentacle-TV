import { describe, expect, it } from "vitest";
import frErrors from "../i18n/locales/fr/errors";
import enErrors from "../i18n/locales/en/errors";
import frCommon from "../i18n/locales/fr/common";
import enCommon from "../i18n/locales/en/common";
import {
  CONNECTIVITY_NOTICE_MS, CONNECTIVITY_OFFLINE_MODE_KEY, connectivityCaseOf, connectivityCopy,
  connectivityNoticeOf, nextConnectivityEpisode, type ConnectivityCase,
} from "./connectivityCase";

const text = (table: Record<string, string>, key: string): string | undefined => table[key.replace(/^errors:/, "")];

describe("les trois cas d'un serveur injoignable", () => {
  it("chaque cause a SON cas : l'appareil, le serveur, Jellyfin", () => {
    expect(connectivityCaseOf("network")).toBe("device");
    expect(connectivityCaseOf("backend")).toBe("server");
    // Délai dépassé : l'appareil a du réseau, la connexion ne mène pas au serveur.
    expect(connectivityCaseOf("timeout")).toBe("server");
    expect(connectivityCaseOf("jellyfin")).toBe("jellyfin");
    expect(connectivityCaseOf(null)).toBeNull();
  });

  it("les mots de Damien, en français et en anglais, sans « téléchargement » ni « pas votre faute »", () => {
    const fr = frErrors as unknown as Record<string, string>;
    const en = enErrors as unknown as Record<string, string>;
    expect(text(fr, connectivityCopy("device").titleKey)).toBe("Vous êtes hors ligne");
    expect(text(fr, connectivityCopy("device").hintKey)).toBe("Vérifiez votre connexion Internet.");
    expect(text(fr, connectivityCopy("server").titleKey)).toBe("Le serveur Tentacle est hors ligne");
    expect(text(fr, connectivityCopy("jellyfin").hintKey)).toMatch(/^Le serveur Tentacle est connecté, mais Jellyfin n'est pas joignable/);
    const kinds: ConnectivityCase[] = ["device", "server", "jellyfin"];
    for (const table of [fr, en]) {
      const keys = [...kinds.flatMap((k) => [connectivityCopy(k).titleKey, connectivityCopy(k).hintKey]), CONNECTIVITY_OFFLINE_MODE_KEY];
      for (const key of keys) {
        const value = text(table, key);
        expect(typeof value, key).toBe("string");
        expect(value).not.toMatch(/t[ée]l[ée]charg|download|faute|fault/i);
      }
    }
    // L'ancien voile ne s'excuse plus non plus.
    for (const common of [frCommon, enCommon] as unknown as Record<string, string>[]) {
      expect(common.offlineMessage).not.toMatch(/faute|fault/i);
    }
  });
});

describe("le message temporaire d'un passage hors ligne", () => {
  it("rien en ligne, ni en hors ligne choisi, ni sans cause", () => {
    expect(connectivityNoticeOf({ offlineAuto: false, reason: "backend", episode: 1 }, null)).toBeNull();
    expect(connectivityNoticeOf({ offlineAuto: true, reason: null, episode: 1 }, null)).toBeNull();
  });

  it("paraît une fois par bascule, avec son compte à rebours", () => {
    const notice = connectivityNoticeOf({ offlineAuto: true, reason: "network", episode: 1 }, null)!;
    expect(notice.kind).toBe("device");
    expect(notice.durationMs).toBe(CONNECTIVITY_NOTICE_MS);
    // Dit : il ne reparaît pas tant que rien ne change.
    expect(connectivityNoticeOf({ offlineAuto: true, reason: "network", episode: 1 }, notice.occasion)).toBeNull();
  });

  it("reparaît quand la cause change, ou à la bascule suivante", () => {
    const first = connectivityNoticeOf({ offlineAuto: true, reason: "network", episode: 1 }, null)!;
    const sameEpisode = connectivityNoticeOf({ offlineAuto: true, reason: "backend", episode: 1 }, first.occasion);
    expect(sameEpisode?.kind).toBe("server");
    const next = connectivityNoticeOf({ offlineAuto: true, reason: "network", episode: 2 }, first.occasion);
    expect(next?.kind).toBe("device");
  });

  it("le compteur n'avance qu'à l'ENTRÉE en hors ligne automatique", () => {
    expect(nextConnectivityEpisode(0, false, true)).toBe(1);
    expect(nextConnectivityEpisode(1, true, true)).toBe(1);
    expect(nextConnectivityEpisode(1, true, false)).toBe(1);
    expect(nextConnectivityEpisode(1, false, false)).toBe(1);
  });
});
