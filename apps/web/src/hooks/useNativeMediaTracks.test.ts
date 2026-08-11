import { describe, expect, it } from "vitest";
import type { AudioTrack } from "../components/player/videoPlayer.types";
import { activerPisteAudio, type ListePistesNatives } from "./useNativeMediaTracks";

/**
 * Ce que ces cas protègent : sur un téléviseur, la piste audio se choisit par
 * cette bascule et par elle seule — le flux est lu directement, aucune URL
 * n'est reconstruite. Se tromper de rang, ou renoncer une fois pour toutes
 * parce que la liste n'était pas encore peuplée, c'est un film en anglais
 * pendant que l'interface affiche « Français ».
 */

const piste = (index: number): AudioTrack => ({ index, label: `piste ${index}` }) as AudioTrack;

function listeNative(nombre: number, actives: number[] = [0]): ListePistesNatives {
  const liste = { length: nombre } as ListePistesNatives;
  for (let i = 0; i < nombre; i++) liste[i] = { enabled: actives.includes(i) };
  return liste;
}

describe("activerPisteAudio", () => {
  it("traduit l'index Jellyfin en RANG dans la liste native", () => {
    // Jellyfin numérote tous les flux (vidéo comprise) : la piste d'index 2 est
    // la première AUDIO, donc le rang 0 côté élément.
    const natives = listeNative(2);
    expect(activerPisteAudio(natives, [piste(2), piste(3)], 3)).toBe(true);
    expect(natives[0].enabled).toBe(false);
    expect(natives[1].enabled).toBe(true);
  });

  it("n'active qu'une piste, quel que soit l'état de départ", () => {
    const natives = listeNative(3, [0, 1, 2]);
    activerPisteAudio(natives, [piste(1), piste(2), piste(3)], 2);
    expect([natives[0].enabled, natives[1].enabled, natives[2].enabled]).toEqual([false, true, false]);
  });

  it("ne touche à RIEN tant que la liste n'est pas peuplée", () => {
    // Le cas du défaut : l'effet tourne au montage, avant loadedmetadata.
    // Renoncer serait juste ; renoncer DÉFINITIVEMENT était le bug.
    const natives = listeNative(0);
    expect(activerPisteAudio(natives, [piste(1), piste(2)], 2)).toBe(false);
  });

  it("ne touche à rien sur une piste unique — il n'y a rien à choisir", () => {
    const natives = listeNative(1);
    expect(activerPisteAudio(natives, [piste(1)], 1)).toBe(false);
    expect(natives[0].enabled).toBe(true);
  });

  it("laisse la piste en place quand l'index demandé n'existe pas", () => {
    const natives = listeNative(2);
    expect(activerPisteAudio(natives, [piste(1), piste(2)], 99)).toBe(false);
    expect(natives[0].enabled).toBe(true);
  });

  it("laisse la piste en place quand le démultiplexeur en a omis", () => {
    // Trois pistes annoncées par Jellyfin, deux lues par le moteur : le rang
    // demandé sort de la liste, mieux vaut la piste du conteneur qu'un
    // débordement silencieux.
    const natives = listeNative(2);
    expect(activerPisteAudio(natives, [piste(1), piste(2), piste(3)], 3)).toBe(false);
    expect(natives[0].enabled).toBe(true);
  });
});
