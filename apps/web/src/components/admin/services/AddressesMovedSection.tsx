import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cls } from "../../../pages/adminUtils";
import { AdminSection } from "../kit";

/** Les ancres d'avant (verrou de jumelage TV, tableau de bord, invitations) : elles mènent désormais au formulaire des adresses. */
const MOVED_ANCHORS = new Set(["#publicurl", "#directstreaming"]);
const TARGET = "/admin/remote-access#addresses";

/**
 * Le lien public et la lecture directe ont rejoint « Accès à distance » (serveur
 * qui déclare `admin.remoteAccess`) : la page Services n'en garde qu'un
 * renvoi. Un lien d'avant vers `#publicurl` ou `#directstreaming` y conduit
 * tout droit, sans repasser par ici.
 */
export function AddressesMovedSection() {
  const { t } = useTranslation("adminServices");
  const { hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (MOVED_ANCHORS.has(hash)) navigate(TARGET, { replace: true });
  }, [hash, navigate]);

  return (
    <AdminSection id="addresses-moved" title={t("movedTitle")} description={t("movedBody")}>
      <Link to={TARGET} className={`${cls.bs} inline-flex items-center gap-2`}>
        {t("movedLink")}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </AdminSection>
  );
}
