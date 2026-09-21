import { langMatches } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/** Piste audio native telle que le lecteur la remonte (`MpvTrack` de type audio). */
export interface NativeAudioTrack { id: number; lang: string; title: string }

type JellyfinAudio = Pick<JfStream, "Index" | "Language" | "Title" | "DisplayTitle">;

/** Langue ramenée à sa racine (« fr-CA » → « fr » ; « und » et vide → « »). */
function baseLang(raw: string | undefined): string {
  const base = (raw ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return base === "und" ? "" : base;
}

/** Même langue à travers ISO 639-1 / 639-2B / 639-2T (« fr » ≡ « fre » ≡ « fra »). */
function sameLang(a: string | undefined, b: string | undefined): boolean {
  const x = baseLang(a);
  const y = baseLang(b);
  if (!x || !y) return false;
  return x === y || langMatches(x, y) || langMatches(y, x);
}

function normTitle(raw: string | undefined): string {
  return (raw ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Apparie les pistes audio Jellyfin (index de flux) aux pistes natives du
 * lecteur (id de sélection), dans cet ordre :
 *  1. langue + titre (`Title` ou `DisplayTitle`) — ce qui distingue deux pistes
 *     de même langue (VFF / VFQ, commentaire audio…) ;
 *  2. langue seule, au rang : le k-ième candidat d'une langue prend la k-ième
 *     piste native libre de cette langue ;
 *  3. position : ce qui reste s'apparie dans l'ordre — exactement l'ancien zip
 *     positionnel, donc le comportement d'Android quand rien d'autre ne tient.
 *
 * `carriable` (PrismCore) restreint d'abord les candidats aux pistes réellement
 * transportées : une piste ni copiable ni pontée n'a pas de rendition, et un
 * zip qui la compterait décalerait toutes les suivantes. PrismCore place par
 * ailleurs la piste PRÉFÉRÉE en tête du master quel que soit son index — d'où
 * les passes 1 et 2 avant la position.
 */
export function matchAudioTracks(a: {
  jellyfinAudio: JellyfinAudio[];
  nativeTracks: NativeAudioTrack[];
  carriable?: Set<number>;
}): Record<number, number> {
  const carriable = a.carriable;
  const candidates = carriable ? a.jellyfinAudio.filter((s) => carriable.has(s.Index)) : a.jellyfinAudio;
  // Positions natives encore libres, en ordre croissant.
  const free: number[] = a.nativeTracks.map((_, i) => i);
  const map: Record<number, number> = {};
  const take = (s: JellyfinAudio, pos: number) => {
    map[s.Index] = a.nativeTracks[pos].id;
    free.splice(free.indexOf(pos), 1);
  };

  // Passe 1 — langue + titre.
  const afterTitle: JellyfinAudio[] = [];
  for (const s of candidates) {
    const titles = [s.Title, s.DisplayTitle].map(normTitle).filter((t) => t.length > 0);
    const pos = free.find((k) => {
      const native = a.nativeTracks[k];
      return sameLang(native.lang, s.Language) && titles.includes(normTitle(native.title));
    });
    if (pos != null) take(s, pos); else afterTitle.push(s);
  }
  // Passe 2 — langue seule, au rang.
  const afterLang: JellyfinAudio[] = [];
  for (const s of afterTitle) {
    const pos = free.find((k) => sameLang(a.nativeTracks[k].lang, s.Language));
    if (pos != null) take(s, pos); else afterLang.push(s);
  }
  // Passe 3 — position.
  for (const s of afterLang) {
    if (free.length === 0) break;
    take(s, free[0]);
  }
  return map;
}
