/**
 * Liaisons brutes vers `libmpv-2.dll`, par koffi.
 *
 * # Pourquoi pas de module natif
 *
 * Un module node-gyp devrait être recompilé à chaque version d'Electron, et
 * exige Python — absent de la machine de développement. koffi charge la DLL en
 * ABI C pure, sans couplage à V8 : la même DLL sert au développement et au
 * paquet livré. Mesuré en phase 0, `libmpv-2.dll` du dépôt accepte `gpu-next`,
 * `d3d11` et toute la chaîne HDR par cette voie.
 *
 * Ce fichier ne contient QUE les signatures et les constantes. La logique vit
 * dans `mpv.ts`, pour que la surface C reste lisible d'un coup d'œil.
 *
 * # La règle macOS, en une phrase
 *
 * ⚠️ **Toute fonction de libmpv qui prend `mp_dispatch_lock` est INTERDITE au
 * thread principal sur macOS.** Elle y attend le cœur de mpv, lequel attend ce
 * même thread pour toucher sa `NSWindow` : chacun attend l'autre, à zéro
 * pourcent de processeur, sans erreur et sans rapport de plantage. Le défaut a
 * été rencontré quatre fois sous quatre visages différents.
 *
 * Interdites : `mpv_command`, `mpv_get_property_string`, `mpv_set_property_string`,
 * `mpv_terminate_destroy`.
 *
 * Autorisées : `mpv_create`, `mpv_set_option_string` (avant `mpv_initialize`,
 * où aucun cœur ne tourne encore), `mpv_wait_event` à échéance nulle, toutes les
 * `*_async`, et `mpv_destroy` au seul instant du `shutdown`.
 *
 * Windows n'est concerné par rien de tout cela : sa fenêtre vidéo est une
 * fenêtre enfant Win32 sans couplage au thread principal.
 */

import koffi from "koffi";
import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

/** Nom du fichier de bibliothèque, selon le système. */
const NOM_LIB = process.platform === "win32" ? "libmpv-2.dll" : "libmpv.2.dylib";

/**
 * Emplacement de la bibliothèque mpv, empaquetée ou en développement.
 *
 * # Le paquet macOS cherche dans `Frameworks`, et nulle part ailleurs
 *
 * Les dylibs livrées sont celles que `build-mpv-lgpl-macos.sh` recompile en
 * **LGPL** — mpv sans `gpl=true`, FFmpeg sans `--enable-gpl`, ni x264 ni x265.
 * Apple refuse du code exécutable sous `Resources`, elles vivent donc dans
 * `Contents/Frameworks` (`package-macos.mjs`), à côté de leurs dépendances qui
 * se retrouvent par `@loader_path`.
 *
 * ⚠️ Le repli Homebrew ne vaut QUE pour le développement : cette mpv est **GPL**,
 * et un paquet qui la chargerait serait indistribuable. Un paquet dont les
 * dylibs manquent doit donc échouer bruyamment plutôt que se rattraper sur elle.
 *
 * # Le cas macOS en développement, et pourquoi il ne vise pas le dépôt
 *
 * `src-tauri/lib/libmpv.2.dylib` est une **mpv 0.40** qui ne sait pas faire de
 * HDR sur macOS : le contexte `macvk` s'y initialise bien, mais la plage étendue
 * reste à 1.00 — le support n'est pas dans le binaire. Mesuré en phase 1. La 0.41
 * déposée à côté (`libmpv.dylib`) est orpheline : ses dépendances (FFmpeg 62.x,
 * rubberband, libarchive) ne sont pas dans `lib/`, elle ne se charge pas.
 *
 * On vise donc Homebrew en développement — c'est ce que le proto a validé, et
 * c'est déjà relié au chargeur Vulkan et à MoltenVK du système.
 *
 * `TENTACLE_MPV_LIB` permet d'en essayer une autre sans toucher au code — c'est
 * la voie pour éprouver les dylibs LGPL avant de les livrer.
 */
export function libmpvPath(): string {
  const choisi = process.env["TENTACLE_MPV_LIB"];
  if (choisi !== undefined && choisi !== "") return choisi;

  if (process.platform === "darwin") {
    // `resourcesPath` = `Contents/Resources` ; les dylibs sont un cran plus haut.
    const cadres = path.join(process.resourcesPath, "..", "Frameworks", NOM_LIB);
    if (app.isPackaged) return cadres;
    return "/opt/homebrew/lib/libmpv.2.dylib";
  }

  if (process.platform !== "win32") {
    // Aucune autre plateforme ne sort d'Electron : Linux reste sur Tauri, et un
    // chemin inventé ici ne serait jamais éprouvé.
    throw new Error(`Aucune libmpv connue pour ${process.platform} — définir TENTACLE_MPV_LIB.`);
  }

  const packaged = path.join(process.resourcesPath, "lib", NOM_LIB);
  if (app.isPackaged && existsSync(packaged)) return packaged;

  // En développement on emprunte la DLL déjà vendorée par l'app Tauri plutôt
  // que d'en dupliquer 95 Mo dans le dépôt.
  return path.resolve(__dirname, "../../../../desktop/src-tauri/lib/libmpv-2.dll");
}

