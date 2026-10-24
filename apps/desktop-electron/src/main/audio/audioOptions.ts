/**
 * Les options de l'instance mpv AUDIO SEUL, et celles de chaque fichier.
 *
 * Pur : aucune dépendance native, tout se teste (`audioOptions.test.ts`).
 *
 * # Une instance à part, légère
 *
 * Le lecteur vidéo garde la sienne (`video/mpv.ts`, un singleton par module) ;
 * la musique en a une seconde, née dans le même processus sur la MÊME libmpv
 * (`mpvApi()`), sans fenêtre ni sortie vidéo : `vo=null`, `vid=no`, et
 * `audio-display=no` pour qu'une pochette embarquée ne devienne jamais une
 * « vidéo » à décoder. Aucun script (le socle de `mpvNoScripts.ts`).
 *
 * # Gapless : `weak`, jamais `yes`
 *
 * `gapless-audio=yes` garde la sortie ouverte au format du PREMIER titre et
 * RÉÉCHANTILLONNE les suivants : un album en 96 kHz après un single en 44,1
 * serait joué en 44,1 — l'inverse de ce qu'on promet à qui choisit la sortie
 * exclusive. `weak` (le défaut de mpv, posé explicitement) enchaîne sans blanc
 * tant que le format ne change pas — un album, la bascule cache → bibliothèque
 * du même fichier — et rouvre la sortie sinon. Mesuré bit pour bit au banc.
 *
 * # La fin d'un fichier qui grandit
 *
 * Une source `complete: false` est lue pendant son écriture. Deux formes de
 * réponse marchent (mesuré au banc, `bench/audio/serve.mjs`) : le flux TENU
 * (la réponse reste ouverte et pousse les octets à mesure) et la réponse
 * coupée qui annonce la taille FINALE (`Content-Range: bytes a-b/<taille>`) —
 * ffmpeg se reconnecte alors seul sur la fin prématurée. ⚠️ `bytes a-b/*`
 * (taille inconnue) casse l'analyse du flux de ffmpeg lui-même (fin de fichier
 * à 7 987 octets, même hors mpv). Quand ffmpeg abandonne (l'écriture cale), le
 * moteur relit à la position (`partialSource.ts`).
 */

import type { AudioBridgeStart } from "./audioBridgeContract";

export type Platform = "darwin" | "win32" | "linux";

/** Les options posées avant `mpv_initialize`, communes aux trois systèmes. */
export function audioInstanceOptions(): Record<string, string> {
  return {
    vo: "null",
    vid: "no",
    video: "no",
    "audio-display": "no",
    idle: "yes",
    // Le dernier titre s'arrête en pause sur sa fin au lieu de vider la liste :
    // c'est ce qui laisse au moteur le temps de dire « fini » ou de relire une
    // source encore en écriture.
    "keep-open": "yes",
    "gapless-audio": "weak",
    "prefetch-playlist": "yes",
    // Aucune pochette embarquée ni aucun sous-titre : rien d'autre que le son.
    sid: "no",
    "audio-file-auto": "no",
    "cover-art-auto": "no",
    // La mémoire tampon d'une instance AUDIO : quelques minutes de FLAC 24/96,
    // jamais les 150 Mio du lecteur vidéo.
    cache: "yes",
    "demuxer-max-bytes": "48MiB",
    "demuxer-max-back-bytes": "16MiB",
    "demuxer-readahead-secs": "20",
    // Démarrer vite : aucune attente de remplissage avant le premier son.
    "cache-pause-initial": "no",
    "cache-pause-wait": "0.5",
    "network-timeout": "15",
    // Le volume de mpv est perceptuel (cubique) ; jamais d'amplification.
    "volume-max": "100",
    "replaygain-clip": "yes",
    "input-default-bindings": "no",
    "input-vo-keyboard": "no",
    terminal: "no",
    "msg-level": "all=warn",
  };
}

/**
 * La sortie : périphérique et mode exclusif.
 *
 * - macOS : `audio-exclusive` fait passer mpv de `coreaudio` à
 *   `coreaudio_exclusive` (hog mode — mesuré sur les haut-parleurs du Mac), et
 *   `coreaudio-change-physical-format` règle le format PHYSIQUE du périphérique
 *   sur celui du fichier : la fréquence d'échantillonnage suit le titre.
 * - Windows : WASAPI en mode exclusif (même option).
 * - Linux : PipeWire (`PW_STREAM_FLAG_EXCLUSIVE`) ou ALSA `hw:` — même option.
 */
