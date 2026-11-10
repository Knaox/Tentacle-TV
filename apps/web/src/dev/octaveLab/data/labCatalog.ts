/**
 * Labo d'Octave — le CATALOGUE factice : artistes et albums inventés, en français. Les images
 * pointent vers `/img/…` (servies par le banc `bench/octave/` ; ailleurs elles manquent et le
 * repli dessiné s'affiche : voulu).
 */

import type { AlbumKind, MusicAlbum, MusicArtist, MusicArtistRef } from "@tentacle-tv/shared/music";
import { labId } from "./labIds";

const img = (name: string): string => `/img/${name}.webp`;

interface ArtistSeed {
  /** Le nom lisible (`ar-vasseur`) ; l'identifiant Jellyfin en est tiré (`labId`). */
  id: string;
  name: string;
  image: string | null;
}

const ARTIST_SEEDS: readonly ArtistSeed[] = [
  { id: "ar-vasseur", name: "Clara Vasseur", image: "b-spring" },
  { id: "ar-heures", name: "Les Heures Bleues", image: "b-cosmos" },
  { id: "ar-canal", name: "Orchestre du Canal", image: "b-cam2" },
  { id: "ar-nuit", name: "Nuit Blanche Club", image: "b-tos2" },
  { id: "ar-marchand", name: "Théo Marchand", image: "b-sintel" },
  // Sans photo : l'initiale du repli.
  { id: "ar-lumiere", name: "Maison Lumière", image: null },
];

export const LAB_ARTISTS: readonly MusicArtist[] = ARTIST_SEEDS.map((seed, i) => ({
  key: `jf:${labId(seed.id)}`,
  jellyfinId: labId(seed.id),
  external: null,
  name: seed.name,
  mbid: null,
  imageUrl: seed.image ? img(seed.image) : null,
  favorite: i < 2,
}));

/** La référence d'un artiste, par son nom lisible (`ar-vasseur`). */
export function artistRef(slug: string): MusicArtistRef {
  const artist = LAB_ARTISTS.find((a) => a.jellyfinId === labId(slug));
  return { name: artist?.name ?? slug, mbid: null, jellyfinId: labId(slug) };
}

export interface AlbumSeed {
  /** Le nom lisible (`al-marees`) ; l'identifiant Jellyfin en est tiré (`labId`). */
  id: string;
  title: string;
  artistId: string;
  year: number;
  kind: AlbumKind;
  art: string;
  /** Les titres, dans l'ordre du disque. */
  tracks: readonly string[];
}

export const ALBUM_SEEDS: readonly AlbumSeed[] = [
  {
    id: "al-marees", title: "Les Marées lentes", artistId: "ar-vasseur", year: 2024, kind: "album", art: "p-spring",
    tracks: ["Avant l'aube", "Les Marées lentes", "Sel et cendre", "Rien ne presse", "Une chambre à Brest", "Verre dépoli", "L'Hiver des autres", "Minuit moins le quart", "Le Phare éteint", "Après la pluie"],
  },
  {
    id: "al-neon", title: "Néons et poussière", artistId: "ar-nuit", year: 2023, kind: "album", art: "p-tos",
    tracks: ["Périphérique", "Néons et poussière", "Taxi bleu", "Fréquence 97", "Danser quand même", "Vitre baissée", "Parking sud", "Les Insomniaques", "Rouge au feu", "Ligne de nuit", "Cinq heures du matin", "Rideau de fer", "Station fantôme", "Lever du jour"],
  },
  {
    id: "al-jardin", title: "Jardin d'hiver", artistId: "ar-heures", year: 2022, kind: "album", art: "p-sintel",
    tracks: ["Givre", "Jardin d'hiver", "La Serre", "Thé noir", "Petite neige", "Les Fenêtres hautes", "Valse du dimanche", "Feu de bois", "Ombres portées", "Laine et velours", "Février", "Un banc au soleil", "Dégel", "Premiers bourgeons"],
  },
  {
    id: "al-canal", title: "Suite pour un canal", artistId: "ar-canal", year: 2021, kind: "album", art: "p-metropolis",
    tracks: ["Ouverture", "Écluse I", "Écluse II", "Les Péniches", "Chemin de halage", "Nocturne des quais", "Pont tournant", "Scherzo", "Brume", "Écluse III", "Les Lavandières", "Adagio du port", "Marche des mariniers", "Finale"],
  },
  {
    id: "al-atlas", title: "Atlas des jours ordinaires", artistId: "ar-marchand", year: 2025, kind: "album", art: "p-vertigo",
    tracks: ["Lundi", "Atlas des jours ordinaires", "Café serré", "Le Bruit des clés", "Ascenseur", "Midi pile", "Carnet à spirale", "Rue des Lilas", "Parapluie", "Dix-huit heures", "Les Voisins", "Lumière allumée", "Presque rien", "Dimanche"],
  },
  {
    id: "al-lumiere", title: "Projection privée", artistId: "ar-lumiere", year: 2020, kind: "soundtrack", art: "p-casablanca",
    tracks: ["Générique", "Projection privée", "Le Hall", "Bobine un", "Fauteuil rouge", "Entracte", "Bobine deux", "La Cabine", "Poussière dans le faisceau", "Travelling", "Hors champ", "Fondu au noir", "Générique de fin", "Rappel"],
  },
  {
    id: "al-orage", title: "Orage d'été", artistId: "ar-vasseur", year: 2021, kind: "ep", art: "p-sunset",
    tracks: ["Chaleur", "Orage d'été", "Les Volets clos", "Tonnerre lointain", "Odeur de terre", "Éclaircie"],
  },
  {
    id: "al-satellite", title: "Satellite", artistId: "ar-nuit", year: 2025, kind: "single", art: "p-cosmos",
    tracks: ["Satellite", "Satellite (version longue)"],
  },
  {
    id: "al-cartes", title: "Cartes du ciel", artistId: "ar-heures", year: 2019, kind: "album", art: "p-forbidden",
    tracks: ["Boussole", "Cartes du ciel", "Grande Ourse", "Parallèles", "Méridien", "Équinoxe", "Latitude nord", "Voie lactée", "Sextant", "Étoile du berger", "Nuit claire", "Zénith", "Horizon", "Retour sur terre"],
  },
  {
    id: "al-fanfare", title: "Fanfare des beaux jours", artistId: "ar-canal", year: 2018, kind: "live", art: "p-charade",
    tracks: ["Entrée des cuivres", "Fanfare des beaux jours", "Place du marché", "Le Kiosque", "Polka des tilleuls", "Guinguette", "La Grande Roue", "Bal perdu", "Confettis", "Tambour major", "Les Lampions", "Rappel", "Dernière danse", "Salut"],
  },
];

export const artOf = (seed: AlbumSeed): string => img(seed.art);

/** L'album SANS ses titres (cartes, étagères, résultats). */
export function albumOf(seed: AlbumSeed): MusicAlbum {
  return {
    key: `jf:${labId(seed.id)}`,
    jellyfinId: labId(seed.id),
    external: null,
    title: seed.title,
    artists: [artistRef(seed.artistId)],
    year: seed.year,
    releaseDate: `${seed.year}-03-14`,
    kind: seed.kind,
    artworkUrl: artOf(seed),
    trackCount: seed.tracks.length,
    durationMs: seed.tracks.length * 214_000,
    mbids: { release: null, releaseGroup: null },
    label: "Disques du Quai",
    favorite: seed.id === "al-marees" || seed.id === "al-jardin",
  };
}

export const LAB_ALBUMS: readonly MusicAlbum[] = ALBUM_SEEDS.map(albumOf);
