import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

/** Ce qui protège ce serveur, en trois lignes : rien d'exposé par défaut, aucun secret dans une adresse, HTTPS conseillé. */
export const SecurityNotes = memo(function SecurityNotes() {
  const { t } = useTranslation("remoteAccess");
  return (
    <section aria-labelledby="remote-security" className="rounded-xl border border-line-subtle bg-fill-faint p-4">
      <h2 id="remote-security" className="flex items-center gap-2 text-sm font-semibold text-content-primary">
        <ShieldCheck size={16} aria-hidden="true" className="text-content-tertiary" />
        {t("securityTitle")}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-content-secondary">
        {(["security_default", "security_secrets", "security_https"] as const).map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </section>
  );
});
