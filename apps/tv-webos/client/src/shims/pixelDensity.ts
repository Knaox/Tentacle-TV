/**
 * La densité réelle de la dalle, mesurée.
 *
 * Substitué à `pixelDensity`. Le client compose sur un canevas de 1920 — c'est
 * `appinfo.json → resolution` qui le fixe — et le téléviseur l'agrandit vers sa
 * dalle. Une image demandée à sa taille CSS arrive donc à deux tiers de la
 * résolution où elle sera affichée, et TOUT paraît mou : les affiches, les
 * vignettes, et surtout le fond de bannière, qui couvre l'écran entier.
 *
 * **`devicePixelRatio` ne sert à rien ici** : mesuré à `0` sur webOS 4.0. On
 * prend donc le rapport entre la dalle et le canevas, que les deux moteurs
 * renseignent correctement — relevé sur l'émulateur : `screen.width` 1920,
 * `innerWidth` 1920, soit 1,5.
 *
 * Mesurée une seule fois : la dalle ne change pas de résolution en cours de
 * route, et un rapport qui varierait ferait changer les URL d'images d'un rendu
 * à l'autre — donc invaliderait le cache du navigateur à chaque fois.
 *
 * Bornée à 2. Au-delà, ce n'est plus une dalle mais une mesure fausse, et la
 * conséquence serait de demander des images inutilement lourdes au serveur.
 */

let mesuree: number | null = null;

export function pixelDensity(): number {
  if (mesuree !== null) return mesuree;
  mesuree = 1;
  try {
    const canevas = window.innerWidth;
    const dalle = window.screen && window.screen.width;
    if (canevas > 0 && dalle > 0) {
      const rapport = dalle / canevas;
      if (rapport > 1 && rapport <= 2) mesuree = rapport;
    }
  } catch {
    // Pas de `screen` : on reste à 1, c'est-à-dire au comportement du web.
  }
  return mesuree;
}
