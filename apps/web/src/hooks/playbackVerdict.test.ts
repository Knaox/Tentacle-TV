import { describe, expect, it } from "vitest";
import { evaluerLecture, normaliserRaisons, sourceEstHdr } from "./playbackVerdict";

/** URL de transcodage minimale, telle que Jellyfin la renvoie. */
const urlHls = (videoCodec: string) =>
  `/videos/x/master.m3u8?VideoCodec=${videoCodec}&AudioCodec=aac&MaxAudioChannels=6`;

describe("evaluerLecture", () => {
  it("reconnaît la lecture directe", () => {
    const v = evaluerLecture({ supportsDirectPlay: true, supportsDirectStream: true });
    expect(v.mode).toBe("DirectPlay");
    expect(v.reencodageVideo).toBe(false);
  });

  it("appelle Remux un transcodage motivé par le seul audio", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: urlHls("hevc"),
      transcodeReasons: ["AudioCodecNotSupported"],
      codecVideoSource: "hevc",
    });
    expect(v.mode).toBe("Remux");
    expect(v.reencodageVideo).toBe(false);
    expect(v.raisons).toEqual(["AudioCodecNotSupported"]);
  });

  it("appelle Transcode dès qu'une raison touche à l'image", () => {
    for (const raison of [
      "VideoCodecNotSupported", "VideoLevelNotSupported", "VideoBitDepthNotSupported",
      "RefFramesNotSupported", "AnamorphicVideoNotSupported", "InterlacedVideoNotSupported",
      "ContainerBitrateExceedsLimit", "VideoRangeTypeNotSupported",
    ]) {
      const v = evaluerLecture({
        supportsDirectPlay: false, supportsDirectStream: false,
        transcodingUrl: urlHls("h264"), transcodeReasons: [raison, "AudioCodecNotSupported"],
      });
      expect(v.mode, raison).toBe("Transcode");
    }
  });

  it("ne prend pas ContainerNotSupported pour une raison vidéo — c'est un remux", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: urlHls("hevc"), transcodeReasons: ["ContainerNotSupported"],
    });
    expect(v.mode).toBe("Remux");
  });

  it("croit `VideoCodec=copy` avant tout le reste", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: urlHls("copy"), transcodeReasons: ["VideoCodecNotSupported"],
    });
    expect(v.mode).toBe("Remux");
  });

  it("compare les codecs quand le serveur ne donne aucune raison", () => {
    const commun = { supportsDirectPlay: false, supportsDirectStream: false };
    expect(evaluerLecture({ ...commun, transcodingUrl: urlHls("hevc,h264"), codecVideoSource: "hevc" }).mode)
      .toBe("Remux");
    expect(evaluerLecture({ ...commun, transcodingUrl: urlHls("h264"), codecVideoSource: "hevc" }).mode)
      .toBe("Transcode");
  });

  it("lit les raisons dans l'URL quand le MediaSource ne les porte pas", () => {
    // Cas réel (Jellyfin 10.10) : `TranscodeReasons` absent de la réponse
    // PlaybackInfo, mais présent dans la query de la TranscodingUrl.
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: `${urlHls("hevc,h264")}&TranscodeReasons=AudioCodecNotSupported`,
      codecVideoSource: "hevc",
    });
    expect(v.raisons).toEqual(["AudioCodecNotSupported"]);
    expect(v.mode).toBe("Remux");
  });

  it("suppose le pire quand rien ne permet de trancher", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false, transcodingUrl: "/videos/x/master.m3u8",
    });
    expect(v.mode).toBe("Transcode");
    expect(v.reencodageVideo).toBe(true);
  });

  it("distingue DirectStream de Transcode en l'absence d'URL de transcodage", () => {
    expect(evaluerLecture({ supportsDirectPlay: false, supportsDirectStream: true }).mode)
      .toBe("DirectStream");
    expect(evaluerLecture({ supportsDirectPlay: false, supportsDirectStream: false }).mode)
      .toBe("Transcode");
  });
});

