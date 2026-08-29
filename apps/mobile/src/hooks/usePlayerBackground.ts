import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { PlayerPlayback } from "./usePlayerPlayback";

const DBG = "[Tentacle:Playback]";

/**
 * Délai de grâce avant de libérer l'encodage d'une application restée en
 * arrière-plan. Une notification qu'on déroule, un appel qu'on refuse, un
 * coup d'œil à un autre écran : l'interruption courte ne doit rien coûter —
 * relancer un flux HLS, c'est plusieurs secondes de noir au retour.
 */
const GRACE_DELAY_MS = 60_000;

/**
 * Libération de l'encodage quand l'application quitte le premier plan.
 *
 * ANDROID uniquement, et c'est délibéré. Le lecteur iOS est monté en
 * `playInBackground` / `playWhenInactive` / PiP, avec `UIBackgroundModes: audio`
 * dans `app.json` : la lecture y CONTINUE en fond, l'audio comme l'AirPlay.
 * Couper le flux à cet instant casserait la fonctionnalité. Android n'a aucune
 * de ces options — la lecture s'y met en pause, et l'encodage qui continue de
 * tourner côté serveur ne sert plus personne.
 *
 * Au-delà du délai de grâce on rapporte donc l'arrêt (ce qui libère ffmpeg et
 * ses fichiers), et au retour au premier plan on relance le flux à la position
 * mémorisée. Le cas « l'application est TUÉE en arrière-plan », lui, échappe à
 * tout code JS : c'est le filet au lancement suivant qui le rattrape, sur les
 * deux plateformes.
 */
export function usePlayerBackground(pb: PlayerPlayback): void {
  // L'effet n'est monté qu'une fois : la lecture passe par un ref, sans quoi
  // on se réabonnerait à `AppState` à chaque rendu du lecteur.
  const pbRef = useRef(pb);
  pbRef.current = pb;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releasedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const cancelTimer = () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        cancelTimer();
        if (!releasedRef.current) return;
        releasedRef.current = false;
        const current = pbRef.current;
        const ticks = Math.floor(current.positionRef.current * TICKS_PER_SECOND);
        console.log(DBG, "retour au premier plan — relance du flux", { ticks });
        current.fetchPlaybackInfo({ startTimeTicks: ticks > 0 ? ticks : undefined });
        return;
      }

      // `inactive` (iOS) ou `background` : on arme, sans réarmer ni doubler.
      if (releasedRef.current || timerRef.current) return;
      const current = pbRef.current;
      // Direct play : aucun encodage côté serveur, rien à libérer — et rien qui
      // justifie d'imposer un rechargement au retour.
      if (current.isDirectPlay || !current.playSessionId) return;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        releasedRef.current = true;
        console.log(DBG, "arrière-plan prolongé — encodage libéré");
        void pbRef.current.reporting.reportStop();
      }, GRACE_DELAY_MS);
    });

    return () => {
      cancelTimer();
      sub.remove();
    };
  }, []);
}
