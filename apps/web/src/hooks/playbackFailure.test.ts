/**
 * L'invariant tenu ici : la bascule de secours reste le défaut — « média »
 * n'est rendu QUE sur une preuve formelle (lecture locale + fichier absent à
 * la sonde). Un code d'erreur mpv, si parlant soit-il, ne suffit jamais.
 */

import { describe, expect, it } from "vitest";
import { MPV_END_FILE_REASON, MPV_ERROR } from "../lib/mpvTypes";
import { classifyEndFileFailure } from "./playbackFailure";

describe("classifyEndFileFailure", () => {
  it("fichier local disparu : erreur de média", () => {
    const verdict = classifyEndFileFailure({
      errorCode: MPV_ERROR.LOADING_FAILED,
      isLocalPlayback: true,
      localFilePresent: false,
    });
    expect(verdict.kind).toBe("media");
  });

  it("fichier local présent mais illisible : lecteur (bascule)", () => {
    const verdict = classifyEndFileFailure({
      errorCode: MPV_ERROR.LOADING_FAILED,
      isLocalPlayback: true,
      localFilePresent: true,
    });
    expect(verdict.kind).toBe("player");
  });

  it("échec réseau, même LOADING_FAILED : lecteur — le −13 est ambigu", () => {
    const verdict = classifyEndFileFailure({
      errorCode: MPV_ERROR.LOADING_FAILED,
      isLocalPlayback: false,
      localFilePresent: null,
    });
    expect(verdict.kind).toBe("player");
  });

  it("décodeur absent sur un fichier local présent : lecteur (repli à chaud §4.2)", () => {
    const verdict = classifyEndFileFailure({
      errorCode: MPV_ERROR.NOTHING_TO_PLAY,
      isLocalPlayback: true,
      localFilePresent: true,
    });
    expect(verdict.kind).toBe("player");
  });

  it("sonde muette en lecture locale : jamais « média » sans preuve", () => {
    const verdict = classifyEndFileFailure({
      errorCode: undefined,
      isLocalPlayback: true,
      localFilePresent: null,
    });
    expect(verdict.kind).toBe("player");
    expect(verdict.detail).toContain("?");
  });

  it("le détail lecteur porte le code, pour le journal et le dernier recours", () => {
    const verdict = classifyEndFileFailure({
      errorCode: MPV_ERROR.UNKNOWN_FORMAT,
      isLocalPlayback: false,
      localFilePresent: null,
    });
    expect(verdict.detail).toContain("-17");
  });

  // Tripwire : les valeurs viennent de client.h (mpv v0.41), relevées — pas
  // devinées. Aucun test du dépôt ne peut lire client.h ; on fige donc les
  // littéraux ici pour qu'une retouche accidentelle se voie.
  it("les constantes mpv restent celles de client.h", () => {
    expect(MPV_END_FILE_REASON).toEqual({ EOF: 0, STOP: 2, QUIT: 3, ERROR: 4, REDIRECT: 5 });
    expect(MPV_ERROR).toEqual({ LOADING_FAILED: -13, NOTHING_TO_PLAY: -16, UNKNOWN_FORMAT: -17 });
  });
});
