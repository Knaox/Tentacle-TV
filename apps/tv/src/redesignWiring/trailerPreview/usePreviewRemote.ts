import { useEffect, useMemo, useSyncExternalStore } from "react";
import { previewPausedAfter, previewRemoteAction, type PreviewRemoteAction } from "@tentacle-tv/tv-core";
import { useRemoteContext } from "../../platform/input";
import { trailerPreviewSoundStore } from "../../lib/trailerPreviewSettings";

/**
 * La télécommande PENDANT l'aperçu d'une carte (Apple TV, Android TV) : un
 * contexte « écran » de l'entrée unique, actif tant que la grande carte joue
 * sous le focus. La décision est dans tv-core (`cards/previewRemote.ts`) :
 * Lecture/Pause met en pause et reprend, Lecture et Pause séparées font ce
 * qu'elles disent, Lecture/Pause maintenue coupe ou remet le son.
 *
 * - La PAUSE vit avec l'aperçu : un seul joue à la fois (l'arbitre), elle
 *   retombe dès qu'il ne joue plus (focus parti, carte repliée).
 * - Le SON est le réglage « Son des aperçus » de l'appareil : retenu pour les
 *   suivants, et visible dans Réglages › Lecture — jamais le volume du
 *   téléviseur.
 */

let paused = false;
const listeners = new Set<() => void>();

function setPaused(next: boolean): void {
  if (next === paused) return;
  paused = next;
  listeners.forEach((listener) => listener());
}

const pausedStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => paused,
  /** L'état d'une carte qui ne joue pas : jamais en pause. */
  idle: () => false,
};

function applyAction(action: PreviewRemoteAction): void {
  if (action === "toggleMute") trailerPreviewSoundStore.set(!trailerPreviewSoundStore.readSnapshot());
  else setPaused(previewPausedAfter(paused, action));
}

/** Prend la télécommande tant que `active` (l'aperçu joue sous le focus) ; rend la pause demandée. */
export function usePreviewRemote(active: boolean): boolean {
  useRemoteContext<PreviewRemoteAction>({
    kind: "screen",
    name: "trailerPreview",
    active,
    decide: previewRemoteAction,
    apply: applyAction,
  });
  // L'aperçu ne joue plus : la pause n'a plus d'objet — le suivant repart en lecture.
  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);
  return useSyncExternalStore(pausedStore.subscribe, active ? pausedStore.get : pausedStore.idle);
}

/**
 * Ce que l'indice sous la carte doit dire, pour la carte dont l'aperçu JOUE
 * (`shown`) : la pause et le son. `null` pour toutes les autres — elles ne se
 * redessinent pas quand l'état change.
 */
export function usePreviewRemoteHint(shown: boolean): { paused: boolean; muted: boolean } | null {
  const pausedNow = useSyncExternalStore(pausedStore.subscribe, shown ? pausedStore.get : pausedStore.idle);
  const sound = useSyncExternalStore(trailerPreviewSoundStore.subscribe, shown ? trailerPreviewSoundStore.readSnapshot : soundIdle);
  return useMemo(() => (shown ? { paused: pausedNow, muted: !sound } : null), [shown, pausedNow, sound]);
}

const soundIdle = () => true;
