import type { TranscodingProfile } from "@tentacle-tv/shared";
import { PROFIL_AUDIO_SEUL, profilHlsFmp4, profilHlsTs } from "@/lib/deviceProfile/blocs";
import { codecsRetenus, type MemoireReplis } from "./repliLecture";
import type { ProfilResolu } from "./codecsWebos";

/**
 * Transcodage — mais surtout : Direct Stream.
 *
 * C'est le point le plus contre-intuitif du profil. Un `TranscodingProfile`
 * n'est pas une autorisation de recompresser : c'est aussi, et d'abord, le
 * mécanisme par lequel Jellyfin REMUXE. Le serveur y copie l'image (`-codec:v
 * copy`) dès que le codec source figure dans la liste — d'où la règle qui
 * gouverne ce module :
 *
 *   **la liste des codecs de transcodage doit contenir tout ce que la dalle
 *   décode**, sans quoi un simple changement de conteneur ou de piste audio
 *   ferait ré-encoder une image que le téléviseur savait lire.
 *
 * Le défaut corrigé à l'époque : l'ancien profil n'y listait que `hevc,h264`.
 * Un MPEG-2 ou un VC-1 dont seul le conteneur posait problème repartait
 * recompressé.
 *
 * `BreakOnNonKeyFrames: false` est posé par `blocs.ts` et ne doit pas bouger :
 * à vrai, il oblige le serveur à savoir couper hors image clé, donc à en
 * fabriquer, donc à recompresser.
 */
export function transcodage(
  resolu: ProfilResolu,
  memoire: MemoireReplis,
  sourceDolbyVision = false,
): TranscodingProfile[] {
  const video = new Set<string>();
  const audio = new Set<string>();
  for (const conteneur of resolu.capacites.conteneurs) {
    for (const codec of codecsRetenus(memoire.video, conteneur.video)) video.add(codec);
    for (const codec of codecsRetenus(memoire.audio, conteneur.audio)) audio.add(codec);
  }

  const canaux = maxCanaux(resolu);
  const audioFmp4 = [...audio].filter((codec) => AUDIO_FMP4.has(codec));
  // Le flux de transport ne porte légalement ni l'AV1, ni le VP9, ni les codecs
  // audio exotiques : y annoncer autre chose obligerait le serveur à convertir.
  const videoTs = [...video].filter((codec) => CODECS_TS.has(codec));
  const audioTs = ["aac", ...[...audio].filter((codec) => codec === "ac3" || codec === "eac3")];

  const fmp4 = profilHlsFmp4([...video].join(",") || "h264", audioFmp4.join(",") || "aac", canaux);
  const ts = profilHlsTs(videoTs.join(",") || "h264", audioTs.join(","), canaux);

  return sourceDolbyVision && conserveLeRpu(resolu)
    ? [ts, fmp4, PROFIL_AUDIO_SEUL]
    : [fmp4, ts, PROFIL_AUDIO_SEUL];
}

/**
 * Faut-il faire passer un remux Dolby Vision par le flux de transport ?
 *
 * **Oui, et c'est une mesure, pas une préférence.** Même fichier, même session,
 * même image copiée, sur une C3 en webOS 25 — relevé par
 * `luna://com.webos.service.videooutput/getStatus` :
 *
 *     segments fMP4, audio AAC ou E-AC3    hdrType « HDR10 »
 *     segments TS,   audio AC3 ou E-AC3    hdrType « DolbyVision »
 *
 * Le segment d'initialisation fMP4 est pourtant écrit en Dolby Vision — marque
 * `dby1`, entrée d'échantillon `dvh1`, boîte `dvvC`. C'est précisément là qu'est
 * le défaut : la spécification Dolby apparie `dvh1`/`dvhe` à `dvcC` et
 * `hvc1`/`hev1` à `dvvC`. La combinaison que produit le serveur n'existe pas, le
 * démultiplexeur ne trouve pas la configuration là où il la cherche, et
 * l'image retombe sur sa couche de base HDR10. Rien de tout cela ne se corrige
 * depuis le client.
 *
 * Le flux de transport, lui, porte le RPU dans un descripteur du PMT — le
 * chemin que l'ingénieur LG cite en premier (cf. `CONTENEURS_DOVI`), et le seul
 * des deux qui fonctionne ici.
 *
 * **Le surcoût est de 3 %**, mesuré segment par segment au milieu du film :
 * 7,4 Mbps en TS contre 7,2 en fMP4, pour des segments de durée identique —
 * c'est le paquetage en 188 octets, pas une recompression.
 *
 * **Ce qu'on y perd**, et c'est pourquoi la bascule est conditionnelle : le TS
 * ne porte pas le DTS (`audioTs`). Une source Dolby Vision dont l'audio DTS
 * aurait pu être copié en fMP4 le verra converti en E-AC3. L'arbitrage est
 * assumé — la plage dynamique de toute l'image contre une piste audio, et
 * seulement dans le cas où un remux a lieu, ce qui n'arrive que si la lecture
 * directe a déjà échoué.
 *
 * Sans Dolby Vision sur la dalle, la question n'a pas d'objet : le fMP4 reprend
 * sa place, avec son DTS copié.
 */
