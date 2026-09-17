/**
 * Commandes du lecteur, exposées à la page.
 *
 * Mêmes noms et mêmes évènements que l'app Tauri (`mpv_*`, `mpv://event`,
 * `mpv://property-change`) : l'adaptateur côté web est donc le même, et rien
 * n'est dupliqué.
 */

import { z } from "zod";
import { getMainWindow, setPlayerSurfaceTransparent } from "../window";
import { finish } from "../video/hdrSession";
import { stop } from "../video/mpvShutdown";
import { command, destroy, getProperty, init, isRunning, setProperty } from "../video/mpv";
import { libmpvAvailable } from "../video/mpvFfi";
import { refuseCommand, refuseWrite } from "../video/mpvAllowlist";
import { nativeHandle, trace } from "../video/native";
import { beginStartup, forgetStartup, markStartup } from "../video/startupClock";
import { createVideoSurface, videoMontage, type VideoSurface } from "../video/surface";
import { assembleInitOptions } from "./videoInitOptions";
import { eventRelay } from "./videoEvents";
import { registerDisplayHdrCommands } from "./videoHdr";
import { registerVideoProbe, resetReport } from "./videoProbe";
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

let video: VideoSurface | null = null;

/**
 * Arrête le lecteur, par le chemin que la plateforme supporte.
 *
 * ⚠️ macOS ne peut PAS détruire d'un bloc : `mpv_terminate_destroy` y attend le
 * démontage de la sortie vidéo, lequel réclame le thread principal — celui qui
 * appelle. Linux le PEUT, mais au prix d'une seconde de gel : l'appel est un
 * FFI synchrone qui joint démuxeur, décodage et contexte Vulkan, et la fenêtre
 * de mpv — de premier niveau chez nous, jamais enfant — n'est démontée qu'en
 * dernier : elle restait seule à l'écran tout ce temps. Les deux prennent donc
 * l'arrêt gracieux (voir `mpvShutdown.ts`) : la vidéo d'abord, sans bloquer.
 * Sous Linux le témoin est l'évènement `idle` de mpv, émis une fois la sortie
 * vidéo — et sa fenêtre — détruite : `quit` part aussitôt, là où dix tours
 * de 50 ms l'attendaient. Windows détruit comme il l'a toujours fait
 * (fenêtre enfant Win32, aucun couplage, en production).
 *
 * L'ORDRE compte : mpv s'arrête AVANT le détachement. L'inverse rendrait la
 * fenêtre de mpv indépendante le temps de sa mort, donc visible seule à
 * l'écran — et `SurfaceWayland.detach` sort du plein écran, ce qui ne doit
 * arriver qu'une fois la vidéo partie.
 *
 * EXPORTÉE pour un second appelant : la séquence de fermeture (`closeSequence.ts`)
 * s'en sert sous Linux, où la fenêtre de mpv survivrait sinon à la nôtre.
 */
export async function stopPlayer(): Promise<void> {
  const surface = video;
  video = null;
  // ⚠️ AVANT l'arrêt, et seule la Render API s'en sert : son contexte de rendu
  // doit être libéré pendant que mpv est encore debout. L'inverse fait
  // s'attendre les deux — `mpv_render_context_free` attend la fin du rendu en
  // cours, et mpv démonte sa sortie vidéo à l'arrêt.
  surface?.preStop?.();
  if (process.platform !== "win32") {
    const witness = surface?.videoGone?.bind(surface);
    await stop(witness);
  } else {
    destroy();
  }
  surface?.detach();
}

export function registerVideoCommands(registry: CommandRegistry): void {
  // Sans libmpv chargeable, les commandes mpv ne sont pas DÉCLARÉES : la liste
  // des capacités les tait, `supportsMpv()` côté page devient honnête, et le
  // lecteur route de lui-même sur le lecteur web — sans payer huit secondes
  // d'init vouée à l'échec. Linux seulement : c'est la seule plateforme où la
  // bibliothèque peut légitimement manquer (repli sur la distribution) ;
  // macOS et Windows gardent leur échec bruyant, qui a valeur d'alerte.
  // Les commandes HDR, elles, restent déclarées sans condition (`videoHdr.ts`).
  const nativePlayer = process.platform !== "linux" || libmpvAvailable();
  if (!nativePlayer) {
    console.warn(
      "[mpv] aucune libmpv chargeable : lecteur natif tu, la page utilisera le lecteur web",
    );
  }
  if (nativePlayer) registerMpvCommands(registry);
  registerDisplayHdrCommands(registry, () => video);

  // Sans effet hors macOS et hors développement — la commande n'est alors même
  // pas déclarée, et la page cesse d'elle-même de proposer la sonde.
  registerVideoProbe(registry, () => video);
}

