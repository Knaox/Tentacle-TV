import { QueryClient } from "@tanstack/react-query";
import { expect } from "vitest";
import { ORIGINAL_AUDIO_LANG, resolveMediaTracks } from "../../../../../packages/shared/src/preferences";
import { mediaVersions, pickMediaSource } from "../../../../../packages/shared/src/utils/mediaVersions";
import type { MediaItem } from "../../../../../packages/shared/src/types/media";
import { getLibraryCatalogKey, prefetchLibraryCatalog } from "../../../../../packages/api-client/src/hooks/useLibraryCatalog";
import { libraryLanguagesPath, parseLibraryLanguages } from "../../../../../packages/api-client/src/hooks/libraryLanguages";
import { fetchIncludedInCollections } from "../../../../../packages/api-client/src/hooks/useIncludedInCollections";
import { check, feature } from "../harness";
import { DIRECT_PROFILE } from "./profiles";
import { bodySize, ctx, expectStatus, tentacleClient, type ItemsPage } from "./support";
import { bebopEpisode, isFrench, isJapanese, resolveBody, resolveWithPref, showsLibrary, streamsOf } from "./trackPrefs";

const client = () => tentacleClient(ctx().user.token);
const u = () => ctx().user.id;
const item = (id: string, fields = "MediaSources,MediaStreams") => client().fetch<MediaItem>(`/Users/${u()}/Items/${id}?Fields=${fields}`);

feature("jellyfin12.episode-versions", () => {
  const { bbS02E01 } = ctx().fixtures.episodes;

  check("l'épisode en deux fichiers n'est qu'une entrée à deux versions", async () => {
    const versions = mediaVersions((await item(bbS02E01)).MediaSources);
    // Jellyfin met en tête la dernière version LUE par le compte : l'ordre varie.
    expect(versions.map((v) => v.label).sort()).toEqual(["1080p", "720p"]);
  });

  check("PlaybackInfo et flux de la version choisie, pas de la première", async () => {
    const episode = await item(bbS02E01);
    const [first, second] = [0, 1].map((i) => pickMediaSource(episode.MediaSources, mediaVersions(episode.MediaSources)[i].id)!);
    expect(first.Size).not.toBe(second.Size);
    const info = await client().getPlaybackInfo(bbS02E01, { userId: u(), deviceProfile: DIRECT_PROFILE, mediaSourceId: second.Id });
    expect(info.MediaSources[0]?.Id).toBe(second.Id);
    const res = await fetch(client().getStreamUrl(bbS02E01, { mediaSourceId: second.Id }), { headers: { Range: "bytes=0-2047" } });
    expectStatus(res, 206);
    // La taille totale annoncée est celle du fichier 720p : c'est bien lui qui part.
    expect(res.headers.get("content-range")).toBe(`bytes 0-2047/${second.Size}`);
    expect(await bodySize(res)).toBe(2048);
  });
});

feature("jellyfin12.original-language", () => {
  const { bebop, breakingBad } = ctx().fixtures.series;

  check("langue originale sur la fiche, héritée par les épisodes, et dans les listes", async () => {
    expect((await item(bebop, "Overview")).OriginalLanguage).toBe("ja");
    expect((await item(breakingBad, "Overview")).OriginalLanguage).toBe("en");
    expect((await bebopEpisode(2)).OriginalLanguage).toBe("ja");
    const list = await client().fetch<ItemsPage<MediaItem>>(`/Users/${u()}/Items?Recursive=true&IncludeItemTypes=Series&ParentId=${showsLibrary()}`);
    expect(list.Items.find((s) => s.Id === bebop)?.OriginalLanguage).toBe("ja");
  });

  check("la piste que le fichier marque originale est reconnue (IsOriginal)", async () => {
    const audio = streamsOf(await bebopEpisode(2), "Audio");
    expect(audio.find(isJapanese)?.IsOriginal).toBe(true);
    expect(audio.find(isFrench)?.IsOriginal).toBe(false);
  });

  check("« VO » choisit la piste originale, pas le doublage par défaut (résolveur partagé)", async () => {
    const episode = await bebopEpisode(2);
    const audio = streamsOf(episode, "Audio");
    const japanese = audio.find(isJapanese)!;
    expect(audio.find((s) => s.IsDefault)?.Index).not.toBe(japanese.Index);
    const body = resolveBody(showsLibrary(), episode);
    const resolved = resolveMediaTracks(
      { jellyfinUserId: u(), libraryId: showsLibrary(), audioLang: ORIGINAL_AUDIO_LANG, subtitleLang: null, subtitleMode: "none" },
      body.audioTracks, body.subtitleTracks, body.originalLanguage,
    );
    expect(resolved.audioIndex).toBe(japanese.Index);
  });

  check("même choix par le serveur (/api/preferences/resolve, préférence enregistrée)", async () => {
    const episode = await bebopEpisode(2);
    const resolved = await resolveWithPref(showsLibrary(), episode, { audioLang: ORIGINAL_AUDIO_LANG });
    expect(resolved.audioIndex).toBe(streamsOf(episode, "Audio").find(isJapanese)!.Index);
  });
});

