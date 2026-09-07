/**
 * La décision des variantes est ce qui évite un fichier illisible sur
 * l'appareil : un MKV « Original » sur iPhone, un DTS sur Android. Chaque cas
 * ci-dessous est un fichier réel d'une bibliothèque Jellyfin.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import type { DownloadCapabilities } from "../sync/capabilities";
import { offlineVariantsFor, REMUX_PRESET, type OfflineVariantKind } from "./offlineVariants";
import { ANDROID_LOCAL_SUPPORT, IOS_LOCAL_SUPPORT } from "./platformSupport";

const FULL: DownloadCapabilities = {
  downloads: true,
  lightDownloads: true,
  lightPresets: ["p1080", "p720", "p480", REMUX_PRESET],
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
  it("MP4 h264/aac sur iOS : l'original, l'Allégé, et un remux inutile", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
    expect(excluded(plan, "remux")).toBe("redundant");
    expect(plan.cards[0]?.sizeBytes).toBe(1_500_000_000);
    expect(plan.cards[0]?.sizeIsEstimate).toBe(false);
  });

  it("MKV h264/aac sur iOS : pas d'original, le remux à cause du conteneur", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["remux", "light"]);
    expect(excluded(plan, "original")).toBe("container");
    expect(plan.cards[0]?.reason).toBe("container");
    expect(plan.cards[0]?.sizeIsEstimate).toBe(true);
  });

  it("MKV h264/aac sur Android : l'original, le remux est inutile", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), ANDROID_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
    expect(excluded(plan, "remux")).toBe("redundant");
  });

  it("MKV hevc/dts sur Android : le remux convertit l'audio", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "hevc" }, ["dts"]), ANDROID_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["remux", "light"]);
    expect(excluded(plan, "original")).toBe("audioCodec");
    expect(plan.cards[0]?.reason).toBe("audioCodec");
  });

  it("MP4 hevc avec [dts, aac] sur iOS : les deux cartes, l'original prévient", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "hevc" }, ["dts", "aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "remux", "light"]);
    expect(plan.cards[0]?.audio).toEqual({ playable: [2], unplayable: [1] });
    expect(plan.cards[1]?.reason).toBe("audioCodec");
  });

  it("MKV hevc 10 bits HDR10 eac3 sur iOS : remux", () => {
    const plan = offlineVariantsFor(
      item("mkv", { Codec: "hevc", BitDepth: 10, VideoRangeType: "HDR10" }, ["eac3"]),
      IOS_LOCAL_SUPPORT,
      FULL,
    );
    expect(kinds(plan)).toEqual(["remux", "light"]);
  });

  it("Dolby Vision profil 5 : l'Allégé seul, sur les deux plateformes", () => {
    const dv5 = item("mkv", { Codec: "hevc", DvProfile: 5, VideoRangeType: "DOVI" }, ["eac3"]);
    for (const platform of [IOS_LOCAL_SUPPORT, ANDROID_LOCAL_SUPPORT]) {
      const plan = offlineVariantsFor(dv5, platform, FULL);
      expect(kinds(plan)).toEqual(["light"]);
      expect(excluded(plan, "original")).toBe("dolbyVision");
      expect(excluded(plan, "remux")).toBe("dolbyVision");
    }
  });

  it("Dolby Vision profil 8.1 (base HDR10) : compatible, remux sur iOS", () => {
    const plan = offlineVariantsFor(
      item("mkv", { Codec: "hevc", DvProfile: 8, VideoRangeType: "DOVIWithHDR10" }, ["eac3"]),
      IOS_LOCAL_SUPPORT,
      FULL,
    );
    expect(kinds(plan)).toEqual(["remux", "light"]);
  });

  it("Dolby Vision profil 7 sur Android : l'Allégé seul", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "hevc", DvProfile: 7 }, ["truehd"]), ANDROID_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["light"]);
  });

  it("AV1 en MKV sur iOS : rien à copier, l'Allégé seul", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "av1" }, ["opus"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["light"]);
    expect(excluded(plan, "original")).toBe("container");
    expect(excluded(plan, "remux")).toBe("videoCodec");
  });

  it("WebM vp9/opus sur Android : l'original se lit tel quel", () => {
    const plan = offlineVariantsFor(item("webm", { Codec: "vp9" }, ["opus"]), ANDROID_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
    expect(excluded(plan, "remux")).toBe("videoCodec");
  });

  it("serveur sans le palier pmax : pas de remux, l'Allégé seul", () => {
    const old: DownloadCapabilities = { ...FULL, lightPresets: ["p1080", "p720", "p480"] };
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, old);
    expect(kinds(plan)).toEqual(["light"]);
    expect(excluded(plan, "remux")).toBe("serverPreset");
  });

  it("sans droit de conversion : ni remux ni Allégé", () => {
    const noConv: DownloadCapabilities = { downloads: true, lightDownloads: false, lightPresets: [] };
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, noConv);
    expect(kinds(plan)).toEqual([]);
    expect(excluded(plan, "remux")).toBe("right");
    expect(excluded(plan, "light")).toBe("right");
  });

  it("sans droit du tout : rien, pas même une raison", () => {
    const none: DownloadCapabilities = { downloads: false, lightDownloads: false, lightPresets: [] };
    expect(offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, none)).toEqual({
      cards: [],
      excluded: [],
    });
  });

  it("entrelacé : exclu sur iOS, lisible sur Android", () => {
    const interlaced = item("mp4", { Codec: "h264", IsInterlaced: true }, ["aac"]);
    expect(kinds(offlineVariantsFor(interlaced, IOS_LOCAL_SUPPORT, FULL))).toEqual(["light"]);
    expect(kinds(offlineVariantsFor(interlaced, ANDROID_LOCAL_SUPPORT, FULL))).toEqual(["original", "light"]);
  });

  it("un conteneur à plusieurs noms se lit par son premier jeton", () => {
    const plan = offlineVariantsFor(item("mov,mp4,m4a", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
  });

  it("un VideoRangeType numérique n'est jamais pris pour du Dolby Vision", () => {
    const plan = offlineVariantsFor(
      item("mp4", { Codec: "hevc", VideoRangeType: 3, DvProfile: 8 }, ["aac"]),
      IOS_LOCAL_SUPPORT,
      FULL,
    );
    expect(kinds(plan)).toEqual(["original", "light"]);
  });

  // ── Sans perte d'abord : l'Allégé n'est plus un choix, c'est un recours.
  it("sans perte d'abord : un MP4 lisible n'a que son original", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL, {
      lossyAsLastResort: true,
    });
    expect(kinds(plan)).toEqual(["original"]);
    expect(excluded(plan, "light")).toBe("lossless");
  });

  it("sans perte d'abord : un MKV sur iOS n'a que son remux", () => {
    const plan = offlineVariantsFor(item("mkv", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL, {
      lossyAsLastResort: true,
    });
    expect(kinds(plan)).toEqual(["remux"]);
    expect(excluded(plan, "light")).toBe("lossless");
  });

  it("sans perte d'abord : le Dolby Vision profil 5 garde son Allégé, faute de mieux", () => {
    const plan = offlineVariantsFor(
      item("mkv", { Codec: "hevc", DvProfile: 5 }, ["eac3"]),
      IOS_LOCAL_SUPPORT,
      FULL,
      { lossyAsLastResort: true },
    );
    expect(kinds(plan)).toEqual(["light"]);
  });

  it("sans perte d'abord : sans droit de conversion, il ne reste rien", () => {
    const plan = offlineVariantsFor(
      item("mkv", { Codec: "hevc", DvProfile: 5 }, ["eac3"]),
      IOS_LOCAL_SUPPORT,
      { downloads: true, lightDownloads: false, lightPresets: [] },
      { lossyAsLastResort: true },
    );
    expect(kinds(plan)).toEqual([]);
    expect(excluded(plan, "light")).toBe("right");
  });

  it("le bureau garde le choix des trois : l'option est éteinte par défaut", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "h264" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
  });

  it("« h265 » vaut hevc", () => {
    const plan = offlineVariantsFor(item("mp4", { Codec: "h265" }, ["aac"]), IOS_LOCAL_SUPPORT, FULL);
    expect(kinds(plan)).toEqual(["original", "light"]);
  });
});
