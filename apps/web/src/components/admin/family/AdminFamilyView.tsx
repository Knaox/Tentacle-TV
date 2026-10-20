import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { ServerCapabilityGate } from "@tentacle-tv/api-client";
import { useFamilyAvailability } from "../../../family/useFamilyAvailability";
import { AdminPage } from "../kit";
import { FamilyLaunchPolicySection } from "./FamilyLaunchPolicySection";
import { FamilyLaunchSettingsSection } from "./FamilyLaunchSettingsSection";
import { FamilySwitchesSection } from "./FamilySwitchesSection";

/**
 * Admin › Famille — les réglages de la Famille pour TOUT le serveur, réunis
 * hors de « Utilisateurs », où ils se mêlaient aux droits par compte (retour de
 * l'alpha, 21/10) : ce que les comptes peuvent faire (fonder une famille,
 * créer des profils invités, laisser les invités demander des films), puis
 * « Qui regarde ? à l'ouverture ». Les exceptions d'un compte restent dans sa
 * fiche (Utilisateurs).
 *
 * Servie par le module de la page Utilisateurs (`AdminUsers section="family"`) :
 * aucune entrée de plus dans `lazyPages.ts`, que la cible webOS remplace.
 * Serveur sans la Famille : retour à Utilisateurs.
 */
export function AdminFamilyView() {
  const { t } = useTranslation("admin");
  const { available, settled } = useFamilyAvailability();

  if (!available) return settled ? <Navigate to="/admin/users" replace /> : null;
  return (
    <AdminPage title={t("familyTitle")} description={t("familyDescription")}>
      <FamilySwitchesSection />
      {/* La forme simple (1.31.1) ; un serveur 1.30 garde son réglage d'avant. */}
      <ServerCapabilityGate capability="family.launchPlatforms" fallback={<FamilyLaunchPolicySection />}>
        <FamilyLaunchSettingsSection />
      </ServerCapabilityGate>
    </AdminPage>
  );
}
