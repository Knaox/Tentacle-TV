/**
 * Politique HDR d'une session de lecture : ce qu'on demande à l'écran, et ce
 * qu'on demande à mpv.
 *
 * `hdr.ts` sait parler à Windows, `mpv.ts` sait parler à mpv. Ce module-ci est
 * le seul à savoir que les deux doivent s'accorder — et c'est précisément ce
 * qui manquait quand ils vivaient chacun de leur côté.
 */

import { enableHdr, hdrActive, restoreHdr } from "./displayHdr";
import { getProperty, setProperty } from "./mpv";

/**
 * La bascule automatique de l'écran en HDR est-elle autorisée ?
 *
 * La POLITIQUE appartient à la page — c'est elle qui connaît la préférence de
 * l'utilisateur ; le MÉCANISME appartient au processus principal, seul à
 * pouvoir lire le gamma du média dès son ouverture et à parler à Windows.
 *
 * Éteinte par défaut : changer le mode d'un écran coûte une à deux secondes de
 * noir, et tous les lecteurs qui le proposent le laissent au choix. La page
 * l'allume à l'initialisation du lecteur si l'utilisateur l'a demandé.
 */
let allowed = false;

/** Dernier gamma constaté, pour ne journaliser qu'au changement. */
let lastGamma: string | null = null;

export function toggleAllowed(): boolean {
  return allowed;
}

/**
 * Laisse mpv transmettre le signal HDR tel quel, ou le lui interdit.
 *
 * # Pourquoi ça ne peut pas se décider séparément de l'écran
 *
 * `target-colorspace-hint` vaut `no` par défaut chez mpv, et c'est un choix
 * assumé de leur part : pousser du PQ vers un compositeur qui ne l'attend pas
 * donne n'importe quoi, donc la transmission est un opt-in.
 *
 * Conséquence, et c'est le défaut qu'on corrige : un écran en HDR SANS ce
 * drapeau donne le pire des deux mondes. mpv tone-mappe le PQ vers du SDR —
 * son comportement par défaut — pendant que Windows, lui, croit recevoir du
 * HDR et applique son propre remappage SDR → HDR par-dessus. L'image ressort
 * **délavée**, exactement le symptôme que `hdr.ts` décrit pour un écran laissé
 * en HDR en permanence.
 *
 * Les deux réglages ne valent que JOINTS :
 *
 *  - écran SDR + drapeau levé   → PQ vers un écran qui ne sait pas le lire :
 *    image quasi noire (mesuré, cf. `hdr.ts`) ;
 *  - écran HDR + drapeau baissé → tone-mapping remappé par Windows : délavé ;
 *  - écran HDR + drapeau levé   → transmission réelle. Le seul bon état.
 *
 * Sans effet si mpv n'est pas démarré : `setProperty` rend une erreur, il ne
 * lève pas.
 */
/**
 * ⚠️ macOS ne joue PAS à ce jeu, et y jouer casserait le HDR.
 *
 * Tout ce qui précède décrit une négociation Windows : un écran qu'on bascule,
 * un drapeau qu'on lève ensuite, et qu'on rabaisse en sortant. Sur macOS il n'y
 * a pas d'écran à basculer — l'EDR est accordé par le compositeur, fenêtre par
 * fenêtre — et `target-colorspace-hint` est posé UNE FOIS pour toutes dans les
 * options d'initialisation, où il conditionne la création de la couche Metal.
 *
 * Le rabaisser en vol n'aurait donc aucun bénéfice et un coût certain : il
 * suffit que la page décoche la préférence — ce qui appelle `finish()` — pour
 * que la transmission tombe à `no` en pleine lecture et que l'image reparte en
 * sRGB. La politique Windows est ici sans objet, pas seulement inutile.
 */
const NEGOTIATED_WITH_DISPLAY = process.platform === "win32";

function transmit(active: boolean): void {
  if (!NEGOTIATED_WITH_DISPLAY) return;
  // L'écriture reste SYNCHRONE sous Windows — la promesse y est déjà réglée
  // quand `setProperty` rend la main, seule la ligne de journal passe par un
  // microtask. Rien de ce qui suit ne dépend de son issue.
  void setProperty("target-colorspace-hint", active ? "yes" : "no").then((err) => {
    if (err) console.info(`[tentacle] HDR : transmission ${active ? "on" : "off"} — ${err}`);
  });
}

/**
 * Accorde l'écran et la sortie de mpv sur ce que le contenu demande.
 *
 * `pq` désigne HDR10 et Dolby Vision, `hlg` la diffusion. Tout le reste est du
 * SDR et n'a rien à gagner à ce que l'écran change de mode — il y perdrait
 * même, Windows délavant alors tout le contenu SDR.
 *
 * # La préférence gouverne la BASCULE, jamais la transmission
 *
 * C'est la distinction qui manquait, et elle se voyait sur le poste le plus
 * simple qui soit : un écran laissé en HDR en permanence par son propriétaire.
 * Il n'a rien à basculer, donc aucune raison de cocher l'option — et comme la
 * fonction sortait sur « préférence éteinte » dès sa première ligne, la
 * transmission n'était jamais levée. mpv tone-mappait, Windows remappait, et
 * chaque film HDR sortait délavé. Le panneau F9 le disait déjà noir sur blanc :
 * « contenu pq → sortie srgb — TONE-MAPPE ».
 *
 * La préférence coûte une à deux secondes de noir : c'est CE changement d'état
 * qui appartient à l'utilisateur. Transmettre du HDR à un écran qui est déjà en
 * HDR ne lui coûte rien et ne change rien à son bureau — le lui faire demander
 * serait lui faire payer un choix qu'il a déjà fait.
 *
 * À appeler sur `file-loaded` ET `video-reconfig`.
 */
