import { useTranslation } from "react-i18next";
import { CheckCircle, Trash2, type LucideIcon } from "lucide-react";

type Tone = "brand" | "danger";

function Action({ Icon, label, tone, disabled, onPress }: {
  Icon: LucideIcon;
  label: string;
  tone: Tone;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = disabled ? "var(--text-quaternary)" : tone === "brand" ? "var(--brand-light)" : "var(--status-error)";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="flex min-h-9 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-3 text-[13px] font-semibold active:opacity-75"
      style={{ color }}
    >
      <Icon size={14} aria-hidden />
      {label}
    </button>
  );
}

/**
 * L'en-tête de la feuille des notifications (`NotifSheetHeader` de l'app) :
 * le titre ou le compte sélectionné, « Sélectionner » / « Annuler » à droite,
 * puis les actions en pastilles.
 */
export function NotifSheetHeader({ selectionMode, selectedCount, unread, total, onMarkAll, onSelect, onDeleteAll, onDeleteSelected, onCancel }: {
  selectionMode: boolean;
  selectedCount: number;
  unread: number;
  total: number;
  onMarkAll: () => void;
  onSelect: () => void;
  onDeleteAll: () => void;
  onDeleteSelected: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("notifications");
  const busy = selectionMode || total > 0;
  return (
    <div className="flex flex-col gap-2.5 border-b border-line-subtle px-4 pb-3 pt-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-lg font-bold text-content-primary">
          {selectionMode ? t("selected", { count: selectedCount }) : t("title")}
        </h2>
        {busy && (
          <button
            type="button"
            onClick={selectionMode ? onCancel : onSelect}
            className="min-h-10 px-1 text-[15px] font-semibold text-brand-light"
          >
            {selectionMode ? t("cancel") : t("select")}
          </button>
        )}
      </div>
      {busy && (
        <div className="flex flex-wrap gap-2">
          {selectionMode ? (
            <Action
              Icon={Trash2}
              label={selectedCount > 0 ? `${t("delete")} (${selectedCount})` : t("delete")}
              tone="danger"
              disabled={selectedCount === 0}
              onPress={onDeleteSelected}
            />
          ) : (
            <>
              {unread > 0 && <Action Icon={CheckCircle} label={t("markAllRead")} tone="brand" onPress={onMarkAll} />}
              <Action Icon={Trash2} label={t("deleteAll")} tone="danger" onPress={onDeleteAll} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
