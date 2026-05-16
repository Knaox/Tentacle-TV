import { useTranslation } from "react-i18next";
import { AVATAR_RING_STYLE } from "../userMenu/menuItems";

interface Props {
  name: string;
  initial: string;
  isAdmin: boolean;
}

/**
 * En-tête de la page Profile mobile : avatar XL + nom + badge admin éventuel.
 * Design aligné avec UserAvatarMenu (mêmes gradient et anneau violet).
 */
export function ProfileHero({ name, initial, isAdmin }: Props) {
  const { t } = useTranslation("profile");
  const { t: tNav } = useTranslation("nav");
  return (
    <header className="flex items-center gap-4 px-1 pb-6">
      <div
        className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={AVATAR_RING_STYLE}
        aria-hidden
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-white">
          {name || t("defaultUsername")}
        </h1>
        {isAdmin ? (
          <span className="mt-2 inline-flex items-center rounded-full border border-[rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.15)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-light)]">
            {tNav("admin")}
          </span>
        ) : (
          <p className="mt-1 text-sm text-white/40">{t("title")}</p>
        )}
      </div>
    </header>
  );
}
