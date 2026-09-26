import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useViewport } from "../../useFormFactor";
import { PLAYER } from "../playerColors";
import { parseTrackLabel } from "../playerMetrics";

export type ChipTone = "purple" | "amber" | "zinc";
export interface PopupBadge { label: string; tone?: ChipTone }
export interface PopupOption {
  key: string | number;
  label: string;
  active: boolean;
  /** Suffixe gris à droite du libellé (« — 4K »). */
  suffix?: string;
  /** Pastilles en ligne (Auto, DV, HDR, Atmos). */
  badges?: PopupBadge[];
  /** Pastille calée à droite (le débit « 30 Mbps »). */
  rightChip?: PopupBadge;
}
export interface PopupSection {
  title: string;
  options: PopupOption[];
  onSelect: (key: string | number) => void;
  showDisabled?: { label: string; active: boolean; onSelect: () => void };
}

interface Props {
  visible: boolean;
  title: string;
  sections: PopupSection[];
  onClose: () => void;
}

/**
 * Le menu en pop-up du lecteur — `PlayerPopupMenu` de l'app : ancré en bas à
 * droite (80 du bas, `min(12, 3 % × W)` du bord), `min(280, W − 32)` de large,
 * rayon 12, marge 14, fond `controlBgHeavy` bordé `borderSubtle` ; entrée en
 * fondu + montée de 10 en 200 ms. Liste bornée à `min(300, 50 % × H)`. Un tap
 * hors du menu le ferme.
 */
export function PopupMenu({ visible, title, sections, onClose }: Props) {
  const { t } = useTranslation("common");
  const { width, height } = useViewport();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible) { setShown(false); return; }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-0" style={{ zIndex: 60 }}>
      <div className="absolute inset-0" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        role="dialog"
        aria-label={title}
        className="absolute overflow-hidden"
        style={{
          bottom: 80, right: Math.min(12, width * 0.03), width: Math.min(280, width - 32),
          borderRadius: 12, padding: 14,
          backgroundColor: PLAYER.controlBgHeavy, border: `1px solid ${PLAYER.borderSubtle}`,
          opacity: shown ? 1 : 0, transform: `translateY(${shown ? 0 : 10}px)`,
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-row items-center justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: PLAYER.text }}>{title}</span>
          <button type="button" aria-label={t("close")} onClick={onClose} className="relative" style={{ padding: 2 }}>
            <span aria-hidden className="absolute -inset-3" />
            <X size={16} color={PLAYER.textDim} />
          </button>
        </div>
        <div className="mirror-no-scrollbar overflow-y-auto overscroll-contain" style={{ maxHeight: Math.min(300, height * 0.5) }}>
          {sections.map((section) => (
            <div key={section.title} style={{ paddingTop: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: PLAYER.textDim, marginBottom: 6 }}>
                {section.title}
              </div>
              {section.showDisabled && (
                <OptionRow
                  label={section.showDisabled.label}
                  active={section.showDisabled.active}
                  onPress={section.showDisabled.onSelect}
                />
              )}
              {section.options.map((opt) => (
                <OptionRow
                  key={opt.key}
                  label={opt.label}
                  active={opt.active}
                  suffix={opt.suffix}
                  badges={opt.badges}
                  rightChip={opt.rightChip}
                  onPress={() => section.onSelect(opt.key)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionRow({ label, active, suffix, badges, rightChip, onPress }: {
  label: string;
  active: boolean;
  suffix?: string;
  badges?: PopupBadge[];
  rightChip?: PopupBadge;
  onPress: () => void;
}) {
  const { title, lang, codec } = parseTrackLabel(label);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onPress}
      className="flex w-full flex-row items-center text-left [-webkit-tap-highlight-color:transparent]"
      style={{ gap: 8, paddingBlock: 6, paddingInline: 10, borderRadius: 8, backgroundColor: active ? PLAYER.accentSoft : "transparent" }}
    >
      <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? PLAYER.accent : "transparent" }} />
      <span className="flex min-w-0 flex-1 flex-row items-center" style={{ gap: 4 }}>
        <span className="truncate" style={{ fontSize: 13, color: active ? PLAYER.accentLight : PLAYER.textSecondary }}>{title}</span>
        {suffix && <span className="truncate" style={{ fontSize: 13, color: PLAYER.textDim }}>{suffix}</span>}
        {badges?.map((b, i) => <Chip key={`${b.label}-${i}`} label={b.label} tone={b.tone ?? "purple"} />)}
      </span>
      {lang && <Chip label={lang} tone="purple" />}
      {codec && <Chip label={codec} tone="zinc" />}
      {rightChip && <Chip label={rightChip.label} tone={rightChip.tone ?? "zinc"} />}
    </button>
  );
}

function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const palette = tone === "purple"
    ? { bg: PLAYER.accentSoft, fg: PLAYER.accentChip }
    : tone === "amber"
      ? { bg: PLAYER.warningSoft, fg: PLAYER.warning }
      : { bg: PLAYER.borderSubtle, fg: PLAYER.textTertiary };
  return (
    <span
      className="shrink-0 whitespace-nowrap"
      style={{ backgroundColor: palette.bg, color: palette.fg, fontSize: 10, fontWeight: 600, paddingInline: 5, paddingBlock: 1, borderRadius: 3 }}
    >
      {label}
    </span>
  );
}
