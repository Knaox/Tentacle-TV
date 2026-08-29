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
export interface CompatContext {
  count(pass: string, number?: number): void;
  report(): string;
  total(): number;
}

export function createContext(): CompatContext {
  const counters = new Map<string, number>();

  return {
    count(pass, number = 1) {
      counters.set(pass, (counters.get(pass) ?? 0) + number);
    },
    report() {
      if (counters.size === 0) return "aucune transformation";
      return [...counters.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pass, number]) => `${pass} ${number}`)
        .join(", ");
    },
    total() {
      let sum = 0;
      for (const number of counters.values()) sum += number;
      return sum;
    },
  };
}
