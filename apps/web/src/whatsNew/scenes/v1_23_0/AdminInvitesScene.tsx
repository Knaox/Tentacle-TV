import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { buildInviteUrl } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { getBackendBase } from "../../../lib/backendBase";
import { formatDeadline } from "../../../components/admin/invites/inviteFormat";
import { EXPIRY_PRESET_DAYS, USES_PRESETS } from "../../../components/admin/invites/inviteDraft";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxChoiceRow, chipCenter } from "./FauxChoiceRow";

const STEPS = [600, 700, 300, 700, 300, 700, 300, 900, 300, 1200] as const;
const PANEL = { x: 110, y: 32, w: 420, h: 296 } as const;
const IN = { x: PANEL.x + 20, y: PANEL.y + 20, w: PANEL.w - 40 } as const;
const USES_W = 44;
const DAYS_W = 62;
/** Les cibles du curseur : « 5 », « 7 jours », « Créer le lien », « Copier le lien ». */
const TARGETS = [
  { x: IN.x + chipCenter(USES_W, 1), y: IN.y + 90 },
  { x: IN.x + chipCenter(DAYS_W, 2), y: IN.y + 150 },
  { x: IN.x + IN.w - 55, y: IN.y + 236 },
  { x: IN.x + IN.w - 50, y: IN.y + 102 },
] as const;
/** Une clé à l'allure réelle ; l'origine, elle, est celle du serveur. */
const SCENE_KEY = "k7Qm2xPa";

/**
 * La nouvelle invitation : des préréglages (5 personnes, 7 jours), « Créer le
 * lien », et le lien prêt à copier dans la même fenêtre — il mène au serveur.
 */
export function AdminInvitesScene({ active, reduced }: SceneProps) {
  const { t, i18n } = useTranslation("adminInvites");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const url = useMemo(() => buildInviteUrl(getBackendBase() || window.location.origin, SCENE_KEY), []);
  // L'échéance suit la durée choisie, comme le résumé du vrai formulaire.
  const deadlines = useMemo(
    () => EXPIRY_PRESET_DAYS.map((count) => formatDeadline(Date.now() + count * 86_400_000, i18n.language)),
    [i18n.language],
  );
  const uses = step >= 2 ? 1 : 0;
  const days = step >= 4 ? 2 : 1;
  const ready = step >= 7;
  const copied = step >= 9;
  const target = step >= 7 ? TARGETS[3] : step >= 5 ? TARGETS[2] : step >= 3 ? TARGETS[1] : step >= 1 ? TARGETS[0] : { x: 580, y: 340 };
  const summary = t("summary", { people: t("people", { count: USES_PRESETS[uses] }), date: deadlines[days] });
  return (
    <SceneStage cycle={cycle}>
      <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h}>
        <div className="h-full rounded-2xl border border-line-subtle" style={{ background: "var(--nav-panel-bg)", boxShadow: "var(--shadow-dropdown)" }} />
      </Place>
      <Place x={IN.x} y={IN.y} w={IN.w} visible={!ready}>
        <p className="text-[15px] font-bold text-content-primary">{t("dialogTitle")}</p>
        <p className="truncate text-[10.5px] text-content-tertiary">{t("dialogSubtitle")}</p>
        <div className="mt-4 space-y-3">
          <FauxChoiceRow legend={t("usesLabel")} chipW={USES_W} selected={uses}
            labels={[...USES_PRESETS.map(String), t("custom")]} />
          <FauxChoiceRow legend={t("expiryLabel")} chipW={DAYS_W} selected={days}
            labels={[...EXPIRY_PRESET_DAYS.map((count) => t("days", { count })), t("custom")]} />
        </div>
        <p className="mt-4 text-[10.5px] leading-snug text-content-tertiary">{summary}</p>
        <div className="mt-6 flex justify-end gap-2 text-[11px]">
          <span className="inline-flex h-8 items-center rounded-lg border border-line-subtle bg-fill-soft px-3 font-semibold text-content-primary">{t("common:cancel")}</span>
          <span className="inline-flex h-8 w-[110px] items-center justify-center rounded-lg border border-cta-primary-border bg-cta-primary-bg font-bold text-cta-primary-fg">{t("create")}</span>
        </div>
      </Place>
      <Place x={IN.x} y={IN.y} w={IN.w} visible={ready} dy={ready ? 0 : 8}>
        <p className="text-[15px] font-bold text-content-primary">{t("readyTitle")}</p>
        <p className="text-[10.5px] leading-snug text-content-tertiary">{t("readySubtitle")}</p>
        <p className="mb-1 mt-5 text-[10.5px] font-medium text-content-tertiary">{t("linkLabel")}</p>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 break-all rounded-lg border border-line-subtle bg-fill-subtle px-2.5 py-2 font-mono text-[10.5px] leading-snug text-content-primary">
            {url}
          </span>
          <span className="inline-flex h-8 w-[100px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-cta-primary-border bg-cta-primary-bg text-[11px] font-bold text-cta-primary-fg">
            {copied ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
            {copied ? t("copied") : t("copyLink")}
          </span>
        </div>
        <p className="mt-4 text-[10.5px] leading-snug text-content-tertiary">{summary}</p>
      </Place>
      <FauxCursor x={target.x} y={target.y} pressed={step === 2 || step === 4 || step === 6 || step === 8} reduced={reduced} />
    </SceneStage>
  );
}
