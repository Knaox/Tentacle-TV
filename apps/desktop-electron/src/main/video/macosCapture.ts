/**
 * Compter les PIXELS de la fenêtre vidéo — la seule preuve qui vaille.
 *
 * # Pourquoi ce détour, et pourquoi il a tout débloqué
 *
 * « mpv joue, la fenêtre est calée, l'EDR est accordé » est parfaitement
 * compatible avec « l'écran reste noir ». Toute la phase 1 s'est perdue à
 * conclure « ça marche » sur des propriétés pendant que l'utilisateur voyait du
 * noir. On ne valide donc pas par des propriétés : on regarde l'image.
 *
 * ⚠️ `capturePage()` d'Electron ne convient PAS : il capture la vue Chromium,
 * pas la fenêtre de mpv qui est DERRIÈRE elle. Il donne une confirmation fausse,
 * ce qui est pire que rien. `screencapture -l <windowNumber>` vise la fenêtre
 * native, par le numéro que le serveur de fenêtres lui a donné.
 *
 * # Ce qu'on mesure, et pourquoi trois chiffres
 *
 * Une vidéo et un aplat noir ne se ressemblent sur AUCUN des trois : part de
 * pixels non noirs, écart-type des luminances, nombre de teintes distinctes.
 * Un seul d'entre eux se laisse tromper — une image très sombre a peu de pixels
 * non noirs, un dégradé a peu de teintes. Les trois ensemble, non.
 *
 * ⚠️ **macOS uniquement**, et **développement uniquement** : cette sonde lance
 * un exécutable du système, elle n'a rien à faire dans un paquet livré.
 */

import { execFile } from "node:child_process";
import { app } from "electron";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Chemin absolu : on ne s'en remet pas au `PATH` pour lancer un exécutable. */
const SCREENCAPTURE = "/usr/sbin/screencapture";

/** Une image sur seize suffit à trancher, et évite de parcourir 4 Mpx. */
const STEP = 4;

/** Au-delà, la luminance n'est plus du noir de bandes ni du noir de fond. */
const BLACK_THRESHOLD = 8;

/** Combien de temps on laisse `screencapture` répondre. */
const DELAY_MS = 10_000;

export interface ImageStats {
  largeur: number;
  hauteur: number;
  /** Part de pixels non noirs, de 0 à 1. */
  nonNoirs: number;
  /** Luminance moyenne, de 0 à 255. */
  moyenne: number;
  /** Écart-type des luminances — un aplat vaut zéro. */
  ecartType: number;
  /** Teintes distinctes, à cinq bits par canal. */
  teintes: number;
}

/** L'en-tête d'un BMP, ce qu'il faut en savoir pour lire les pixels. */
interface Header {
  offset: number;
  largeur: number;
  hauteur: number;
  bytesPerPixel: number;
  step: number;
  /** Hauteur négative : les lignes sont stockées de haut en bas. */
  topDown: boolean;
}

function readHeader(header: Buffer): Header {
  if (header.readUInt16LE(0) !== 0x4d42) throw new Error("capture illisible (pas un BMP)");
  const width = header.readInt32LE(18);
  const rawHeight = header.readInt32LE(22);
  const bits = header.readUInt16LE(28);
  if (bits !== 24 && bits !== 32) throw new Error(`capture en ${String(bits)} bits, non gérée`);
  const bytesPerPixel = bits / 8;
  return {
    offset: header.readUInt32LE(10),
    largeur: width,
    hauteur: Math.abs(rawHeight),
    bytesPerPixel,
    // Les lignes sont alignées sur quatre octets, quelle que soit la largeur.
    step: Math.ceil((width * bytesPerPixel) / 4) * 4,
    topDown: rawHeight < 0,
  };
}

/**
 * Parcourt les lignes retenues, une par une.
 *
 * ⚠️ Le fichier n'est JAMAIS chargé en entier : une capture d'un écran 4K pèse
 * 33 Mo, et la sonde tourne pendant une lecture vidéo. On ne garde qu'un tampon
 * d'une ligne — dix kilo-octets — réutilisé d'un bout à l'autre.
 */
async function walk(filePath: string): Promise<ImageStats> {
  const file = await open(filePath, "r");
  try {
    const raw = Buffer.alloc(54);
    await file.read(raw, 0, raw.length, 0);
    const t = readHeader(raw);

    const line = Buffer.alloc(t.step);
    const hues = new Set<number>();
    let total = 0;
    let nonBlack = 0;
    let sum = 0;
    let sumSquares = 0;

    for (let y = 0; y < t.hauteur; y += STEP) {
      await file.read(line, 0, t.step, t.offset + y * t.step);
      for (let x = 0; x < t.largeur; x += STEP) {
        const p = x * t.bytesPerPixel;
        const b = line[p] ?? 0;
        const v = line[p + 1] ?? 0;
        const r = line[p + 2] ?? 0;
        // Luminance perçue (Rec. 601) : le vert pèse six fois le bleu, et une
        // moyenne arithmétique ferait passer un aplat bleu pour de l'image.
        const luminance = (r * 299 + v * 587 + b * 114) / 1000;
        total += 1;
        if (luminance > BLACK_THRESHOLD) nonBlack += 1;
        sum += luminance;
        sumSquares += luminance * luminance;
        hues.add(((r >> 3) << 10) | ((v >> 3) << 5) | (b >> 3));
      }
    }

    const mean = total === 0 ? 0 : sum / total;
    return {
      largeur: t.largeur,
      hauteur: t.hauteur,
      nonNoirs: total === 0 ? 0 : nonBlack / total,
      moyenne: mean,
      ecartType: Math.sqrt(Math.max(0, sumSquares / total - mean * mean)),
      teintes: hues.size,
    };
  } finally {
    await file.close();
  }
}

let counter = 0;

/**
 * Capture une fenêtre par son numéro et rend ce que l'image contient.
 *
 * Lève quand la capture échoue — autorisation « Enregistrement de l'écran »
 * refusée, ou numéro de fenêtre périmé. ⚠️ Ces deux cas ne se corrigent PAS
 * comme une image noire, et les confondre ferait chercher au mauvais endroit :
 * le message est donc remonté tel quel, jamais transformé en « rien à voir ».
 */
export async function captureWindow(number: number): Promise<ImageStats> {
  counter += 1;
  const filePath = path.join(
    app.getPath("temp"),
    `tentacle-surface-${String(process.pid)}-${String(counter)}.bmp`,
  );
  try {
    // `-o` retire l'ombre portée, `-x` le bruit de l'obturateur.
    await run(SCREENCAPTURE, ["-l", String(number), "-o", "-x", "-t", "bmp", filePath], {
      timeout: DELAY_MS,
    });
    return await walk(filePath);
  } finally {
    await rm(filePath, { force: true });
  }
}
