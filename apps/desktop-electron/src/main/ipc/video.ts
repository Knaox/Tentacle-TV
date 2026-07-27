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
import { basculeEnCours, hdrActif, hdrSupporte } from "../video/hdr";
import { accorder, autoriserBascule, basculeAutorisee, terminer } from "../video/hdrSession";
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
              if (p.event === "file-loaded" || p.event === "video-reconfig") accorder();
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
        // AVANT `destroy()` : après, mpv n'est plus là pour entendre qu'on
        // coupe la transmission. L'écran est rendu dans la foulée — un écran
        // qu'on a basculé et laissé en HDR délave tout le reste de Windows.
        terminer();
        destroy();
      },
    })
    .add("mpv_command", {
      schema: COMMAND,
      run: async ({ name, args }) => {
        const liste = (args ?? []).map(String);
        // `await` : la commande ne bloque plus le processus principal, elle
        // attend sa réponse dans la file d'évènements. Un `sub-add` vers une
        // source injoignable prend donc son temps sans geler l'application.
        const err = await command([name, ...liste]);
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
        autoAutorise: basculeAutorisee(),
      }),
    })
    .add("display_hdr_auto", {
      schema: SURFACE,
      run: ({ on }) => autoriserBascule(on),
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
  terminer();
}