feature("jellyfin12.language-filters", () => {
  const library = (name: string): string => ctx().libraries.find((l) => l.name === name)!.id;
  const catalog = async (libraryName: string, filters: Parameters<typeof prefetchLibraryCatalog>[4]): Promise<string[]> => {
    const qc = new QueryClient();
    const libraryId = library(libraryName);
    await prefetchLibraryCatalog(qc as unknown as Parameters<typeof prefetchLibraryCatalog>[0], client(), u(), libraryId, filters);
    const state = qc.getQueryState(getLibraryCatalogKey(libraryId, filters));
    if (state?.error) throw state.error;
    const data = qc.getQueryData<{ pages: Array<ItemsPage<MediaItem>> }>(getLibraryCatalogKey(libraryId, filters));
    return (data?.pages.flatMap((p) => p.Items) ?? []).map((i) => i.Name).sort();
  };
  const languages = async (libraryName: string) => {
    const parsed = parseLibraryLanguages(await client().fetch<unknown>(libraryLanguagesPath(u(), library(libraryName))));
    if (!parsed) throw new Error("le serveur ne rend pas de langues (capacité non détectée)");
    return parsed;
  };
  const pick = (options: Array<{ code: string; values: string[] }>, code: string) => {
    const hit = options.find((o) => o.code === code);
    if (!hit) throw new Error(`langue « ${code} » absente de ${JSON.stringify(options.map((o) => o.code))}`);
    return hit.values;
  };

  check("langues de la bibliothèque (Filters2) : capacité détectée", async () => {
    const found = await languages("Séries");
    expect(found.audio.map((l) => l.code)).toEqual(expect.arrayContaining(["en", "fr", "ja"]));
    expect(found.subtitle.map((l) => l.code)).toEqual(expect.arrayContaining(["en", "fr"]));
  });

  check("audio japonais : la seule série qui en a (prefetchLibraryCatalog)", async () => {
    expect(await catalog("Séries", { audioLanguages: pick((await languages("Séries")).audio, "ja") })).toEqual(["Cowboy Bebop"]);
  });

  // Jellyfin range « fre » (piste intégrée) et « fra » (sous-titre externe)
  // dans la même bibliothèque : « français » doit réunir les deux codes.
  check("« français » réunit les codes fre et fra que Jellyfin mélange", async () => {
    const french = pick((await languages("Films")).subtitle, "fr");
    expect(french).toEqual(expect.arrayContaining(["fre", "fra"]));
    expect(await catalog("Films", { subtitleLanguages: french })).toEqual(["Big Buck Bunny", "Sintel"]);
  });

  check("sous-titres anglais, fichiers externes compris", async () => {
    expect(await catalog("Films", { subtitleLanguages: pick((await languages("Films")).subtitle, "en") })).toEqual(["Sintel"]);
  });
});

feature("jellyfin12.included-in", () => {
  const { bbb, tears } = ctx().fixtures.movies;

  check("« Fait partie de » : la collection d'un titre, par le proxy", async () => {
    const collections = await fetchIncludedInCollections(client(), bbb, u());
    expect(collections.map((c) => c.Id)).toContain(ctx().fixtures.collection);
  });

  check("un titre hors collection n'en a aucune", async () => {
    expect(await fetchIncludedInCollections(client(), tears, u())).toEqual([]);
  });
});

feature("jellyfin12.localized-tracks", () => {
  const { bbS01E01 } = ctx().fixtures.episodes;
  const labels = async (language: string) => {
    const c = client();
    c.language = language;
    const episode = await c.fetch<MediaItem>(`/Users/${u()}/Items/${bbS01E01}?Fields=MediaSources,MediaStreams`);
    return {
      audio: streamsOf(episode, "Audio").find((s) => s.IsDefault)?.DisplayTitle ?? "",
      forced: streamsOf(episode, "Subtitle").find((s) => s.IsForced)?.DisplayTitle ?? "",
    };
  };

  // Jellyfin 12 traduit les MENTIONS selon la langue de la requête ; le nom de
  // la langue, lui, reste en anglais sur l'image officielle (« Japanese »).
  check("mentions des pistes dans la langue de l'interface (Accept-Language)", async () => {
    const [fr, en] = [await labels("fr-FR"), await labels("en-US")];
    expect(en.audio).toMatch(/Default/);
    expect(fr.audio).toMatch(/Par défaut/);
    expect(en.forced).toMatch(/Forced/);
    expect(fr.forced).toMatch(/Forcé/);
  });
});
