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

const executer = promisify(execFile);

/** Chemin absolu : on ne s'en remet pas au `PATH` pour lancer un exécutable. */
const SCREENCAPTURE = "/usr/sbin/screencapture";

/** Une image sur seize suffit à trancher, et évite de parcourir 4 Mpx. */
const PAS = 4;

/** Au-delà, la luminance n'est plus du noir de bandes ni du noir de fond. */
const SEUIL_NOIR = 8;

/** Combien de temps on laisse `screencapture` répondre. */
const DELAI_MS = 10_000;

export interface StatistiquesImage {
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
interface EnTete {
  offset: number;
  largeur: number;
  hauteur: number;
  octetsParPixel: number;
  pas: number;
  /** Hauteur négative : les lignes sont stockées de haut en bas. */
  hautEnBas: boolean;
}

function lireEnTete(entete: Buffer): EnTete {
  if (entete.readUInt16LE(0) !== 0x4d42) throw new Error("capture illisible (pas un BMP)");
  const largeur = entete.readInt32LE(18);
  const hauteurBrute = entete.readInt32LE(22);
  const bits = entete.readUInt16LE(28);
  if (bits !== 24 && bits !== 32) throw new Error(`capture en ${String(bits)} bits, non gérée`);
  const octetsParPixel = bits / 8;
  return {
    offset: entete.readUInt32LE(10),
    largeur,
    hauteur: Math.abs(hauteurBrute),
    octetsParPixel,
    // Les lignes sont alignées sur quatre octets, quelle que soit la largeur.
    pas: Math.ceil((largeur * octetsParPixel) / 4) * 4,
    hautEnBas: hauteurBrute < 0,
  };
}

/**
 * Parcourt les lignes retenues, une par une.
 *
 * ⚠️ Le fichier n'est JAMAIS chargé en entier : une capture d'un écran 4K pèse
 * 33 Mo, et la sonde tourne pendant une lecture vidéo. On ne garde qu'un tampon
 * d'une ligne — dix kilo-octets — réutilisé d'un bout à l'autre.
 */
async function parcourir(chemin: string): Promise<StatistiquesImage> {
  const fichier = await open(chemin, "r");
  try {
    const brut = Buffer.alloc(54);
    await fichier.read(brut, 0, brut.length, 0);
    const t = lireEnTete(brut);

    const ligne = Buffer.alloc(t.pas);
    const teintes = new Set<number>();
    let total = 0;
    let nonNoirs = 0;
    let somme = 0;
    let sommeCarres = 0;

    for (let y = 0; y < t.hauteur; y += PAS) {
      await fichier.read(ligne, 0, t.pas, t.offset + y * t.pas);
      for (let x = 0; x < t.largeur; x += PAS) {
        const p = x * t.octetsParPixel;
        const b = ligne[p] ?? 0;
        const v = ligne[p + 1] ?? 0;
        const r = ligne[p + 2] ?? 0;
        // Luminance perçue (Rec. 601) : le vert pèse six fois le bleu, et une
        // moyenne arithmétique ferait passer un aplat bleu pour de l'image.
        const luminance = (r * 299 + v * 587 + b * 114) / 1000;
        total += 1;
        if (luminance > SEUIL_NOIR) nonNoirs += 1;
        somme += luminance;
        sommeCarres += luminance * luminance;
        teintes.add(((r >> 3) << 10) | ((v >> 3) << 5) | (b >> 3));
      }
    }

    const moyenne = total === 0 ? 0 : somme / total;
    return {
      largeur: t.largeur,
      hauteur: t.hauteur,
      nonNoirs: total === 0 ? 0 : nonNoirs / total,
      moyenne,
      ecartType: Math.sqrt(Math.max(0, sommeCarres / total - moyenne * moyenne)),
      teintes: teintes.size,
    };
  } finally {
    await fichier.close();
  }
}

let compteur = 0;

/**
 * Capture une fenêtre par son numéro et rend ce que l'image contient.
 *
 * Lève quand la capture échoue — autorisation « Enregistrement de l'écran »
 * refusée, ou numéro de fenêtre périmé. ⚠️ Ces deux cas ne se corrigent PAS
 * comme une image noire, et les confondre ferait chercher au mauvais endroit :
 * le message est donc remonté tel quel, jamais transformé en « rien à voir ».
 */
export async function capturerFenetre(numero: number): Promise<StatistiquesImage> {
  compteur += 1;
  const chemin = path.join(
    app.getPath("temp"),
    `tentacle-surface-${String(process.pid)}-${String(compteur)}.bmp`,
  );
  try {
    // `-o` retire l'ombre portée, `-x` le bruit de l'obturateur.
    await executer(SCREENCAPTURE, ["-l", String(numero), "-o", "-x", "-t", "bmp", chemin], {
      timeout: DELAI_MS,
    });
    return await parcourir(chemin);
  } finally {
    await rm(chemin, { force: true });
  }
}
