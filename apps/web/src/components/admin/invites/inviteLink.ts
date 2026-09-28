/**
 * Le lien d'invitation une fois construit : savoir s'il sortira du réseau
 * local. Le copier et le partager passent par `lib/clipboard` et `lib/share`,
 * communs à tous les liens de l'application.
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
