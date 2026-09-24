import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, CircleCheck, Cpu, Package, type LucideIcon } from "lucide-react";
import type { DeliveryKind } from "@tentacle-tv/shared";

/**
 * La pastille qui dit comment le média arrive — une couleur par poids pour le
 * serveur, et TOUJOURS une icône et un mot : la couleur seule ne dit rien à
 * qui ne la distingue pas.
 *
 * - lecture directe : vert, rien à surveiller ;
 * - remux : bleu — ni le vert du « rien », ni l'ambre de l'alerte : le serveur
 *   ne fait que réemballer, sans perte ;
 * - transcodage audio : l'aplat ambre, la famille du transcodage ;
 * - transcodage : le même aplat CERCLÉ d'ambre — plus d'encre pour le plus
 *   lourd, c'est lui que l'œil doit trouver d'abord.
 *
 * Contour en couleur pleine (`border-status-warning`) et non en opacité : un
 * modificateur `/40` sur un jeton `var()` est supprimé par Tailwind sans un
 * mot (cf. `theme/alphaModifier.test.ts`).
 */

interface DeliveryStyle {
  label: string;
  count: string;
  hint: string;
  tone: string;
  Icon: LucideIcon;
}

const STYLE: Record<DeliveryKind, DeliveryStyle> = {
  direct: { label: "directPlay", count: "countDirect", hint: "directPlayHint", tone: "bg-status-success-bg text-status-success-fg", Icon: CircleCheck },
  remux: { label: "remux", count: "countRemux", hint: "remuxHint", tone: "bg-status-info-bg text-status-info-fg", Icon: Package },
  audio: { label: "audioTranscode", count: "countAudio", hint: "audioTranscodeHint", tone: "bg-status-warning-bg text-status-warning-fg", Icon: AudioLines },
  video: { label: "transcode", count: "countVideo", hint: "transcodeHint", tone: "border border-status-warning bg-status-warning-bg text-status-warning-fg", Icon: Cpu },
};

const SIZE = {
  md: { box: "h-7 gap-1.5 px-2.5 text-[11.5px]", icon: 13 },
  sm: { box: "h-6 gap-1 px-2 text-[11px]", icon: 12 },
} as const;

export const DeliveryChip = memo(function DeliveryChip({ kind, count, size = "md" }: {
  kind: DeliveryKind;
  /** Présent : la pastille devient un compteur (« 2 remux »). */
  count?: number;
  size?: keyof typeof SIZE;
}) {
  const { t } = useTranslation("sessions");
  const style = STYLE[kind];
  const box = SIZE[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold tracking-wide ${box.box} ${style.tone}`}
      title={t(style.hint)}
    >
      <style.Icon size={box.icon} aria-hidden strokeWidth={2.2} />
      <span className={count === undefined ? undefined : "tabular-nums"}>
        {count === undefined ? t(style.label) : t(style.count, { count })}
      </span>
    </span>
  );
});

/** La clé du libellé, pour les textes qui la citent sans pastille. */
export function deliveryLabelKey(kind: DeliveryKind): string {
  return STYLE[kind].label;
}