function registerMpvCommands(registry: CommandRegistry): void {
  registry
    .add("mpv_init", {
      schema: INIT,
      run: async ({ options }) => {
        // L'horloge part ICI, avant l'arrêt du précédent : au changement
        // d'épisode, c'est lui que la page attend en premier (`startupClock.ts`).
        beginStartup();
        const win = getMainWindow();
        if (!win) throw new Error("aucune fenetre pour accueillir la video");

        // Une instance encore vivante doit partir par la porte que la
        // plateforme supporte. `init` fait bien un `destroy()` de son côté,
        // mais celui-ci est l'arrêt de SECOURS : sur macOS il ne convient
        // qu'en l'absence de sortie vidéo. La page appelle normalement
        // `mpv_destroy` avant de remonter le lecteur ; ceci couvre le cas où
        // elle ne l'a pas fait — un changement d'épisode qui se chevauche.
        if (isRunning()) {
          await stopPlayer();
          markStartup("previous-stopped");
        }

        const observed = (options?.observedProperties ?? []).map(
          ([name, format]) => [name, format] as const,
        );
        // Ce que la page demande, ce que la coquille y ajoute, ce que le
        // montage réécrit : `videoInitOptions.ts`.
        const mpvOptions = await assembleInitOptions(win, options?.initialOptions ?? {});
        const parent = nativeHandle(win);
        const err = init(
          { options: mpvOptions, observed, wid: parent },
          eventRelay(() => video),
        );
        if (err) throw new Error(err);
        markStartup("init");

        // Le journal doit dire ce que mpv a REELLEMENT recu : une option
        // ecartee par la liste blanche l'est en SILENCE, et le defaut ne se
        // voit alors qu'a l'image — un ecran noir sans un mot.
        trace(
          `mpv demarre — montage ${videoMontage()}, ` +
            `${Object.keys(mpvOptions).length} options retenues (vo=${String(mpvOptions["vo"] ?? "?")}` +
            `, target-trc=${String(mpvOptions["target-trc"] ?? "-")}` +
            `, target-peak=${String(mpvOptions["target-peak"] ?? "-")}` +
            `, gpu-context=${String(mpvOptions["gpu-context"] ?? "-")})`,
        );

        // La fenêtre de mpv naît de façon asynchrone : `attach` la cherche,
        // puis la désarme et la maintient calée à chaque changement de
        // géométrie. Les écouteurs de la fenêtre principale appartiennent à
        // `VideoWindow` et partent avec elle — posés ici, rien ne les retirait,
        // et le lecteur est remonté à chaque épisode.
        video?.detach();
        video = createVideoSurface(win);
        await video.attach();
        markStartup("attach");
        resetReport();

        return "ok";
      },
    })
    .add("mpv_destroy", {
      schema: NO_ARGS,
      run: async () => {
        // AVANT l'arrêt : après, mpv n'est plus là pour entendre qu'on coupe la
        // transmission. L'écran est rendu dans la foulée — un écran qu'on a
        // basculé et laissé en HDR délave tout le reste de Windows.
        finish();
        forgetStartup();
        await stopPlayer();
      },
    })
    .add("mpv_command", {
      schema: COMMAND,
      run: async ({ name, args }) => {
        const list = (args ?? []).map(String);
        // Liste blanche AVANT tout : la libmpv du dépôt expose `run`,
        // `subprocess` et `load-script` — vérifié par sonde. Sans ce garde, la
        // page pouvait lancer un programme hors du bac à sable.
        const refusal = refuseCommand(name, list);
        if (refusal !== null) throw new Error(refusal);
        if (name === "loadfile") markStartup("loadfile");
        // `await` : la commande ne bloque plus le processus principal, elle
        // attend sa réponse dans la file d'évènements. Un `sub-add` vers une
        // source injoignable prend donc son temps sans geler l'application.
        const err = await command([name, ...list]);
        // Les ARGUMENTS ne sont PAS dans le message. Ils y étaient, pour que
        // « set : erreur » désigne quelque chose — mais l'URL d'un `sub-add` ou
        // d'un `loadfile` porte le jeton Jellyfin, et ce message part dans le
        // journal du processus principal (`ipc/registry.ts`). Le nom de la
        // commande et, pour `set`, celui de la propriété refusée suffisent à
        // situer l'erreur ; ni l'un ni l'autre n'est un secret.
        if (err) throw new Error(`${name} : ${err}`);
      },
    })
    .add("mpv_set_property", {
      schema: SET_PROPERTY,
      run: async ({ name, value }) => {
        const refusal = refuseWrite(name);
        if (refusal !== null) throw new Error(refusal);
        // `await` : hors Windows l'écriture passe par la file de commandes et
        // attend sa réponse dans la file d'évènements — sur macOS elle figerait
        // sinon le thread principal, sous Linux elle le retiendrait (voir
        // `mpv.ts`). Sous Windows la promesse est déjà résolue.
        const err = await setProperty(
          name,
          typeof value === "boolean" ? (value ? "yes" : "no") : String(value),
        );
        if (err) throw new Error(`${name} : ${err}`);
      },
    })
    .add("mpv_get_property", {
      schema: GET_PROPERTY,
      run: async ({ name, format }) => {
        // `await` : hors Windows la valeur arrive par la file d'évènements,
        // seule façon de lire sans retenir le thread principal (`mpvRead.ts`).
        const raw = await getProperty(name);
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
    });
}

/**
 * Rend l'écran à son état d'origine, quoi qu'il arrive.
 *
 * Filet de sécurité pour la fermeture, y compris brutale : un écran laissé en
 * HDR délave tout Windows, et l'utilisateur n'aurait aucune raison de faire le
 * lien avec une application fermée.
 */
export function restoreDisplay(): void {
  finish();
}
