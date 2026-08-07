import { describe, expect, it } from "vitest";
import type { DeviceProfile } from "@tentacle-tv/shared";
import { capacitesDe } from "./capacitesWebos";
import type { DalleTv, ProfilResolu } from "./codecsWebos";
import type { GenerationWebos } from "./generationWebos";
import { construireProfilTv } from "./profilWebos";
import { MEMOIRE_VIDE, type MemoireReplis } from "./repliLecture";

/**
 * Le profil décide, à lui seul, si une médiathèque se lit sans effort ou si
 * chaque fichier passe par ffmpeg. Rien de tout cela ne se voit à l'écran : un
 * transcodage réussi ressemble à une lecture directe, en plus lent et en moins
 * beau. D'où ces tests, qui interrogent le profil plutôt que l'image.
 */

function dalle(extra: Partial<DalleTv> = {}): DalleTv {
  return {
    uhd: true,
    uhd8K: false,
    hdr10: true,
    dolbyVision: false,
    dolbyAtmos: false,
    oled: false,
    ...extra,
  };
}

function resolu(
  generation: GenerationWebos = 24,
  annee: number | null = 2024,
  ecran: Partial<DalleTv> = {},
): ProfilResolu {
  const d = dalle(ecran);
  return {
    plateforme: { generation, annee, source: "ua" },
    capacites: capacitesDe(generation, { annee, oled: d.oled, uhd8K: d.uhd8K }),
    dalle: d,
  };
}

function profil(
  generation: GenerationWebos = 24,
  annee: number | null = 2024,
  memoire: MemoireReplis = MEMOIRE_VIDE,
  ecran: Partial<DalleTv> = {},
): DeviceProfile {
  return construireProfilTv(resolu(generation, annee, ecran), memoire);
}

/** Entrée de lecture directe d'un conteneur donné. */
function directPlay(p: DeviceProfile, conteneur: string) {
  return p.DirectPlayProfiles.find((entree) => entree.Container === conteneur);
}

describe("lecture directe", () => {
  it("déclare le MKV avec HEVC et E-AC3 — le cas qui compte", () => {
    const mkv = directPlay(profil(), "mkv");
    expect(mkv?.VideoCodec).toContain("hevc");
    expect(mkv?.AudioCodec).toContain("eac3");
  });

  it("garde une entrée par conteneur, pas une liste fourre-tout", () => {
    // Les codecs ne sont pas les mêmes partout : l'AV1 passe en MP4, jamais en
    // flux de transport. Une entrée unique promettrait une combinaison qui
    // n'existe pas.
    const p = profil(24, 2024);
    expect(directPlay(p, "mp4,m4v,mov")?.VideoCodec).toContain("av1");
    expect(directPlay(p, "ts,m2ts,mts,mpegts")?.VideoCodec).not.toContain("av1");
  });

  it("garde un plancher même si la session a tout disqualifié", () => {
    // C'est le défaut corrigé : l'ancien profil pouvait ne produire AUCUNE
    // entrée vidéo, et toute la médiathèque partait alors en transcodage.
    const tout: MemoireReplis = {
      conteneurs: ["mkv", "mp4", "ts", "avi", "asf", "mpg", "vob", "3gp"],
      audio: [],
      video: [],
    };
    const p = construireProfilTv(resolu(), tout);
    const video = p.DirectPlayProfiles.filter((entree) => entree.Type === "Video");
    expect(video.length).toBeGreaterThan(0);
    expect(video[0].VideoCodec).toBe("h264");
  });

  it("retire un conteneur disqualifié par la session", () => {
    const p = profil(24, 2024, { conteneurs: ["mkv"], audio: [], video: [] });
    expect(directPlay(p, "mkv")).toBeUndefined();
    expect(directPlay(p, "mp4,m4v,mov")).toBeDefined();
  });

  it("honore mkvNonFiable, le drapeau que le client web tient déjà", () => {
    const p = construireProfilTv(resolu(), MEMOIRE_VIDE, undefined, { mkvNonFiable: true });
    expect(directPlay(p, "mkv")).toBeUndefined();
  });

  it("ne déclare le FLAC que comme fichier autonome", () => {
    const p = profil();
    const video = p.DirectPlayProfiles.filter((entree) => entree.Type === "Video");
    expect(video.some((entree) => entree.AudioCodec?.includes("flac"))).toBe(false);
    expect(p.DirectPlayProfiles.some((entree) => entree.Container === "flac")).toBe(true);
  });
});

describe("canaux audio — le passthrough", () => {
  it("ne pose AUCUNE limite de canaux sur l'audio d'une vidéo", () => {
    // Le `CodecProfile` `VideoAudio` du profil navigateur plafonnait à six
    // canaux : une piste 7.1 partait en transcodage. Son absence est ce qui
    // donne son passthrough à ce profil.
    const contraintes = profil().CodecProfiles ?? [];
    expect(contraintes.some((entree) => entree.Type === "VideoAudio")).toBe(false);
  });

  it("laisse passer huit canaux en remux quand le téléviseur annonce l'Atmos", () => {
    const p = profil(24, 2024, MEMOIRE_VIDE, { dolbyAtmos: true });
    for (const entree of p.TranscodingProfiles.filter((t) => t.Type === "Video")) {
      expect(entree.MaxAudioChannels).toBe("8");
    }
  });

  it("s'en tient à six sans chaîne Atmos", () => {
    const video = profil().TranscodingProfiles.filter((t) => t.Type === "Video");
    expect(video.every((entree) => entree.MaxAudioChannels === "6")).toBe(true);
  });
});

