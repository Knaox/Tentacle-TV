/**
 * Le `Button` de l'app (`ui/Button.tsx`) : pilule de 44 au moins, 12/24,
 * libellé 15 semi-gras, échelle 0,97 sous le doigt, 0,45 d'opacité désactivé.
 * `primary` blanc à l'ombre noire, `secondary` gris translucide, `ghost` nu.
 */
type Variant = "primary" | "secondary" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "border border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg shadow-[0_4px_10px_rgba(0,0,0,0.25)]",
  secondary: "bg-cta-secondary-bg text-cta-secondary-fg",
  ghost: "bg-transparent text-content-secondary",
};

export function PillButton({ title, onPress, variant = "primary", disabled = false, className }: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`mirror-pressable flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-[15px] font-semibold tracking-[0.1px] disabled:opacity-[0.45] ${VARIANT[variant]} ${className ?? ""}`}
    >
      {title}
    </button>
  );
}
