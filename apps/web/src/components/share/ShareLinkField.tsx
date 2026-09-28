import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, Copy, type LucideIcon } from "lucide-react";
import { useCopyFeedback, type CopyStatus } from "../../hooks/useCopyFeedback";
import { copyShortcutLabel } from "../../lib/shortcutLabel";

// La grammaire des pilules d'action (`admin/sessions/ActionPill`) : coche sur
// vert pour la réussite, alerte sur rouge et un tremblement unique pour
// l'échec — en `transform` seul, neutralisé par la réduction de mouvement.
const TONE: Record<CopyStatus, string> = {
  idle: "bg-fill-soft text-content-primary hover:bg-fill-medium",
  copied: "bg-status-success-bg text-status-success-fg",
  failed: "animate-shake bg-status-error-bg text-status-error-fg",
};
const ICON: Record<CopyStatus, LucideIcon> = { idle: Copy, copied: Check, failed: CircleAlert };
const LABEL: Record<CopyStatus, string> = { idle: "copyLink", copied: "linkCopied", failed: "copyFailed" };

/**
 * Le lien de partage et son bouton « Copier » — un résultat qui SE VOIT.
 *
 * Réussite : coche et « Copié ! » deux secondes. Échec : le bouton le dit, et
 * une ligne sous le champ explique comment finir à la main — le lien est déjà
 * sélectionné, il ne reste que ⌘C (ou un appui long au doigt). Plus jamais
 * d'échec muet : c'est lui qui faisait passer le bouton du bureau pour mort.
 */
export function ShareLinkField({ url }: { url: string }) {
  const { t } = useTranslation("common");
  const { status, copy } = useCopyFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const Icon = ICON[status];

  const onCopy = async () => {
    if (await copy(url)) return;
    // Le lien prêt pour la copie à la main.
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  return (
    <div>
      {/* `focus-within`, comme les champs de recherche — jamais `:has()`, que
          le socle Chrome 53 du téléviseur refuse (règle entière perdue). */}
      <div className="flex items-center gap-2 rounded-lg border border-line-subtle bg-fill-subtle py-1.5 pl-3 pr-1.5 transition-colors focus-within:border-[rgba(var(--brand-rgb),0.55)]">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={url}
          aria-label={t("shareLinkField")}
          aria-describedby={status === "failed" ? hintId : undefined}
          // Tout le lien d'un geste, au clavier comme à la souris.
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 truncate bg-transparent text-sm text-content-secondary outline-none"
        />
        <button
          type="button"
          onClick={onCopy}
          className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${TONE[status]}`}
        >
          {/* `key` : l'icône change avec l'état, et son entrée se rejoue. */}
          <span key={status} className={`flex ${status === "idle" ? "" : "animate-scale-in"}`}>
            <Icon aria-hidden strokeWidth={2.2} className="h-3.5 w-3.5" />
          </span>
          <span aria-live="polite">{t(LABEL[status])}</span>
        </button>
      </div>
      {status === "failed" && (
        <p id={hintId} role="alert" className="mt-2 text-xs leading-snug text-status-error-fg">
          {touch ? t("copyFailedHintTouch") : t("copyFailedHint", { shortcut: copyShortcutLabel() })}
        </p>
      )}
    </div>
  );
}
