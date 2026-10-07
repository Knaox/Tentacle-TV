import { useTranslation } from "react-i18next";
import { AdminPage } from "../admin/kit";
import { useHashTarget } from "../admin/services/useHashTarget";
import { useDirectStreamingConfig, usePublicUrlConfig } from "../admin/services/useServicesData";
import { RemoteAccessPanel } from "./RemoteAccessPanel";
import { useRemoteAccess } from "./remoteAccessApi";

/**
 * La page « Accès à distance » (`/admin/remote-access`). Rendue par le module
 * paresseux de la page Services (`AdminServicesPage section="remote-access"`) :
 * ainsi elle reste hors du client LG sans nouvelle entrée dans `lazyPages.ts`,
 * que la cible webOS remplace par sa propre liste.
 */
export function AdminRemoteAccessView() {
  const { t } = useTranslation("remoteAccess");
  // `#addresses`, `#guide`, `#check`… mènent à leur section une fois l'état et les adresses lus.
  const ready = [useRemoteAccess(), usePublicUrlConfig(), useDirectStreamingConfig()].every((query) => !query.isPending);
  useHashTarget(ready);
  return (
    <AdminPage title={t("pageTitle")} description={t("pageDescription")}>
      <RemoteAccessPanel variant="admin" />
    </AdminPage>
  );
}
