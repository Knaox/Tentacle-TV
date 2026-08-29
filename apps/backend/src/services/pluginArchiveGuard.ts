/**
 * Contrôle des membres d'une archive de greffon, AVANT extraction.
 *
 * # Pourquoi avant, et pas après
 *
 * `extractPlugin` lance `tar -xzf` dans un dossier de destination. Une archive
 * dont un membre s'appelle `../../serveur.js` écrit HORS de ce dossier — et le
 * vérifier après coup ne servirait à rien : le fichier serait déjà posé. Le
 * seul moment utile est avant, en listant l'archive (`tar -tzf`), qui n'écrit
 * rien.
 *
 * # Pourquoi ne pas se contenter des protections de tar
 *
 * GNU tar (Linux, Docker) et bsdtar (Windows) écartent tous deux les chemins
 * absolus et les `..` — mais pas de la même façon, pas avec les mêmes messages,
 * et pas toujours en échouant. L'invocation d'extraction, elle, a été réglée
 * finement pour fonctionner avec les DEUX saveurs sans option (voir le
 * commentaire d'`extractPlugin`) : y ajouter des drapeaux de sécurité propres à
 * l'une casserait l'autre. Un contrôle en amont, écrit ici, se comporte pareil
 * partout et se teste.
 *
 * # Ce que ça ne couvre pas
 *
 * Les liens symboliques. `tar -tzf` ne montre pas leur cible, et la sortie
 * verbeuse qui la montrerait n'a pas le même format d'une saveur à l'autre.
 * Les deux tars modernes refusent d'écrire à travers un lien lors de
 * l'extraction ; c'est un résidu assumé, pas une protection posée ici.
 *
 * Ce fichier n'importe rien et se teste seul.
 */

/** Un membre douteux, décrit en clair — ou `null` si l'archive est saine. */
export function unsafeMember(members: readonly string[]): string | null {
  for (const raw of members) {
    const member = raw.trim();
    if (member === "") continue;

    // Chemin absolu POSIX. `tar` le strippe en général, « en général » ne
    // suffit pas.
    if (member.startsWith("/") || member.startsWith("\\")) {
      return `chemin absolu : ${member}`;
    }

    // Lettre de lecteur Windows, et flux de données alternatif NTFS.
    if (/^[a-z]:/i.test(member) || member.includes(":")) {
      return `chemin absolu ou flux NTFS : ${member}`;
    }

    // Remontée. On teste les SEGMENTS, pas la sous-chaîne : un fichier nommé
    // `..donnees` est parfaitement légitime et ne doit pas être refusé.
    const segments = member.split(/[/\\]/);
    if (segments.includes("..")) {
      return `remontee de dossier : ${member}`;
    }
  }
  return null;
}

/**
 * Découpe la sortie de `tar -tzf` en membres.
 *
 * Séparée pour que le contrôle ci-dessus se teste sans invoquer `tar`, et pour
 * qu'un jour où la sortie changerait de forme, un seul endroit soit à reprendre.
 */
export function membersFromListing(listing: string): string[] {
  return listing.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
}

/**
 * L'URL de téléchargement d'un greffon est-elle acceptable ?
 *
 * Le registre est une source distante, et un administrateur peut en ajouter
 * une personnalisée : cette URL n'est donc pas de nous. On n'admet que HTTP et
 * HTTPS — un `file:` ferait lire le disque du SERVEUR, ce qui n'a aucun sens
 * pour un téléchargement de greffon.
 *
 * On ne bloque PAS les adresses privées : un registre auto-hébergé sur le
 * réseau local est un usage légitime ici — tout Tentacle vit sur un réseau
 * local. Le refuser casserait un cas normal pour un gain théorique.
 */
export function rejectedDownloadUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL de telechargement illisible";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return `schema refuse pour un telechargement : ${parsed.protocol}`;
  }
  return null;
}
