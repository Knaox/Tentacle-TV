import { useEffect, useRef } from "react";
import { useWebPlaybackFallbacks as repliWeb } from "@/hooks/useWebPlaybackFallbacks?original";
import type { MediaSource } from "@tentacle-tv/shared";
import { signalerEchecLecture } from "./repliLecture";
import { observer, VEILLE_VIDE } from "./relanceGel";

/**
 * Période d'échantillonnage de la veille.
 *
 * Deux secondes : assez fin pour que quatre secondes de gel soient détectées
 * sans qu'un utilisateur ait le temps de croire à une panne, assez espacé pour
 * qu'une lecture d'une heure ne coûte que dix-huit cents relevés d'une propriété
 * déjà en mémoire.
 */
const PERIODE_VEILLE_MS = 2000;

/**
 * Le filet du téléviseur, par-dessus ceux du client web.
 *
 * Le web en a deux — la lecture directe MKV muette, le rendu PGS — et ils
 * suffisent à un navigateur, dont le profil d'appareil est bâti sur une sonde
 * qui, elle, ne se trompe guère. Le profil du téléviseur, lui, est bâti sur une
 * table documentée (`capacitesWebos.ts`), et une table finit toujours par se
 * tromper : LG publie des tableaux qu'elle ne nettoie pas, vend sous un même nom
 * de modèle des dalles aux licences différentes, et laisse `deviceInfo` muet sur
 * des générations entières. Il faut donc un signal de dernier recours.
 *
 * **Ce signal est l'erreur média, pas un délai.** Le client web arme aussi une
 * garde de trois secondes sur la lecture directe, mais elle n'est armée que pour
 * le MKV, et l'élargir à tous les conteneurs sur un téléviseur produirait des
 * replis pour rien — trois secondes, sur une dalle reliée en Wi-Fi à un serveur
 * qui doit encore ouvrir un fichier de quarante gigaoctets, ne veulent pas dire
 * grand-chose. `MEDIA_ERR_DECODE` et `MEDIA_ERR_SRC_NOT_SUPPORTED`, eux, sont
 * sans ambiguïté : la puce a refusé ce flux.
 *
 * L'écoute est posée sur le document, en CAPTURE. Les événements `error` d'un
 * élément média ne remontent pas — mais ils descendent, et c'est ce qui permet
 * de les entendre sans détenir la référence de la balise, qui appartient au
 * lecteur du web.
 */

// Un remplacement doit rendre TOUT ce que le module remplacé rendait :
// `useServerTrackPrefs` importe cette fonction-ci depuis le même fichier, et
// c'est le build — non `tsc`, que la déclaration `export *` de `globals.d.ts`
// satisfait — qui le rappelle.
export { necessiteIncrustation } from "@/hooks/useWebPlaybackFallbacks?original";

type OptionsRepli = Parameters<typeof repliWeb>[0];

/** Ce que Jellyfin dit de la source qu'on vient d'essayer de lire. */
function decrire(source: MediaSource | null | undefined) {
  if (!source) return {};
  const flux = source.MediaStreams ?? [];
  const video = flux.find((piste) => piste.Type === "Video");
  // La piste audio RETENUE, et non la première venue : sur un film à plusieurs
  // doublages, disqualifier le codec d'une piste qu'on n'écoutait pas ferait
  // descendre l'échelle pour rien.
  const indexAudio = source.DefaultAudioStreamIndex;
  const audio =
    flux.find((piste) => piste.Type === "Audio" && piste.Index === indexAudio) ??
    flux.find((piste) => piste.Type === "Audio");
  return {
    conteneur: source.Container,
    codecVideo: video?.Codec,
    codecAudio: audio?.Codec,
  };
}

