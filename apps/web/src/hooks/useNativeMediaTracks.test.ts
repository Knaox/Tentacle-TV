import { describe, expect, it } from "vitest";
import type { AudioTrack } from "../components/player/videoPlayer.types";
import { matchTracks, rankOf } from "./trackMatching";
import {
  enableAudioTrack,
  listNativeTracks,
  trackNotFound,
  type NativeTrackList,
} from "./useNativeMediaTracks";

/**
 * Ce que ces cas protègent : sur un téléviseur, la piste audio se choisit par
 * cette bascule et par elle seule — le flux est lu directement, aucune URL
 * n'est reconstruite. Se tromper de rang, ou renoncer une fois pour toutes
 * parce que la liste n'était pas encore peuplée, c'est un film en anglais
 * pendant que l'interface affiche « Français ».
 */

const track = (index: number, lang?: string, codec?: string): AudioTrack =>
  ({ index, label: `piste ${index}`, lang, codec });

function nativeList(count: number, actives: number[] = [0]): NativeTrackList {
  const list = { length: count } as NativeTrackList;
  for (let i = 0; i < count; i++) list[i] = { enabled: actives.includes(i) };
  return list;
}

/** Le rang tel que le hook le calcule, pour tester les deux bouts ensemble. */
function wantedRank(
  natives: NativeTrackList,
  tracks: AudioTrack[],
  wanted: number,
  publishable?: (p: AudioTrack) => boolean,
): number | null {
  return rankOf(matchTracks(listNativeTracks(natives), tracks, publishable), tracks, wanted);
}

describe("activerPisteAudio", () => {
  it("n'active que le rang demandé, quel que soit l'état de départ", () => {
    const natives = nativeList(3, [0, 1, 2]);
    expect(enableAudioTrack(natives, 1)).toBe(true);
    expect([natives[0].enabled, natives[1].enabled, natives[2].enabled]).toEqual([false, true, false]);
  });

  it("n'écrit RIEN quand la piste voulue est déjà la seule active", () => {
    // Le cas le plus fréquent, et celui qui rendait le téléviseur muet :
    // réaffirmer `enabled` sur la piste courante pendant l'initialisation de la
    // chaîne audio la fait taire. Un accesseur qui compte les écritures le dit.
    let ecritures = 0;
    const natives = nativeList(2);
    for (let i = 0; i < 2; i++) {
      const value = i === 0;
      Object.defineProperty(natives, i, {
        get: () => ({ get enabled() { return value; }, set enabled(_v: boolean) { ecritures += 1; } }),
      });
    }
    expect(enableAudioTrack(natives, 0)).toBe(false);
    expect(ecritures).toBe(0);
  });

  it("refuse un rang hors de la liste plutôt que de déborder", () => {
    const natives = nativeList(2);
    expect(enableAudioTrack(natives, 5)).toBe(false);
    expect(enableAudioTrack(natives, -1)).toBe(false);
    expect(natives[0].enabled).toBe(true);
  });
});

describe("listerNatives", () => {
  it("copie la collection vivante en données inertes", () => {
    const natives = { length: 2 } as NativeTrackList;
    natives[0] = { enabled: true, id: "1", language: "fr", label: "VFF" };
    natives[1] = { enabled: false, id: "2", language: "en" };
    expect(listNativeTracks(natives)).toEqual([
      { id: "1", language: "fr", label: "VFF" },
      { id: "2", language: "en", label: undefined },
    ]);
  });
});

/**
 * Le verdict, et le défaut qu'il referme.
 *
 * L'ancien critère était la LONGUEUR de la liste : moins de deux entrées valait
 * « pas encore peuplée ». Sur le MKV de référence — DTS-HD MA 5.1 français,
 * TrueHD 7.1 Atmos anglais, mesuré sur une C3 en webOS 25 — le démultiplexeur
 * n'en publie qu'une, définitivement. Le critère était donc vrai pour toujours,
 * et demander l'anglais ne déclenchait RIEN : ni bascule, ni session serveur.
 * C'est ce cas-là que le premier test ci-dessous inverse.
 */
describe("pisteIntrouvable", () => {
  it("conclut sur une liste d'UNE seule entrée quand les métadonnées sont là", () => {
    const natives = nativeList(1);
    natives[0] = { enabled: true, id: "1", language: "fr" };
    const tracks = [track(1, "fra", "dts"), track(2, "eng", "truehd")];
    expect(wantedRank(natives, tracks, 2)).toBeNull();
    expect(trackNotFound(true, wantedRank(natives, tracks, 2))).toBe(true);
  });

  it("trouve bien la piste qui, elle, est publiée", () => {
    const natives = nativeList(1);
    natives[0] = { enabled: true, id: "1", language: "fr" };
    const tracks = [track(1, "fra", "dts"), track(2, "eng", "truehd")];
    expect(wantedRank(natives, tracks, 1)).toBe(0);
    expect(trackNotFound(true, wantedRank(natives, tracks, 1))).toBe(false);
  });

  it("ne conclut rien tant que les métadonnées ne sont pas là", () => {
    // Quelle que soit la longueur : c'est `readyState` qui décide, et lui seul.
    expect(trackNotFound(false, null)).toBe(false);
  });

  it("reconnaît un index que le serveur n'annonce même pas", () => {
    const natives = nativeList(2, [0]);
    const tracks = [track(1), track(2)];
    expect(trackNotFound(true, wantedRank(natives, tracks, 99))).toBe(true);
  });

  it("se tait quand la piste est bien là", () => {
    const natives = nativeList(2, [0]);
    const tracks = [track(1), track(2)];
    expect(trackNotFound(true, wantedRank(natives, tracks, 2))).toBe(false);
  });
});
