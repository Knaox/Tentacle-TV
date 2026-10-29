/**
 * Octave (web, bureau) — les albums hors bibliothèque VUS DÉFILER, préparés à l'arrêt (`warmVisibleAlbums`
 * d'api-client, règle `albumWarmup` du partagé, les mêmes que le mobile). Chaque carte d'album hors bibliothèque
 * s'inscrit auprès d'UN observateur de visibilité ; tout défilement (n'importe quelle liste : écoute en capture,
 * passive) repousse l'arrêt ; `WARM_SETTLE_MS` sans mouvement, les cartes à l'écran partent, dans l'ordre du
 * document. La coquille d'Octave pose le destinataire (`useAlbumWarmupSink`) ; sans lui, rien ne part.
 */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { warmVisibleAlbums } from "@tentacle-tv/api-client";
import { WARM_SETTLE_MS } from "@tentacle-tv/shared/octave";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";

type Sink = (albums: readonly MusicAlbum[]) => void;

const albumOf = new Map<Element, MusicAlbum>();
const onScreen = new Set<Element>();
let observer: IntersectionObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let sink: Sink | null = null;

function arm(): void {
  if (!sink) return;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const shown = [...onScreen].filter((el) => el.isConnected).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const albums = shown.map((el) => albumOf.get(el)).filter((a): a is MusicAlbum => !!a);
    if (albums.length > 0) sink?.(albums);
  }, WARM_SETTLE_MS);
}

/** Un défilement en cours : l'arrêt se compte à partir de maintenant (seulement si un arrêt était attendu). */
function onScroll(): void {
  if (timer !== null) arm();
}

function ensureObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === "undefined") return observer;
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) onScreen.add(e.target);
      else onScreen.delete(e.target);
    }
    arm();
  });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return observer;
}

/** La référence à poser sur une carte d'album ; `album` à `null` : rien à préparer (bibliothèque, grisé). */
export function useAlbumCardWarmup(album: MusicAlbum | null): (el: HTMLElement | null) => void {
  const node = useRef<HTMLElement | null>(null);
  const current = useRef(album);
  current.current = album;
  const detach = useCallback(() => {
    const el = node.current;
    if (!el) return;
    observer?.unobserve(el);
    albumOf.delete(el);
    onScreen.delete(el);
    node.current = null;
  }, []);
  useEffect(() => detach, [detach]);
  useEffect(() => {
    if (node.current && album) albumOf.set(node.current, album);
  }, [album]);
  return useCallback(
    (el: HTMLElement | null) => {
      detach();
      const a = current.current;
      if (!el || !a) return;
      const obs = ensureObserver();
      if (!obs) return;
      node.current = el;
      albumOf.set(el, a);
      obs.observe(el);
    },
    [detach],
  );
}

/** Le destinataire, posé une fois par la coquille d'Octave : l'extension de ce compte, le cache des vues. */
export function useAlbumWarmupSink(): void {
  const qc = useQueryClient();
  const provider = useOctaveProvider();
  useEffect(() => {
    sink = (albums) => void warmVisibleAlbums(qc, provider, albums);
    if (onScreen.size > 0) arm();
    return () => {
      sink = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
  }, [qc, provider]);
}
