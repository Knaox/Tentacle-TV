import { describe, expect, it } from "vitest";
import { edlFrom, formatFileOptions, headerFields, outputOptions, partialStreamOptions, swapPoint } from "./audioOptions";
import { exclusiveCapable, parseOutputs } from "./audioOutputs";
import { effectiveGainMode, gainFromSource, replayGainOptions } from "./replayGain";
import { cachedToEnd, isRealEnd, progressed, reloadDelayMs } from "./partialSource";
import { codecsFromDecoderList, contractCodec, decodedFormat } from "./audioFormat";
import { expiresSoon, refuseSource, servedSource } from "./audioSources";
import type { AudioBridgeSource } from "./audioBridgeContract";

describe("options mpv", () => {
  it("échappe une valeur à virgules en %longueur% (octets UTF-8)", () => {
    expect(formatFileOptions({ start: "12.5", "volume-gain": "-3.00" })).toBe("start=12.5,volume-gain=-3.00");
    const o = formatFileOptions(partialStreamOptions(false));
    expect(o).toMatch(/^stream-lavf-o=%\d+%reconnect=1,/);
    expect(formatFileOptions({ title: "é,x" })).toBe("title=%4%é,x");
    expect(() => formatFileOptions({ "a b": "x" })).toThrow();
  });

  it("l'EDL de bascule : adresse protégée, longueur explicite", () => {
    expect(edlFrom("http://s/a,b;c", 1.5)).toBe("edl://%14%http://s/a,b;c,start=1.500000,length=86400");
    expect(edlFrom("http://s/é", 2)).toBe("edl://%11%http://s/é,start=2.000000,length=86400");
  });

  it("une source complète ne demande aucune reconnexion", () => {
    expect(partialStreamOptions(true)).toEqual({});
  });

  it("refuse un en-tête qui couperait la liste ou en injecterait un autre", () => {
    expect(headerFields({ "X-Emby-Token": "abc" })).toBe("X-Emby-Token: abc");
    expect(() => headerFields({ "X-Emby-Token": "a,b" })).toThrow();
    expect(() => headerFields({ "X-Emby-Token": "a\r\nX: y" })).toThrow();
  });

  it("le point de bascule tombe AU MILIEU de deux échantillons", () => {
    const t = swapPoint(1, 44100, 1.5);
    expect(t * 44100).toBeCloseTo(Math.floor(2.5 * 44100) + 0.5, 6);
    expect(swapPoint(1, null, 1.5)).toBe(2.5);
  });

  it("la sortie exclusive par système", () => {
    expect(outputOptions("darwin", null, true)).toEqual({
      "audio-device": "auto", "audio-exclusive": "yes", "coreaudio-change-physical-format": "yes",
    });
    expect(outputOptions("win32", "wasapi/{x}", true)).toEqual({ "audio-device": "wasapi/{x}", "audio-exclusive": "yes" });
    expect(outputOptions("linux", "pipewire/a", false)).toEqual({ "audio-device": "pipewire/a", "audio-exclusive": "no" });
  });
});

describe("sorties proposées", () => {
  it("macOS : une seule famille (CoreAudio), sans le doublon AVFoundation", () => {
    const json = JSON.stringify([
      { name: "auto", description: "Autoselect device" },
      { name: "coreaudio/BuiltInSpeakerDevice", description: "Haut-parleurs MacBook Pro" },
      { name: "avfoundation/BuiltInSpeakerDevice", description: "Haut-parleurs MacBook Pro" },
    ]);
    expect(parseOutputs("darwin", json)).toEqual([
      { id: "auto", name: "Autoselect device", exclusiveCapable: true },
      { id: "coreaudio/BuiltInSpeakerDevice", name: "Haut-parleurs MacBook Pro", exclusiveCapable: true },
    ]);
  });

  it("Linux : PipeWire masque son émulation PulseAudio ; ALSA hw: seul est exclusif", () => {
    const json = JSON.stringify([
      { name: "pipewire/alsa_output.usb", description: "DAC" },
      { name: "pulse/alsa_output.usb", description: "DAC" },
      { name: "alsa/hw:CARD=DAC,DEV=0", description: "DAC direct" },
      { name: "alsa/default", description: "Défaut" },
    ]);
    const ids = parseOutputs("linux", json).map((o) => `${o.id}:${o.exclusiveCapable}`);
    expect(ids).toEqual(["auto:true", "pipewire/alsa_output.usb:true", "alsa/hw:CARD=DAC,DEV=0:true", "alsa/default:false"]);
  });

  it("Windows : WASAPI ; un JSON illisible ne rend que la sortie du système", () => {
    expect(exclusiveCapable("win32", "wasapi/{abc}")).toBe(true);
    expect(exclusiveCapable("win32", "openal/x")).toBe(false);
    expect(parseOutputs("win32", "pas du json")).toEqual([{ id: "auto", name: "", exclusiveCapable: true }]);
  });
});

