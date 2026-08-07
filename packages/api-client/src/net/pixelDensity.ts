/**
 * Pixels physiques par pixel CSS, appliqué aux dimensions demandées à Jellyfin.
 *
 * Les appelants raisonnent en pixels CSS — « cette affiche fait 450 de haut » —
 * et c'est bien ce qu'il faut : ils décrivent une mise en page, pas un capteur.
 * Mais l'image, elle, doit être demandée dans la résolution où elle sera
 * RASTÉRISÉE. Quand une couche compose à 1280 pour une dalle de 1920, une image
 * livrée à sa taille CSS est agrandie de moitié à l'affichage, et tout le rendu
 * paraît mou sans qu'aucune mesure de mise en page ne soit fausse.
 *
 * Neutre ici, et volontairement : le client web tourne dans un navigateur dont
 * le `devicePixelRatio` est déjà pris en compte par le navigateur lui-même pour
 * les images, et doubler le poids du fil pour tous les écrans HiDPI serait un
 * changement d'un tout autre ordre. La cible téléviseur, elle, substitue cette
 * fonction — c'est le seul contexte du dépôt où la composition et la dalle ne
 * partagent pas la même échelle.
 */
export function pixelDensity(): number {
  return 1;
}