function conserveLeRpu(resolu: ProfilResolu): boolean {
  return resolu.dalle.dolbyVision;
}

/** Ce que le démultiplexeur TS de webOS sait porter. */
const CODECS_TS = new Set(["h264", "hevc", "mpeg2video"]);

/**
 * Ce qu'un remux fMP4 a le droit de porter.
 *
 * **Le DTS y est, et il a été retiré à tort pendant un temps.** La mesure qui
 * l'en avait chassé — « DTS copié : `hdrType` none ; converti en AAC :
 * DolbyVision » — était faussée deux fois. Elle portait sur un fichier dont le
 * sous-titre par défaut est un PGS, ce qui suffit à lui seul à faire incruster
 * donc RECOMPRESSER l'image ; et elle datait d'avant le choix explicite de la
 * variante Dolby Vision (`varianteDovi.ts`), quand le téléviseur prenait encore
 * un repli SDR une fois sur trois. Refaite sur un fichier sans sous-titre image,
 * variante désignée, elle rend :
 *
 *     audio DTS copié       videoInfo.hdrType « DolbyVision »
 *     audio converti AAC    videoInfo.hdrType « DolbyVision »
 *
 * Le DTS ne coûte donc rien, et le déclarer épargne une conversion sur le gros
 * des remux d'une médiathèque. Moonfin et `jellyfin-web` s'en tiennent à
 * `aac,mp3,ac3,eac3` ; ils ne se privent de rien qu'ils aient mesuré, et cette
 * table-ci a la dalle sous la main.
 *
 * Le PCM reste dehors — et cette fois la raison est nommée pour ce qu'elle est :
 * une PRUDENCE, pas une mesure. Le conteneur MP4 ne le porte pas naturellement,
 * personne ne l'a essayé ici, et une piste muette est plus difficile à
 * diagnostiquer qu'une conversion.
 *
 * Le TrueHD n'y sera jamais : webOS ne le démultiplexe dans AUCUN conteneur, si
 * bien qu'il n'a jamais atteint la chaîne audio, avec ou sans barre de son. Un
 * fichier qui n'aurait que cette piste-là paiera une conversion, et c'est le
 * seul cas qui en paie une.
 */
const AUDIO_FMP4 = new Set(["aac", "mp3", "ac3", "eac3", "dts", "dca"]);

/**
 * Canaux maximaux d'un remux.
 *
 * Huit quand le téléviseur annonce l'Atmos : il a alors une chaîne audio
 * capable de recevoir plus que du 5.1, et brider le remux à six canaux
 * l'obligerait à mélanger une piste 7.1 sans nécessité. Six sinon.
 *
 * C'est ce qui permet à un TrueHD 7.1 Atmos converti en E-AC3 de rester en huit
 * canaux — l'Atmos de Netflix et de Disney+ voyage exactement comme cela.
 */
function maxCanaux(resolu: ProfilResolu): string {
  return resolu.dalle.dolbyAtmos ? "8" : "6";
}