export function useWebPlaybackFallbacks(options: OptionsRepli) {
  const base = repliWeb(options);

  // La source décrite au moment de l'échec, tenue dans une référence : l'écouteur
  // est posé une fois et ne doit pas se reposer à chaque changement de piste.
  const source = options.pbInfo.mediaSource ?? options.mediaSource;
  const description = useRef(decrire(source));
  description.current = decrire(source);

  const relancer = base.relancerLecture;
  // Un seul repli par source. Sans ce garde-fou, une balise qui émet `error` en
  // rafale — ce que fait webOS quand le décodeur renonce — descendrait toute
  // l'échelle d'un coup, jusqu'au ré-encodage, pour un seul refus.
  const enCours = useRef(false);
  useEffect(() => {
    enCours.current = false;
  }, [source]);

  useEffect(() => {
    const surErreur = (evenement: Event) => {
      const cible = evenement.target;
      if (!(cible instanceof HTMLVideoElement)) return;
      const code = cible.error?.code;
      // 3 = MEDIA_ERR_DECODE, 4 = MEDIA_ERR_SRC_NOT_SUPPORTED. Les codes 1
      // (abandon) et 2 (réseau) ne disent rien des capacités de la dalle.
      if (code !== 3 && code !== 4) return;
      if (enCours.current) return;
      enCours.current = true;

      const repli = signalerEchecLecture(description.current);
      if (repli.etage === "epuise") {
        // Plus rien à retirer : relancer produirait la même source et la même
        // erreur. On rend la main au lecteur, dont le filet de quinze secondes
        // affichera le bouton de lecture plutôt qu'un écran noir.
        console.error("[Tentacle:TV] echelle de repli epuisee", description.current);
        return;
      }
      relancer();
    };

    document.addEventListener("error", surErreur, true);
    return () => document.removeEventListener("error", surErreur, true);
  }, [relancer]);

  useVeilleGel(source);

  return base;
}

/**
 * Le témoin des lectures qui se figent sans rien dire.
 *
 * Distinct de l'échelle ci-dessus, et il faut voir pourquoi : celle-ci retire
 * des capacités au profil, parce qu'un code 3 ou 4 signifie qu'une puce a
 * refusé un flux. Un gel ne dit rien de tel — le flux est bon.
 *
 * **Cette veille ne répare plus rien**, et `relanceGel.ts` dit pourquoi : pendant
 * un gel le serveur répond 200 en 12 ms, ffmpeg a des minutes d'avance, et c'est
 * le téléviseur qui rejette deux segments adjacents une trentaine de fois par
 * seconde. Recharger jetait un tampon encore garni et faisait repartir un ffmpeg
 * au début du film, sans jamais traiter la cause.
 *
 * Elle mesure donc, et c'est tout. Les deux nombres qui manquaient au journal :
 * l'avance du tampon au moment du gel — c'est elle qui fond, de quarante-cinq
 * secondes à dix — et la durée du gel avant que la lecture reparte seule.
 */
function useVeilleGel(source: unknown): void {
  const veille = useRef(VEILLE_VIDE);
  useEffect(() => {
    veille.current = VEILLE_VIDE;
  }, [source]);

  useEffect(() => {
    const minuteur = window.setInterval(() => {
      const v = document.querySelector("video");
      if (!v) return;

      const debut = veille.current.fige;
      const [suivant, verdict] = observer(veille.current, {
        position: v.currentTime,
        enPause: v.paused,
        pret: v.readyState,
        erreur: v.error?.code ?? null,
        instant: Date.now(),
      });
      veille.current = suivant;
      if (verdict === "rien") return;

      if (verdict === "reprise") {
        // Ça repart tout seul, et c'est le fait le plus instructif du dossier :
        // rien n'a été relancé entre-temps.
        console.warn("[Tentacle:TV] lecture repartie", {
          position: Math.round(v.currentTime),
          apresSecondes: debut === null ? null : Math.round((Date.now() - debut) / 1000),
        });
        return;
      }

      // L'AVANCE DU TAMPON, pas seulement la position : c'est elle qui fond
      // pendant que le téléviseur tourne sur deux segments, et c'est en la
      // voyant tomber à zéro qu'on comprend le gel. Sans ce nombre, le journal
      // donnait le change.
      const fin = v.buffered.length > 0 ? v.buffered.end(v.buffered.length - 1) : null;
      console.warn("[Tentacle:TV] lecture figee", {
        position: Math.round(v.currentTime),
        avanceTampon: fin === null ? null : Math.round((fin - v.currentTime) * 10) / 10,
        pret: v.readyState,
        erreur: v.error?.code ?? null,
      });
    }, PERIODE_VEILLE_MS);

    return () => window.clearInterval(minuteur);
  }, []);
}
