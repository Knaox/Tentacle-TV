// Les éléments Jellyfin de la vitrine, tels que l'app les reçoit, fabriqués
// à partir du catalogue libre dans UNE langue (synopsis, genres, pistes). Les
// états du compte de démo (reprise, Ma liste, favori, vu) sont ceux du
// catalogue ; rien n'est inventé au-delà (ni note communautaire, ni âge).
import crypto from "node:crypto";

const TICKS_PER_SECOND = 10_000_000;

/** Identifiant stable, à la manière de Jellyfin (32 hexadécimaux). */
export const idOf = (key) => crypto.createHash("md5").update(`tentacle-vitrine:${key}`).digest("hex");

const iso = (day) => `${day}T19:30:00.0000000Z`;

const LANGUAGE_NAMES = {
  fr: { fre: "Français", eng: "Anglais", deu: "Allemand", spa: "Espagnol" },
  en: { fre: "French", eng: "English", deu: "German", spa: "Spanish" },
};

const WORDS = {
  fr: { stereo: "Stéréo", default: "Par défaut", season: "Saison" },
  en: { stereo: "Stereo", default: "Default", season: "Season" },
};

/** Les pistes d'un fichier : la vidéo, une piste audio, les sous-titres. */
function streamsOf(entry, lang) {
  const [width, height] = entry.video ?? [1920, 1080];
  const words = WORDS[lang];
  const names = LANGUAGE_NAMES[lang];
  const label = width >= 3800 ? "4K" : height >= 1000 || width >= 1900 ? "1080p" : "720p";
  const streams = [
    { Index: 0, Type: "Video", Codec: "h264", Width: width, Height: height, Profile: "High", IsDefault: true, VideoRange: "SDR", VideoRangeType: "SDR", DisplayTitle: `${label} H264 SDR` },
  ];
  const audioName = entry.audio ? names[entry.audio] : undefined;
  streams.push({
    Index: 1,
    Type: "Audio",
    Codec: "aac",
    Channels: 2,
    ChannelLayout: "stereo",
    Profile: "LC",
    IsDefault: true,
    ...(entry.audio ? { Language: entry.audio } : {}),
    DisplayTitle: [audioName, "AAC", words.stereo, words.default].filter(Boolean).join(" - "),
  });
  // Le compte de démo anglophone n'a pas de sous-titres français : chez lui,
  // le jeton « VOSTFR » (propre au français, `extractAudioLabels`) n'a pas lieu d'être.
  (entry.subtitles ?? []).filter((code) => lang === "fr" || code !== "fre").forEach((code, index) => {
    streams.push({ Index: 2 + index, Type: "Subtitle", Codec: "subrip", Language: code, IsDefault: false, IsExternal: false, DisplayTitle: `${names[code]} - SUBRIP` });
  });
  return streams;
}

function userDataOf(id, entry) {
  const state = entry.state ?? {};
  const ticks = (entry.seconds ?? 0) * TICKS_PER_SECOND;
  const progress = state.progress ?? 0;
  const touched = progress > 0 || state.played;
  return {
    PlayedPercentage: progress > 0 ? progress * 100 : undefined,
    PlaybackPositionTicks: Math.round(ticks * progress),
    PlayCount: state.played ? 1 : 0,
    IsFavorite: !!state.favorite,
    ...(state.list ? { Likes: true } : {}),
    ...(touched ? { LastPlayedDate: iso("2026-09-30") } : {}),
    Played: !!state.played,
    Key: id,
    ItemId: id,
  };
}

/** Les champs d'images d'un élément, à partir des images tirées. */
function imageFieldsOf(derived) {
  const tags = {};
  const blur = {};
  const backdrop = [];
  for (const [kind, image] of Object.entries(derived)) {
    const type = kind === "Still" ? "Primary" : kind;
    blur[type] = { [image.tag]: image.blurHash };
    if (type === "Backdrop") backdrop.push(image.tag);
    else tags[type] = image.tag;
  }
  return { ImageTags: tags, BackdropImageTags: backdrop, ImageBlurHashes: blur };
}

function common(entry, lang, genres) {
  return {
    ServerId: "tentacle-vitrine",
    Name: entry.name[lang],
    OriginalTitle: entry.name.en,
    SortName: entry.name[lang].toLowerCase(),
    Overview: entry.overview[lang],
    ProductionYear: entry.year,
    DateCreated: iso(entry.added ?? "2026-09-01"),
    Genres: (entry.genres ?? []).map((key) => genres[key][lang]),
    GenreItems: (entry.genres ?? []).map((key) => ({ Name: genres[key][lang], Id: idOf(`genre:${key}`) })),
    People: (entry.directors ?? []).map((name) => ({ Name: name, Id: idOf(`person:${name}`), Role: "", Type: "Director" })),
    Studios: [{ Name: "Blender Foundation", Id: idOf("studio:blender") }],
    Taglines: [],
    Tags: [],
    ProviderIds: {},
    RemoteTrailers: [],
    LocalTrailerCount: 0,
    SpecialFeatureCount: 0,
    LocationType: "FileSystem",
    PlayAccess: "Full",
    CanDelete: false,
    CanDownload: true,
  };
}