describe("ReplayGain", () => {
  it("« auto » : l'album quand un voisin est du même album, le titre sinon", () => {
    expect(effectiveGainMode("auto", "A", ["A", null])).toBe("album");
    expect(effectiveGainMode("auto", "A", ["B"])).toBe("track");
    expect(effectiveGainMode("auto", null, ["A"])).toBe("track");
    expect(effectiveGainMode("off", "A", ["A"])).toBe("off");
  });

  it("le gain de la source, rabattu pour ne jamais écrêter", () => {
    const rg = { trackGainDb: 6, trackPeak: 0.9, albumGainDb: -4, albumPeak: 1 };
    expect(gainFromSource("track", rg)).toBeCloseTo(-20 * Math.log10(0.9), 6);
    expect(gainFromSource("album", rg)).toBe(-4);
    expect(gainFromSource("album", { trackGainDb: 2, trackPeak: null, albumGainDb: null, albumPeak: null })).toBe(2);
    expect(gainFromSource("track", { trackGainDb: 40, trackPeak: null, albumGainDb: null, albumPeak: null })).toBe(12);
  });

  it("sans valeurs de la source, mpv lit les étiquettes du fichier", () => {
    expect(replayGainOptions("album", null)).toEqual({ replaygain: "album", "volume-gain": "0" });
    expect(replayGainOptions("off", null)).toEqual({ replaygain: "no", "volume-gain": "0" });
    expect(replayGainOptions("track", { trackGainDb: -3, trackPeak: null, albumGainDb: null, albumPeak: null })).toEqual({
      replaygain: "no", "volume-gain": "-3.00",
    });
  });
});

describe("fin d'un fichier qui grandit", () => {
  const base = { complete: false, durationMs: 200_000, positionMs: 60_000, stalledReloads: 0 };
  it("provisoire tant qu'on est loin de la durée annoncée", () => {
    expect(isRealEnd(base)).toBe(false);
    expect(isRealEnd({ ...base, positionMs: 199_000 })).toBe(true);
    expect(isRealEnd({ ...base, complete: true })).toBe(true);
  });
  it("sans durée connue : vraie après des relectures sans progrès", () => {
    expect(isRealEnd({ ...base, durationMs: null, stalledReloads: 3 })).toBe(false);
    expect(isRealEnd({ ...base, durationMs: null, stalledReloads: 4 })).toBe(true);
    expect(isRealEnd({ ...base, stalledReloads: 8 })).toBe(true);
  });
  it("entièrement en cache : la fin connue est atteinte par le cache", () => {
    expect(cachedToEnd(199.8, 0, 200_000)).toBe(true);
    expect(cachedToEnd(150, 0, 200_000)).toBe(false);
    expect(cachedToEnd(98, 102, 200_000)).toBe(true);
    expect(cachedToEnd(199.9, 0, null)).toBe(false);
  });

  it("délais croissants, progrès au-delà du bruit", () => {
    expect([0, 1, 2, 3, 9].map(reloadDelayMs)).toEqual([250, 600, 1200, 2500, 2500]);
    expect(progressed(null, 0)).toBe(true);
    expect(progressed(1000, 1100)).toBe(false);
    expect(progressed(1000, 1300)).toBe(true);
  });
});

