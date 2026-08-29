/**
 * Le journal du relevé, et les deux calculs qu'on lui demande.
 *
 * Une ligne par observation, en NDJSON : `jq` sait le lire, un tableur aussi,
 * et un relevé de trois minutes fait quelques milliers de lignes qu'aucun
 * format plus riche ne rendrait plus clair.
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * À quoi sert une URL demandée pendant la lecture.
 *
 * Le manifeste et ses segments empruntent la même route `hls1/` : l'un se
 * demande trois fois par film, l'autre plus de mille. Les confondre rendrait
 * illisible la seule mesure qui compte, la durée d'un segment.
 */
export function classifyRequest(url) {
  if (typeof url !== "string" || !url) return "autre";
  const path = url.split("?")[0];
  if (/\/hls1\//.test(path)) return path.endsWith(".m3u8") ? "manifeste" : "segment";
  if (/\.m3u8$/.test(path)) return "manifeste";
  if (/\/(stream|universal)(\.[a-z0-9]+)?$/i.test(path)) return "flux";
  return "autre";
}

/**
 * Débit réellement obtenu, en mégabits par seconde.
 *
 * C'est lui qui départage une famine de livraison d'un défaut de décodage : un
 * segment de six secondes de média qui met sept secondes à descendre affame le
 * lecteur, quel que soit le débit annoncé par le manifeste.
 */
export function effectiveBitrate(bytes, ms) {
  if (!Number.isFinite(bytes) || !Number.isFinite(ms) || bytes <= 0 || ms <= 0) return null;
  return Math.round(((bytes * 8) / (ms / 1000) / 1e6) * 100) / 100;
}

/** Écriture sans tampon applicatif : un relevé interrompu reste exploitable. */
export function createLog(path) {
  mkdirSync(dirname(path), { recursive: true });
  const flux = createWriteStream(path, { flags: "a" });
  let lines = 0;

  return {
    path,
    write(recording) {
      lines += 1;
      flux.write(`${JSON.stringify({ t: Date.now(), ...recording })}\n`);
    },
    get lines() {
      return lines;
    },
    close() {
      return new Promise((resolve) => flux.end(resolve));
    },
  };
}
