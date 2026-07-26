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
 */

import koffi from "koffi";
import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

/** Emplacement de la DLL, empaquetée ou en développement. */
export function libmpvPath(): string {
  const packaged = path.join(process.resourcesPath, "lib", "libmpv-2.dll");
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

const lib = koffi.load(libmpvPath());

export const mpv = {
  create: lib.func("void* mpv_create()"),
  initialize: lib.func("int mpv_initialize(void* ctx)"),
  terminateDestroy: lib.func("void mpv_terminate_destroy(void* ctx)"),
  setOptionString: lib.func(
    "int mpv_set_option_string(void* ctx, const char* name, const char* data)",
  ),
  setPropertyString: lib.func(
    "int mpv_set_property_string(void* ctx, const char* name, const char* data)",
  ),
  // `void*` et non `char*` : koffi décoderait sinon la chaîne tout seul et on
  // perdrait le pointeur, donc la possibilité d'appeler `mpv_free` — une fuite
  // à chaque lecture de propriété.
  getPropertyString: lib.func("void* mpv_get_property_string(void* ctx, const char* name)"),
  command: lib.func("int mpv_command(void* ctx, const char** args)"),
  observeProperty: lib.func(
    "int mpv_observe_property(void* ctx, uint64 userdata, const char* name, int format)",
  ),
  waitEvent: lib.func("void* mpv_wait_event(void* ctx, double timeout)"),
  free: lib.func("void mpv_free(void* data)"),
  errorString: lib.func("const char* mpv_error_string(int error)"),
  clientApiVersion: lib.func("unsigned long mpv_client_api_version()"),
};

/** Message d'erreur mpv lisible, ou `null` si le code vaut succès. */
export function mpvError(code: number): string | null {
  if (code >= 0) return null;
  return `${code} (${mpv.errorString(code) as string})`;
}
