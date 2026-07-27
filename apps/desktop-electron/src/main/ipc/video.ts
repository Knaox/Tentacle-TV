/**
 * Commandes du lecteur, exposées à la page.
 *
 * Mêmes noms et mêmes évènements que l'app Tauri (`mpv_*`, `mpv://event`,
 * `mpv://property-change`) : l'adaptateur côté web est donc le même, et rien
 * n'est dupliqué.
 */

import { z } from "zod";
import { sendToPage } from "../pageEvents";
import { getMainWindow, setPlayerSurfaceTransparent } from "../window";
import { activerHdr, basculeEnCours, hdrSupporte, restaurerHdr, hdrActif } from "../video/hdr";
import { command, destroy, getProperty, init, setProperty } from "../video/mpv";
import { nativeHandle, VideoWindow } from "../video/videoWindow";
import { CommandRegistry } from "./registry";

/** Valeur scalaire acceptée par mpv. */
const SCALAR = z.union([z.string(), z.number(), z.boolean()]);

// Forme envoyée par l'adaptateur web, à respecter au caractère près :
//   { options: { initialOptions: {...}, observedProperties: [[nom, format], ...] } }
// Une propriété observée peut porter un troisième élément (`["time-pos",
// "double", "none"]`), d'où le `.rest()`.
//
// Champs `optional()` plutôt que `default()` : sous `exactOptionalPropertyTypes`,
// le type de sortie d'un `ZodDefault` traîne encore `undefined`, et la valeur de
// repli se lit mieux au point d'utilisation.
const OBSERVED = z.array(z.tuple([z.string(), z.string()]).rest(z.unknown()));
const INIT = z.object({
  options: z
    .object({
      initialOptions: z.record(SCALAR).optional(),
      observedProperties: OBSERVED.optional(),
    })
    .optional(),
});
const COMMAND = z.object({ name: z.string(), args: z.array(SCALAR).optional() });
const SURFACE = z.object({ on: z.boolean() });
const SET_PROPERTY = z.object({ name: z.string(), value: SCALAR });
const GET_PROPERTY = z.object({ name: z.string(), format: z.string().optional() });
const NO_ARGS = z.object({}).passthrough();

let video: VideoWindow | null = null;

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
let hdrAutoAutorise = false;

/** Dernier gamma constaté, pour ne journaliser qu'au changement. */
let dernierGamma: string | null = null;

/**
 * Bascule l'écran en HDR si, et seulement si, le contenu en a besoin.
 *
 * `pq` désigne HDR10 et Dolby Vision, `hlg` la diffusion. Tout le reste est du
 * SDR et n'a rien à gagner à ce que l'écran change de mode — il y perdrait
 * même, Windows délavant alors tout le contenu SDR.
 */
function basculerSiHdr(): void {
  if (!hdrAutoAutorise) return;

  const gamma = getProperty("video-params/gamma");

  // ⚠️ `video-params/*` n'est PAS renseigné à `file-loaded` : mpv a ouvert le
  // fichier mais n'a pas encore configuré sa sortie vidéo. On sortait donc sur
  // « contenu ? » et la bascule n'avait jamais lieu — sauf coup de chance de
  // calendrier. D'où l'appel aussi sur `video-reconfig`, où les paramètres sont
  // valides : ici on se contente d'attendre, sans rien journaliser.
  if (gamma === null) return;

  if (gamma !== "pq" && gamma !== "hlg") {
    if (dernierGamma !== gamma) {
      console.info(`[tentacle] HDR : contenu ${gamma}, pas de bascule a faire`);
      dernierGamma = gamma;
    }
    return;
  }
  // `video-reconfig` se répète (changement de piste, de résolution) : on ne
  // journalise qu'au changement, l'action restant idempotente.
  if (dernierGamma === gamma) {
    activerHdr();
    return;
  }
  dernierGamma = gamma;

  // Pas de garde « un ecran est deja en HDR » : sur un poste a plusieurs
  // ecrans, un seul deja allume suffisait a tout annuler — et la memoire de
  // l'etat d'origine n'etait alors jamais posee, donc rien n'etait rendu.
  // `activerHdr` traite chaque cible separement et est idempotente.
  const ok = activerHdr();
  console.info(`[tentacle] HDR : contenu ${gamma} — bascule ${ok ? "ok" : "REFUSEE"}`);
}

