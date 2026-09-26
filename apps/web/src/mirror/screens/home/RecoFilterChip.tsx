import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { familyOfProviderId } from "@tentacle-tv/shared";
import { useRecoFilter } from "../../../hooks/useRecoFilter";

/**
 * `RecoFilterChip` de l'app : à côté du titre de la première rangée reco
 * servie, les noms des familles actives (« Netflix · Disney+ ») et une croix —
 * toute la puce retire le filtre DU COMPTE (le store du web, poussé au serveur
 * par la liaison de session). Pilule de 24, rayon 12, teinte de marque.
 */
export const RecoFilterChip = memo(function RecoFilterChip() {
  const { t } = useTranslation("reco");
  const { selected, clear } = useRecoFilter();
  const label = useMemo(() => {
    const names = selected.map((id) => familyOfProviderId(id)?.label).filter((n): n is string => !!n);
    return names.length > 0 ? names.join(" · ") : t("homeFilterGeneric");
  }, [selected, t]);
  if (selected.length === 0) return null;

  return (
    <button
      type="button"
      onClick={clear}
      aria-label={t("homeFilterRemove")}
      className="-my-1.5 flex h-6 min-w-0 shrink items-center gap-1 rounded-xl border px-2 text-[13px] font-semibold leading-4 text-brand"
      style={{ background: "var(--brand-soft)", borderColor: "rgba(var(--brand-rgb), 0.5)" }}
    >
      <span className="truncate">{label}</span>
      <X size={12} className="shrink-0" aria-hidden />
    </button>
  );
});
