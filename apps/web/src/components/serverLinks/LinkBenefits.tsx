import { useTranslation } from "react-i18next";
import { Gauge, Globe, House, Server, Share2, Smartphone, type LucideIcon } from "lucide-react";
import { LINK_BENEFITS, type LinkCheckId } from "@tentacle-tv/shared";

/**
 * Le pourquoi d'une recommandation, bénéfice par bénéfice — l'ordre vient de
 * `LINK_BENEFITS` (shared), les mots de l'espace `serverLinks`. Le même
 * texte dans la vue d'ensemble et dans l'assistant d'installation.
 */

const ICON: Record<string, LucideIcon> = {
  away: Globe,
  apps: Smartphone,
  shares: Share2,
  quality: Gauge,
  load: Server,
  local: House,
};

export function LinkBenefits({ id }: { id: LinkCheckId }) {
  const { t } = useTranslation("serverLinks");
  return (
    <ul className="space-y-1.5">
      {LINK_BENEFITS[id].map((benefit) => {
        const Icon = ICON[benefit] ?? Globe;
        return (
          <li key={benefit} className="flex items-start gap-2 text-xs leading-relaxed text-content-secondary">
            <Icon aria-hidden size={14} className="mt-0.5 flex-shrink-0 text-[var(--brand-light)]" />
            <span>{t(`benefit_${id}_${benefit}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}
