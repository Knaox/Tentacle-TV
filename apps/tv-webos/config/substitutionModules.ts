import type { Plugin } from "vite";

/**
 * Remplace un module par un autre, à chemin résolu.
 *
 * `resolve.alias` de Vite agit sur le **spécificateur** écrit dans l'import.
 * Il attrape donc `framer-motion`, mais jamais le `./browser` relatif que
 * `lib/deviceProfile/index.ts` écrit pour désigner son voisin. Or c'est
 * précisément ce genre d'import qu'il faut détourner pour donner au téléviseur
 * son profil d'appareil sans poser une condition de plateforme dans `apps/web`.
 *
 * Le plugin résout d'abord — en déléguant à la chaîne normale, `skipSelf`
 * évitant de se rappeler lui-même — puis compare le chemin absolu obtenu à la
 * table. Il s'exécute en `pre` pour passer avant le résolveur de Vite.
 *
 * Une substitution déclarée mais jamais déclenchée est presque toujours une
 * faute de frappe dans un chemin. Le plugin le signale en fin de build plutôt
 * que de laisser le module d'origine partir dans le bundle en silence.
 */
export function substitutionModules(table: Record<string, string>): Plugin {
  const declenchees = new Set<string>();

  return {
    name: "tentacle-substitution-modules",
    enforce: "pre",

    async resolveId(source, importateur, options) {
      // Sans importateur, c'est un point d'entrée : il n'y a rien à détourner.
      if (!importateur) return null;

      const resolu = await this.resolve(source, importateur, { ...options, skipSelf: true });
      if (!resolu) return null;

      // Vite suffixe les identifiants (`?url`, `?worker`, `?v=…`) ; la table
      // ne connaît que des chemins de fichier.
      const chemin = resolu.id.split("?")[0];
      const remplacement = table[chemin];
      if (!remplacement) return null;

      const cible = await this.resolve(remplacement, importateur, { ...options, skipSelf: true });

      // Le remplacement a le droit d'importer l'original — c'est même tout
      // l'intérêt : un composant téléviseur enveloppe celui du web au lieu de
      // le recopier. Sans cette garde, cet import se substituerait à lui-même
      // et la résolution bouclerait, sur un `vite build` qui part sans jamais
      // rendre la main ni dire pourquoi.
      if (cible && cible.id.split("?")[0] === importateur.split("?")[0]) return null;

      declenchees.add(chemin);
      return cible;
    },

    buildEnd() {
      const inutilisees = Object.keys(table).filter((chemin) => !declenchees.has(chemin));
      if (inutilisees.length === 0) return;
      this.warn(
        `substitutions jamais déclenchées (chemin erroné ou module devenu inatteignable) :\n  ${
          inutilisees.join("\n  ")
        }`,
      );
    },
  };
}
