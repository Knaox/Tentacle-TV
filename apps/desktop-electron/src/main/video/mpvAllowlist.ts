/**
 * Liste blanche de la frontière mpv.
 *
 * # Pourquoi ce fichier existe
 *
 * `mpv_command` acceptait n'importe quel nom de commande, `mpv_set_property`
 * n'importe quelle propriété, et `mpv_init` n'importe quelle option. Or la
 * libmpv du dépôt — mpv v0.41.0-233, relevé par sonde et non supposé — expose
 * **85 commandes**, dont `run`, `subprocess` et `load-script`, et **959
 * propriétés**, parmi lesquelles les options `scripts`, `input-ipc-server`,
 * `input-conf` et `log-file`.
 *
 * Autrement dit : n'importe quel script s'exécutant dans la page pouvait lancer
 * un programme sur la machine, HORS du bac à sable de Chromium. La page n'est
 * pas censée être hostile — mais l'utilisateur saisit lui-même l'adresse d'un
 * serveur Jellyfin quelconque, et les greffons viennent d'un registre distant.
 * Une exécution de script dans le rendu n'est pas une hypothèse d'école : c'est
 * le scénario contre lequel toute la coquille est bâtie (bac à sable, isolation
 * de contexte, CSP par empreintes). Laisser cette porte ouverte annulait le
 * bénéfice de tout le reste.
 *
 * La surface réellement utilisée par `apps/web` est PETITE : cinq commandes,
 * une douzaine de propriétés, une trentaine d'options. La fermer ne coûte donc
 * rien à la fonctionnalité.
 *
 * # Pourquoi l'arité est bornée
 *
 * Ce n'est pas de la coquetterie. `loadfile` accepte un QUATRIÈME argument qui
 * porte des options par fichier (`loadfile <url> <flags> <index> <options>`) :
 * le laisser passer rouvrirait par la bande tout ce que la liste d'options
 * ferme. On n'accepte donc que le nombre d'arguments que la page émet
 * réellement.
 *
 * De même, `set` et `cycle` sont des écrivains de propriété GÉNÉRIQUES : les
 * filtrer sur le seul nom de commande ne servirait à rien. Leur premier
 * argument passe par la liste des propriétés.
 *
 * # Ce qui n'est PAS filtré, et pourquoi
 *
 * La LECTURE (`mpv_get_property`) reste libre. Lire ne donne aucune exécution,
 * et le panneau de diagnostic interroge des propriétés arbitraires. Ce que la
 * lecture peut révéler — l'URL en cours, par exemple — la page le connaît déjà.
 *
 * # Étendre
 *
 * Une commande, une propriété ou une option nouvelle côté `apps/web` doit être
 * ajoutée ICI, sinon elle est refusée. `mpvAllowlist.test.ts` relit le source
 * de `apps/web` et échoue si les deux divergent : la dérive ne peut pas passer
 * inaperçue.
 */

/** Valeur scalaire acceptée par mpv, telle que la page l'envoie. */
export type ValeurMpv = string | number | boolean;

/**
 * Commandes autorisées, et NOMBRE MAXIMAL d'arguments de chacune.
 *
 * Les valeurs viennent du balayage de `apps/web` :
 *   seek(pos, mode) · set(propriété, valeur) · cycle(propriété)
 *   loadfile(url) · sub-add(url, mode)
 */
const COMMANDES: ReadonlyMap<string, number> = new Map([
  ["seek", 2],
  ["set", 2],
  ["cycle", 1],
  ["loadfile", 1],
  ["sub-add", 2],
]);

/** Commandes dont le PREMIER argument est un nom de propriété. */
const ECRIVAINS_DE_PROPRIETE: ReadonlySet<string> = new Set(["set", "cycle"]);

/**
 * Propriétés que la page a le droit d'ÉCRIRE.
 *
 * Deux origines, et les deux comptent :
 *  - le lecteur de production (`useMpvCommands`, `useMpvLifecycle`,
 *    `useDesktopPlayer`) ;
 *  - le panneau de diagnostic (`apps/web/src/dev/playerDebugActions.ts`), qui
 *    n'existe pas dans un build de production mais sert en développement. Ses
 *    quatre bascules sont des réglages de RENDU : elles ne donnent accès à rien.
 */
const PROPRIETES_ECRITURE: ReadonlySet<string> = new Set([
  // Transport
  "pause",
  "speed",
  "start",
  // Son
  "volume",
  "mute",
  "ao-volume",
  // Pistes
  "aid",
  "sid",
  "sub-visibility",
  // Panneau de diagnostic — réglages de rendu uniquement
  "hwdec",
  "tone-mapping",
  "target-prim",
  "target-colorspace-hint",
]);

