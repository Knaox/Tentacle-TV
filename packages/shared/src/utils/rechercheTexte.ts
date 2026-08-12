/**
 * Comparaison de texte pour les recherches — mesurée sur le serveur, pas devinée.
 *
 * # Ce que fait Jellyfin, relevé sur une bibliothèque réelle
 *
 * `searchTerm` compare le terme au nom nettoyé de l'élément, en ignorant la
 * casse et les accents (« heros » trouve « héros »), mais en traitant la
 * **ponctuation au pied de la lettre** :
 *
 * | terme envoyé   | résultats |
 * |----------------|-----------|
 * | `Spider-Man`   | 7         |
 * | `Spider Man`   | **0**     |
 * | `spiderman`    | **0**     |
 * | `spider`       | 8         |
 * | `destin d'un`  | 1         |
 * | `destin dun`   | **0**     |
 *
 * Deux enseignements décident de toute la conception. D'abord, **normaliser le
 * terme envoyé ne sert à rien** : ni « spider man » ni « spiderman » ne
 * rattrapent « Spider-Man », puisque le tiret est dans la chaîne comparée.
 * Ensuite, un **mot isolé passe toujours** — c'est la seule porte de sortie.
 *
 * D'où la stratégie : on envoie le terme tel qu'il est tapé, et seulement s'il
 * ne rend rien, on réessaie avec son mot le plus long, puis on reclasse. Le cas
 * qui marchait déjà n'est jamais touché.
 *
 * La normalisation, elle, sert à COMPARER en local — le classement des
 * résultats et les filtres de listes en mémoire.
 */

/** Marques de combinaison laissées par la décomposition NFD. */
const DIACRITIQUES = /[̀-ͯ]/g;

/**
 * Séparateurs remplacés par une espace. Liste explicite plutôt que `\P{L}` :
 * les classes Unicode ne sont pas garanties sous Hermes, et surtout une classe
 * générique écraserait les alphabets non latins — un titre japonais deviendrait
 * une chaîne vide.
 *
 * La ponctuation asiatique y figure aussi, mais pas le prolongateur katakana
 * « ー », qui est une lettre : le retirer changerait le mot.
 */
const SEPARATEURS = /[-_.,;:!?'"`´’‘“”«»()[\]{}<>/\\|@#$%^&*+=~·–—。、・「」『』（）【】！？：；]+/g;

/**
 * Forme comparable : sans accents, sans casse, ponctuation ramenée à des
 * espaces. « Spider-Man : No Way Home » → « spider man no way home ».
 */
export function normaliserRecherche(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .toLowerCase()
    .replace(SEPARATEURS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longueur en deçà de laquelle un mot ne discrimine plus rien. */
const MOT_MINIMAL = 3;

/**
 * Terme de secours quand la recherche telle quelle n'a rien donné : le mot le
 * plus long de la saisie.
 *
 * Le plus long parce que c'est le plus discriminant : « Spider Man » retombe sur
 * « spider » et non sur « man ». `null` quand il n'y a qu'un mot — réessayer le
 * même terme serait un aller-retour pour rien.
 */
export function termeDeRepli(requete: string): string | null {
  const mots = normaliserRecherche(requete).split(" ").filter(Boolean);
  if (mots.length < 2) return null;

  let meilleur = "";
  for (const mot of mots) if (mot.length > meilleur.length) meilleur = mot;
  return meilleur.length >= MOT_MINIMAL ? meilleur : null;
}

/* Paliers. Les écarts sont larges à dessein : le départage interne affine le
 * classement à l'intérieur d'un palier, il ne doit jamais en faire changer. */
const EXACT = 1000;
const PREFIXE = 800;
const SOUS_CHAINE = 600;
/**
 * Même chaîne une fois les espaces retirés de part et d'autre. Rattrape ce que
 * la saisie a soudé ou disjoint : « destin dun heros » retrouve « Destin d'un
 * héros », dont l'apostrophe fait deux mots là où l'utilisateur en a tapé un.
 */
const SOUS_CHAINE_SOUDEE = 500;
/** Tous les mots présents, mais dispersés : « Destin héros » sur « Le Destin d'un héros ». */
const MOTS_EPARS = 400;

/**
 * Pertinence d'un candidat pour une requête, de 0 (aucun rapport) à 1000.
 *
 * Sert à reclasser une réponse élargie. Un score nul signifie que le résultat
 * n'a été remonté que par le terme de repli et ne répond pas à la saisie
 * complète — il vaut mieux ne pas l'afficher que de le montrer en queue.
 */
export function scoreRecherche(candidat: string, requete: string): number {
  const c = normaliserRecherche(candidat);
  const q = normaliserRecherche(requete);
  if (!c || !q) return 0;

  if (c === q) return EXACT;
  if (c.startsWith(q)) return PREFIXE - penalite(c, q);

  const pos = c.indexOf(q);
  if (pos >= 0) return SOUS_CHAINE - Math.min(pos, 60) - penalite(c, q);

  const posSoudee = c.replace(/ /g, "").indexOf(q.replace(/ /g, ""));
  if (posSoudee >= 0) return SOUS_CHAINE_SOUDEE - Math.min(posSoudee, 60) - penalite(c, q);

  /* Dernier recours : les mots y sont tous, ailleurs et dans le désordre. Le
   * préfixe suffit, pour que « destin » attrape « destinée ». */
  const motsCandidat = c.split(" ");
  const tousPresents = q.split(" ").every(
    (mot) => motsCandidat.some((m) => m.startsWith(mot)),
  );
  return tousPresents ? MOTS_EPARS - penalite(c, q) : 0;
}

/**
 * Départage à l'intérieur d'un palier : à égalité, le titre le plus court est
 * le plus proche de ce qui a été demandé. Plafonnée bien en dessous de l'écart
 * entre deux paliers.
 */
function penalite(candidat: string, requete: string): number {
  return Math.min(Math.max(candidat.length - requete.length, 0), 100);
}

/** Version booléenne, pour les listes filtrées en mémoire. */
export function correspondALaRecherche(candidat: string, requete: string): boolean {
  if (!requete.trim()) return true;
  return scoreRecherche(candidat, requete) > 0;
}