export function grant(): void {
  // Sous Linux il n'y a rien à négocier non plus, mais il y a quelque chose à
  // CONSTATER : ce que mpv envoie réellement à l'écran. C'est le seul témoin
  // qui distingue une transmission d'un tone-mapping. Voir `linux/hdr.ts`.
  if (process.platform === "linux") {
    (require("../linux/hdr") as typeof import("../linux/hdr")).recordOutput();
  }
  // ⚠️ SORTIE IMMÉDIATE SUR macOS : il n'y a rien à accorder, l'EDR y étant
  // alloué par le compositeur fenêtre par fenêtre (voir `displayHdr.ts`).
  if (!NEGOTIATED_WITH_DISPLAY) return;

  // Une seule évaluation à la fois. `accorder` est appelée sur `file-loaded`
  // ET sur `video-reconfig`, qui se suivent parfois de très près ; la lecture
  // étant devenue asynchrone, deux évaluations pourraient sinon s'entrelacer et
  // basculer l'écran deux fois.
  if (inProgress) return;
  inProgress = true;
  void getProperty("video-params/gamma")
    // ⚠️ `video-params/*` n'est PAS renseigné à `file-loaded` : mpv a ouvert le
    // fichier mais n'a pas encore configuré sa sortie vidéo. On sortait alors
    // sur « contenu ? » et la bascule n'avait jamais lieu — sauf coup de chance
    // de calendrier. D'où l'appel aussi sur `video-reconfig`, où les paramètres
    // sont valides : ici on attend, sans rien journaliser.
    .then((gamma) => {
      if (gamma !== null) evaluate(gamma);
    })
    .finally(() => {
      inProgress = false;
    });
}

/** Évaluation en cours ? Voir `grant`. */
let inProgress = false;

/** Ce que le gamma du contenu implique pour l'écran et pour la transmission. */
function evaluate(gamma: string): void {
  if (gamma !== "pq" && gamma !== "hlg") {
    if (lastGamma !== gamma) {
      console.info(`[tentacle] HDR : contenu ${gamma}, rien a transmettre`);
      lastGamma = gamma;
    }
    return;
  }

  // L'écran est-il DÉJÀ en HDR ? Alors il n'y a rien à basculer, seulement à
  // transmettre — et on ne réveille pas `activerHdr`, dont la mémoire d'état
  // d'origine servirait ensuite à « rendre » un écran qu'on n'a jamais pris.
  //
  // Pas de garde équivalente côté bascule en revanche : sur un poste à
  // plusieurs écrans, un seul déjà allumé suffisait à tout annuler.
  // `activerHdr` traite chaque cible séparément et est idempotente.
  const alreadyHdr = hdrActive();
  const toggle = !alreadyHdr && allowed && enableHdr();

  // STRICTEMENT conditionnée à un écran réellement en HDR. Réaffirmée à chaque
  // passage et pas seulement au premier : mpv reconstruit sa sortie sur
  // `video-reconfig`, et un drapeau posé avant qu'elle n'existe n'y survit pas
  // toujours.
  if (alreadyHdr || toggle) transmit(true);

  if (lastGamma === gamma) return;
  lastGamma = gamma;
  console.info(`[tentacle] HDR : contenu ${gamma} — ${reason(alreadyHdr, toggle)}`);
}

function reason(alreadyHdr: boolean, toggle: boolean): string {
  if (alreadyHdr) return "ecran deja en HDR, transmission seule";
  if (toggle) return "bascule ok";
  return allowed
    ? "bascule REFUSEE, tone-mapping"
    : "ecran SDR et bascule non autorisee, tone-mapping";
}

/**
 * Ferme la session : coupe la transmission, puis rend l'écran.
 *
 * L'ORDRE compte. L'inverse laisserait un signal PQ arriver sur un écran
 * redevenu SDR — l'image passe alors par le noir. `restaurerHdr` ne touche que
 * les écrans qu'on a soi-même basculés ; un écran que l'utilisateur avait mis
 * en HDR y reste, comme il se doit.
 */
export function finish(): void {
  transmit(false);
  restoreHdr();
  lastGamma = null;
}

/** Applique la préférence de la page. Éteinte en vol, elle rend l'écran. */
export function allowToggle(on: boolean): void {
  allowed = on;
  // Journalisé là seulement où la bascule existe : `displayHdr` ne parle qu'à
  // Windows. Sur macOS la ligne se répétait à chaque montage du lecteur et se
  // lisait comme « pas de HDR », alors qu'elle ne dit rien de la lecture — le
  // HDR y passe par mpv et la couche Metal, pas par un mode d'écran.
  if (process.platform === "win32") {
    console.info(`[tentacle] HDR : bascule automatique ${on ? "autorisee" : "refusee"}`);
  }
  // L'utilisateur qui décoche s'attend à voir l'effet tout de suite, pas à
  // devoir arrêter le film.
  if (!on) finish();
}