/** Formats de propriété mpv (`client.h`). */
export const FORMAT = {
  NONE: 0,
  STRING: 1,
  FLAG: 3,
  INT64: 4,
  DOUBLE: 5,
} as const;

/** Identifiants d'évènement utiles (`client.h`). */
export const EVENT = {
  NONE: 0,
  SHUTDOWN: 1,
  LOG_MESSAGE: 2,
  /**
   * Réponse à `mpv_get_property_async` — même charge qu'un changement observé.
   *
   * ⚠️ TROIS, et pas vingt-six. Les identifiants d'évènement de `client.h` ne
   * suivent pas l'ordre de la documentation, et se tromper ici ne casse rien
   * visiblement : la réponse n'est simplement jamais reconnue, chaque lecture
   * attend son échéance puis sert le souvenir. Le panneau de diagnostic
   * affichait donc « décodage LOGICIEL » sur une lecture `videotoolbox`.
   */
  GET_PROPERTY_REPLY: 3,
  /** Réponse à `mpv_command_async` — porte le code d'erreur et l'identifiant. */
  COMMAND_REPLY: 5,
  START_FILE: 6,
  END_FILE: 7,
  FILE_LOADED: 8,
  IDLE: 11,
  CLIENT_MESSAGE: 16,
  VIDEO_RECONFIG: 17,
  AUDIO_RECONFIG: 18,
  SEEK: 20,
  PLAYBACK_RESTART: 21,
  PROPERTY_CHANGE: 22,
  QUEUE_OVERFLOW: 24,
} as const;

/** Nom d'évènement transmis à la page, aligné sur celui de l'app Tauri. */
export const EVENT_NAMES: Readonly<Record<number, string>> = {
  [EVENT.SHUTDOWN]: "shutdown",
  [EVENT.START_FILE]: "start-file",
  [EVENT.END_FILE]: "end-file",
  [EVENT.FILE_LOADED]: "file-loaded",
  [EVENT.IDLE]: "idle",
  [EVENT.VIDEO_RECONFIG]: "video-reconfig",
  [EVENT.AUDIO_RECONFIG]: "audio-reconfig",
  [EVENT.SEEK]: "seek",
  [EVENT.PLAYBACK_RESTART]: "playback-restart",
};

// `mpv_event` : { int event_id; int error; uint64 reply_userdata; void* data; }
export const MpvEvent = koffi.struct("mpv_event", {
  event_id: "int",
  error: "int",
  reply_userdata: "uint64",
  data: "void*",
});

// `mpv_event_property` : { const char* name; int format; void* data; }
export const MpvEventProperty = koffi.struct("mpv_event_property", {
  name: "const char*",
  format: "int",
  data: "void*",
});

// `mpv_event_end_file` : { int reason; int error; ... } — seul `reason` sert.
export const MpvEventEndFile = koffi.struct("mpv_event_end_file", {
  reason: "int",
  error: "int",
});

/**
 * `mpv_event_log_message` : { const char* prefix; const char* level;
 *                             const char* text; int log_level; }
 *
 * C'est par ce canal que passe la preuve du HDR sur macOS. mpv trace lui-même
 * l'état de sa couche Metal — « Metal layer colorspace changed: ITUR_2100_PQ »
 * puis « Metal layer HDR active ». Aucune sonde extérieure ne dit la même chose
 * avec autant d'autorité : c'est le rendu qui parle, pas un tiers qui devine.
 */
export const MpvEventLogMessage = koffi.struct("mpv_event_log_message", {
  prefix: "const char*",
  level: "const char*",
  text: "const char*",
  log_level: "int",
});

/** L'ensemble des fonctions de libmpv dont l'application se sert. */
export type MpvApi = ReturnType<typeof lier>;

/**
 * Chargement PARESSEUX, et c'est délibéré.
 *
 * Charger la bibliothèque à l'import ferait tomber le processus principal quand
 * elle manque — or c'est précisément la situation où l'on a besoin que
 * l'application démarre : pour que le panneau de diagnostic puisse DIRE qu'elle
 * manque. Une application muette qui refuse de s'ouvrir n'apprend rien à
 * personne.
 */
let cache: MpvApi | null = null;

