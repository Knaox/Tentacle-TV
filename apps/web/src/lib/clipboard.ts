/**
 * Copier du texte dans le presse-papiers, où que tourne l'application.
 *
 * Deux voies, dans cet ordre :
 *
 * 1. l'API asynchrone, `navigator.clipboard.writeText`. Elle n'existe qu'en
 *    contexte sécurisé — un serveur ouvert en `http://192.168.…` ne l'a pas —
 *    et elle peut être refusée : c'était le cas de toute la coquille Electron,
 *    dont la politique de permissions l'interdisait (cf.
 *    `apps/desktop-electron/src/main/security.ts`) ;
 * 2. `document.execCommand("copy")` sur un champ caché, dépréciée mais
 *    universelle tant que l'activation de l'utilisateur court encore.
 *
 * Rend `true` si le texte est parti. Un `false` doit SE VOIR : l'appelant dit
 * l'échec et laisse le texte sélectionnable, jamais un silence — c'est un
 * `catch` muet qui faisait passer le bouton « Copier » du bureau pour mort.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refusée : l'ancienne voie reste possible */
  }
  return copyWithSelection(text);
}

/**
 * L'ancienne voie : un champ hors de la vue, sélectionné, copié, retiré — en
 * rendant le focus à qui l'avait (le bouton, dans une modale piégée).
 */
function copyWithSelection(text: string): boolean {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);
  try {
    area.select();
    // iOS ne sélectionne rien d'un champ en lecture seule par `select()` seul.
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previous?.focus();
  }
}
