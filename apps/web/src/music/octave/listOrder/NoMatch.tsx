/** Octave — une recherche ou un filtre qui ne garde rien : le dire, et offrir de tout réafficher. */

import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EMPTY_ACTION_CLASS, EmptyState } from "../components/ViewStates";

export function NoMatch({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation("music");
  return (
    <EmptyState
      icon={SearchX}
      title={t("listOrder.noMatch")}
      action={
        <button type="button" onClick={onReset} className={`${EMPTY_ACTION_CLASS} cursor-pointer`}>
          {t("listOrder.reset")}
        </button>
      }
    >
      {t("listOrder.noMatchHint")}
    </EmptyState>
  );
}
