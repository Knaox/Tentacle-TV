/**
 * Compteurs partagés par les passes de compatibilité.
 *
 * Le rapport imprimé en fin de build n'est pas décoratif : chaque passe
 * transforme du CSS que personne n'a écrit à la main — il est produit par
 * Tailwind, et il change quand une classe change quelque part dans `apps/web`.
 * Un compteur qui bouge sans raison est le seul signal disponible.
 *
 * Une passe qui rapporte zéro est le signal le plus important de tous : soit
 * la primitive a disparu du code, soit la passe ne s'exécute plus au bon
 * endroit de la chaîne.
 */
export interface ContexteCompat {
  compter(passe: string, nombre?: number): void;
  rapport(): string;
  total(): number;
}

export function creerContexte(): ContexteCompat {
  const compteurs = new Map<string, number>();

  return {
    compter(passe, nombre = 1) {
      compteurs.set(passe, (compteurs.get(passe) ?? 0) + nombre);
    },
    rapport() {
      if (compteurs.size === 0) return "aucune transformation";
      return [...compteurs.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([passe, nombre]) => `${passe} ${nombre}`)
        .join(", ");
    },
    total() {
      let somme = 0;
      for (const nombre of compteurs.values()) somme += nombre;
      return somme;
    },
  };
}
