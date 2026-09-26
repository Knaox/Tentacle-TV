import { memo } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * La tête des écrans empilés de l'app (`AboutScreen`, `CreditsScreen`,
 * `TicketComposerView`) : `IconButton` chevron de 40, fond transparent, icône
 * `brand.light` de 20 ; titre 28 extra-gras, interlettrage −0,6.
 */
export const ScreenTitle = memo(function ScreenTitle({ title, onBack, size = 28, gap = 4, className }: {
  title: string;
  onBack: () => void;
  size?: number;
  gap?: number;
  className?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <div className={`flex items-center ${className ?? ""}`} style={{ gap }}>
      <BackButton onPress={onBack} label={t("back")} />
      <h1
        className="min-w-0 flex-1 font-extrabold text-content-primary"
        style={{ fontSize: size, letterSpacing: -0.6, lineHeight: 1.2 }}
      >
        {title}
      </h1>
    </div>
  );
});

/** `IconButton icon="chevron-left" size={40} bgColor="transparent"` de l'app. */
export function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="mirror-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{ color: "var(--brand-light)", WebkitTapHighlightColor: "transparent" }}
    >
      <ChevronLeft size={20} strokeWidth={2} />
    </button>
  );
}
