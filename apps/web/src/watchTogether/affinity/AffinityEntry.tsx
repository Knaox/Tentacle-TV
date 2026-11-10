import { useTranslation } from "react-i18next";
import { CaretRightIcon as ChevronRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { HandHeartIcon as HeartHandshake } from "@phosphor-icons/react/dist/csr/HandHeart";
import { useWatchTogether } from "../WatchTogetherProvider";
import { closeRoomModal } from "../roomModalStore";
import { openAffinity, useAffinityStore } from "@tentacle-tv/api-client";
import { KIND_LABEL_KEY } from "@tentacle-tv/shared";

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
        className="group flex w-full items-center gap-3 rounded-tile bg-surface-2 px-3 py-2.5 text-left outline-none transition-colors duration-hover hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent"
        >
          <HeartHandshake className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-content-primary">{t("affinityFind")}</span>
          <span className="block truncate text-xs text-content-tertiary">{detail}</span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-content-quaternary" />
      </button>
    );
  }

  return (
    <section>
      <h3 className="ui-eyebrow mb-2">{t("affinityFind")}</h3>
      <div className="flex items-center gap-3 rounded-tile bg-surface-2 p-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent"
        >
          <HeartHandshake className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-content-tertiary">{detail}</p>
        <button
          type="button"
          onClick={open}
          disabled={alone}
          className="btn btn-sm btn-accent shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state ? t(participant ? "affinityResume" : "affinityJoin") : t("affinityStart")}
        </button>
      </div>
    </section>
  );
}
