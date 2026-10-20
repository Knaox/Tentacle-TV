/**
 * L'heure et la batterie pendant la lecture : la barre d'état du SYSTÈME
 * paraît avec les commandes et s'en va avec elles.
 *
 * iOS masque d'office la barre d'état d'un iPhone en paysage (classe de taille
 * verticale compacte) : `prefersStatusBarHidden` n'y peut rien. Là — et
 * seulement là —, le lecteur dessine sa propre heure et sa batterie dans le
 * coin des commandes. Partout ailleurs (iPad, iPhone en portrait, Android,
 * qui la rend même en plein écran immersif), c'est la vraie barre.
 *
 * Image dans l'image : rien, ni barre ni heure.
 */
export interface StatusBarInput {
  os: "ios" | "android" | string;
  isTablet: boolean;
  landscape: boolean;
  controlsVisible: boolean;
  pipActive: boolean;
}

export interface StatusBarPlan {
  /** La barre d'état du système est-elle affichée ? */
  systemBar: boolean;
  /** Le lecteur dessine-t-il son heure et sa batterie ? */
  inlineClock: boolean;
}

/** Le système sait-il montrer sa barre d'état dans cette disposition ? */
export function systemStatusBarAvailable(os: string, isTablet: boolean, landscape: boolean): boolean {
  if (os !== "ios") return true;
  return isTablet || !landscape;
}

export function statusBarPlan(input: StatusBarInput): StatusBarPlan {
  if (input.pipActive || !input.controlsVisible) return { systemBar: false, inlineClock: false };
  const available = systemStatusBarAvailable(input.os, input.isTablet, input.landscape);
  return { systemBar: available, inlineClock: !available };
}

/**
 * La marge du haut des commandes, STABLE : la plus grande marge sûre vue dans
 * cette orientation. Montrer puis masquer la barre d'état fait varier la
 * marge sûre (Android bord à bord, iPad) ; la suivre ferait sauter la barre du
 * haut à chaque apparition. L'image, elle, n'en dépend pas.
 */
export function stableTopInset(previousMax: number | undefined, current: number): number {
  return Math.max(previousMax ?? 0, current);
}
