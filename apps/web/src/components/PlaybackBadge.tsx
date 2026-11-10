import type { FlashKind, PlaybackFlash } from "../hooks/usePlaybackFlash";
import { usePlayerGlassMode } from "./player/glass/PlayerGlassContext";
import { isGlassLayout } from "./player/glass/playerGlassMode";
import { GlassSurface } from "./player/glass/GlassSurface";
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
 * Le composant n'est monté que le temps du flash (`usePlaybackFlash` le remet à
 * `null`) : rien ne subsiste dans la composition entre deux bascules.
 */
export function PlaybackBadge({ flash }: { flash: PlaybackFlash | null }) {
  const glass = isGlassLayout(usePlayerGlassMode());
  if (!flash) return null;

  // Lecteur en verre : une bulle de verre FIXE (sa région native ne bouge pas,
  // elle paraît et part avec le badge), le symbole seul fait son battement.
  if (glass) {
    return (
      <div key={flash.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-hidden="true">
        <GlassSurface className="lgp-badge lgp-badge--round" group="player-flash" variant="regular">
          <div className="flex h-full w-full animate-[playbackFlash_0.7s_ease-out_forwards] items-center justify-center">
            <Trace kind={flash.kind} />
          </div>
        </GlassSurface>
      </div>
    );
  }

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
