/**
 * La reprise se voit tout de suite quand elle est fausse — un episode vu qui
 * rouvre a trois secondes de la fin, generique en cours.
 */

import { describe, expect, it } from "vitest";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { resumeStartSeconds } from "./watchSessionMedia";

const MINUTE = 60 * TICKS_PER_SECOND;

describe("resumeStartSeconds", () => {
  it("part du debut quand rien n'a ete regarde", () => {
    expect(resumeStartSeconds(undefined, null)).toBeUndefined();
    expect(resumeStartSeconds(0, null)).toBeUndefined();
  });

  it("reprend a la position du serveur", () => {
    expect(resumeStartSeconds(10 * MINUTE, null)).toBe(600);
  });

  // Une lecture faite hors ligne, pas encore resynchronisee, est plus recente
  // que ce que le serveur connait.
  it("retient la position la plus avancee", () => {
    const local = { positionTicks: 20 * MINUTE, played: false };
    expect(resumeStartSeconds(10 * MINUTE, local)).toBe(1200);
    expect(resumeStartSeconds(30 * MINUTE, local)).toBe(1800);
  });

  // Jellyfin remet la position a zero quand il marque une video vue : un
  // episode vu mais non supprime doit se relancer depuis le debut.
  it("repart de zero pour un fichier local deja vu", () => {
    expect(resumeStartSeconds(undefined, { positionTicks: 40 * MINUTE, played: true }))
      .toBeUndefined();
  });

  it("repart de zero meme si le serveur porte encore une position", () => {
    expect(resumeStartSeconds(35 * MINUTE, { positionTicks: 40 * MINUTE, played: true }))
      .toBeUndefined();
  });
});
