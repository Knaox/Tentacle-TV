import { useEffect } from "react";
import { hostTitleBar, hostTitleBarHeight } from "./hostChrome";
import { useHostFullscreen } from "../hooks/useHostFullscreen";

/**
 * Le bandeau de fenêtre que la page dessine à la place de la barre de titre.
 *
 * Sur la coquille Electron macOS, la fenêtre naît sans barre de titre — c'est ce
 * qui fait coïncider la page et le cadre (voir `main/window.ts`). Mais les feux
 * de circulation, eux, restent : ils se posaient sur l'affiche, sur le titre,
 * sur la vidéo. Et rien ne déclarait de zone de déplacement hors de la barre de
 * navigation, dont les liens et les boutons sont tous en `no-drag` : la fenêtre
 * n'était pratiquement pas déplaçable, et pas du tout depuis le lecteur.
 *
 * # Ce que ce composant fait, et ce qu'il délègue
 *
 * Il pose `data-hote-bandeau` et `--hote-bandeau` sur la racine, puis dessine la
 * bande. Tout le décalage du contenu est en CSS (`index.css`) : le remplissage
 * du `body`, la hauteur d'écran utile — sur cette coquille, « plein écran »
 * signifie désormais « la fenêtre moins sa bande » — et la barre de navigation
 * qui descend d'autant. Le faire là plutôt que composant par composant garantit
 * qu'une page ajoutée demain est servie sans qu'on y pense.
 *
 * ⚠️ RIEN DE CLIQUABLE DEDANS. `-webkit-app-region: drag` consomme les clics, et
 * chaque exception à déclarer en `no-drag` reprendrait à la fenêtre la prise
 * qu'on vient de lui rendre. C'est déjà ce qui rendait la barre de navigation
 * inutilisable comme poignée.
 *
 * # Le plein écran le démonte
 *
 * La fenêtre y a l'écran entier, les feux disparaissent, et le processus
 * principal cesse de retrancher la bande à la fenêtre de mpv
 * (`macosTitleBar.retraitBandeau`). La garder laisserait une bande opaque en
 * haut d'un film.
 */
export function HostTitleBar() {
  const fullscreen = useHostFullscreen();
  const active = hostTitleBar() && !fullscreen;

  useEffect(() => {
    const root = document.documentElement;
    if (!active) return;
    root.style.setProperty("--hote-bandeau", `${hostTitleBarHeight()}px`);
    root.dataset["hoteBandeau"] = "oui";
    return () => {
      delete root.dataset["hoteBandeau"];
      root.style.removeProperty("--hote-bandeau");
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="bandeau-hote fixed inset-x-0 top-0 z-[10000] flex select-none items-center justify-center bg-surface-0"
      style={{ height: "var(--hote-bandeau)" }}
    >
      <span className="text-xs font-medium text-content-tertiary">Tentacle TV</span>
    </div>
  );
}
