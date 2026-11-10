/**
 * Le client Jellyfin du labo des fiches : le VRAI `JellyfinClient` (les crochets d'`api-client`
 * n'en connaissent pas d'autre), dont deux portes sont détournées — `fetch` répond depuis le
 * serveur factice (`labServer.ts`), `getImageUrl` rend l'image du banc. Rien ne part au réseau,
 * et `window.fetch` n'est pas touché : hors du labo, l'application garde son vrai client.
 */

import { JellyfinClient, type StorageAdapter } from "@tentacle-tv/api-client";
import { LAB_ART } from "./labItems";
import { labJellyfin } from "./labServer";

// Les images libres du prototype, copiées dans le banc — jamais dans `public/` : elles ne
// sont liées qu'au labo, donc qu'aux paquets de développement.
const FILES = import.meta.glob<string>("../../../bench/fiches/img/*.webp", { eager: true, query: "?url", import: "default" });
const urlOf = new Map(Object.entries(FILES).map(([path, url]) => [path.split("/").pop()!.replace(/\.webp$/, ""), url]));

/** Un stockage en mémoire : le labo n'écrit rien dans celui de l'application. */
export class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

export class LabClient extends JellyfinClient {
  constructor() {
    super("/__lab/jellyfin", new MemoryStorage(), { randomUUID: () => "lab-device" }, "Labo", "Tentacle TV - Labo", "0.0.0");
  }

  override fetch<T>(path: string): Promise<T> {
    return labJellyfin<T>(path);
  }

  /** L'image du banc pour ce titre ; un épisode sans décor prend celui de sa série. Sans image : une adresse qui échoue. */
  override getImageUrl(itemId: string, imageType = "Primary"): string {
    const file = LAB_ART.get(`${itemId}/${imageType}`);
    return (file && urlOf.get(file)) ?? `/__lab/missing/${itemId}/${imageType}`;
  }
}
