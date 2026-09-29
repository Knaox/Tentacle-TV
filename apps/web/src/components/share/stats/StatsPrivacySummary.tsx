import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Lock, type LucideIcon } from "lucide-react";

/** Ce que montre la page publique — dans l'ordre de la page. */
const PUBLIC_KEYS = ["public_time", "public_profile", "public_tastes", "public_titles", "public_records", "public_loves"] as const;
/** Ce que le serveur garde : la réponse publique ne le contient pas (liste blanche, cf. contractShare). */
const PRIVATE_KEYS = ["private_hours", "private_devices", "private_dates", "private_place", "private_list"] as const;

function Column({ title, keys, Icon, tone }: { title: string; keys: readonly string[]; Icon: LucideIcon; tone: string }) {
  const { t } = useTranslation("statsShare");
  return (
    <section aria-label={title} className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-content-tertiary">{title}</h3>
      <ul className="space-y-1.5">
        {keys.map((key) => (
          <li key={key} className="flex items-start gap-2 text-[13px] leading-snug text-content-secondary">
            <Icon size={14} strokeWidth={2.4} aria-hidden className={`mt-0.5 shrink-0 ${tone}`} />
            {t(key)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ce que le propriétaire voit AVANT de partager : ce qui devient public, et ce
 * qui reste privé quoi qu'il arrive. L'icône et le titre portent le sens, la
 * couleur ne fait que l'appuyer (jamais la couleur seule).
 */
export const StatsPrivacySummary = memo(function StatsPrivacySummary() {
  const { t } = useTranslation("statsShare");
  return (
    <div className="grid gap-4 rounded-xl bg-fill-faint p-4 ring-1 ring-line-subtle sm:grid-cols-2 sm:gap-5">
      <Column title={t("publicTitle")} keys={PUBLIC_KEYS} Icon={Check} tone="text-[var(--brand-light)]" />
      <Column title={t("privateTitle")} keys={PRIVATE_KEYS} Icon={Lock} tone="text-content-tertiary" />
    </div>
  );
});