describe("codecs et format", () => {
  it("les noms du contrat", () => {
    expect(contractCodec("dsd_lsbf_planar")).toBe("dsd");
    expect(contractCodec("pcm_s24le", "wav")).toBe("wav");
    expect(contractCodec("pcm_s16be", "aiff")).toBe("aiff");
    expect(contractCodec("mp3float")).toBe("mp3");
    expect(contractCodec("h264")).toBeNull();
    const list = JSON.stringify(["flac", "alac", "opus", "aac", "mp3float", "pcm_s16le", "dsd_lsbf", "h264"].map((codec) => ({ codec })));
    expect(codecsFromDecoderList(list)).toEqual(["aac", "alac", "dsd", "flac", "mp3", "opus", "wav"]);
  });
  it("le format décodé garde la profondeur annoncée du même codec", () => {
    const announced = { codec: "flac", container: "flac", sampleRate: 96000, bitDepth: 24, bitrate: null, channels: 2, lossless: true };
    const f = decodedFormat({ codecName: "flac", fileFormat: "flac", sampleRate: 96000, channels: 2, bitrate: 2_400_000 }, announced);
    expect(f).toEqual({ ...announced, bitrate: 2_400_000 });
    expect(decodedFormat({ codecName: null, fileFormat: null, sampleRate: null, channels: null, bitrate: null }, null)).toBeNull();
  });
});

describe("sources", () => {
  const s = (url: string, origin: "library" | "plugin" = "library"): AudioBridgeSource => ({
    url, origin, complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null,
  });
  it("seulement http(s), seulement le serveur Tentacle", () => {
    expect(refuseSource("http://srv:3001/api/music/stream/1", "http://srv:3001")).toBeNull();
    expect(refuseSource("file:///etc/passwd", "http://srv:3001")).not.toBeNull();
    expect(refuseSource("lavfi://sine", "http://srv:3001")).not.toBeNull();
    expect(refuseSource("http://ailleurs/x", "http://srv:3001")).not.toBeNull();
    expect(refuseSource("http://u:p@srv:3001/x", "http://srv:3001")).not.toBeNull();
    expect(refuseSource("http://srv:3001/x", null)).not.toBeNull();
  });
  it("un flux googlevideo ou une pochette tierce est REFUSÉ : le jeton (http-header-fields) vaut pour TOUTES les requêtes de mpv", () => {
    // Garde-fou (25/10) : l'en-tête X-Emby-Token est posé sur l'instance entière. Admettre une autre origine ici
    // (lecture directe de googlevideo par le bureau, R3) exige d'abord que le jeton ne vise plus que le serveur.
    expect(refuseSource("https://rr3---sn-nfpnnjvh-1gir.googlevideo.com/videoplayback?expire=1&itag=251", "http://srv:3001")).not.toBeNull();
    expect(refuseSource("https://coverartarchive.org/release/x/front", "http://srv:3001")).not.toBeNull();
    expect(refuseSource("https://srv:3001/api/music/stream/1", "http://srv:3001")).not.toBeNull();
  });
  it("une bascule reçue d'avance sert, jamais à reculer vers l'extension", () => {
    const overrides = new Map([["k", s("http://srv/lib")]]);
    expect(servedSource(overrides, "k", s("http://srv/ext", "plugin")).url).toBe("http://srv/lib");
    expect(overrides.size).toBe(0);
    const back = new Map([["k", s("http://srv/ext", "plugin")]]);
    expect(servedSource(back, "k", s("http://srv/lib")).url).toBe("http://srv/lib");
  });
  it("expiration proche", () => {
    expect(expiresSoon({ ...s("x"), expiresAt: 1000 + 30_000 }, 1000, 60_000)).toBe(true);
    expect(expiresSoon({ ...s("x"), expiresAt: null }, 1000, 60_000)).toBe(false);
  });
});
