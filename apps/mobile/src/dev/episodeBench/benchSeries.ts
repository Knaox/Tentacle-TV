import type { MediaItem } from "@tentacle-tv/shared";

/**
 * La série du banc d'UI de la liste des épisodes : les FILMS LIBRES du
 * Jellyfin de banc (`lot1014-jf-10.11`, http://127.0.0.1:18710) rangés en
 * trois saisons — le muet, les classiques, les courts de Blender Studio —,
 * sous la forme exacte des réponses de Jellyfin (`MediaItem`). Titres, années,
 * résumés et images viennent de ce Jellyfin (domaine public, CC BY) ; les
 * durées sont celles des films, les résumés anglais y sont traduits.
 *
 * Ce qu'une vraie série met à l'épreuve : plusieurs saisons, une saison vue,
 * des épisodes vus, entamés et neufs, des titres longs, un épisode sans
 * image (Glass Half), une saison de douze épisodes qui défile.
 */

export const BENCH_SERIES = { id: "bench-series-films-libres", name: "Films libres" } as const;

interface Film {
  id: string;
  title: string;
  minutes: number;
  overview: string;
  /** Jellyfin n'a pas d'image pour lui (le cas « sans vignette »). */
  noImage?: true;
}

const SEASONS: readonly (readonly Film[])[] = [
  [
    { id: "5ced6d65a7c6c207a2b1b872fd1d4e09", title: "Le Kid", minutes: 68, overview: "Un vagabond recueille un enfant abandonné par sa jeune mère qui, quelques années plus tard, est prise de remords et tente de retrouver son fils." },
    { id: "d0af192d893e47c26059ad4785a55374", title: "Nosferatu", minutes: 94, overview: "En 1838, Hutter, jeune clerc de notaire, part conclure une vente avec un châtelain des Carpathes. Après des rencontres menaçantes et de funestes présages, il est reçu par le comte Orlock, qui n'est autre que le vampire Nosferatu." },
    { id: "bd59e1dcf35328d0e888b97e2962eb6d", title: "Sherlock Junior", minutes: 45, overview: "Un projectionniste s'endort et retrouve en rêve son amie, son rival, et vit de nombreuses aventures." },
    { id: "cc531c25c0b6cca47f83c3b6d0d612cf", title: "Le Mécano de la Générale", minutes: 78, overview: "En 1861, Johnnie Gray a deux amours : sa locomotive, la « Générale », et sa fiancée, Annabelle Lee. Quand des soldats yankees volent l'une et enlèvent l'autre, il part à leur poursuite." },
    { id: "90d50b74d48412cfc9db9a256b1d0c64", title: "Metropolis", minutes: 153, overview: "Une métropole à l'architecture fantastique vit sous le joug d'un groupe de tyrans. Le fils du maître de la ville découvre avec effarement le monde souterrain où survivent les ouvriers." },
  ],
  [
    { id: "aa0b99c4a00d1e10231921517b0f7080", title: "La Dame du vendredi", minutes: 92, overview: "Hildy Johnson quitte son époux Walter Burns, le sarcastique rédacteur en chef du journal où elle est reporter. Walter, qui connaît sa passion du métier, a l'idée farfelue de la reconquérir par un dernier reportage." },
    { id: "59557891bb533c461e7b72a6351d9cf2", title: "Plan 9 from Outer Space", minutes: 79, overview: "Des extraterrestres, alarmés par la maîtrise balbutiante de l'énergie atomique, décident de ressusciter les morts pour punir ces humains inconscients." },
    { id: "9308c1b5ece4cbf0b59e051a6f680d6b", title: "Charade", minutes: 113, overview: "De retour des sports d'hiver, Reggie Lampert retrouve son appartement parisien sens dessus dessous et apprend la mort de son mari, qui avait détourné pendant la guerre un magot destiné à la Résistance." },
    { id: "62ab56865c5d96ba6aa3ee975adaa736", title: "La Nuit des morts-vivants", minutes: 96, overview: "Chaque année, Barbara et Johnny vont fleurir la tombe de leur père. La nuit tombe ; un homme étrange apparaît et attaque Johnny. Terrorisée, Barbara se réfugie dans une maison de campagne." },
  ],
  [
    { id: "afe7b71fe34789de4a322ca295817d1f", title: "Elephants Dream", minutes: 11, overview: "Deux personnages, Emo et Proog, dans un monde étrange modelé par leurs pensées. Proog est émerveillé par ses mystères ; Emo, lui, en est lassé." },
    { id: "0c19a6f54d50d8bbbba00f8f4325de45", title: "Big Buck Bunny", minutes: 10, overview: "Un gros lapin se réveille et respire à pleins poumons les essences du printemps. Mais trois rongeurs malveillants s'en prennent aux papillons sous ses yeux : il décide de se venger." },
    { id: "caa4ab6504e352396ce27a3fdc291d57", title: "Sintel", minutes: 15, overview: "Une jeune femme solitaire, Sintel, secourt un dragonneau qu'elle nomme Scales. Lorsqu'un dragon adulte l'enlève, elle se lance dans une dangereuse quête pour le retrouver." },
    { id: "b1667e21805d958d5caa0017ab47aeac", title: "Tears of Steel", minutes: 12, overview: "Dans un futur apocalyptique, à Amsterdam, un groupe de soldats et de scientifiques tente de changer l'issue de la guerre totale entre les humains et les robots." },
    { id: "bb432ee1ca4fcf2d678a56002a4150c3", title: "Caminandes : Llama Drama", minutes: 2, overview: "Un lama a besoin d'aide pour traverser la route." },
    { id: "795b58f7de4f7f15db6ca576911551b9", title: "Cosmos Laundromat : First Cycle", minutes: 12, overview: "Sur une île déserte, un mouton suicidaire nommé Franck rencontre son destin sous la forme d'un vendeur excentrique, Victor, qui lui offre le don de changer de vie." },
    { id: "e3e3ab787b28aa7f24a92f6d4ea21751", title: "Glass Half", minutes: 3, noImage: true, overview: "Deux critiques d'art amateurs se croisent dans une galerie et se disputent passionnément chaque œuvre, jusqu'à en trouver une qui les met d'accord." },
    { id: "bb642488c64a08fc1bfa4d856039cd11", title: "Agent 327 : Opération Barbershop", minutes: 4, overview: "L'agent 327 suit une piste qui le mène à un salon de coiffure louche d'Amsterdam, sans se douter que le mercenaire Boris Kloris est sur ses talons." },
    { id: "44f3c5a07506291f09c1a454280f22f7", title: "Coffee Run", minutes: 3, overview: "Portée par la caféine, une jeune femme court à travers les souvenirs doux-amers de son ancienne histoire d'amour." },
    { id: "7742d8ba75b19323faf1a2be0af2a1b8", title: "Charge", minutes: 4, overview: "Dans une dystopie où l'énergie manque, un vieil homme démuni s'introduit dans une usine de batteries, et se retrouve face à un droïde de sécurité, sans issue." },
    { id: "d6895a876da6be845b58137fc2bbed95", title: "Wing It!", minutes: 4, overview: "Un ingénieur coincé reçoit la visite d'un apprenti pilote enthousiaste : les voilà tous deux lancés dans les airs à bord d'une navette hors de contrôle." },
    { id: "b2adac067bada8d21619b59fbbf632ae", title: "Sprite Fright", minutes: 10, overview: "Une bande d'adolescents chahuteurs s'enfonce dans une forêt isolée et y découvre de paisibles créatures-champignons, une force de la nature inattendue." },
  ],
];