/**
 * Options acceptées à l'initialisation de mpv.
 *
 * Reprises une à une de `buildMpvInitOptions` (`apps/web/src/hooks/mpvRuntime.ts`).
 * Tout ce qui n'est pas là est IGNORÉ silencieusement, jamais rejeté : une
 * option inconnue de mpv ne l'est déjà jamais — mpv la signale et continue —,
 * et faire échouer `mpv_init` pour ça empêcherait toute lecture.
 *
 * ⚠️ `log-file` fait écrire un fichier au chemin que la page indique. On le
 * garde : c'est le journal verbeux de mpv, indispensable pour diagnostiquer un
 * flux HLS qui ne démarre pas, et il est déjà derrière un drapeau. Le résidu
 * est assumé et documenté — il exige de toute façon une exécution de script
 * dans la page, et n'offre alors qu'une écriture de journal, là où `scripts`
 * offrait une exécution de code.
 */
const OPTIONS_INIT: ReadonlySet<string> = new Set([
  // Sortie vidéo et décodage
  "vo",
  "hwdec",
  "keep-open",
  "force-window",
  "hr-seek",
  // Chaîne de rendu macOS. `gpu-api`/`gpu-context` désignent un backend, pas un
  // fichier ni un programme : une valeur inconnue fait au pire échouer la
  // sortie vidéo. `target-colorspace-hint` est le drapeau dont dépend tout le
  // HDR — sans lui dans cette liste, il serait écarté EN SILENCE et l'image
  // sortirait en sRGB sans que rien ne le signale.
  "gpu-api",
  "gpu-context",
  "target-colorspace-hint",
  "border",
  "auto-window-resize",
  // Entrées de la fenêtre enfant — toutes désarmées, cf. mpvRuntime.ts
  "window-dragging",
  "input-cursor",
  "input-builtin-bindings",
  "input-media-keys",
  "native-touch",
  "cursor-autohide",
  "input-default-bindings",
  "input-vo-keyboard",
  "osc",
  // Cache et réseau
  "cache",
  "cache-pause-wait",
  "demuxer-max-bytes",
  "demuxer-max-back-bytes",
  "demuxer-readahead-secs",
  "network-timeout",
  "stream-lavf-o",
  "demuxer-lavf-o",
  // Identité affichée
  "force-media-title",
  "audio-client-name",
  "title",
  // Diagnostic, derrière un drapeau côté page
  "log-file",
  "msg-level",
]);

/** Motif du refus, ou `null` si la commande passe. */
export function refuserCommande(nom: string, args: readonly string[]): string | null {
  const arite = COMMANDES.get(nom);
  if (arite === undefined) return `commande refusee : ${nom}`;
  if (args.length > arite) {
    // Le NOMBRE seulement, jamais les arguments : ce message part dans un
    // journal, et l'URL d'un `loadfile` porte un jeton.
    return `commande ${nom} : ${String(args.length)} arguments, ${String(arite)} au plus`;
  }

  if (!ECRIVAINS_DE_PROPRIETE.has(nom)) return null;

  const propriete = args[0];
  if (propriete === undefined) return `commande ${nom} : propriete manquante`;
  // Le nom d'une propriété n'est pas un secret, et sans lui le message ne
  // désigne rien — `set` sert à écrire n'importe laquelle.
  if (!PROPRIETES_ECRITURE.has(propriete)) return `propriete refusee : ${propriete}`;
  return null;
}

/** Motif du refus d'une écriture directe de propriété, ou `null`. */
export function refuserEcriture(nom: string): string | null {
  return PROPRIETES_ECRITURE.has(nom) ? null : `propriete refusee : ${nom}`;
}

/** Options retenues, et noms de celles qui ont été écartées. */
export interface OptionsFiltrees {
  retenues: Record<string, ValeurMpv>;
  refusees: string[];
}

/** Ne garde que les options connues. Les autres sont écartées sans bruit. */
export function filtrerOptionsInit(
  options: Readonly<Record<string, ValeurMpv>>,
): OptionsFiltrees {
  const retenues: Record<string, ValeurMpv> = {};
  const refusees: string[] = [];
  for (const [nom, valeur] of Object.entries(options)) {
    if (OPTIONS_INIT.has(nom)) retenues[nom] = valeur;
    else refusees.push(nom);
  }
  return { retenues, refusees };
}

/** Vues en lecture seule, pour les tests et pour l'inventaire du rapport. */
export const INVENTAIRE = {
  commandes: (): string[] => [...COMMANDES.keys()],
  proprietes: (): string[] => [...PROPRIETES_ECRITURE],
  options: (): string[] => [...OPTIONS_INIT],
} as const;
