/**
 * Le lien d'invitation une fois construit : savoir s'il sortira du réseau
 * local, le copier, le partager.
 */

const PRIVATE_SUFFIXES = [".localhost", ".local", ".lan", ".home.arpa", ".internal"];

/**
 * Un lien que seul le réseau local sait ouvrir : `localhost`, une adresse
 * privée (IPv4 ou IPv6), ou un nom sans domaine (`http://nas:3000`). Envoyé à
 * quelqu'un d'extérieur, il ne mène nulle part.
 */
export function isLocalOnlyUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (!host) return false;
  if (host === "localhost" || PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (host.includes(":")) {
    return host === "::1" || /^f[cd]/.test(host) || host.startsWith("fe80");
  }
  // Un nom sans point : un hôte du réseau (NAS, conteneur), pas un domaine.
  return !host.includes(".");
}

/**
 * Copie dans le presse-papiers. L'API asynchrone n'existe qu'en contexte
 * sécurisé : un administrateur qui ouvre son serveur en `http://192.168.…`
 * ne l'a pas — l'ancien bouton levait alors une erreur muette. Repli sur
 * `execCommand`, qui marche partout, en rendant le focus à qui l'avait.
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
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previous?.focus();
  }
}

/** Le partage natif (mobile, macOS, Windows) — absent de Linux et de Firefox. */
export function canShareNatively(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
