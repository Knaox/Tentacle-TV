import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { biographyParagraphs } from "@tentacle-tv/shared";

const FOLDED_CHARS = 500;

/**
 * La biographie, repliée sur ses premiers paragraphes (cinq lignes au plus chacun) ;
 * « Voir plus » déplie le reste. Rien du tout quand Jellyfin n'en a pas —
 * pas de titre orphelin au-dessus d'un vide.
 */
export const PersonBiography = memo(function PersonBiography({ overview }: { overview: string | undefined }) {
  const { t } = useTranslation(["media", "common"]);
  const [expanded, setExpanded] = useState(false);
  const paragraphs = biographyParagraphs(overview);
  if (paragraphs.length === 0) return null;

  // Replié : les premiers paragraphes tant qu'ils tiennent en ~500 signes (un
  // au moins) — une première phrase seule ne dit rien de la personne.
  let folded = 1;
  for (let len = paragraphs[0].length; folded < paragraphs.length && len + paragraphs[folded].length <= FOLDED_CHARS; folded++) {
    len += paragraphs[folded].length;
  }
  const foldable = folded < paragraphs.length || paragraphs[0].length > FOLDED_CHARS;
  const shown = expanded ? paragraphs : paragraphs.slice(0, folded);

  return (
    <section className="max-w-3xl" aria-labelledby="person-bio-title">
      <h2 id="person-bio-title" className="text-lg font-semibold text-content-primary">{t("media:personBiography")}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-content-secondary">
        {shown.map((p, i) => (
          <p key={i} className={!expanded && foldable && i === shown.length - 1 ? "line-clamp-5" : undefined}>{p}</p>
        ))}
      </div>
      {foldable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 text-sm font-semibold text-brand-light transition-colors hover:text-content-primary"
        >
          {expanded ? t("common:showLess") : t("common:showMore")}
        </button>
      )}
    </section>
  );
});