export function registerVideoCommands(registry: CommandRegistry): void {
  registry
    .add("mpv_init", {
      schema: INIT,
      run: ({ options }) => {
        const win = getMainWindow();
        if (!win) throw new Error("aucune fenetre pour accueillir la video");

        const observed = (options?.observedProperties ?? []).map(
          ([name, format]) => [name, format] as const,
        );
        const parent = nativeHandle(win);
        const err = init(
          { options: options?.initialOptions ?? {}, observed, wid: parent },
          {
            event: (p) => {
              // Le contenu ne se déclare qu'une fois le fichier ouvert : c'est
              // le seul moment où l'on sait s'il faut basculer l'écran. Comme
              // tous les bons lecteurs, on le fait UNE fois au démarrage de la
              // lecture — changer le mode d'un écran coûte une à deux secondes
              // de noir pendant la resynchronisation, hors de question de le
              // refaire en cours de route.
              // `file-loaded` d'abord — au cas où les paramètres seraient déjà
              // là — puis `video-reconfig`, où ils le sont à coup sûr : c'est
              // l'évènement que mpv émet quand il a configuré sa sortie vidéo.
              if (p.event === "file-loaded" || p.event === "video-reconfig") basculerSiHdr();
              sendToPage("mpv://event", p);
            },
            property: (p) => sendToPage("mpv://property-change", p),
          },
        );
        if (err) throw new Error(err);

        // La fenêtre de mpv naît de façon asynchrone : `attach` la cherche,
        // puis la désarme et la maintient calée à chaque changement de
        // géométrie. Les écouteurs de la fenêtre principale appartiennent à
        // `VideoWindow` et partent avec elle — posés ici, rien ne les retirait,
        // et le lecteur est remonté à chaque épisode.
        video?.detach();
        video = new VideoWindow(win);
        video.attach();

        return "ok";
      },
    })
    .add("mpv_destroy", {
      schema: NO_ARGS,
      run: () => {
        video?.detach();
        video = null;
        destroy();
        dernierGamma = null;
        // L'écran est rendu tel qu'on l'a trouvé, systématiquement. Un écran
        // laissé en HDR délave tout le reste de Windows.
        restaurerHdr();
      },
    })
    .add("mpv_command", {
      schema: COMMAND,
      run: ({ name, args }) => {
        const liste = (args ?? []).map(String);
        const err = command([name, ...liste]);
        // Les ARGUMENTS dans le message, sans quoi « set : erreur » ne désigne
        // rien : `set` sert à écrire n'importe quelle propriété, et l'erreur
        // vient précisément de laquelle.
        if (err) throw new Error(`${name} ${liste.join(" ")} : ${err}`);
      },
    })
    .add("mpv_set_property", {
      schema: SET_PROPERTY,
      run: ({ name, value }) => {
        const err = setProperty(
          name,
          typeof value === "boolean" ? (value ? "yes" : "no") : String(value),
        );
        if (err) throw new Error(`${name} : ${err}`);
      },
    })
    .add("mpv_get_property", {
      schema: GET_PROPERTY,
      run: ({ name, format }) => {
        const raw = getProperty(name);
        if (raw === null) return null;
        // mpv ne rend que des chaînes par cette porte ; on retype selon ce que
        // la page a demandé, comme le fait déjà le côté Rust.
        if (format === "flag") return raw === "yes" || raw === "true";
        if (format === "int64" || format === "double") {
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        }
        return raw;
      },
    })
    .add("player_surface_transparent", {
      schema: SURFACE,
      run: ({ on }) => {
        // Contre-intuitif au regard de la documentation d'Electron, qui lie
        // l'alpha au drapeau `transparent` de la fabrication — mais mesuré sur
        // maquette : appliqué à l'exécution, il fonctionne sans ce drapeau, et
        // la fenêtre garde alors son cadre, son redimensionnement et son plein
        // écran. Même partage que l'app Tauri (`mpv_window.rs:78`).
        //
        // La fenêtre garde la mémoire de cet état : elle en a besoin pour
        // relancer sa composition à la sortie du plein écran.
        setPlayerSurfaceTransparent(on);
      },
    })
    .add("mpv_harden_child_window", {
      schema: NO_ARGS,
      // Le durcissement RÉEL a lieu dans `VideoWindow.attach`, dès que la
      // fenêtre de mpv existe. Cette commande n'est plus qu'un rappel : la page
      // l'appelle immédiatement après `mpv_init`, quelques millisecondes avant
      // que mpv n'ait créé sa fenêtre — elle rendait donc `false` en silence, et
      // rien n'était jamais désarmé. Conservée parce que le contrat avec la page
      // est partagé avec l'app Tauri, et qu'elle ne coûte rien.
      run: () => video?.harden() ?? false,
    })
    .add("display_hdr_state", {
      schema: NO_ARGS,
      run: () => ({
        supporte: hdrSupporte(),
        actif: hdrActif(),
        bascule: basculeEnCours(),
        autoAutorise: hdrAutoAutorise,
      }),
    })
    .add("display_hdr_auto", {
      schema: SURFACE,
      run: ({ on }) => {
        hdrAutoAutorise = on;
        console.info(`[tentacle] HDR : bascule automatique ${on ? "autorisee" : "refusee"}`);
        // Désactivée en cours de lecture, la préférence rend l'écran tout de
        // suite : l'utilisateur qui décoche s'attend à voir l'effet, pas à
        // devoir arrêter le film.
        if (!on) restaurerHdr();
      },
    });
}

/**
 * Rend l'écran à son état d'origine, quoi qu'il arrive.
 *
 * Filet de sécurité pour la fermeture, y compris brutale : un écran laissé en
 * HDR délave tout Windows, et l'utilisateur n'aurait aucune raison de faire le
 * lien avec une application fermée.
 */
export function restaurerEcran(): void {
  restaurerHdr();
}
