import { useEffect, useState } from "react";
import { Image } from "react-native";
import { HERO_IMAGE_WAIT_MS } from "@tentacle-tv/tv-core";

/**
 * Le préchargement d'une image, UNE fois par adresse : le héros précharge les
 * fonds de sa rotation, et l'accueil attend celui du premier
 * (`useHeroImageReady`) — c'est la même requête.
 */
const prefetched = new Map<string, Promise<boolean>>();

export function prefetchImage(uri: string): Promise<boolean> {
  let pending = prefetched.get(uri);
  if (!pending) {
    pending = Image.prefetch(uri).catch(() => false);
    if (prefetched.size >= 64) prefetched.clear();
    prefetched.set(uri, pending);
  }
  return pending;
}

/**
 * L'image du PREMIER héros est là — arrivée, ou son délai passé
 * (`HERO_IMAGE_WAIT_MS`), ou il n'en a pas : l'accueil peut se montrer
 * (tv-core `homeLoading`). Vrai une fois, vrai pour de bon : la rotation ne
 * fait jamais repasser l'accueil en chargement.
 */
export function useHeroImageReady(shown: boolean, uri: string | undefined): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || !shown) return;
    if (!uri) {
      setReady(true);
      return;
    }
    let live = true;
    const done = () => {
      if (live) setReady(true);
    };
    const timer = setTimeout(done, HERO_IMAGE_WAIT_MS);
    void prefetchImage(uri).then(done);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [ready, shown, uri]);
  return ready;
}
