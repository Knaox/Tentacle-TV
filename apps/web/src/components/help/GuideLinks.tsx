import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { resolveGuideLink, type TrailerGuideLink, type TrailerGuideLinkContext } from "@tentacle-tv/shared";
import { externalLinkHandler } from "../../lib/openExternal";

/**
 * Les liens d'une étape du guide, en pilules. Ne s'affichent que ceux qui
 * mènent quelque part pour CE compte (`resolveGuideLink`) : le tableau de bord
 * de Jellyfin et l'administration restent aux administrateurs. La flèche
 * oblique dit qu'on quitte l'application (le bureau passe par le navigateur
 * du système) ; le chevron, qu'on y reste.
 *
 * `touch` : au téléphone (miroir), 44 px de haut — la cible d'un doigt.
 */
export const GuideLinks = memo(function GuideLinks({
  links,
  ctx,
  touch = false,
}: {
  links: readonly TrailerGuideLink[];
  ctx: TrailerGuideLinkContext;
  touch?: boolean;
}) {
  const { t } = useTranslation("trailerHelp");
  const entries = links.flatMap((link) => {
    const target = resolveGuideLink(link, ctx);
    return target ? [{ link, target }] : [];
  });
  if (entries.length === 0) return null;

  const pill = `inline-flex items-center gap-1.5 rounded-full border border-line-subtle px-3.5 text-sm font-medium text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
    touch ? "min-h-[2.75rem]" : "min-h-[2.25rem]"
  }`;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {entries.map(({ link, target }) =>
        target.external ? (
          <a
            key={link.labelKey}
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={externalLinkHandler(target.href)}
            className={pill}
          >
            {t(link.labelKey)}
            <ArrowUpRight size={15} aria-hidden />
            <span className="sr-only">({t("linkOpensOutside")})</span>
          </a>
        ) : (
          <Link key={link.labelKey} to={target.href} className={pill}>
            {t(link.labelKey)}
            <ChevronRight size={15} aria-hidden />
          </Link>
        ),
      )}
    </div>
  );
});
