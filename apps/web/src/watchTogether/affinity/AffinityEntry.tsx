import { useTranslation } from "react-i18next";
import { ChevronRight, HeartHandshake } from "lucide-react";
import { useWatchTogether } from "../WatchTogetherProvider";
import { closeRoomModal } from "../roomModalStore";
import { openAffinity, useAffinityStore } from "./affinityStore";
import { KIND_LABEL_KEY } from "./affinityText";

/**
 * L'entrée de l'affinité, là où l'on voit la salle : le panneau de la barre
 * (`panel`) et la modale du groupe (`room`). Seul dans la salle, elle reste
 * visible mais inactive, et dit pourquoi — une fonctionnalité qui disparaît
 * sans explication ne se découvre pas.
 */
export function AffinityEntry({ variant, onOpen }: { variant: "panel" | "room"; onOpen?: () => void }) {
  const { t } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogether();
  const { state } = useAffinityStore();
  if (!room) return null;

  const alone = room.members.length < 2;
  const participant = !!state && state.participants.some((p) => p.userId === selfId);
  const detail = alone
    ? t("affinityNeedTwo")
    : state
      ? `${t(KIND_LABEL_KEY[state.kind])} · ${t("affinityInProgress")}`
      : t("affinityFindHint");
  const open = () => {
    onOpen?.();
    closeRoomModal();
    openAffinity();
  };

  if (variant === "panel") {
    return (
      <button
        type="button"
        onClick={open}
        disabled={alone}
        className="group flex w-full items-center gap-3 rounded-2xl border border-line-subtle bg-fill-faint px-3 py-2.5 text-left outline-none transition-colors hover:bg-fill-soft focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        >
          <HeartHandshake className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-content-primary">{t("affinityFind")}</span>
          <span className="block truncate text-xs text-content-tertiary">{detail}</span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-content-quaternary transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  }

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{t("affinityFind")}</h3>
      <div className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-fill-faint p-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        >
          <HeartHandshake className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-content-tertiary">{detail}</p>
        <button
          type="button"
          onClick={open}
          disabled={alone}
          className="inline-flex h-9 shrink-0 items-center rounded-full bg-[rgba(var(--brand-rgb),0.18)] px-4 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:bg-[rgba(var(--brand-rgb),0.3)] focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state ? t(participant ? "affinityResume" : "affinityJoin") : t("affinityStart")}
        </button>
      </div>
    </section>
  );
}