/** Ce qui fait un fichier lisible : pistes, source, durée. */
function playable(id, entry, lang) {
  const streams = streamsOf(entry, lang);
  const ticks = entry.seconds * TICKS_PER_SECOND;
  const [width, height] = entry.video ?? [1920, 1080];
  return {
    RunTimeTicks: ticks,
    MediaType: "Video",
    VideoType: "VideoFile",
    IsFolder: false,
    Container: "mkv",
    Width: width,
    Height: height,
    HasSubtitles: (entry.subtitles ?? []).length > 0,
    MediaStreams: streams,
    MediaSources: [{
      Id: id, Protocol: "File", Type: "Default", Container: "mkv", Name: entry.name.en, RunTimeTicks: ticks,
      SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true, MediaStreams: streams, DefaultAudioStreamIndex: 1,
    }],
  };
}

export function movieItem(entry, lang, ctx) {
  const id = idOf(entry.slug);
  return {
    ...common(entry, lang, ctx.genres),
    ...playable(id, entry, lang),
    Id: id,
    Type: "Movie",
    ParentId: idOf(`library:${entry.library}`),
    UserData: userDataOf(id, entry),
    PrimaryImageAspectRatio: 2 / 3,
    ...imageFieldsOf(ctx.images),
  };
}

export function seriesItem(entry, lang, ctx) {
  const id = idOf(entry.slug);
  const episodes = entry.seasons.flatMap((season) => season.episodes);
  const unplayed = episodes.filter((episode) => !episode.state?.played).length;
  return {
    ...common(entry, lang, ctx.genres),
    Id: id,
    Type: "Series",
    IsFolder: true,
    Status: "Ended",
    ParentId: idOf(`library:${entry.library}`),
    ChildCount: entry.seasons.length,
    RecursiveItemCount: episodes.length,
    CumulativeRunTimeTicks: episodes.reduce((sum, episode) => sum + episode.seconds * TICKS_PER_SECOND, 0),
    RunTimeTicks: Math.round(episodes.reduce((sum, episode) => sum + episode.seconds, 0) / episodes.length) * TICKS_PER_SECOND,
    UserData: { UnplayedItemCount: unplayed, PlayCount: 0, IsFavorite: false, Played: unplayed === 0, Key: id, ItemId: id },
    PrimaryImageAspectRatio: 2 / 3,
    ...imageFieldsOf(ctx.images),
  };
}

export function seasonItem(series, season, lang, ctx) {
  const seriesId = idOf(series.slug);
  const id = idOf(`${series.slug}:s${season.index}`);
  const unplayed = season.episodes.filter((episode) => !episode.state?.played).length;
  return {
    ServerId: "tentacle-vitrine",
    Id: id,
    Name: `${WORDS[lang].season} ${season.index}`,
    Type: "Season",
    IsFolder: true,
    IndexNumber: season.index,
    ProductionYear: season.episodes[0]?.year,
    SeriesId: seriesId,
    SeriesName: series.name[lang],
    ChildCount: season.episodes.length,
    RecursiveItemCount: season.episodes.length,
    UserData: { UnplayedItemCount: unplayed, PlayCount: 0, IsFavorite: false, Played: unplayed === 0, Key: id, ItemId: id },
    ImageTags: {},
    BackdropImageTags: [],
    SeriesPrimaryImageTag: ctx.seriesImages.Primary?.tag,
    ParentBackdropItemId: seriesId,
    ParentBackdropImageTags: ctx.seriesImages.Backdrop ? [ctx.seriesImages.Backdrop.tag] : [],
    LocationType: "FileSystem",
  };
}

export function episodeItem(series, season, entry, lang, ctx) {
  const id = idOf(entry.slug);
  const seriesId = idOf(series.slug);
  return {
    ...common({ ...entry, genres: series.genres, directors: series.directors, added: series.added }, lang, ctx.genres),
    ...playable(id, entry, lang),
    Id: id,
    Type: "Episode",
    IndexNumber: entry.index,
    ParentIndexNumber: season.index,
    SeriesId: seriesId,
    SeriesName: series.name[lang],
    SeasonId: idOf(`${series.slug}:s${season.index}`),
    SeasonName: `${WORDS[lang].season} ${season.index}`,
    ParentId: idOf(`${series.slug}:s${season.index}`),
    UserData: userDataOf(id, entry),
    PrimaryImageAspectRatio: 16 / 9,
    SeriesPrimaryImageTag: ctx.seriesImages.Primary?.tag,
    ParentBackdropItemId: seriesId,
    ParentBackdropImageTags: ctx.seriesImages.Backdrop ? [ctx.seriesImages.Backdrop.tag] : [],
    ...imageFieldsOf(ctx.images),
  };
}

export function personItem(name) {
  return { Id: idOf(`person:${name}`), Name: name, Type: "Person", PersonType: "Director", ImageTags: {} };
}
