/**
 * Une information et son intitulé, à la taille d'un salon.
 *
 * Extrait de l'écran Compte, où il vivait en composant local, du jour où À
 * propos a eu les mêmes lignes à afficher. Deux copies d'une paire
 * intitulé/valeur auraient divergé à la première retouche de graisse.
 *
 * L'intitulé est petit et espacé, la valeur grande et pleine : à trois mètres,
 * c'est le contraste de taille qui dit lequel des deux on cherche, pas la
 * position.
 */
export function InfoRowTv({ intitule, value }: { intitule: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm uppercase tracking-[0.08em] text-content-tertiary">{intitule}</dt>
      <dd className="text-xl font-semibold text-content-primary">{value}</dd>
    </div>
  );
}
