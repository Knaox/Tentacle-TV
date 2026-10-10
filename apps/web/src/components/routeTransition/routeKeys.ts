/**
 * Clés des transitions de page : ce qui, d'une adresse à l'autre, compte pour
 * « une autre page ».
 *
 * La clé change → la page quittée sort en fondu, la suivante joue son entrée.
 * La clé reste → le contenu se met à jour en place, sans sortie : changer un
 * filtre, une section des réglages ou passer d'une fiche à la suivante ne doit
 * pas faire clignoter tout l'écran.
 */

/**
 * Premiers segments des routes rendues HORS de la coquille (`AppLayout`) : les
 * écrans immersifs et ceux d'avant la connexion. Tout le reste vit dans la
 * coquille — y compris les pages des plugins, dont le chemin n'est connu qu'à
 * l'exécution, et l'adresse inconnue (`NotFound`). Les redirections pures
 * (`/setup`, `/preferences`) n'y figurent pas : elles ne rendent rien, leur
 * donner une clé ferait sortir un `<Navigate>` en fondu.
 */
const OUTSIDE_SHELL = new Set(["login", "register", "share", "watch", "media", "person", "offline"]);

const segments = (pathname: string): string[] => pathname.split("/").filter(Boolean);

/**
 * Niveau 1, autour de `<Routes>` : la coquille entière est UNE page. Passer de
 * l'accueil à une fiche fait sortir la coquille ; passer de l'accueil aux
 * favoris ne la touche pas (le niveau 2 s'en charge, sous la barre).
 */
export function routeGroupKey(pathname: string): string {
  const first = segments(pathname)[0] ?? "";
  return OUTSIDE_SHELL.has(first) ? first : "shell";
}

/**
 * Niveau 2, autour de l'`<Outlet>` de la coquille : la SECTION, pas l'adresse.
 * Les réglages et l'administration gardent leur rail : leurs sous-pages
 * changent sous lui sans sortie de l'ensemble. Une bibliothèque, en revanche,
 * est une page à part entière — on passe de l'une à l'autre par les onglets de
 * la barre, comme d'une section à une autre.
 */
export function shellSectionKey(pathname: string): string {
  const [first = "", second] = segments(pathname);
  return first === "library" && second ? `library/${second}` : first;
}
