import { expect } from "vitest";
import { ORIGINAL_AUDIO_LANG } from "../../../../../packages/shared/src/preferences";
import { applies, check, feature } from "../harness";
import { bebopEpisode, isEnglish, isFrench, resolveWithPref, showsLibrary, streamsOf } from "./trackPrefs";

feature("playback.track-preferences", () => {
  check("langue audio préférée : la piste française, que Jellyfin écrive « fre » ou « fra »", async () => {
    const episode = await bebopEpisode(1);
    const french = streamsOf(episode, "Audio").find(isFrench);
    expect(french, "piste française de S01E01").toBeTruthy();
    expect(streamsOf(episode, "Audio").find((s) => s.IsDefault)?.Index).not.toBe(french!.Index);
    const resolved = await resolveWithPref(showsLibrary(), episode, { audioLang: "fre" });
    expect(resolved.audioIndex).toBe(french!.Index);
  });

  check("sous-titres toujours, en anglais", async () => {
    const episode = await bebopEpisode(1);
    const english = streamsOf(episode, "Subtitle").find(isEnglish);
    expect(english, "sous-titre anglais de S01E01").toBeTruthy();
    const resolved = await resolveWithPref(showsLibrary(), episode, { subtitleLang: "eng", subtitleMode: "always" });
    expect(resolved.subtitleIndex).toBe(english!.Index);
  });

  // Avant Jellyfin 12, ni `OriginalLanguage` ni `IsOriginal` : la préférence
  // « VO » ne sait rien choisir et doit laisser la piste par défaut du fichier.
  check("« VO » sur un Jellyfin qui ne connaît pas la langue originale : la piste par défaut", async () => {
    const episode = await bebopEpisode(2);
    expect(episode.OriginalLanguage).toBeUndefined();
    const fallback = streamsOf(episode, "Audio").find((s) => s.IsDefault) ?? streamsOf(episode, "Audio")[0];
    const resolved = await resolveWithPref(showsLibrary(), episode, { audioLang: ORIGINAL_AUDIO_LANG });
    expect(resolved.audioIndex).toBe(fallback.Index);
  }, { skip: applies("jellyfin12.original-language") });
});