const TICKS_PER_MINUTE = 600_000_000;

/** Les deux images figées du banc : une claire (Big Buck Bunny), une sombre (Cosmos Laundromat). */
export type BenchFrame = "light" | "dark";
const CURRENT: Record<BenchFrame, number> = { light: 1, dark: 5 };

export interface BenchScenario {
  seasons: MediaItem[];
  episodesBySeason: Record<string, MediaItem[]>;
  current: MediaItem;
  /** Les épisodes sans image (le banc ne leur rend aucune vignette). */
  missingImages: ReadonlySet<string>;
}

function seasonId(index: number): string {
  return `bench-season-${index + 1}`;
}

/**
 * La série telle que Jellyfin la rendrait pour un compte : la saison 1 vue, la
 * 2 entamée (Charade à 35 %), la 3 en cours — avant l'épisode en lecture : vus ;
 * lui : à 38 % ; deux plus loin : entamé à 15 % ; le reste neuf.
 */
export function benchScenario(frame: BenchFrame): BenchScenario {
  const currentIndex = CURRENT[frame];
  const episodesBySeason: Record<string, MediaItem[]> = {};
  const missing = new Set<string>();
  SEASONS.forEach((films, s) => {
    episodesBySeason[seasonId(s)] = films.map((film, e) => {
      const runtime = film.minutes * TICKS_PER_MINUTE;
      const percent = s === 0 ? 100
        : s === 1 ? (e < 2 ? 100 : e === 2 ? 35 : 0)
        : e < currentIndex ? 100 : e === currentIndex ? 38 : e === currentIndex + 2 ? 15 : 0;
      if (film.noImage) missing.add(film.id);
      return {
        Id: film.id,
        Name: film.title,
        Type: "Episode",
        IndexNumber: e + 1,
        ParentIndexNumber: s + 1,
        SeriesId: BENCH_SERIES.id,
        SeriesName: BENCH_SERIES.name,
        SeasonId: seasonId(s),
        Overview: film.overview,
        RunTimeTicks: runtime,
        ImageTags: film.noImage ? {} : { Primary: "bench" },
        UserData: {
          Played: percent === 100,
          PlayedPercentage: percent > 0 && percent < 100 ? percent : undefined,
          PlaybackPositionTicks: percent > 0 && percent < 100 ? Math.round((runtime * percent) / 100) : 0,
        },
      } as MediaItem;
    });
  });
  const seasons = SEASONS.map((films, s) => ({
    Id: seasonId(s),
    Name: `Saison ${s + 1}`,
    Type: "Season",
    IndexNumber: s + 1,
    SeriesId: BENCH_SERIES.id,
    ChildCount: films.length,
    UserData: { Played: s === 0 },
  }) as MediaItem);
  const current = episodesBySeason[seasonId(2)][currentIndex];
  return { seasons, episodesBySeason, current, missingImages: missing };
}