/** La libmpv chargée. Lève si elle est introuvable — l'appelant décide. */
export function mpvApi(): MpvApi {
  if (cache === null) cache = lier(koffi.load(libmpvPath()));
  return cache;
}

/** La bibliothèque est-elle chargeable ? Ne lève jamais. */
export function libmpvDisponible(): boolean {
  try {
    mpvApi();
    return true;
  } catch {
    return false;
  }
}

function lier(lib: ReturnType<typeof koffi.load>) {
  return {
  create: lib.func("void* mpv_create()"),
  initialize: lib.func("int mpv_initialize(void* ctx)"),
  terminateDestroy: lib.func("void mpv_terminate_destroy(void* ctx)"),
  setOptionString: lib.func(
    "int mpv_set_option_string(void* ctx, const char* name, const char* data)",
  ),
  /**
   * ⚠️ BLOQUANTE : elle prend `mp_dispatch_lock` et ne rend la main qu'une fois
   * la propriété appliquée par le cœur. Réservée à Windows — sur macOS
   * `mpv.ts` passe par `set` dans la file de commandes.
   */
  setPropertyString: lib.func(
    "int mpv_set_property_string(void* ctx, const char* name, const char* data)",
  ),
  /**
   * ⚠️ BLOQUANTE, comme sa jumelle en écriture. Réservée à Windows.
   *
   * `void*` et non `char*` : koffi décoderait sinon la chaîne tout seul et on
   * perdrait le pointeur, donc la possibilité d'appeler `mpv_free` — une fuite
   * à chaque lecture de propriété.
   */
  getPropertyString: lib.func("void* mpv_get_property_string(void* ctx, const char* name)"),
  /**
   * Demande une propriété SANS attendre ; la valeur arrive en
   * `GET_PROPERTY_REPLY`, avec la même charge utile qu'un changement observé.
   *
   * C'est la seule façon de lire une propriété sur macOS. Elle ouvre au passage
   * ce que le souvenir ne pouvait pas donner : `track-list/*` — donc les pistes
   * audio et les sous-titres —, qu'on n'observe pas et qu'on ne peut donc pas
   * avoir entendu passer.
   */
  getPropertyAsync: lib.func(
    "int mpv_get_property_async(void* ctx, uint64 userdata, const char* name, int format)",
  ),
  /**
   * ⚠️ BLOQUANTE, et pas qu'un peu : `mpv_command` ne rend la main qu'une fois
   * la commande TERMINÉE. `sub-add` sur une URL injoignable y reste le temps du
   * `network-timeout` (30 s) multiplié par les reconnexions — et comme l'appel
   * est un FFI synchrone sur le thread du processus principal, c'est TOUTE
   * l'application qui gèle : plus d'IPC, plus une fenêtre qui répond, pendant
   * que mpv continue de jouer sur ses propres threads.
   *
   * Conservée parce que `mpv_command_async` peut échouer à l'envoi et qu'on
   * garde le même décodage d'erreur, mais on ne l'appelle plus.
   */
  command: lib.func("int mpv_command(void* ctx, const char** args)"),
  /** Rend la main IMMÉDIATEMENT ; le résultat arrive en `COMMAND_REPLY`. */
  commandAsync: lib.func(
    "int mpv_command_async(void* ctx, uint64 userdata, const char** args)",
  ),
  observeProperty: lib.func(
    "int mpv_observe_property(void* ctx, uint64 userdata, const char* name, int format)",
  ),
  /**
   * Libère NOTRE poignée, sans attendre l'arrêt du cœur.
   *
   * ⚠️ Indispensable sur macOS, où `terminateDestroy` fige l'application : elle
   * n'y rend la main qu'une fois la sortie vidéo démontée, or ce démontage exige
   * le thread principal — celui-là même qui appelle. Chacun attend l'autre.
   * Ici le cœur se termine seul, sur ses propres threads, une fois son dernier
   * client parti. Voir `mpvArret.ts`.
   */
  destroyClient: lib.func("void mpv_destroy(void* ctx)"),
  /** Abonne le client aux messages de journal de mpv, par niveau. */
  requestLogMessages: lib.func("int mpv_request_log_messages(void* ctx, const char* level)"),
  waitEvent: lib.func("void* mpv_wait_event(void* ctx, double timeout)"),
  free: lib.func("void mpv_free(void* data)"),
  errorString: lib.func("const char* mpv_error_string(int error)"),
  clientApiVersion: lib.func("unsigned long mpv_client_api_version()"),
  };
}

/** Message d'erreur mpv lisible, ou `null` si le code vaut succès. */
export function mpvError(code: number): string | null {
  if (code >= 0) return null;
  return `${code} (${mpvApi().errorString(code) as string})`;
}