export function outputOptions(platform: Platform, deviceId: string | null, exclusive: boolean): Record<string, string> {
  const options: Record<string, string> = {
    "audio-device": deviceId ?? "auto",
    "audio-exclusive": exclusive ? "yes" : "no",
  };
  if (platform === "darwin") options["coreaudio-change-physical-format"] = exclusive ? "yes" : "no";
  return options;
}

/**
 * Les options d'une source qui grandit : se reconnecter sur une fin
 * PRÉMATURÉE, vite abandonner sinon (le moteur prend la relève).
 *
 * ⚠️ Jamais `reconnect_at_eof` : ffmpeg boucle alors aussi sur la VRAIE fin
 * (« Will reconnect at <taille> », 1 s puis 3 s à chaque tentative) ; la
 * recherche d'une relecture, qui lit vers la fin du FLAC, s'y enlisait 24 s
 * (mesuré : écrivain calé 7 s, reprise à 33 s au lieu de 9).
 */
export function partialStreamOptions(complete: boolean): Record<string, string> {
  if (complete) return {};
  return { "stream-lavf-o": "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=2" };
}

/**
 * Les options PAR FICHIER au format de `loadfile` (`clé=valeur,clé=valeur`).
 *
 * ⚠️ Une valeur qui contient une virgule, un signe égal ou une espace casserait
 * la liste : elle part sous la forme `%longueur%valeur`, que mpv lit sans
 * l'interpréter (syntaxe des sous-options). La longueur est en OCTETS UTF-8.
 */
export function formatFileOptions(options: Readonly<Record<string, string>>): string {
  return Object.entries(options)
    .map(([key, value]) => {
      if (!/^[a-z0-9-/]+$/i.test(key)) throw new Error(`option par fichier invalide : ${key}`);
      const plain = /^[A-Za-z0-9._+\-:/]*$/.test(value);
      return plain ? `${key}=${value}` : `${key}=%${Buffer.byteLength(value, "utf8")}%${value}`;
    })
    .join(",");
}

/**
 * Les en-têtes HTTP de toutes les requêtes du moteur (`http-header-fields`,
 * une liste séparée par des virgules). Un en-tête qui en contiendrait une,
 * ou un retour à la ligne, est refusé : il couperait la liste ou injecterait
 * un en-tête.
 */
export function headerFields(headers: Readonly<Record<string, string>>): string {
  return Object.entries(headers)
    .map(([name, value]) => {
      if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error(`en-tête invalide : ${name}`);
      if (/[,\r\n]/.test(value)) throw new Error(`valeur d'en-tête invalide pour ${name}`);
      return `${name}: ${value}`;
    })
    .join(",");
}

/**
 * Une EDL d'un seul segment qui commence à `fromS` : la chronologie est décalée
 * à l'OUVERTURE, sans saut (voir `audioQueue.ts`). La longueur est donnée, et
 * large : sans elle, mpv borne le segment à la durée annoncée du conteneur et
 * perd le DERNIER échantillon du titre (mesuré : −1 trame au raccord suivant).
 * L'adresse passe en `%longueur%` : ni `,` ni `;` ne peuvent la couper.
 */
export function edlFrom(url: string, fromS: number): string {
  return `edl://%${Buffer.byteLength(url, "utf8")}%${url},start=${fromS.toFixed(6)},length=86400`;
}

/**
 * Le point de bascule d'une source à l'autre, en secondes : `lead` après la
 * position, posé AU MILIEU de deux échantillons.
 *
 * ⚠️ Pile sur une frontière, `end` et `start` arrondissent chacun de leur côté :
 * un échantillon joué deux fois (mesuré : +1 au raccord). Au milieu, `end`
 * garde les échantillons d'avant et `start` reprend au suivant — bit pour bit.
 *
 * `lead` doit dépasser ce que mpv a déjà décodé d'avance (le tampon de la
 * sortie : 0,2 s par défaut, ~1,5 s pour la sortie PCM du banc) — en deçà,
 * `end` tombe dans des échantillons déjà partis vers la sortie.
 */
export function swapPoint(positionS: number, sampleRate: number | null, leadS: number): number {
  const target = positionS + leadS;
  if (sampleRate === null || sampleRate <= 0) return target;
  return (Math.floor(target * sampleRate) + 0.5) / sampleRate;
}

/** Toutes les options de naissance : l'instance, la sortie, l'authentification, le volume. */
export function startOptions(
  platform: Platform,
  start: AudioBridgeStart,
  headers: string,
  extra: Readonly<Record<string, string>>,
): Record<string, string> {
  return {
    ...audioInstanceOptions(),
    ...outputOptions(platform, start.deviceId, start.exclusive),
    "http-header-fields": headers,
    volume: String(Math.round(start.volume * 100)),
    mute: start.muted ? "yes" : "no",
    ...extra,
  };
}