describe("transcodage — c'est d'abord le mécanisme du remux", () => {
  it("liste TOUS les codecs décodés, pour que le repli reste une copie", () => {
    // Le défaut corrigé : l'ancien profil n'y listait que `hevc,h264`. Un
    // MPEG-2 dont seul le conteneur posait problème repartait recompressé.
    const fmp4 = profil().TranscodingProfiles.find((t) => t.Container === "mp4");
    expect(fmp4?.VideoCodec).toContain("hevc");
    expect(fmp4?.VideoCodec).toContain("h264");
    expect(fmp4?.VideoCodec).toContain("mpeg2video");
    expect(fmp4?.VideoCodec).toContain("vc1");
  });

  it("place le fMP4 avant le TS — seul conteneur qui copie une image HEVC", () => {
    const video = profil().TranscodingProfiles.filter((t) => t.Type === "Video");
    expect(video[0].Container).toBe("mp4");
    expect(video[1].Container).toBe("ts");
  });

  it("n'annonce jamais en TS ce que le flux de transport ne porte pas", () => {
    const ts = profil(24, 2024).TranscodingProfiles.find((t) => t.Container === "ts");
    expect(ts?.VideoCodec).not.toContain("av1");
    expect(ts?.VideoCodec).not.toContain("vp9");
    expect(ts?.VideoCodec).toContain("hevc");
  });

  it("ne demande jamais au serveur de couper hors image clé", () => {
    // À vrai, `BreakOnNonKeyFrames` oblige le serveur à fabriquer des images
    // clés, donc à recompresser — mesuré à 4,7x le temps réel contre 60x en
    // copie.
    const video = profil().TranscodingProfiles.filter((t) => t.Type === "Video");
    expect(video.every((entree) => entree.BreakOnNonKeyFrames === false)).toBe(true);
  });
});

describe("plages dynamiques", () => {
  it("déclare le HDR10 et le HLG sur une dalle qui les affiche", () => {
    const hevc = (profil().CodecProfiles ?? []).find((c) => c.Codec === "hevc");
    const plages = hevc?.Conditions.find((c) => c.Property === "VideoRangeType")?.Value ?? "";
    expect(plages).toContain("HDR10");
    expect(plages).toContain("HLG");
  });

  it("n'annonce le Dolby Vision que s'il est déclaré", () => {
    const sans = (profil().CodecProfiles ?? []).find((c) => c.Codec === "hevc");
    expect(sans?.Conditions.find((c) => c.Property === "VideoRangeType")?.Value)
      .not.toContain("DOVI");

    const avec = (profil(25, 2023, MEMOIRE_VIDE, { dolbyVision: true }).CodecProfiles ?? [])
      .find((c) => c.Codec === "hevc");
    expect(avec?.Conditions.find((c) => c.Property === "VideoRangeType")?.Value).toContain("DOVI");
  });

  it("n'annonce JAMAIS le Dolby Vision à deux couches", () => {
    // Le profil 7 n'est lu par aucun téléviseur LG : Jellyfin retombe alors sur
    // la couche de base HDR10, ce qui est le bon comportement.
    const hevc = (profil(26, 2026, MEMOIRE_VIDE, { dolbyVision: true }).CodecProfiles ?? [])
      .find((c) => c.Codec === "hevc");
    const plages = hevc?.Conditions.find((c) => c.Property === "VideoRangeType")?.Value ?? "";
    expect(plages).not.toContain("DOVIWithEL");
  });

  it("garde toujours Unknown et SDR", () => {
    // Ce sont les valeurs que Jellyfin attribue aux fichiers dont il ne sait
    // rien : les taire ferait transcoder la moitié d'une médiathèque.
    const hevc = (profil().CodecProfiles ?? []).find((c) => c.Codec === "hevc");
    const plages = hevc?.Conditions.find((c) => c.Property === "VideoRangeType")?.Value ?? "";
    expect(plages).toContain("Unknown");
    expect(plages).toContain("SDR");
  });
});

describe("débit", () => {
  it("ne descend jamais sous ce que le client web s'autorise", () => {
    // Le défaut corrigé : 20 Mb/s dès que `deviceInfo` omettait `uhd`, ce que
    // LG fait sur des téléviseurs parfaitement capables.
    const p = profil(24, 2024, MEMOIRE_VIDE, { uhd: false });
    expect(p.MaxStreamingBitrate).toBeGreaterThanOrEqual(80_000_000);
  });

  it("laisse le sélecteur de qualité imposer le sien", () => {
    const p = construireProfilTv(resolu(), MEMOIRE_VIDE, 8_000_000);
    expect(p.MaxStreamingBitrate).toBe(8_000_000);
  });
});

describe("sous-titres image", () => {
  it("évite l'incrustation là où le client sait décoder le PGS", () => {
    const pgs = profil(24, 2024).SubtitleProfiles.find((s) => s.Format === "pgssub");
    expect(pgs?.Method).toBe("External");
  });

  it("retombe sur l'incrustation sans WebAssembly — dernier recours assumé", () => {
    // webOS 4, Chromium 53 : pas de WebAssembly, donc pas de décodeur PGS
    // client. L'interface doit le signaler.
    const pgs = profil(4, 2018).SubtitleProfiles.find((s) => s.Format === "pgssub");
    expect(pgs?.Method).toBe("Encode");
  });
});
