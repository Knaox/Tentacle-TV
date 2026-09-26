import { memo } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, LoaderCircle } from "lucide-react";
import { cls } from "../../../pages/adminUtils";

interface TmdbSavedKeyProps {
  last4: string | null;
  source: "env" | "db" | null;
  testing: boolean;
  /** Un retrait est en cours : plus rien ne se clique. */
  busy: boolean;
  onTest: () => void;
  onReplace: () => void;
  onRemove: () => void;
}

/**
 * La clé en place, telle que le serveur accepte de la montrer : ses quatre
 * derniers caractères et sa provenance. Une clé posée par variable
 * d'environnement se teste mais ne se remplace ni ne se retire d'ici — une
 * saisie serait sans effet, la variable reste prioritaire.
 */
export const TmdbSavedKey = memo(function TmdbSavedKey({
  last4, source, testing, busy, onTest, onReplace, onRemove,
}: TmdbSavedKeyProps) {
  const { t } = useTranslation("adminMetadata");
  const fromEnv = source === "env";
  return (
    // Les boutons passent sous la clé quand la place manque : ce sont les
    // quatre derniers caractères qu'on vient lire, ils ne se tronquent jamais.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-line-subtle bg-fill-faint p-4">
      <div className="flex min-w-[14rem] flex-1 items-center gap-3">
        <KeyRound aria-hidden size={18} className="shrink-0 text-content-tertiary" />
        <div className="min-w-0">
          <p className="text-xs text-content-tertiary">
            <span className="font-medium">{t("keySaved")}</span> · {t(fromEnv ? "keySourceEnv" : "keySourceDb")}
          </p>
          <p className="whitespace-nowrap font-mono text-sm tracking-wider text-content-primary">
            <span aria-hidden>•••• •••• {last4 ?? "••••"}</span>
            {last4 && <span className="sr-only">{t("keyEndsWith", { last4 })}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onTest} disabled={testing || busy} className={cls.bs}>
          {testing && <LoaderCircle aria-hidden size={16} className="animate-spin" />}
          {t("testSaved")}
        </button>
        {!fromEnv && (
          <>
            <button type="button" onClick={onReplace} disabled={busy} className={cls.bs}>
              {t("replace")}
            </button>
            <button type="button" onClick={onRemove} disabled={busy} className={cls.bd}>
              {t("remove")}
            </button>
          </>
        )}
      </div>
    </div>
  );
});
