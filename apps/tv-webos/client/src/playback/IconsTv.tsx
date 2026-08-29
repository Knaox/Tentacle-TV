/**
 * Les icônes que le lecteur du téléviseur ajoute aux siennes.
 *
 * `apps/web/src/components/PlayerIcons.tsx` en porte treize, toutes reprises
 * telles quelles — c'est le vocabulaire visuel de l'application, et on ne le
 * redessine pas. Une seule manque, parce que le geste qu'elle nomme n'existe
 * pas sur un écran d'ordinateur : **entrer en déplacement**.
 *
 * Sur le web, on attrape la barre de progression à la souris ; il n'y a rien à
 * déclarer. À la télécommande, se déplacer dans le flux est un MODE — on y
 * entre, on vise, on confirme —, et un mode veut un bouton. `apps/tv` a le
 * sien (`ScrubIcon` de `components/icons/TVIcons.tsx`) : un trait vertical
 * encadré de deux triangles opposés, qui dit les deux sens à la fois sans
 * ressembler au saut de piste. On en reprend le tracé au pixel, transposé de
 * `react-native-svg` en SVG du document.
 *
 * Elle n'a pas sa place dans `apps/web`, qui n'a pas de mode déplacement — et
 * la règle de cette cible est de ne rien y ajouter.
 *
 * Convention de `PlayerIcons` respectée : `text-white` en dur dans les deux
 * thèmes, puisque l'icône est toujours posée sur une vidéo.
 */

export function MoveIcon() {
  return (
    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
      <rect x="11" y="5" width="2" height="14" rx="1" />
      <path d="M8 8l-5 4 5 4z" />
      <path d="M16 8l5 4-5 4z" />
    </svg>
  );
}
