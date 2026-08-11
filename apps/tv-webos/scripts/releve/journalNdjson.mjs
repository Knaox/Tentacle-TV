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
export function classerRequete(url) {
  if (typeof url !== "string" || !url) return "autre";
  const chemin = url.split("?")[0];
  if (/\/hls1\//.test(chemin)) return chemin.endsWith(".m3u8") ? "manifeste" : "segment";
  if (/\.m3u8$/.test(chemin)) return "manifeste";
  if (/\/(stream|universal)(\.[a-z0-9]+)?$/i.test(chemin)) return "flux";
  return "autre";
}

/**
 * Débit réellement obtenu, en mégabits par seconde.
 *
 * C'est lui qui départage une famine de livraison d'un défaut de décodage : un
 * segment de six secondes de média qui met sept secondes à descendre affame le
 * lecteur, quel que soit le débit annoncé par le manifeste.
 */
export function debitEffectif(octets, ms) {
  if (!Number.isFinite(octets) || !Number.isFinite(ms) || octets <= 0 || ms <= 0) return null;
  return Math.round(((octets * 8) / (ms / 1000) / 1e6) * 100) / 100;
}

/** Écriture sans tampon applicatif : un relevé interrompu reste exploitable. */
export function creerJournal(chemin) {
  mkdirSync(dirname(chemin), { recursive: true });
  const flux = createWriteStream(chemin, { flags: "a" });
  let lignes = 0;

  return {
    chemin,
    ecrire(enregistrement) {
      lignes += 1;
      flux.write(`${JSON.stringify({ t: Date.now(), ...enregistrement })}\n`);
    },
    get lignes() {
      return lignes;
    },
    fermer() {
      return new Promise((resoudre) => flux.end(resoudre));
    },
  };
}
