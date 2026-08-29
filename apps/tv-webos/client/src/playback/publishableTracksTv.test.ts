import { describe, expect, it } from "vitest";
import type { AudioTrack } from "@/components/player/videoPlayer.types";
import { isPublishableTrack } from "./publishableTracksTv";

const track = (codec?: string): AudioTrack => ({ index: 1, label: "piste", codec });

describe("isPublishableTrack", () => {
  it("refuse ce qu'aucune génération ne démultiplexe", () => {
    for (const codec of ["truehd", "TrueHD", "mlp", "alac"]) {
      expect(isPublishableTrack(track(codec))).toBe(false);
    }
  });

  it("accepte le DTS — son sort dépend de l'année, pas d'une table absolue", () => {
    // Un modèle 2023 OLED le décode, un modèle 2025 non. Trancher ici
    // refuserait la lecture directe là où elle marche ; l'appariement, lui, voit
    // ce que le lecteur a réellement publié et n'a pas besoin de deviner.
    expect(isPublishableTrack(track("dts"))).toBe(true);
    expect(isPublishableTrack(track("dca"))).toBe(true);
  });

  it("accepte tout ce que la dalle ouvre partout", () => {
    for (const codec of ["aac", "ac3", "eac3", "mp3", "opus", "pcm_s16le", "flac"]) {
      expect(isPublishableTrack(track(codec))).toBe(true);
    }
  });

  it("accepte une piste dont le codec est inconnu", () => {
    // Le doute profite à la piste : au pire elle n'apparaîtra pas dans
    // `video.audioTracks`, et l'appariement rendra `null` — le même résultat,
    // obtenu par la mesure plutôt que par une supposition.
    expect(isPublishableTrack(track(undefined))).toBe(true);
    expect(isPublishableTrack(track(""))).toBe(true);
  });
});
