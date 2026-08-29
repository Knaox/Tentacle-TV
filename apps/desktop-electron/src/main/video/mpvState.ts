/**
 * L'état de mpv, tenu à jour par ce que mpv NOUS envoie.
 *
 * # Pourquoi un souvenir, et pas une lecture à la demande
 *
 * ⚠️ C'est la leçon la plus chère de la phase 1, apprise deux fois.
 *
 * `mpv_get_property_string` est synchrone et prend le verrou du cœur de mpv.
 * Pour une propriété qui dépend de la sortie vidéo, mpv doit toucher sa
 * `NSWindow` — donc passer par le thread principal. Appelée DEPUIS ce même
 * thread, la lecture attend un thread qui l'attend : blocage parfait, sans un
 * pourcent de processeur, sans message d'erreur.
 *
 * Constaté sous deux visages : d'abord au démarrage en interrogeant
 * `window-id`, puis EN FIN DE FICHIER, où mpv reconfigure sa sortie pendant
 * qu'on l'interroge. Le second est le plus vicieux — tout marche pendant
 * plusieurs minutes, et l'application se fige au générique.
 *
 * `mpv_observe_property` ne souffre pas de ce défaut : les changements arrivent
 * par la file d'évènements, que l'on vide déjà. Sur macOS on ne demande donc
 * plus rien à mpv — on écoute, et on se souvient.
 *
 * Windows conserve la lecture directe : sa fenêtre vidéo est une fenêtre enfant
 * Win32 sans couplage au thread principal, et rien n'y a jamais bloqué.
 */

/** Ce que mpv nous a dit, et rien d'autre. */
const values = new Map<string, string>();

/**
 * Retient un changement de propriété, sous la forme qu'une lecture rendrait.
 *
 * Les booléens deviennent `yes`/`no` : c'est ce que rend `mpv_get_property_string`,
 * et l'appelant ne doit pas avoir à savoir d'où vient la valeur.
 */
export function remember(name: string, value: unknown): void {
  if (value === null || value === undefined) {
    values.delete(name);
    return;
  }
  if (typeof value === "boolean") {
    values.set(name, value ? "yes" : "no");
    return;
  }
  values.set(name, String(value));
}

/** Dernière valeur connue, ou `null` si mpv n'en a jamais parlé. */
export function knownValue(name: string): string | null {
  return values.get(name) ?? null;
}

/**
 * Oublie tout — entre deux instances mpv.
 *
 * Sans cela, la lecture suivante hériterait des valeurs de la précédente : un
 * épisode SDR affichant encore le `bt.2020` de l'épisode HDR d'avant.
 */
export function forgetState(): void {
  values.clear();
}
