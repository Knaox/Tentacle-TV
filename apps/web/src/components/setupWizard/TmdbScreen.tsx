import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { SetupContext } from "@tentacle-tv/shared";
import { DoneLine, linkBtn, primary } from "./AccountParts";
import { TmdbKeyEntry } from "./TmdbKeyEntry";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

/** Ce que la clé apporte vraiment (recommandations, sagas, plateformes, affiches hors bibliothèque). */
const BENEFITS = ["reco", "sagas", "providers", "artwork"] as const;

/**
 * La clé TMDB, FACULTATIVE, dans les deux parcours, juste avant le
 * récapitulatif. La clé est validée par TMDB (côté serveur) avant d'être
 * gardée ; « Configurer plus tard » ne pose rien, et l'avis « Aucune clé
 * TMDB » ne relancera pas cet administrateur (le tableau de bord la garde
 * dans ses recommandations). Une clé déjà là — saisie avant un retour en
 * arrière, ou fournie par `TMDB_API_KEY` — se dit, sans rien redemander.
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

  return (
    <WizardFrame help={wizard} title={t("tmdbTitle")} subtitle={t("tmdbSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back} server={wizard.server}>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-medium text-content-tertiary">{t("tmdbBenefitsLabel")}</p>
          <ul className="space-y-2">
            {BENEFITS.map((id) => (
              <li key={id} className="flex items-start gap-2.5 text-sm leading-relaxed text-content-secondary">
                <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-light" />
                <span>{t(`tmdbBenefit_${id}`)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-content-tertiary">{t("tmdbWithout")}</p>
        </div>
        {fromEnv || saved ? (
          <>
            <DoneLine>{t(fromEnv ? "tmdbFromEnv" : "tmdbSaved", { last4: tmdb?.last4 ?? "" })}</DoneLine>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button type="button" onClick={next} className={primary} autoFocus>
                {t("next")}
              </button>
              {fromEnv ? null : (
                <button type="button" onClick={() => setReplacing(true)} className={linkBtn}>
                  {t("tmdbReplace")}
                </button>
              )}
            </div>
          </>
        ) : (
          <TmdbKeyEntry onDone={onDone} />
        )}
      </div>
    </WizardFrame>
  );
}
