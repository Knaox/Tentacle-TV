import { useTranslation } from "react-i18next";
import { HEADER_TOTAL } from "../../shell/metrics";
import { PANE_REGISTRY } from "../settings/paneRegistry";
import type { MirrorPaneId } from "../settings/panes";

/** Au-delà, une ligne de réglage devient une piste d'atterrissage. */
const DETAIL_COLUMN_MAX = 680;

/**
 * `ProfileDetailPane` de l'app : la colonne de détail du profil tablette —
 * titre du volet (22 extra-gras, 16 dessous), puis son contenu, le même
 * composant que l'écran du téléphone, dans une colonne de 680 au plus, marges
 * 20. La clé `pane` remonte le défilement en haut à chaque changement.
 */
export function ProfileDetailPane({ pane, bottomInset }: { pane: MirrorPaneId; bottomInset: string }) {
  const { t } = useTranslation();
  const { Component, title } = PANE_REGISTRY[pane];
  return (
    <div
      key={pane}
      className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-5"
      style={{ paddingTop: `calc(${HEADER_TOTAL} + 20px)`, paddingBottom: bottomInset }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: DETAIL_COLUMN_MAX }}>
        {/* L'espace passe à l'appel : il change d'un volet à l'autre sans remontage. */}
        <h2 className="mb-4 text-[22px] font-extrabold tracking-[-0.4px] text-content-primary">{t(title.key, { ns: title.ns })}</h2>
        <Component />
      </div>
    </div>
  );
}
