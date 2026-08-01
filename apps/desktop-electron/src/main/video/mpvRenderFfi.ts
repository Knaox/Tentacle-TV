/**
 * Liaisons de la Render API de mpv (`render.h`, `render_gl.h`).
 *
 * Séparé de `mpvFfi.ts` — qui porte le cycle de vie et les propriétés — pour
 * tenir la limite de 300 lignes, et parce que rendre une image et piloter un
 * lecteur sont deux métiers distincts.
 *
 * ⚠️ Aucune de ces fonctions n'est bloquante au sens de `mp_dispatch_lock` :
 * elles ne demandent rien au cœur de mpv, elles dessinent. C'est ce qui rend le
 * rendu depuis le thread principal acceptable, là où une simple lecture de
 * propriété y figerait l'application (voir l'avertissement de `mpvFfi.ts`).
 *
 * ⚠️ **macOS uniquement** dans ce projet : Windows garde la fenêtre enfant.
 */

import koffi from "koffi";
import { libmpvPath } from "./mpvLib";

/** Types de `mpv_render_param` (`render.h`). */
export const PARAM = {
  INVALID: 0,
  API_TYPE: 1,
  OPENGL_INIT_PARAMS: 2,
  OPENGL_FBO: 3,
  FLIP_Y: 4,
  /** Rendre sans afficher — sert à consommer une image qu'on ne montrera pas. */
  SKIP_RENDERING: 12,
} as const;

/** `mpv_render_param` : { int type; void *data; } */
export const MpvRenderParam = koffi.struct("mpv_render_param", {
  type: "int",
  data: "void*",
});

/**
 * `mpv_opengl_init_params` : { get_proc_address, get_proc_address_ctx }
 *
 * On le construit à la main dans un tampon plutôt que par une structure koffi :
 * le premier champ est un POINTEUR DE FONCTION, et il doit recevoir l'adresse
 * du rappel enregistré, pas une valeur convertie.
 */
export const TAILLE_INIT_PARAMS = 16;

/** `mpv_opengl_fbo` : { int fbo; int w; int h; int internal_format; } */
export const TAILLE_FBO = 16;

/** Le prototype du rappel que mpv appelle pour résoudre les symboles OpenGL. */
export const GetProcAddress = koffi.proto(
  "void *GetProcAddress(void *ctx, const char *name)",
);

let cache: ReturnType<typeof lier> | null = null;

/** Les fonctions de rendu de la libmpv chargée. Lève si elle est introuvable. */
export function renderApi(): ReturnType<typeof lier> {
  if (cache === null) cache = lier(koffi.load(libmpvPath()));
  return cache;
}

function lier(lib: ReturnType<typeof koffi.load>) {
  return {
    /**
     * Crée le contexte de rendu. `res` est un pointeur de sortie : on passe un
     * tableau d'un élément, que koffi remplit.
     *
     * ⚠️ Doit être appelée avec le contexte OpenGL COURANT, sans quoi mpv ne
     * peut pas interroger les extensions et échoue.
     */
    contextCreate: lib.func(
      "int mpv_render_context_create(_Out_ void **res, void *mpv, mpv_render_param *params)",
    ),
    /** Dessine une image dans le FBO décrit par les paramètres. */
    contextRender: lib.func(
      "int mpv_render_context_render(void *ctx, mpv_render_param *params)",
    ),
    /**
     * Drapeaux de mise à jour. Bit 0 (`MPV_RENDER_UPDATE_FRAME`) : une image
     * nouvelle attend d'être rendue.
     */
    contextUpdate: lib.func("unsigned long long mpv_render_context_update(void *ctx)"),
    /** Signale à mpv que l'image a été présentée — cale sa cadence. */
    contextReportSwap: lib.func("void mpv_render_context_report_swap(void *ctx)"),
    /**
     * Détruit le contexte de rendu.
     *
     * ⚠️ AVANT l'arrêt de mpv, et jamais depuis un rappel de mpv. Elle attend
     * que le rendu en cours se termine.
     */
    contextFree: lib.func("void mpv_render_context_free(void *ctx)"),
  };
}

/** Bit rendu par `contextUpdate` quand une image neuve attend. */
export const UPDATE_FRAME = 1n;

/**
 * Le pont vers `dlsym`, pour résoudre les symboles OpenGL à la demande.
 *
 * mpv appelle notre rappel avec le nom de chaque fonction GL dont il a besoin,
 * pendant la création du contexte. On ne peut donc pas les déclarer à l'avance :
 * il faut une résolution dynamique, et `dlsym` est faite pour ça.
 */
const systeme = koffi.load("/usr/lib/libSystem.B.dylib");
const dlopen = systeme.func("void *dlopen(const char *path, int mode)");
const dlsym = systeme.func("void *dlsym(void *handle, const char *symbol)");

/** `RTLD_LAZY` — les symboles sont résolus au premier appel. */
const RTLD_LAZY = 1;

let openGl: unknown = null;

/** La bibliothèque OpenGL du système, ouverte une seule fois. */
export function frameworkOpenGl(): unknown {
  if (openGl === null) {
    openGl = dlopen("/System/Library/Frameworks/OpenGL.framework/OpenGL", RTLD_LAZY);
  }
  return openGl;
}

/** Résout un symbole OpenGL par son nom. `null` s'il n'existe pas. */
export function symboleOpenGl(nom: string): unknown {
  const lib = frameworkOpenGl();
  if (!lib) return null;
  return dlsym(lib, nom);
}

/**
 * `CGLSetCurrentContext` — rend un contexte courant pour le thread appelant.
 *
 * Indispensable avant chaque image : le thread principal sert aussi Chromium,
 * qui a ses propres contextes, et rien ne garantit que le nôtre soit resté
 * courant d'une image à l'autre.
 */
const cgl = koffi.load("/System/Library/Frameworks/OpenGL.framework/OpenGL");
export const setCurrentContext = cgl.func("int CGLSetCurrentContext(void *ctx)");
