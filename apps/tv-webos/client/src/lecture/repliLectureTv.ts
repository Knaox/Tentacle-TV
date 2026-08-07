import { useEffect, useRef } from "react";
import { useWebPlaybackFallbacks as repliWeb } from "@/hooks/useWebPlaybackFallbacks?original";
import type { MediaSource } from "@tentacle-tv/shared";
import { signalerEchecLecture } from "./repliLecture";

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

  return base;
}
