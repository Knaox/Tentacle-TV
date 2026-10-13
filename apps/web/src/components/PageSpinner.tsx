/**
 * L'anneau d'attente d'une page entière — le démarrage avant le statut de
 * l'installation, et le chargement d'une route paresseuse. Sorti d'`App.tsx`,
 * qui tient la limite de 300 lignes.
 */
export function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}
