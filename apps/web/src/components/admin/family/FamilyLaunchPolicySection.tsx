import { useTranslation } from "react-i18next";
import { useFamilyLaunchPolicy, useServerCapability, useSetFamilyLaunchPolicy } from "@tentacle-tv/api-client";
import { useFamilyAvailability } from "../../../family/useFamilyAvailability";
import { SettingToggleRow } from "../../settings/SettingToggleRow";
import { AdminSection } from "../kit";

/**
 * Admin › Utilisateurs : « Qui regarde ? » à l'ouverture, plateforme par
 * plateforme (serveur `family.pickerPolicy`).
 * - Ordinateurs : « Permis » (coupé : jamais à l'ouverture, pour personne) et,
 *   s'il est permis, « Activé par défaut » pour l'ordinateur qui n'a encore
 *   rien choisi (chacun décide ensuite pour lui-même).
 * - Téléviseurs : « Permis » (coupé : chaque TV ouvre directement le profil
 *   du compte qui l'a jumelée, sans PIN).
 * Un RÉGLAGE, pas une alerte. L'état affiché est celui que le serveur RÉPOND ;
 * la règle vaut au prochain lancement de chaque appareil.
 */
export function FamilyLaunchPolicySection() {
  const { t } = useTranslation("profilePicker");
  const { available } = useFamilyAvailability();
  const declared = useServerCapability("family.pickerPolicy");
  const shown = available && declared;
  const policy = useFamilyLaunchPolicy({ enabled: shown });
  const save = useSetFamilyLaunchPolicy();

  if (!shown) return null;
  const current = policy.data;
  const heading = "text-xs font-semibold uppercase tracking-wide text-content-tertiary";

  return (
    <AdminSection scope="server" title={t("adminPolicy.title")} description={t("adminPolicy.description")}>
      {current ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <p className={heading}>{t("adminPolicy.desktop")}</p>
            <SettingToggleRow
              title={t("adminPolicy.allowed")}
              hint={t("adminPolicy.allowedHintDesktop")}
              active={current.desktop.mode === "choice"}
              onChange={(allowed) => save.mutate({ desktop: { mode: allowed ? "choice" : "off" } })}
            />
            {current.desktop.mode === "choice" && (
              <SettingToggleRow
                title={t("adminPolicy.defaultOn")}
                hint={t("adminPolicy.defaultOnHint")}
                active={current.desktop.defaultOn}
                onChange={(defaultOn) => save.mutate({ desktop: { defaultOn } })}
              />
            )}
          </div>
          <div className="space-y-4">
            <p className={heading}>{t("adminPolicy.tv")}</p>
            <SettingToggleRow
              title={t("adminPolicy.allowed")}
              hint={t("adminPolicy.allowedHintTv")}
              active={current.tv.mode === "choice"}
              onChange={(allowed) => save.mutate({ tv: { mode: allowed ? "choice" : "off" } })}
            />
          </div>
          {save.isError && <p role="alert" className="text-sm text-status-error-fg">{t("adminPolicy.saveError")}</p>}
        </div>
      ) : policy.isError ? (
        <p className="text-sm text-status-error-fg">{t("adminPolicy.loadError")}</p>
      ) : (
        <div aria-hidden="true" className="h-24 animate-pulse rounded-xl bg-fill-subtle" />
      )}
    </AdminSection>
  );
}
