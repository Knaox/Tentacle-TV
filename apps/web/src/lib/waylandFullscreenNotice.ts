/**
 * Avis « première fois » du plein écran Wayland.
 *
 * Sous Wayland la lecture native est OBLIGATOIREMENT plein écran : un client ne
 * place pas ses fenêtres (règle du protocole), celle de mpv ne peut donc être
 * calée sur la nôtre qu'en plein écran — c'est le prix du HDR. Le réglage des
 * Préférences (session X11) offre le fenêtré, mais encore faut-il savoir qu'il
 * existe : un toast unique y renvoie, à la première lecture native sous ce
 * montage. Même patron que `hdrPreference.ts` : localStorage, silencieux si le
 * stockage manque.
 */

const CLE = "tentacle_wayland_fullscreen_notice";

/** L'avis a-t-il déjà été montré sur cet appareil ? */
export function avisPleinEcranDejaVu(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    // Stockage indisponible : impossible de retenir « déjà vu » — mieux vaut
    // se taire que répéter l'avis à chaque lecture.
    return true;
  }
}

/** Retient que l'avis a été montré. */
export function marquerAvisPleinEcranVu(): void {
  try {
    localStorage.setItem(CLE, "1");
  } catch {
    /* stockage indisponible : l'avis ne sera de toute façon pas remontré */
  }
}
