/**
 * Commandes du lecteur, exposées à la page.
 *
 * Mêmes noms et mêmes évènements que l'app Tauri (`mpv_*`, `mpv://event`,
 * `mpv://property-change`) : l'adaptateur côté web est donc le même, et rien
 * n'est dupliqué.
 */

import { screen } from "electron";
import { z } from "zod";
import { getMainWindow, setPlayerSurfaceTransparent } from "../window";
import { finish } from "../video/hdrSession";
import { stop } from "../video/mpvShutdown";
import { command, destroy, getProperty, init, isRunning, setProperty } from "../video/mpv";
import { libmpvAvailable } from "../video/mpvFfi";
import {
  filterInitOptions,
  refuseCommand,
  refuseWrite,
  type MpvValue,
} from "../video/mpvAllowlist";
import { nativeHandle, trace } from "../video/native";
import { adaptToFullscreen } from "../video/macosWindowOptions";
import { initialGeometryOption } from "../linux/initialGeometry";
import { linuxWindowing, linuxMontage } from "../linux/session";
import { createVideoSurface, videoMontage, type VideoSurface } from "../video/surface";
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
 * appelle. On démonte donc la vidéo d'abord et on guette sa disparition (voir
 * `mpvShutdown.ts`). Windows détruit comme il l'a toujours fait.
 *
 * L'ORDRE compte : mpv s'arrête AVANT le détachement. L'inverse rendrait la
 * fenêtre de mpv indépendante le temps de sa mort, donc visible seule à l'écran.
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
  if (process.platform === "darwin") {
    const witness = surface?.videoGone?.bind(surface);
    await stop(witness);
  } else {
    destroy();
  }
  surface?.detach();
}

/**
 * La réécriture Render API des options, chargée À LA DEMANDE.
 *
 * ⚠️ L'`import` ne peut PAS être en tête de fichier : `macosRenderOptions.ts`
 * remonte à `objc.ts`, qui appelle `koffi.load("/usr/lib/libobjc.A.dylib")` dès
 * l'import — introuvable sur Windows, où le processus principal tombe alors
 * avant la première fenêtre. Même précaution que `surface.ts`, en miroir.
 */
function renderApiOptions(
  kept: Readonly<Record<string, MpvValue>>,
): Record<string, MpvValue> {
  const { adaptForRenderApi } =
    require("../video/macosRenderOptions") as typeof import("../video/macosRenderOptions");
  return adaptForRenderApi(kept);
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
        const win = getMainWindow();
        if (!win) throw new Error("aucune fenetre pour accueillir la video");

        // Une instance encore vivante doit partir par la porte que la
        // plateforme supporte. `init` fait bien un `destroy()` de son côté,
        // mais celui-ci est l'arrêt de SECOURS : sur macOS il ne convient
        // qu'en l'absence de sortie vidéo. La page appelle normalement
        // `mpv_destroy` avant de remonter le lecteur ; ceci couvre le cas où
        // elle ne l'a pas fait — un changement d'épisode qui se chevauche.
        if (isRunning()) await stopPlayer();

        const observed = (options?.observedProperties ?? []).map(
          ([name, format]) => [name, format] as const,
        );
        // Les options d'init sont passées VERBATIM à mpv. Parmi les 959
        // propriétés de la libmpv du dépôt figurent `scripts` (chargement de
        // code Lua), `input-ipc-server` (tuyau nommé donnant le contrôle total
        // de mpv) et `input-conf` — relevé par sonde. On ne retient donc que ce
        // que `buildMpvInitOptions` produit. Une option écartée est IGNORÉE et
        // non rejetée : mpv lui-même tolère les options inconnues, et faire
        // échouer `mpv_init` empêcherait toute lecture.
        const { kept } = filterInitOptions(options?.initialOptions ?? {});
        // Le montage Render API réécrit ce que la page a demandé : elle décrit
        // ce qu'elle veut voir, le processus principal sait comment l'obtenir.
        // Voir `macosRenderOptions.ts`.
        // Et le montage à deux fenêtres a sa propre réécriture : une lecture qui
        // démarre alors que l'app est DÉJÀ en plein écran doit dire à mpv de ne
        // pas laisser macOS ouvrir un second bureau. Voir `macosWindowOptions.ts`.
        const mpvOptions =
          videoMontage() === "gl"
            ? renderApiOptions(kept)
            : adaptToFullscreen(kept, win);
        // Montage fenêtré libre (colle KDE) : mpv naît à la TAILLE de l'hôte —
        // sans quoi il naît à la taille du média, plein écran apparent pendant
        // ~0,5 s avant le premier coller() (voir linux/initialGeometry.ts).
        const bounds = win.getBounds();
        const geometry = initialGeometryOption(
          linuxMontage(),
          linuxWindowing(),
          bounds,
          screen.getDisplayMatching(bounds).scaleFactor,
        );
        const parent = nativeHandle(win);
        const err = init(
          { options: { ...mpvOptions, ...geometry }, observed, wid: parent },
          eventRelay(() => video),
        );
        if (err) throw new Error(err);

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
        // `await` : sur macOS l'écriture passe par la file de commandes et
        // attend sa réponse dans la file d'évènements, faute de quoi elle
        // figerait le thread principal (voir `mpv.ts`). Sous Windows la
        // promesse est déjà résolue.
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
        // `await` : sur macOS la valeur arrive par la file d'évènements, seule
        // façon de lire sans figer le thread principal (voir `mpvRead.ts`).
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
