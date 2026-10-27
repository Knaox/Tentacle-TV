/**
 * Octave — les albums et artistes consultés sur CET appareil (`localStorage`), par identité (`octaveOwner`). La
 * règle et la clé vivent dans le partagé (`@tentacle-tv/shared/octave` › pages/recentVisits), lues aussi par le
 * mobile.
 */

import { useEffect, useRef } from "react";
import type { MusicAlbum, MusicArtist } from "@tentacle-tv/shared/music";
import {
  forgetRecentVisitsIn, readRecentVisitsFrom, recordVisitTo, visitOf, type OctaveDeviceStore, type RecentVisit,
} from "@tentacle-tv/shared/octave";
import { octaveOwner } from "../cache/octaveOwner";

export { VISITS_MAX, visitOf, withVisit, type RecentVisit } from "@tentacle-tv/shared/octave";

const store = (): OctaveDeviceStore | null => (typeof localStorage === "undefined" ? null : localStorage);

export function readRecentVisits(owner: string | null = octaveOwner()): RecentVisit[] {
  return readRecentVisitsFrom(store(), owner);
}

export function recordVisit(visit: RecentVisit, owner: string | null = octaveOwner()): void {
  recordVisitTo(store(), visit, owner);
}

/** La déconnexion efface les pages consultées, toutes identités confondues (`forgetOctaveDevice`). */
export function forgetRecentVisits(): void {
  forgetRecentVisitsIn(store());
}

/** Note la page d'un album ou d'un artiste, une fois chargée (`null`, `undefined` : rien à noter encore). */
export function useRecordVisit(kind: "album" | "artist", item: MusicAlbum | MusicArtist | null | undefined): void {
  // Une fois par page ouverte : la clé décide, l'objet (rafraîchi par le cache) est lu au moment de noter.
  const latest = useRef(item);
  latest.current = item;
  const key = item?.key;
  useEffect(() => {
    const current = latest.current;
    if (!key || !current) return;
    recordVisit(kind === "album" ? visitOf("album", current as MusicAlbum, Date.now()) : visitOf("artist", current as MusicArtist, Date.now()));
  }, [kind, key]);
}
