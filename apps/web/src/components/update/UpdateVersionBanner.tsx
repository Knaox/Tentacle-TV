import { useTranslation } from "react-i18next";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";

interface UpdateVersionBannerProps {
  from: string;
  to?: string;
  channelLabel: string;
}

/**
 * La ligne « 1.20.11 → 1.21.0 » : la version installée en encre discrète, la nouvelle à la
 * teinte franche (c'est elle, l'état qui arrive), le canal en puce. Plus de lueur ni de dégradé
 * de marque : rien ici ne se lit ni ne se mesure. Rien n'y bouge — elle est là dans toutes les
 * phases, c'est le repère fixe de la pop-up.
 */
export function UpdateVersionBanner({ from, to, channelLabel }: UpdateVersionBannerProps) {
  const { t } = useTranslation("notifications");
  const label = to
    ? t("notifications:updateVersionLine", { from, to })
    : `${t("notifications:updateCurrentVersion")} ${from}`;
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3 rounded-tile bg-surface-2 px-4 py-3">
      <div aria-hidden className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        <span className="num text-base font-semibold text-content-tertiary">{from}</span>
        {to && (
          <>
            <ArrowRightIcon size={16} weight="bold" className="flex-shrink-0 text-content-quaternary" />
            <span className="num font-display text-xl font-bold tracking-tight text-accent">{to}</span>
          </>
        )}
      </div>
      <span aria-hidden className="chip flex-shrink-0">{channelLabel}</span>
    </div>
  );
}
