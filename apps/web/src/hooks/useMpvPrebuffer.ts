import { useEffect, useRef, useState } from "react";
import { tracerCommande } from "./startupTrace";

/**
 * Pré-remplissage piloté par l'application : retenir la lecture, juste après la
 * première image, le temps que mpv ait de quoi tenir.
 *
 * # Pourquoi ne pas laisser mpv le faire
 *
 * C'est exactement l'objet de son `--cache-pause-initial`, et l'option arrive
 * bien jusqu'à lui (elle passe l'allowlist de la coquille, et sa valeur est
 * convertie en chaîne). Mais son code (`handle_update_cache`, v0.40) la
 * subordonne à un état du lecteur :
 *
 *     if (!mpctx->restart_complete)
 *         use_pause_on_low_cache &= opts->cache_pause_initial &&
 *             (mpctx->video_status == STATUS_READY ||
 *              mpctx->audio_status == STATUS_READY);
 *
 * Sur notre chemin macOS, mpv tient sa propre fenêtre et `force-window` vaut
 * `no` : la sortie vidéo n'existe qu'à la première image. Le statut attendu
 * n'est pas là quand la condition s'évalue, et l'attente n'a jamais lieu —
 * mesuré, l'image part parfois avec zéro seconde en réserve.
 *
 * # Ce qu'on fait à la place
 *
 * La même chose, mais après `playback-restart`, quand mpv a sa fenêtre et son
 * image : on met en pause, on laisse le demuxer travailler (il remplit jusqu'à
 * `demuxer-readahead-secs`, indépendamment de la lecture), et on repart. La
 * pause n'intervient donc JAMAIS avant le `loadfile` — c'est le chemin qui,
 * lui, est connu pour laisser mpv sans fenêtre ni première frame.
 *
 * L'appelant garde son écran de chargement pendant ce temps : l'attente se
 * confond avec celle qui est déjà à l'écran, et la lecture ne démarre qu'une
 * fois.
 */

/** Réserve visée avant de lancer l'image. */
export const PREBUFFER_SECS = 12;

/**
 * Au-delà, on lance quoi qu'il arrive. Un débit trop court pour constituer la
 * réserve ne doit pas se traduire par une attente sans fin : mieux vaut une
 * lecture imparfaite qu'un écran de chargement éternel.
 */
const PLAFOND_MS = 20_000;

interface UseMpvPrebufferOptions {
  /** Vrai `playback-restart` du média courant. */
  mediaReady: boolean;
  /** `demuxer-cache-duration`, en secondes. */
  buffered: number;
  eof: boolean;
  setPause: (paused: boolean) => Promise<void>;
}

/** @returns vrai tant qu'on retient la lecture. */
export function useMpvPrebuffer({
  mediaReady, buffered, eof, setPause,
}: UseMpvPrebufferOptions): boolean {
  // Une seule fois par média — le hook vit dans un lecteur remonté à chaque
  // épisode (`key={itemId}`), donc les refs repartent naturellement à zéro.
  const decideRef = useRef(false);
  const attenteRef = useRef(false);
  const [, rerendre] = useState(0);

  // ⚠️ DÉCISION PRISE PENDANT LE RENDU, pas dans un effet.
  //
  // `mediaReady` devient vrai au rendu N, mais un effet ne s'exécute qu'après —
  // et son `setState` ne peint qu'au rendu N+1. Le rendu N sortait donc avec
  // l'overlay retiré : l'image apparaissait une fraction de seconde, puis la
  // bannière revenait par-dessus. Un clignotement, à l'endroit précis où l'on
  // cherchait justement à ne montrer qu'un seul chargement continu.
  //
  // Décider ici rend l'état visible dès le rendu N : rien n'est peint entre les
  // deux. La mutation reste sûre — elle est gardée, donc idempotente si React
  // rejoue le rendu.
  if (mediaReady && !decideRef.current) {
    decideRef.current = true;
    attenteRef.current = buffered < PREBUFFER_SECS;
  }

  const relacher = (motif: string) => {
    if (!attenteRef.current) return;
    attenteRef.current = false;
    tracerCommande("pré-remplissage terminé", motif);
    void setPause(false);
    rerendre((n) => n + 1);
  };

  // L'effet de bord suit la décision : c'est la pause qui attend le rendu, pas
  // l'affichage.
  useEffect(() => {
    if (!attenteRef.current) return;
    tracerCommande("pré-remplissage", `${buffered.toFixed(1)} s en réserve, ${PREBUFFER_SECS} s visées`);
    void setPause(true);
    const plafond = setTimeout(() => relacher(`plafond ${PLAFOND_MS / 1000} s`), PLAFOND_MS);
    return () => clearTimeout(plafond);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady]);

  useEffect(() => {
    // `eof` : un média plus court que la réserve visée ne l'atteindra jamais.
    if (attenteRef.current && (buffered >= PREBUFFER_SECS || eof)) {
      relacher(`${buffered.toFixed(1)} s en réserve`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffered, eof]);

  return attenteRef.current;
}
