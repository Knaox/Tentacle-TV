import type { FlashKind, PlaybackFlash } from "../hooks/usePlaybackFlash";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerXIcon } from "@phosphor-icons/react/dist/csr/SpeakerX";
import { PauseIcon, PlayIcon } from "./icons/transport";

/**
 * L'icône qui s'affiche au centre à chaque bascule du lecteur — lecture/pause
 * et son coupé/rétabli.
 *
 * # Un seul style dans le cercle
 *
 * ⚠️ Le premier jet mélangeait des tracés pleins improvisés pour la pause avec
 * le haut-parleur au trait des contrôles : deux styles dans le même cercle, et
 * le résultat jurait. Depuis la refonte de nov. 2026 le transport est PLEIN
 * partout (`icons/transport`) ; le haut-parleur du badge l'est donc aussi —
 * les quatre symboles sont ceux de Phosphor, à la même graisse.
 *
 * # Ce que ce badge ne fait pas
 *
 * Même famille que `SkipBadge`, et les mêmes contraintes :
 *
 *  - couleurs EN DUR (`bg-black`, `text-white`) : posé sur la vidéo, pas sur une
 *    surface du thème, il doit rester lisible en clair comme en sombre ;
 *  - **pas de `backdrop-filter`.** Sur les trois bureaux, mpv ne dessine pas
 *    dans le moteur web : celui-ci ne voit jamais l'image du film et ne peut
 *    donc pas l'échantillonner. Un flou posé ici ne flouterait rien et
 *    coûterait quand même une couche composée par image ;
 *  - l'animation ne touche QUE `opacity` et `transform` — tout le reste
 *    déclenche une peinture par image, et sur un élément centré plein écran
 *    c'est le viewport entier qui serait repeint.
 *
 * # Jamais en verre
 *
 * Sous le Liquid Glass aussi, c'est la pastille d'ENCRE des commandes (nov. 2026 : sur la vidéo,
 * seuls les menus et les avis sont en verre). La bulle de verre d'avant portait la classe
 * `lgp-badge`, qui est AUSSI celle de la pastille de vitesse d'un bouton (`playerGlassButtons.css` :
 * `position: absolute; top; right`, fond clair) : le badge partait en haut à droite, en disque blanc.
 *
 * Le composant n'est monté que le temps du flash (`usePlaybackFlash` le remet à
 * `null`) : rien ne subsiste dans la composition entre deux bascules.
 */
export function PlaybackBadge({ flash }: { flash: PlaybackFlash | null }) {
  if (!flash) return null;

  return (
    <div
      key={flash.id}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="flex h-[84px] w-[84px] animate-[playbackFlash_0.7s_ease-out_forwards] items-center justify-center rounded-full bg-[rgba(24,24,27,0.74)]">
        <Trace kind={flash.kind} />
      </div>
    </div>
  );
}

/**
 * Les quatre symboles : le transport est PLEIN (`icons/transport`, règle de la refonte), le
 * haut-parleur vient du jeu des contrôles — le badge montre ce que le bouton montre.
 */
function Trace({ kind }: { kind: FlashKind }) {
  const size = "h-10 w-10 text-white";
  if (kind === "pause") return <PauseIcon className={size} aria-hidden />;
  // Décalé d'un point : un triangle centré géométriquement paraît trop à gauche.
  if (kind === "play") return <PlayIcon className={`ml-1 ${size}`} aria-hidden />;
  return kind === "mute"
    ? <SpeakerXIcon className={size} weight="fill" aria-hidden />
    : <SpeakerHighIcon className={size} weight="fill" aria-hidden />;
}
