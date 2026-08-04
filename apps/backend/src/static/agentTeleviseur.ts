/**
 * Qui a le droit de charger le client téléviseur.
 *
 * **Ce n'est pas un contrôle d'accès, et il ne faut pas le lire comme tel.** Un
 * en-tête `User-Agent` est écrit par le client : n'importe qui peut en poser un
 * autre, et c'est l'affaire d'une ligne de `curl`. Ce filtre est une adresse
 * qu'on ne donne pas, rien de plus.
 *
 * Rien de sensible n'en dépend, et c'est ce qui le rend acceptable : le client
 * téléviseur exige de toute façon une authentification — jeton d'appareil issu
 * du jumelage, ou cookie de session. Ce que le filtre évite est qu'un
 * ordinateur qui tombe sur l'adresse reçoive une interface de salon, dessinée
 * pour un canevas de 1280×720 agrandi par une dalle et pilotée à la
 * télécommande. C'est une erreur d'aiguillage qu'on empêche, pas une intrusion.
 *
 * **`Web0S` s'écrit avec un zéro.** C'est la graphie que LG met dans l'agent de
 * ses téléviseurs, et la confondre avec la lettre O suffit à ne jamais rien
 * laisser passer. Les deux graphies sont acceptées ici, la comparaison étant de
 * toute façon insensible à la casse.
 */

/** Ce qu'on accepte dans l'agent, en minuscules. */
const MARQUEURS_TELEVISEUR = ["web0s", "webos"];

/**
 * Le verrou s'ouvre hors production, et sur demande explicite.
 *
 * En développement, le client doit rester atteignable depuis un navigateur de
 * bureau : c'est le seul endroit où on puisse le regarder, l'émulateur de LG ne
 * tournant pas sur Apple Silicon. `TENTACLE_TV_OUVERT=1` rend le même service
 * sur un serveur de production, le temps d'un essai — la variable est lue à
 * chaque requête, pas au démarrage, pour qu'on n'ait pas à redémarrer.
 */
export function clientTvOuvertATous(): boolean {
  if (process.env.TENTACLE_TV_OUVERT === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/** Vrai si l'agent dit venir d'un téléviseur webOS. */
export function agentEstUnTeleviseur(agent: string | undefined): boolean {
  if (!agent) return false;
  const minuscules = agent.toLowerCase();
  return MARQUEURS_TELEVISEUR.some((marqueur) => minuscules.includes(marqueur));
}

/** Le chemin demandé relève-t-il du client téléviseur ? */
export function chemineVersLeClientTv(chemin: string): boolean {
  return chemin === "/tv" || chemin.startsWith("/tv/");
}
