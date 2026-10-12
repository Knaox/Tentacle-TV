import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { SetupContext } from "@tentacle-tv/shared";
import { DoneLine } from "./AccountParts";
import { TmdbKeyEntry } from "./TmdbKeyEntry";
import type { Wizard } from "./useWizard";
import { WizardFrame, type WizardFrameBase } from "./WizardFrame";

/** Ce que la clé apporte vraiment (recommandations, sagas, plateformes, affiches hors bibliothèque). */
const BENEFITS = ["reco", "sagas", "providers", "artwork"] as const;

/**
 * La clé TMDB, FACULTATIVE, dans les deux parcours, juste avant le
 * récapitulatif. La clé est validée par TMDB (côté serveur) avant d'être
 * gardée ; « Configurer plus tard » ne pose rien, et l'avis « Aucune clé
 * TMDB » ne relancera pas cet administrateur (le tableau de bord la garde
 * dans ses recommandations). Une clé déjà là — saisie avant un retour en
 * arrière, ou fournie par `TMDB_API_KEY` — se dit, sans rien redemander. Ce
 * qu'elle apporte est dit à gauche, la saisie à droite.
 */
export function TmdbScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const { patch, next } = wizard;
  const tmdb = wizard.data.context?.flow.tmdb;
  const [replacing, setReplacing] = useState(false);
  const fromEnv = tmdb?.source === "env";
  const saved = !!tmdb?.configured && !replacing;

  const onDone = useCallback(
    (context: SetupContext) => {
      patch({ context });
      next();
    },
    [patch, next],
  );

  const frame: WizardFrameBase = { wizard, title: t("tmdbTitle"), subtitle: t("tmdbSubtitle"), aside: <TmdbBenefits /> };
  if (fromEnv || saved) {
    return (
      <WizardFrame
        {...frame}
        primary={{ label: t("next"), onClick: next, autoFocus: true }}
        secondary={fromEnv ? undefined : [{ label: t("tmdbReplace"), onClick: () => setReplacing(true) }]}
      >
        <DoneLine>{t(fromEnv ? "tmdbFromEnv" : "tmdbSaved", { last4: tmdb?.last4 ?? "" })}</DoneLine>
      </WizardFrame>
    );
  }
  return <TmdbKeyEntry frame={frame} onDone={onDone} />;
}

/** Ce que la clé apporte, et ce qui marche sans elle. */
function TmdbBenefits() {
  const { t } = useTranslation("setupWizard");
  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-content-tertiary">{t("tmdbBenefitsLabel")}</h2>
      <ul className="space-y-2.5">
        {BENEFITS.map((id) => (
          <li key={id} className="flex items-start gap-2.5">
            <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)]" />
            <span>{t(`tmdbBenefit_${id}`)}</span>
          </li>
        ))}
      </ul>
      <p className="text-content-tertiary">{t("tmdbWithout")}</p>
    </>
  );
}