describe("tone mapping HDR", () => {
  // Cas réel : Dolby Vision 8.1, seule raison annoncée « AudioCodecNotSupported »,
  // et ffmpeg lançait pourtant `hevc_qsv` avec un filtre `tonemap_opencl`.
  const dolbyVision = {
    supportsDirectPlay: false, supportsDirectStream: false,
    transcodingUrl: `${urlHls("hevc,h264")}&TranscodeReasons=AudioCodecNotSupported`,
    codecVideoSource: "hevc", sourceHdr: true,
  };

  it("dénonce le ré-encodage quand le client n'affiche pas le HDR", () => {
    const v = evaluerLecture({ ...dolbyVision, clientAccepteHdr: false });
    expect(v.mode).toBe("Transcode");
    expect(v.reencodageVideo).toBe(true);
    expect(v.raisons).toContain("ToneMappingHdrVersSdr");
  });

  it("laisse passer le remux quand le client affiche le HDR", () => {
    const v = evaluerLecture({ ...dolbyVision, clientAccepteHdr: true });
    expect(v.mode).toBe("Remux");
    expect(v.raisons).not.toContain("ToneMappingHdrVersSdr");
  });

  it("n'invente pas de tone mapping sur une source SDR", () => {
    const v = evaluerLecture({ ...dolbyVision, sourceHdr: false, clientAccepteHdr: false });
    expect(v.mode).toBe("Remux");
  });
});

describe("sourceEstHdr", () => {
  it("reconnaît le HDR quelle que soit la sérialisation de VideoRangeType", () => {
    expect(sourceEstHdr({ VideoRangeType: 9 })).toBe(true);
    expect(sourceEstHdr({ VideoRangeType: "HDR10" })).toBe(true);
    expect(sourceEstHdr({ DvProfile: 8 })).toBe(true);
    expect(sourceEstHdr({ Hdr10PlusPresentFlag: true })).toBe(true);
  });

  it("ne prend ni SDR ni Unknown pour du HDR", () => {
    expect(sourceEstHdr({ VideoRangeType: 1 })).toBe(false);
    expect(sourceEstHdr({ VideoRangeType: 0 })).toBe(false);
    expect(sourceEstHdr({ VideoRangeType: "SDR" })).toBe(false);
    expect(sourceEstHdr({ VideoRangeType: "Unknown" })).toBe(false);
    expect(sourceEstHdr({})).toBe(false);
    expect(sourceEstHdr(undefined)).toBe(false);
  });
});

describe("normaliserRaisons", () => {
  it("accepte le tableau (Jellyfin 10.9+) comme la chaîne de drapeaux", () => {
    expect(normaliserRaisons(["A", "B"])).toEqual(["A", "B"]);
    expect(normaliserRaisons("A, B ,")).toEqual(["A", "B"]);
    expect(normaliserRaisons(undefined)).toEqual([]);
    expect(normaliserRaisons("")).toEqual([]);
  });
});

describe("AllowVideoStreamCopy — le signal explicite du serveur", () => {
  /**
   * Ces deux cas viennent d'un défaut vécu : la surcouche de diagnostic du
   * téléviseur annonçait « image RECOMPRESSÉE » pendant que la dalle recevait
   * un Dolby Vision à l'image copiée. `VideoRangeTypeNotSupported` commence par
   * « video » et tombait donc dans les raisons de ré-encodage — à juste titre
   * pour un tone mapping, à tort pour le mécanisme qui va CHERCHER le remux en
   * retirant les plages Dolby Vision d'un conteneur.
   */
  const base = {
    supportsDirectPlay: false,
    supportsDirectStream: true,
    codecVideoSource: "hevc",
  };

  it("ne lit pas l'absence du drapeau comme une promesse de copie", () => {
    // Jellyfin ré-encode quand même si le codec source n'est pas dans la liste
    // de sortie : l'absence ne prouve rien, on s'en remet aux raisons. Le cas
    // Dolby Vision, où l'image EST copiée, est tranché par `playbackInfoTv.ts`,
    // seul à savoir quelle variante il a désignée.
    const v = evaluerLecture({
      ...base,
      transcodingUrl: "/videos/x/main.m3u8?VideoCodec=hevc,h264",
      transcodeReasons: ["VideoRangeTypeNotSupported"],
    });
    expect(v.reencodageVideo).toBe(true);
  });

  it("conclut au ré-encodage quand le serveur interdit la copie", () => {
    const v = evaluerLecture({
      ...base,
      transcodingUrl: "/videos/x/main.m3u8?VideoCodec=hevc&AllowVideoStreamCopy=false",
      transcodeReasons: ["VideoRangeTypeNotSupported"],
    });
    expect(v.reencodageVideo).toBe(true);
    expect(v.mode).toBe("Transcode");
  });

  it("laisse le manifeste maître aux raisons — il ne porte pas le drapeau", () => {
    // Le paramètre n'existe que sur une playlist de variante. Sur le maître, le
    // verdict doit continuer de s'en remettre aux raisons, comme avant.
    const v = evaluerLecture({
      ...base,
      transcodingUrl: "/videos/x/master.m3u8?VideoCodec=hevc",
      transcodeReasons: ["VideoBitrateNotSupported"],
    });
    expect(v.reencodageVideo).toBe(true);
  });
});
