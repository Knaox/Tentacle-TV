import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxChip, FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";

const STEPS = [800, 900, 1000, 1800] as const;

/** Le menu du profil s'ouvre, « Sur cet appareil » s'allume, et le catalogue local paraît — serveur joignable. */
export function OnDeviceScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const open = step >= 1;
  const picked = step >= 2;
  const shown = step >= 3;
  const items = [t("nav:preferences"), t("nav:about"), t("nav:onDevice"), t("nav:goOffline")];
  return (
    <SceneStage cycle={cycle}>
      {/* L'avatar, en haut à droite comme dans la barre. */}
      <Place x={556} y={18} visible={!shown}>
        <span className="block h-9 w-9 rounded-full" style={{ background: "linear-gradient(135deg, var(--brand-dark), var(--brand))" }} />
      </Place>
      {/* Le menu s'efface quand le catalogue paraît : il a fait son travail, et
          le laisser ouvert le ferait chevaucher les affiches. */}
      <Place x={392} y={66} w={212} visible={open && !shown} dy={open ? 0 : -6} className="rounded-xl border border-line-subtle bg-surface-modal p-1.5 shadow-2xl">
        {items.map((label, i) => (
          <span
            key={label}
            className={`flex items-center rounded-lg px-3 py-2 text-[12px] ${
              picked && i === 2 ? "bg-fill-soft font-semibold text-content-primary" : "text-content-secondary"
            }`}
          >
            {label}
          </span>
        ))}
      </Place>
      {/* Le catalogue local, tel qu'il s'ouvre : titre, résumé, une rangée. */}
      <Place x={40} y={40} visible={shown} dy={shown ? 0 : 8}>
        <p className="text-[17px] font-bold text-content-primary">{t("downloads:heroLabel")}</p>
      </Place>
      <FauxChip x={40} y={76} label={t("downloads:deviceTitles", { count: 12 })} size="sm" visible={shown} />
      <FauxChip x={140} y={76} label={t("downloads:deviceSpace", { size: "38 Gio" })} size="sm" visible={shown} />
      <FauxRow x={40} y={118} title={t("downloads:sectionSeries")} count={5} cardW={68} showTitles revealed={shown} stagger />
      <FauxCursor x={picked ? 470 : 574} y={picked ? 136 : 40} hidden={step < 1 || shown} reduced={reduced} />
    </SceneStage>
  );
}
