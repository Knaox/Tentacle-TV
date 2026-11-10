/**
 * Labo d'Octave — le LECTEUR factice, sans rien changer à `music/` : la couture est celle de la
 * bascule du mode (`prestartAudioEngine`, qui accepte sa fabrique de moteur). Le labo « démarre au
 * geste » un moteur FACTICE (`createFakeEngine`, shared : tests et bancs) juste avant que
 * `AudioEngineProvider` se monte ; celui-ci le reprend comme il reprend le vrai. Aucun son, aucun
 * mpv, aucun `<audio>`.
 *
 * La scène pose ensuite l'état par le vrai lecteur (`OctavePlayer`) : un titre EN LECTURE à 1:12
 * sur 3:45, la suite de son album, deux titres en file d'attente, l'aléatoire allumé — ou la pause.
 */

import { useLayoutEffect } from "react";
import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { createQueue, enqueue } from "@tentacle-tv/shared/octave";
import { createFakeEngine } from "@tentacle-tv/shared/octave/testing";
import { prestartAudioEngine } from "../../music/engine/enginePrestart";
import { useMusicEngineAuth } from "../../music/engine/engineAuth";
import { octaveEnginePrefs, useOctavePlayer } from "../../music/octave/player/OctavePlayerProvider";
import { CURRENT_ALBUM_ID, CURRENT_POSITION_MS, CURRENT_TRACK_ID, trackBySlug, tracksOfAlbum } from "./data/labTracks";

export type LabPlayerState = "idle" | "playing" | "paused";

/** Le moteur factice, qui « sonne » dès qu'on lui donne un titre (sauf pause posée dans le même tour). */
function createLabEngine(): AudioEnginePort {
  const fake = createFakeEngine();
  return {
    ...fake,
    play(track, source, startMs) {
      fake.play(track, source, startMs);
      queueMicrotask(() => {
        if (fake.getState().status === "loading") fake.sound();
      });
    },
  };
}

/**
 * Arme le moteur factice. À rendre AVANT `OctavePlayerProvider`, en frère aîné : son effet de mise
 * en page passe alors avant celui d'`AudioEngineProvider`, à chaque montage (mode strict compris).
 */
export function LabEngineArm() {
  const auth = useMusicEngineAuth();
  useLayoutEffect(() => {
    prestartAudioEngine(auth, octaveEnginePrefs(), () => Promise.resolve(createLabEngine()));
  }, [auth]);
  return null;
}

/** Les deux titres « en file d'attente » de l'utilisateur (d'autres albums que celui qui joue). */
const USER_QUEUE = ["al-neon-03", "al-jardin-07"] as const;

/** Pose l'état du lecteur de la scène. À rendre SOUS `OctavePlayerProvider`. */
export function LabPlayerScene({ state }: { state: LabPlayerState }) {
  const player = useOctavePlayer();
  useLayoutEffect(() => {
    if (state === "idle") return;
    const album = tracksOfAlbum(CURRENT_ALBUM_ID);
    const index = album.findIndex((track) => track.jellyfinId === CURRENT_TRACK_ID);
    const context = createQueue(album, index, { contextId: `album:${CURRENT_ALBUM_ID}` });
    // L'aléatoire ALLUMÉ sans rebattre la file : l'ordre des captures ne change pas d'un passage à l'autre.
    const queue = { ...enqueue(context, USER_QUEUE.map(trackBySlug)), shuffle: true };
    player.startItem(queue, CURRENT_POSITION_MS);
    if (state === "paused") player.pause();
  }, [player, state]);
  return null;
}
