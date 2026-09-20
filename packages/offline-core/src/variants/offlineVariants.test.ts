/**
 * La décision des variantes est ce qui évite un fichier illisible sur
 * l'appareil. Depuis le lecteur avancé, l'appareil lit presque tout : ces cas
 * vérifient surtout que l'original est bien OFFERT — un MKV DTS sur iPhone,
 * un AVI DivX sur Android — et que les vrais murs (Dolby Vision 5 et 7, les
 * droits du compte) tiennent. Chaque cas est un fichier réel d'une
 * bibliothèque Jellyfin.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import type { DownloadCapabilities } from "../sync/capabilities";
import { offlineVariantsFor, REMUX_PRESET, type OfflineVariantKind } from "./offlineVariants";
import { ANDROID_LOCAL_SUPPORT, IOS_LOCAL_SUPPORT, IOS_NATIVE_SUPPORT } from "./platformSupport";

const FULL: DownloadCapabilities = {
  downloads: true,
  remuxDownloads: true,
  lightDownloads: true,
  audioConversion: true,
  lightPresets: ["p1080", "p720", "p480", REMUX_PRESET],
};

/** Le compte sans mode Allégé : il ne lui reste que l'original. */
const NO_CONVERSION: DownloadCapabilities = {
  downloads: true,
  remuxDownloads: true,
  lightDownloads: false,
  audioConversion: true,
  lightPresets: [REMUX_PRESET],
};

function stream(partial: Partial<MediaStream> & Pick<MediaStream, "Type" | "Codec" | "Index">): MediaStream {
  return { IsDefault: false, ...partial };
}

function item(
  container: string,
  video: Partial<MediaStream> & { Codec: string },
  audioCodecs: string[],
  size = 1_500_000_000,
): MediaItem {
  const streams: MediaStream[] = [
    stream({ Type: "Video", Index: 0, ...video }),
    ...audioCodecs.map((codec, i) => stream({ Type: "Audio", Codec: codec, Index: i + 1 })),
  ];
  return {
    Id: "film",
    Name: "Un film",
    Type: "Movie",
    MediaSources: [
      {
        Id: "ms1",
        Name: "ms1",
        Container: container,
        Size: size,
        SupportsDirectPlay: true,
        SupportsDirectStream: true,
        SupportsTranscoding: true,
        MediaStreams: streams,
      },
    ],
  };
}

const kinds = (plan: ReturnType<typeof offlineVariantsFor>): OfflineVariantKind[] =>
  plan.cards.map((c) => c.kind);
const excluded = (plan: ReturnType<typeof offlineVariantsFor>, kind: OfflineVariantKind) =>
  plan.excluded.find((e) => e.kind === kind)?.reason;

