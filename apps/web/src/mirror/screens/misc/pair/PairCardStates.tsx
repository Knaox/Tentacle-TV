import { useTranslation } from "react-i18next";
import { CheckCircle, Lock } from "lucide-react";
import { Spinner } from "../shared/Spinner";

/**
 * `PairUnavailableCard` de l'app : vérification en cours (roue), ou jumelage
 * fermé — cadenas 30 dans une pastille de 64 `fill.subtle`, texte 14/20.
 */
export function PairUnavailable({ loading }: { loading: boolean }) {
  const { t } = useTranslation("pairing");
  if (loading) {
    return (
      <div className="flex justify-center" style={{ padding: "24px 0" }}>
        <Spinner size={20} color="var(--brand-light)" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center" style={{ padding: "16px 0" }}>
      <span
        className="flex items-center justify-center rounded-full bg-fill-subtle text-content-tertiary"
        style={{ width: 64, height: 64, marginBottom: 14 }}
      >
        <Lock size={30} />
      </span>
      <p className="text-center font-medium text-content-secondary" style={{ fontSize: 14, lineHeight: "20px" }}>
        {t("pairingUnavailable")}
      </p>
    </div>
  );
}

/** Le succès de `PairTVScreen` : pastille 72 verte, coche 40, texte 16 semi-gras. */
export function PairSuccess() {
  const { t } = useTranslation("pairing");
  return (
    <div className="flex flex-col items-center" style={{ padding: "12px 0" }}>
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: 72, height: 72, marginBottom: 14, background: "var(--status-success-bg)", color: "var(--status-success)" }}
      >
        <CheckCircle size={40} />
      </span>
      <p className="text-center font-semibold" style={{ fontSize: 16, color: "var(--status-success)" }}>
        {t("tvPairedSuccess")}
      </p>
    </div>
  );
}
