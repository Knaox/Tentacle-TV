/**
 * Commandes du lecteur, exposées à la page.
 *
 * Mêmes noms et mêmes évènements que l'app Tauri (`mpv_*`, `mpv://event`,
 * `mpv://property-change`) : l'adaptateur côté web est donc le même, et rien
 * n'est dupliqué.
 */

import { z } from "zod";
import { getMainWindow } from "../window";
import { activerHdr, basculeEnCours, hdrActif, restaurerHdr } from "../video/hdr";
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

/** Diffuse vers la page, si elle est encore là. */
function send(channel: string, payload: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send(`tentacle:${channel}`, payload);
}

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
  if (gamma !== "pq" && gamma !== "hlg") return;
  if (hdrActif()) return;
  const ok = activerHdr();
  console.info(`[tentacle] contenu ${gamma} — bascule HDR de l'ecran : ${ok ? "ok" : "refusee"}`);
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
              if (p.event === "file-loaded") basculerSiHdr();
              send("mpv://event", p);
            },
            property: (p) => send("mpv://property-change", p),
          },
        );
        if (err) throw new Error(err);

        // La fenêtre de mpv naît de façon asynchrone : on la cherche, puis on
        // la maintient calée à chaque changement de géométrie. Sans ce suivi,
        // la vidéo garde la taille qu'elle avait au démarrage.
        video?.detach();
        video = new VideoWindow(parent);
        video.attach();
        const suivre = (): void => video?.align();
        win.on("resize", suivre);
        win.on("enter-full-screen", suivre);
        win.on("leave-full-screen", suivre);

        return "ok";
      },
    })
    .add("mpv_destroy", {
      schema: NO_ARGS,
      run: () => {
        video?.detach();
        video = null;
        destroy();
        // L'écran est rendu tel qu'on l'a trouvé, systématiquement. Un écran
        // laissé en HDR délave tout le reste de Windows.
        restaurerHdr();
      },
    })
    .add("mpv_command", {
      schema: COMMAND,
      run: ({ name, args }) => {
        const err = command([name, ...(args ?? []).map(String)]);
        if (err) throw new Error(`${name} : ${err}`);
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
        // `transparent` est figé à la fabrication de la fenêtre ; la COULEUR de
        // fond, non. Passer en `#00000000` laisse voir la fenêtre vidéo placée
        // dessous, revenir au noir opaque la masque. C'est l'équivalent Electron
        // de la bascule que l'app Tauri fait sur la webview — et il faut la
        // faire, une transparence permanente sort Windows du chemin de
        // présentation opaque et fait scintiller chaque transition.
        getMainWindow()?.setBackgroundColor(on ? "#00000000" : "#000000");
      },
    })
    .add("mpv_harden_child_window", {
      schema: NO_ARGS,
      run: () => video?.harden() ?? false,
    })
    .add("display_hdr_state", {
      schema: NO_ARGS,
      run: () => ({
        actif: hdrActif(),
        bascule: basculeEnCours(),
        autoAutorise: hdrAutoAutorise,
      }),
    })
    .add("display_hdr_auto", {
      schema: SURFACE,
      run: ({ on }) => {
        hdrAutoAutorise = on;
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
