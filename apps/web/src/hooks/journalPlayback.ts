import type { MediaStream } from "@tentacle-tv/shared";
import type { Verdict } from "./playbackVerdict";

/**
 * Relevé synthétique de la décision de lecture, extrait de `usePlaybackInfo`
 * (budget 300 lignes) — comportement inchangé.
 *
 * `warn` et non `log`, et ce n'est pas une question de gravité : les builds de
 * production évincent `console.log` (`pure:` d'esbuild, cf. la configuration du
 * téléviseur). Ce relevé-ci est précisément celui qu'on vient chercher dans
 * l'inspecteur d'une dalle, où il n'y a pas d'autre instrument — et il n'y
 * était jamais. Mesuré sur l'émulateur webOS 4 : lecture directe en cours,
 * console vide.
 */
export function journaliserLecture(args: {
  verdict: Verdict;
  fluxVideo: MediaStream | undefined;
  plages: string[];
  transport: "direct" | "proxy";
  directStreamingConfigured: boolean;
  url: string;
  directPlay: boolean;
}): void {
  const { verdict, fluxVideo, plages, transport, directStreamingConfigured, url, directPlay } = args;
  console.warn("[Tentacle:Playback]", {
    mode: verdict.mode,
    reencodage: verdict.reencodageVideo,
    // Jointes plutôt qu'en tableau : un `Array(1)` replié dans la console
    // ne dit rien, et c'est précisément la valeur qu'on vient y chercher.
    raisons: verdict.raisons.join(",") || "(aucune)",
    // Plage dynamique : la valeur BRUTE du serveur face à ce qu'on déclare.
    // Jellyfin sérialise `VideoRangeType` tantôt en nom, tantôt en index —
    // et c'est ce nom, côté serveur, qu'il compare à notre liste pour
    // décider s'il peut copier l'image. Sans les deux sous les yeux, on en
    // est réduit à deviner.
    plageSource: fluxVideo?.VideoRangeType,
    plagesDeclarees: plages.join("|"),
    transport,
    directStreamingConfigured,
    isHls: url.includes(".m3u8"),
  });
  // Sur SA PROPRE ligne, en chaîne nue : la console replie les objets, et
  // c'est justement le champ le plus long qu'elle cache derrière son « … ».
  //
  // Cette URL porte tout ce que le serveur relira pour décider de copier
  // l'image ou de la recompresser — `hevc-rangetype`, `hevc-profile`,
  // `hevc-level`, `hevc-videobitdepth`, `VideoBitrate`, `MaxFramerate`,
  // `TranscodeReasons`. `EncodingHelper.CanStreamCopyVideo` ne lit pas le
  // DeviceProfile : il ne lit que ces paramètres-là. Réservée au
  // transcodage — en lecture directe il n'y a rien à diagnostiquer.
  if (!directPlay) {
    console.warn(
      "[Tentacle:Playback] url →",
      url.replace(/([?&])(api_key|apikey)=[^&]*/gi, "$1api_key=***"),
    );
  }
}
