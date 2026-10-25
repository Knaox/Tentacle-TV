import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOctaveRights, useSetOctaveRights } from "@tentacle-tv/api-client";
import { ToggleSwitch } from "../../../settings/ToggleSwitch";
import { FIELD_HINT, FIELD_LABEL, SMALL_BUTTON } from "../../../parental/fieldStyles";
import { RightError } from "../rights/RightRows";

/**
 * « Accès à Octave » — un droit TENTACLE (pas un champ de la politique
 * Jellyfin) : le serveur le garde et le tient (routes musique, extension de
 * musique). Même rangée qu'un droit Jellyfin : libellé, aide d'une ligne,
 * l'interrupteur ; un refus est dit dessous et l'état relu.
 */
export function OctaveAccessRight({ userId }: { userId: string }) {
  const { t } = useTranslation("userRights");
  const query = useOctaveRights(userId);
  const save = useSetOctaveRights();
  const [failed, setFailed] = useState(false);
  const label = t("octave.access.label");

  if (!query.data) {
    return (
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className={FIELD_LABEL}>{label}</span>
          <span role={query.isError ? "alert" : undefined} className={FIELD_HINT}>
            {t(query.isError ? "octave.access.loadError" : "octave.access.loading")}
          </span>
        </span>
        {query.isError && (
          <button type="button" onClick={() => void query.refetch()} className={SMALL_BUTTON}>{t("retry")}</button>
        )}
      </div>
    );
  }

  const change = (access: boolean) => {
    setFailed(false);
    save.mutate({ userId, rights: { access } }, { onError: () => setFailed(true) });
  };
  // État optimiste pendant l'écriture : l'interrupteur suit le geste, la réponse fait foi.
  const checked = save.isPending && save.variables ? save.variables.rights.access ?? query.data.access : query.data.access;

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className={FIELD_LABEL}>{label}</span>
          <span className={FIELD_HINT}>{t(checked ? "octave.access.hint" : "octave.access.hintOff")}</span>
        </span>
        <span className="pt-0.5">
          <ToggleSwitch checked={checked} label={label} disabled={save.isPending} onChange={change} />
        </span>
      </div>
      <RightError text={failed ? t("octave.access.saveError") : null} />
    </div>
  );
}
