import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { HEADER_TOTAL } from "../../shell/metrics";

/** Au-delà, une ligne de réglage devient une piste d'atterrissage. */
const DETAIL_COLUMN_MAX = 680;

/**
 * `ProfileDetailPane` de l'app : la colonne de détail du profil tablette —
 * la page de la rubrique choisie, ou un de ses volets avec « ‹ Rubrique »
 * pour remonter. Titre 22 extra-gras, 16 dessous, colonne de 680 au plus,
 * marges 20. Le parent change la `key` à chaque page : le défilement
 * remonte en haut.
 */
export function ProfileDetailPane({ title, back, bottomInset, children }: {
  title: string;
  /** Un volet ouvert depuis la page : le nom de la rubrique, pour y revenir. */
  back?: { label: string; onPress: () => void };
  bottomInset: string;
  children: ReactNode;
}) {
  return (
    <div
      className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-5"
      style={{ paddingTop: `calc(${HEADER_TOTAL} + 20px)`, paddingBottom: bottomInset }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: DETAIL_COLUMN_MAX }}>
        {back && (
          <button
            type="button"
            onClick={back.onPress}
            className="mirror-press -ml-1 mb-1 flex items-center gap-0.5 text-[15px] font-medium text-[var(--brand-light)]"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <ChevronLeft size={18} aria-hidden />
            {back.label}
          </button>
        )}
        <h2 className="mb-4 text-[22px] font-extrabold tracking-[-0.4px] text-content-primary">{title}</h2>
        {children}
      </div>
    </div>
  );
}
