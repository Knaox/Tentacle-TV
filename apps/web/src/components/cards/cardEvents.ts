/**
 * Un clic sur un contrôle de carte ne doit jamais naviguer : la carte entière
 * ouvre la fiche (ou lance la lecture), ses boutons ne font que leur geste.
 *
 * Les bascules elles-mêmes vivent dans `@tentacle-tv/api-client`
 * (`useCardToggles`) : le mobile et la télécommande lisent la même logique.
 */
export function stopCardClick(e: React.MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}
