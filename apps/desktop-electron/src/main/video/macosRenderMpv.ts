/**
 * Le rendu de mpv dans notre vue OpenGL, image par image.
 *
 * # Pourquoi pas de thread de rendu
 *
 * Le renderer Rust de l'app Tauri (`src-tauri/src/macos/render.rs`) tourne sur
 * un thread dédié. Ici on ne peut pas : Node n'en a pas, et un rappel appelé
 * depuis un thread mpv ne traverse pas proprement la frontière koffi.
 *
 * Ce n'est pas un pis-aller. Une image coûte trois appels FFI — rendre le
 * contexte courant, dessiner, présenter — soit moins de deux cents par seconde
 * à soixante images. Le GPU fait le travail ; le thread principal ne fait que
 * le déclencher. Et surtout, ces trois fonctions-là ne prennent PAS
 * `mp_dispatch_lock` : elles dessinent, elles n'interrogent pas le cœur de mpv.
 * C'est toute la différence avec la lecture de propriété qui figeait
 * l'application (voir `mpvFfi.ts`).
 *
 * Le pouls (`battement.ts`) surveille ce choix : s'il se met à sauter pendant
 * une lecture, c'est ici qu'il faut revenir.
 *
 * ⚠️ **macOS uniquement.**
 */

import koffi from "koffi";
import { sansFaillir, trace } from "./native";
import { msg } from "./objc";
import {
  GetProcAddress,
  MpvRenderParam,
  PARAM,
  TAILLE_FBO,
  TAILLE_INIT_PARAMS,
  renderApi,
  setCurrentContext,
  symboleOpenGl,
} from "./mpvRenderFfi";
import type { VueGl } from "./macosVueGl";

/**
 * Cadence de rendu.
 *
 * mpv sait quand une image l'attend (`mpv_render_context_update`), mais son
 * rappel de réveil arrive depuis un de ses threads. On sonde donc à cadence
 * fixe : à 120 Hz on ne rate aucune image d'un film à 24, et une passe qui n'a
 * rien à dessiner coûte un seul appel FFI.
 */
const PERIODE_MS = 8;

/** Le rappel enregistré auprès de koffi, tel qu'il faut le rendre. */
type RappelEnregistre = ReturnType<typeof koffi.register>;

interface Session {
  contexte: unknown;
  vue: VueGl;
  echelle: number;
  boucle: ReturnType<typeof setInterval>;
  /** Le rappel enregistré, à libérer avec la session. */
  rappel: RappelEnregistre;
  images: number;
}

let session: Session | null = null;

/** Le rendu tourne-t-il ? */
export function rendEnCours(): boolean {
  return session !== null;
}

/** Nombre d'images présentées depuis le début de la session. */
export function imagesPresentees(): number {
  return session?.images ?? 0;
}

/** Un tampon de `mpv_opengl_init_params` pointant sur notre rappel. */
function initParams(rappel: unknown): Buffer {
  const tampon = Buffer.alloc(TAILLE_INIT_PARAMS);
  koffi.encode(tampon, 0, "void*", rappel);
  koffi.encode(tampon, 8, "void*", null);
  return tampon;
}

/** Un tampon de `mpv_opengl_fbo` visant l'écran (FBO 0). */
function fbo(largeur: number, hauteur: number): Buffer {
  const tampon = Buffer.alloc(TAILLE_FBO);
  tampon.writeInt32LE(0, 0); // fbo 0 : le tampon d'affichage de la vue
  tampon.writeInt32LE(largeur, 4);
  tampon.writeInt32LE(hauteur, 8);
  tampon.writeInt32LE(0, 12); // internal_format : laissé à mpv
  return tampon;
}

/** Un tampon d'entier, pour les paramètres scalaires (`flip_y`). */
function entier(valeur: number): Buffer {
  const tampon = Buffer.alloc(4);
  tampon.writeInt32LE(valeur, 0);
  return tampon;
}

/**
 * Démarre le rendu de `mpv` dans `vue`. Rend le motif de l'échec, ou `null`.
 *
 * ⚠️ Le contexte OpenGL doit être COURANT quand mpv crée son contexte de rendu :
 * il y interroge les extensions disponibles, et échoue sinon.
 */
