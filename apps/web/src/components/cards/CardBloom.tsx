interface CardBloomProps {
  /** La carte est visée par le curseur. */
  on: boolean;
  /**
   * Image DÉJÀ affichée par la carte. C'est la source de lumière : le halo
   * n'est pas une couleur de marque mais l'affiche elle-même, floutée — ses
   * teintes sont donc celles du média, par construction.
   *
   * Strictement la même URL que la carte, jamais une seconde version : elle est
   * déjà décodée et en cache, le halo ne coûte pas un octet ni un aller-retour.
   *
   * Encore fallait-il que la carte l'ait effectivement demandée : cette <img>
   * étant `eager` alors que `CardImage` est `lazy`, c'était le HALO qui
   * déclenchait le téléchargement, et le chargement différé des affiches ne
   * servait plus à rien. D'où le `loading="lazy"` ci-dessous.
   */
  imageUrl: string;
  /**
   * Reprendre le halo DÉJÀ éclos, sans rejouer l'éclosion.
   *
   * Pour le panneau d'aperçu : il prend le relais d'une carte qui vient
   * d'allumer le sien et qui s'efface en même temps. Rejouer l'éclosion
   * donnerait deux détonations à un cinquième de seconde d'intervalle, là où le
   * geste doit se lire comme une seule lumière qui change de porteur.
   */
  settled?: boolean;
}

/**
 * Halo de ciblage : la lumière qui éclot autour d'une carte survolée, puis
 * dérive imperceptiblement tant que le curseur reste dessus.
 *
 * Toute l'apparence vit dans la feuille de style (`theme/surfaces.css`, classe
 * `card-bloom`) — ce composant n'est que le point de montage. C'est délibéré :
 * une rangée affiche une dizaine de cartes, et faire piloter l'animation par
 * React imposerait un rendu par image. Ici React ne fait que basculer un
 * attribut ; le compositeur fait tout le reste.
 *
 * À poser en PREMIER enfant d'un conteneur `relative`. L'empilement ne repose
 * sur aucun z-index : entre éléments positionnés sans z-index, le dernier du
 * DOM peint par-dessus, donc l'affiche recouvre le halo et il n'en reste que le
 * pourtour. Un `z-index: -1` aurait paru plus explicite mais l'aurait fait
 * passer derrière le FOND de tout ancêtre opaque, c'est-à-dire disparaître.
 */
export function CardBloom({ on, imageUrl, settled = false }: CardBloomProps) {
  return (
    <div aria-hidden data-on={on} data-settled={settled} className="card-bloom">
      {/* Boîte de rendu sous-échelle : le flou est calculé sur le quart de la
          surface, puis agrandi par le compositeur (cf. `.card-bloom-render`). */}
      <div className="card-bloom-render">
        <img src={imageUrl} alt="" draggable={false} loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
