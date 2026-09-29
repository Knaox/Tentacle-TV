import { memo } from "react";
import { useTranslation } from "react-i18next";
import { TRAILER_GUIDE_STEPS, type TrailerGuideLinkContext } from "@tentacle-tv/shared";
import { GUIDE_PARAGRAPH, GuideStep } from "./GuideStep";

/**
 * « Pour l'administrateur » : les étapes, dans l'ordre où les faire — les deux
 * premières suffisent le plus souvent. Lisible par tous (un utilisateur peut la
 * transmettre), ses liens ne s'ouvrent qu'à un administrateur. C'est la cible
 * du contrôle « Bandes-annonces » de la vue d'ensemble (`#admin`).
 */
export const GuideAdmin = memo(function GuideAdmin({ ctx, touch = false }: { ctx: TrailerGuideLinkContext; touch?: boolean }) {
  const { t } = useTranslation("trailerHelp");
  return (
    <section id="admin" aria-labelledby="guide-admin-title" className="scroll-mt-24">
      <h2 id="guide-admin-title" className="text-heading-1 text-content-primary">
        {t("partAdmin")}
      </h2>
      <p className={GUIDE_PARAGRAPH}>{t("adminLead")}</p>
      <ol className="mt-5 space-y-3">
        {TRAILER_GUIDE_STEPS.map((step, index) => (
          <GuideStep key={step.id} step={step} number={index + 1} ctx={ctx} touch={touch} />
        ))}
      </ol>
    </section>
  );
});
