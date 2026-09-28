/**
 * `AuthLink` de l'app : 44 de haut, préfixe neutre facultatif puis le lien en
 * `brand.light` (« Pas encore de compte ? Créer un compte »).
 */
export function AuthLinkRow({ label, onClick, prefix }: { label: string; onClick: () => void; prefix?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-content-tertiary active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      style={{ fontSize: 13 }}
    >
      <span>
        {prefix ? `${prefix} ` : ""}
        <span className="font-medium text-[var(--brand-light)]" style={{ letterSpacing: 0.2 }}>{label}</span>
      </span>
    </button>
  );
}
