/**
 * Commandes du lecteur, exposées à la page.
 *
 * Mêmes noms et mêmes évènements que l'app Tauri (`mpv_*`, `mpv://event`,
 * `mpv://property-change`) : l'adaptateur côté web est donc le même, et rien
 * n'est dupliqué.
 */

import { powerMonitor } from "electron";
import { z } from "zod";
import { getMainWindow, setPlayerSurfaceTransparent } from "../window";
import { finish } from "../video/hdrSession";
import { command, getProperty, isRunning, setProperty } from "../video/mpv";
import { libmpvAvailable } from "../video/mpvFfi";
import { refuseCommand, refuseWrite } from "../video/mpvAllowlist";
import { trace } from "../video/native";
import { beginStartup, forgetStartup, markStartup } from "../video/startupClock";
import { videoMontage } from "../video/surface";
import { assembleInitOptions } from "./videoInitOptions";
import { launchForRequest, launchInstance } from "./videoLaunch";
import {
  currentSurface,
  releasePlayer,
  reuseParked,
  serialized,
  stopPlayer,
} from "./videoLifecycle";
import { installPrewarm, prewarmPlayer, rememberRequest, type InitRequest } from "./videoPrewarm";

// Deux autres appelants — le point d'entrée et la séquence de fermeture —
// l'importent d'ici : le déménagement ne les regarde pas.
export { stopPlayer } from "./videoLifecycle";
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
  registerDisplayHdrCommands(registry, currentSurface);

  // Sans effet hors macOS et hors développement — la commande n'est alors même
  // pas déclarée, et la page cesse d'elle-même de proposer la sonde.
  registerVideoProbe(registry, currentSurface);
}

/** La demande de la page, telle que `mpv_init` et `mpv_prewarm` la reçoivent. */
function toRequest(options: z.infer<typeof INIT>["options"]): InitRequest {
  return {
    page: options?.initialOptions ?? {},
    observed: (options?.observedProperties ?? []).map(([name, format]) => [name, format] as const),
  };
}

function registerMpvCommands(registry: CommandRegistry): void {
  // Linux : l'instance mince née d'avance, et ce que l'alimentation en permet —
  // voir `videoPrewarm.ts`. Ailleurs le parking n'existe pas (`parkable`).
  if (process.platform === "linux") {
    installPrewarm({ onBattery: () => powerMonitor.isOnBatteryPower(), launch: launchForRequest }, powerMonitor);
  }
  registry
    .add("mpv_prewarm", {
      schema: INIT,
      // Jamais d'erreur : un préchauffage manqué ne coûte que l'attente d'avant.
      run: ({ options }) => serialized(() => prewarmPlayer("demande de la page", toRequest(options))),
    })
    .add("mpv_init", {
      schema: INIT,
      run: ({ options }) => {
        // L'horloge part ICI, avant l'arrêt du précédent — et avant la file :
        // au changement d'épisode, c'est lui que la page attend en premier
        // (`startupClock.ts`).
        beginStartup();
        return serialized(() => initPlayer(toRequest(options)));
      },
    })
    .add("mpv_destroy", {
      schema: NO_ARGS,
      run: () =>
        serialized(async () => {
          // AVANT l'arrêt : après, mpv n'est plus là pour entendre qu'on coupe la
          // transmission. L'écran est rendu dans la foulée — un écran qu'on a
          // basculé et laissé en HDR délave tout le reste de Windows.
          finish();
          forgetStartup();
          // Garée si l'on peut, arrêtée sinon — voir `videoLifecycle.ts`.
          await releasePlayer();
        }),
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
      run: () => currentSurface()?.harden() ?? false,
    });
}

/**
 * `mpv_init`, dans la file (`videoLifecycle.ts`) : reprendre l'instance garée
 * si elle convient, sinon arrêter ce qui tourne et en faire naître une.
 */
async function initPlayer(request: InitRequest): Promise<string> {
  const win = getMainWindow();
  if (!win) throw new Error("aucune fenetre pour accueillir la video");
  // La demande la plus récente : c'est elle que reproduira le recyclage.
  rememberRequest(request);
  const { observed } = request;
  // Ce que la page demande, ce que la coquille y ajoute, ce que le montage
  // réécrit : `videoInitOptions.ts`.
  const mpvOptions = await assembleInitOptions(win, request.page);

  // L'instance gardée au chaud — ou préchauffée — reprend du service si ses
  // options sont les mêmes : sortie vidéo et fenêtre collée comprises. Voir
  // `mpvPark.ts` pour ce que ça épargne.
  if (reuseParked(mpvOptions, observed)) {
    resetReport();
    trace("mpv reste chaud — instance reprise, sortie vidéo conservée");
    return "ok";
  }

  // Une instance encore vivante doit partir par la porte que la plateforme
  // supporte. `init` fait bien un `destroy()` de son côté, mais celui-ci est
  // l'arrêt de SECOURS : sur macOS il ne convient qu'en l'absence de sortie
  // vidéo. La page appelle normalement `mpv_destroy` avant de remonter le
  // lecteur ; ceci couvre le cas où elle ne l'a pas fait — un changement
  // d'épisode qui se chevauche — et l'instance garée aux options périmées.
  if (isRunning()) {
    await stopPlayer();
    markStartup("stopped-in-init");
  }

  const err = await launchInstance(win, mpvOptions, observed, () => {
    markStartup("init");
    // Le journal doit dire ce que mpv a REELLEMENT recu : une option ecartee
    // par la liste blanche l'est en SILENCE, et le defaut ne se voit alors
    // qu'a l'image — un ecran noir sans un mot.
    trace(
      `mpv demarre — montage ${videoMontage()}, ` +
        `${Object.keys(mpvOptions).length} options retenues (vo=${String(mpvOptions["vo"] ?? "?")}` +
        `, target-trc=${String(mpvOptions["target-trc"] ?? "-")}` +
        `, target-peak=${String(mpvOptions["target-peak"] ?? "-")}` +
        `, gpu-context=${String(mpvOptions["gpu-context"] ?? "-")})`,
    );
  });
  if (err !== null) throw new Error(err);
  markStartup("attach");
  resetReport();
  return "ok";
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