describe("offlineVariantsFor", () => {
  it("MP4 h264/aac sur iOS : l'original en tête, l'Allégé à côté, jamais de remux", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
    expect(plan.excluded).toEqual([]);
    expect(plan.cards[0]).toMatchObject({ reason: "playable", sizeBytes: 1_500_000_000, sizeIsEstimate: false });
  });

  it("MKV h264/aac sur iOS : l'original, le lecteur avancé lit le MKV", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
  });

  it("MKV hevc/dts sur iOS et Android : l'original, toutes les pistes lisibles", () => {
    for (const platform of [IOS_LOCAL_SUPPORT, ANDROID_LOCAL_SUPPORT]) {
      const plan = offlineVariantsFor(item("mkv", { Codec: "hevc" }, ["dts", "truehd"]), platform, FULL);
      expect(kinds(plan)).toEqual(["original", "light"]);
      expect(plan.cards[0]?.audio).toEqual({ playable: [1, 2], unplayable: [] });
    }
  });

  it("AVI mpeg4/mp3 (DivX) : l'original, sur les deux plateformes", () => {
    for (const platform of [IOS_LOCAL_SUPPORT, ANDROID_LOCAL_SUPPORT]) {
      expect(kinds(offlineVariantsFor(item("avi", { Codec: "mpeg4" }, ["mp3"]), platform, FULL))).toEqual(["original", "light"]);
    }
  });

  it("AV1 en MKV sur iOS : l'original (décodage logiciel du lecteur avancé)", () => {
    expect(kinds(offlineVariantsFor(item("mkv", { Codec: "av1" }, ["opus"]), IOS_LOCAL_SUPPORT, FULL))).toEqual(["original", "light"]);
  });

  it("MKV hevc 10 bits HDR10 eac3 sur iOS : l'original", () => {
    const hdr = item("mkv", { Codec: "hevc", BitDepth: 10, VideoRangeType: "HDR10" }, ["eac3"]);
    expect(kinds(offlineVariantsFor(hdr, IOS_LOCAL_SUPPORT, FULL))).toEqual(["original", "light"]);
  });

  it("Dolby Vision profil 5 : l'Allégé seul, sur les deux plateformes", () => {
    const dv5 = item("mp4", { Codec: "hevc", DvProfile: 5 }, ["eac3"]);
    for (const platform of [IOS_LOCAL_SUPPORT, ANDROID_LOCAL_SUPPORT]) {
      const plan = offlineVariantsFor(dv5, platform, FULL);
      expect(kinds(plan)).toEqual(["light"]);
      expect(excluded(plan, "original")).toBe("dolbyVision");
    }
  });

  it("Dolby Vision profil 8.1 (base HDR10) : compatible, l'original", () => {
    const dv81 = item("mkv", { Codec: "hevc", DvProfile: 8, VideoRangeType: "DOVIWithHDR10" }, ["eac3"]);
    expect(kinds(offlineVariantsFor(dv81, IOS_LOCAL_SUPPORT, FULL))).toEqual(["original", "light"]);
  });

  it("Dolby Vision profil 7 sur Android : l'Allégé seul", () => {
    const dv7 = item("mkv", { Codec: "hevc", DvProfile: 7 }, ["truehd"]);
    expect(kinds(offlineVariantsFor(dv7, ANDROID_LOCAL_SUPPORT, FULL))).toEqual(["light"]);
  });

  it("le Dolby Vision profil 5 sans mode Allégé : il ne reste rien", () => {
    const dv5 = item("mp4", { Codec: "hevc", DvProfile: 5 }, ["eac3"]);
    const plan = offlineVariantsFor(dv5, IOS_LOCAL_SUPPORT, NO_CONVERSION);
    expect(kinds(plan)).toEqual([]);
    expect(excluded(plan, "original")).toBe("dolbyVision");
    expect(excluded(plan, "light")).toBe("right");
  });

  it("sans mode Allégé : l'original seul", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "hevc" }, ["dts"]), IOS_LOCAL_SUPPORT, NO_CONVERSION);
    expect(kinds(plan)).toEqual(["original"]);
    expect(excluded(plan, "light")).toBe("right");
  });

  it("sans droit du tout : rien, pas même une raison", () => {
    const none: DownloadCapabilities = { ...NO_CONVERSION, downloads: false, remuxDownloads: false, lightPresets: [] };
    const plan = offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, none);
    expect(plan).toEqual({ cards: [], excluded: [] });
  });

  it("entrelacé : l'union désentrelace, l'original reste — le natif seul l'écartait", () => {
    const interlaced = item("mp4", { Codec: "h264", IsInterlaced: true }, ["aac"]);
    expect(kinds(offlineVariantsFor(interlaced, IOS_LOCAL_SUPPORT, FULL))).toEqual(["original", "light"]);
    const nativeOnly = offlineVariantsFor(interlaced, IOS_NATIVE_SUPPORT, FULL);
    expect(kinds(nativeOnly)).toEqual(["light"]);
    expect(excluded(nativeOnly, "original")).toBe("interlaced");
  });

  it("le natif seul : un MKV n'a pas d'original — la raison est le conteneur", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), IOS_NATIVE_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["light"]);
    expect(excluded(plan, "original")).toBe("container");
  });

  it("une piste audio inconnue parmi d'autres : l'original prévient, sans l'écarter", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "hevc" }, ["atrac3", "aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
    expect(plan.cards[0]?.audio).toEqual({ playable: [2], unplayable: [1] });
  });

  it("aucune piste audio lisible : l'original est écarté pour l'audio", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "hevc" }, ["atrac3"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["light"]);
    expect(excluded(plan, "original")).toBe("audioCodec");
  });

  it("un conteneur à plusieurs noms se lit par son premier jeton", () => {
    const plan = offlineVariantsFor(item("mov,mp4,m4a", { Codec: "h264" }, ["aac"]), IOS_NATIVE_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
  });

  it("un VideoRangeType numérique n'est jamais pris pour du Dolby Vision", () => {
    const weird = item("mkv", { Codec: "hevc", VideoRangeType: 3 as unknown as string }, ["aac"]);
    expect(kinds(offlineVariantsFor(weird, IOS_LOCAL_SUPPORT, FULL))).toEqual(["original", "light"]);
  });

  it("« h265 » vaut hevc", () => {
    expect(kinds(offlineVariantsFor(item("mp4", { Codec: "h265" }, ["aac"]), IOS_NATIVE_SUPPORT, FULL))).toEqual(["original", "light"]);
  });

  it("une taille inconnue : la carte originale la dit inconnue", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"], 0), IOS_LOCAL_SUPPORT, FULL);
    expect(plan.cards[0]?.sizeBytes).toBeNull();
  });
});
