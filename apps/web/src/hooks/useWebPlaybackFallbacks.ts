import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { killActiveEncoding, type JellyfinClient } from "@tentacle-tv/api-client";
import {
  BURN_IN_SUBTITLE_CODECS, PGS_SUBTITLE_CODECS, TICKS_PER_SECOND,
} from "@tentacle-tv/shared";
import type { MediaSource, MediaStream as JfStream } from "@tentacle-tv/shared";
import type { usePlaybackInfo } from "./usePlaybackInfo";

/**
 * Le serveur doit-il incruster ce sous-titre — donc ré-encoder toute l'image ?
 *
 * Oui pour tout sous-titre image, SAUF le PGS quand le rendu client est
 * disponible : c'est là tout le gain, la première cause de transcodage vidéo.
 */
export function necessiteIncrustation(codec: string | undefined, pgsClientOk: boolean): boolean {
  if (!BURN_IN_SUBTITLE_CODECS.test(codec ?? "")) return false;
  return !(pgsClientOk && PGS_SUBTITLE_CODECS.test(codec ?? ""));
}

interface Options {
  isDesktop: boolean;
  client: JellyfinClient;
  itemId: string | undefined;
  mediaSourceId: string | undefined;
  streams: JfStream[];
  mediaSource: MediaSource | undefined;
  subtitleIndex: number | null;
  /** Le rendu PGS client est encore disponible pour cette session. */
  pgsClientOk: boolean;
  positionRef: MutableRefObject<number>;
  setStartTicks: (ticks: number) => void;
  setBurnInSubtitleIndex: (idx: number | undefined) => void;
  pbInfo: ReturnType<typeof usePlaybackInfo>;
}

/**
 * Les deux filets du lecteur web : lecture directe MKV et rendu PGS client.
 *
 * Ils partagent une mécanique — une capacité annoncée, un échec observé, la
 * capacité retirée pour la session, un PlaybackInfo relancé — et c'est pour ne
 * pas la disperser dans `useWatchSession` qu'ils vivent ici.
 */
