import { memo } from "react";
import { useTranslation } from "react-i18next";
import { packagedHelpKeys, type SetupPackaging, type TrailerGuideLinkContext, type TrailerGuideStep } from "@tentacle-tv/shared";
import { GuideLinks } from "./GuideLinks";

/** Le corps de texte du guide : 15 px, interligne généreux, sans dépasser ~70 signes. */
export const GUIDE_PARAGRAPH = "mt-2 text-[0.9375rem] leading-relaxed text-content-secondary";

/**
 * Une étape de la partie administrateur : son numéro, son titre (et
 * « Facultatif » quand elle complète), ses paragraphes, l'arborescence
 * d'exemple après le premier, puis ses liens. Rendue dans un `<ol>` : le
 * numéro dessiné est décoratif, la liste le dit déjà aux lecteurs d'écran.
 */
export const GuideStep = memo(function GuideStep({
  step,
  number,
  ctx,
  touch = false,
  packaging = null,
}: {
  step: TrailerGuideStep;
  number: number;
  ctx: TrailerGuideLinkContext;
  touch?: boolean;
  /** La livraison du serveur : l'app Windows a ses phrases (`packagedHelp.ts`). */
  packaging?: SetupPackaging | null;
}) {
  const { t } = useTranslation("trailerHelp");
  const [first, ...rest] = packagedHelpKeys("trailerHelp", step.paragraphKeys, packaging);

  return (
    <li className="ui-panel flex gap-4 p-4 sm:p-5">
      <span
        aria-hidden
        className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold text-content-primary"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-heading-3 text-content-primary">
          {t(step.titleKey)}
          {step.optional && (
            <span className="chip tracking-normal">
              {t("optional")}
            </span>
          )}
        </h3>
        {first && <p className={GUIDE_PARAGRAPH}>{t(first)}</p>}
        {step.exampleKey && (
          // Des noms de fichiers : à chasse fixe, sans retour à la ligne — une
          // ligne trop longue défile plutôt que de couper un chemin en deux.
          <pre className="mt-3 overflow-x-auto rounded-tile bg-surface-2 px-4 py-3 font-mono text-[0.8125rem] leading-6 text-content-secondary">
            <code>{t(step.exampleKey)}</code>
          </pre>
        )}
        {rest.map((key) => (
          <p key={key} className={GUIDE_PARAGRAPH}>
            {t(key)}
          </p>
        ))}
        <GuideLinks links={step.links} ctx={ctx} touch={touch} />
      </div>
    </li>
  );
});