export function demarrerRendu(
  mpv: unknown,
  vue: VueGl,
  echelle: number,
  taille: { l: number; h: number },
): string | null {
  if (session !== null) return "un rendu tourne deja";

  setCurrentContext(vue.contexte);

  // Enregistré AVANT la création : mpv l'appelle pendant, de façon synchrone.
  const rappel = koffi.register(
    (_ctx: unknown, nom: string): unknown => symboleOpenGl(nom),
    koffi.pointer(GetProcAddress),
  );

  const sortie: unknown[] = [null];
  const code = renderApi().contextCreate(sortie, mpv, [
    { type: PARAM.API_TYPE, data: Buffer.from("opengl\0", "utf8") },
    { type: PARAM.OPENGL_INIT_PARAMS, data: initParams(rappel) },
    { type: PARAM.INVALID, data: null },
  ]) as number;

  if (code < 0 || !sortie[0]) {
    koffi.unregister(rappel);
    return `mpv_render_context_create : ${String(code)}`;
  }

  const contexte = sortie[0];
  const boucle = setInterval(() => {
    sansFaillir("rendu d'une image", () => dessiner());
  }, PERIODE_MS);
  boucle.unref();

  session = { contexte, vue, echelle, boucle, rappel, images: 0 };
  trace(
    `rendu demarre — ${String(taille.l)}x${String(taille.h)} px, ` +
      `${String(Math.round(1000 / PERIODE_MS))} sondages/s`,
  );
  return null;
}

/**
 * Dessine une image, si mpv en a une qui attend.
 *
 * `mpv_render_context_update` est le seul appel de la passe quand il n'y a rien
 * à faire — c'est ce qui rend la cadence de sondage bon marché.
 */
function dessiner(): void {
  const s = session;
  if (s === null) return;
  const api = renderApi();

  // koffi rend un `number` tant que la valeur tient dans la plage sûre, un
  // `bigint` au-delà — les deux passent par `Number()` sans perte ici, seul le
  // bit de poids faible nous intéresse.
  const drapeaux = Number(api.contextUpdate(s.contexte) as number | bigint);
  if ((drapeaux & 1) === 0) return;

  const taille = tailleCourante(s);
  setCurrentContext(s.vue.contexte);
  api.contextRender(s.contexte, [
    { type: PARAM.OPENGL_FBO, data: fbo(taille.l, taille.h) },
    // ⚠️ mpv dessine l'origine en HAUT, OpenGL l'attend en BAS. Sans ce
    // drapeau, l'image est retournée — et une image retournée reste une image,
    // donc la sonde de pixels ne le verrait pas.
    { type: PARAM.FLIP_Y, data: entier(1) },
    { type: PARAM.INVALID, data: null },
  ]);
  msg.get(s.vue.contexteNs, "flushBuffer");
  api.contextReportSwap(s.contexte);
  s.images += 1;
}

/** La taille en pixels de la vue, relue à chaque image — elle suit la fenêtre. */
function tailleCourante(s: Session): { l: number; h: number } {
  const cadre = msg.rect(s.vue.vue, "frame");
  return {
    l: Math.max(1, Math.round(cadre.width * s.echelle)),
    h: Math.max(1, Math.round(cadre.height * s.echelle)),
  };
}

/**
 * Arrête le rendu et détruit le contexte.
 *
 * ⚠️ À appeler AVANT l'arrêt de mpv : `mpv_render_context_free` attend la fin
 * du rendu en cours, et mpv détruit sa sortie vidéo à l'arrêt.
 */
export function arreterRendu(): void {
  const s = session;
  if (s === null) return;
  session = null;
  clearInterval(s.boucle);
  sansFaillir("arret du rendu", () => {
    renderApi().contextFree(s.contexte);
    koffi.unregister(s.rappel);
  });
  trace(`rendu arrete — ${String(s.images)} images presentees`);
}

/** Décrit l'état du rendu, pour le rapport de diagnostic. */
export function etatRendu(): string {
  const s = session;
  if (s === null) return "rendu=arrete";
  const taille = tailleCourante(s);
  return `rendu=actif ${String(taille.l)}x${String(taille.h)} px, ${String(s.images)} images`;
}

/** Le type de structure, exporté pour que koffi le connaisse à l'appel. */
export const PARAM_STRUCT = MpvRenderParam;