export function useWebPlaybackFallbacks({
  isDesktop, client, itemId, mediaSourceId, streams, mediaSource, subtitleIndex, pgsClientOk,
  positionRef, setStartTicks, setBurnInSubtitleIndex, pbInfo,
}: Options) {
  // Relance inconditionnelle du PlaybackInfo.
  //
  // Les deux filets misaient sur un changement d'état pour repartir — le
  // drapeau MKV, la position de reprise. Aucun des deux ne suffit : l'échec
  // survient à 0 s, où `setStartTicks(0)` ne change rien et où React ne rejoue
  // donc rien. Le lecteur restait alors sur un spinner que plus rien ne
  // relevait. Un compteur, lui, change toujours.
  const [relanceLecture, setRelanceLecture] = useState(0);

  // La session du moment, tenue dans une référence plutôt qu'en dépendances.
  //
  // `relancerLecture` doit garder une identité STABLE : le repli du téléviseur
  // en fait la dépendance de l'effet qui pose son écouteur d'erreur, et cet
  // écouteur se reposerait alors à chaque PlaybackInfo — c'est-à-dire à chaque
  // fois qu'on vient de renégocier. Il doit pourtant tuer la session réellement
  // en cours, pas celle du rendu où il a été créé.
  const sessionEnCours = useRef({ client, playSessionId: pbInfo.playSessionId, isDirectPlay: pbInfo.isDirectPlay });
  sessionEnCours.current = { client, playSessionId: pbInfo.playSessionId, isDirectPlay: pbInfo.isDirectPlay };

  /**
   * Tuer l'encodage en cours AVANT de renégocier — sans quoi il survit et
   * remplit le disque du serveur.
   *
   * Toute renégociation obtient un NOUVEAU `PlaySessionId`, donc un nouveau
   * ffmpeg ; l'ancien, lui, n'était prévenu de rien. Or un remux tourne à mille
   * à trois mille fois le temps réel : il écrit le film ENTIER en quelques
   * secondes — 35 à 80 s pour 90 minutes de 4K, mesuré le 11 août 2026 — puis
   * meurt en laissant ses segments derrière lui, que le nettoyage de Jellyfin
   * ne ramasse pas (jellyfin#16608).
   *
   * Les gestes de l'utilisateur passent par les handlers de `WatchWeb` ; ce
   * fichier-ci couvre ce que les FILETS renégocient tout seuls — l'échelle de
   * replis du téléviseur, qui descend d'un cran à chaque erreur média, et le
   * repli CORS comme le seek HLS, qui passent par le même compteur. La veille
   * de gel, elle, ne renégocie rien : elle recharge la MÊME URL, donc le même
   * `PlaySessionId`, et ne fuit que par les erreurs qu'elle peut provoquer.
   *
   * La garde `isDirectPlay` n'est pas une précaution : c'est ce qui distingue
   * les deux filets. Celui du MKV muet part d'une lecture directe — aucun
   * ffmpeg à tuer — quand celui du PGS et l'échelle du téléviseur peuvent
   * partir d'un transcodage.
   */
  const libererEncodage = useCallback(() => {
    const { client: jf, playSessionId, isDirectPlay } = sessionEnCours.current;
    if (isDirectPlay || !playSessionId) return;
    void killActiveEncoding(jf, playSessionId);
  }, []);

  const relancerLecture = useCallback(() => {
    libererEncodage();
    setRelanceLecture((n) => n + 1);
  }, [libererEncodage]);

  // ── Filet de la lecture directe MKV (cf. lib/deviceProfile/browser.ts) ──
  // Le rattrapage n'est proposé que s'il y a matière à rattraper : un MKV, sur
  // le lecteur web, dont la lecture directe n'a pas encore été disqualifiée.
  // Ailleurs il vaut `undefined`, donc la garde des trois secondes de
  // `useVideoSource` n'est pas même armée — un mp4 lent ne risque rien.
  const signalerMkvNonFiable = pbInfo.signalerMkvNonFiable;
  const handleDirectPlayNonFiable = useCallback((seconds: number) => {
    if (seconds > 0) setStartTicks(Math.floor(seconds * TICKS_PER_SECOND));
    signalerMkvNonFiable();
    relancerLecture();
  }, [signalerMkvNonFiable, setStartTicks, relancerLecture]);
  const conteneurLu = (pbInfo.mediaSource?.Container ?? mediaSource?.Container)?.toLowerCase();
  const onDirectPlayNonFiable = !isDesktop && conteneurLu === "mkv" && !pbInfo.mkvNonFiable
    ? handleDirectPlayNonFiable
    : undefined;

  // ── Rendu PGS côté client ──
  // mpv lit les sous-titres image nativement : le rendu canvas ne concerne que
  // le lecteur web, et disparaît dès qu'il a échoué une fois.
  const pgsSubtitleUrl = useMemo(() => {
    if (!pgsClientOk || subtitleIndex == null || !itemId || !mediaSourceId) return null;
    const s = streams.find((st) => st.Type === "Subtitle" && st.Index === subtitleIndex);
    if (!s || !PGS_SUBTITLE_CODECS.test(s.Codec ?? "")) return null;
    return client.getSubtitleUrl(itemId, mediaSourceId, s.Index, "sup");
  }, [pgsClientOk, subtitleIndex, streams, client, itemId, mediaSourceId]);

  // Repli : le rendu client a échoué, l'incrustation serveur reprend la main.
  // C'est le seul chemin qui rétablit un transcodage vidéo — il n'est emprunté
  // qu'après un échec réel, jamais par précaution.
  //
  // `isDesktop` d'abord : là-bas `pgsClientOk` est faux non pas par échec mais
  // parce que mpv rend les PGS lui-même. Sans cette garde, choisir un
  // sous-titre image sous mpv aurait déclenché une incrustation serveur —
  // exactement le transcodage que ce chantier supprime.
  //
  // Ce filet-ci ne passe PAS par `relancerLecture` : il renégocie en changeant
  // l'incrustation, et c'est un chemin distinct — d'où le kill posé à la main.
  useEffect(() => {
    if (isDesktop || pgsClientOk || subtitleIndex == null) return;
    const s = streams.find((st) => st.Type === "Subtitle" && st.Index === subtitleIndex);
    if (!s || !PGS_SUBTITLE_CODECS.test(s.Codec ?? "")) return;
    libererEncodage();
    if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    setBurnInSubtitleIndex(subtitleIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, pgsClientOk, subtitleIndex]);

  return {
    onDirectPlayNonFiable,
    pgsSubtitleUrl,
    signalerEchecPgs: pbInfo.signalerPgsClientIndisponible,
    relanceLecture,
    relancerLecture,
    libererEncodage,
  };
}
