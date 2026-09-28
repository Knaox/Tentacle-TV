import { useTranslation } from "react-i18next";
import { HeartHandshake, LogOut } from "lucide-react";
import type { WtAffinityStateDto } from "@tentacle-tv/shared";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import { showAffinityView } from "./affinityStore";
import { KIND_LABEL_KEY } from "./affinityText";

/**
 * L'en-tête de la pile : ce qu'on swipe (type, taille de la pile, « Changer »),
 * « Quitter », et qui swipe — chaque membre avec ce qu'il a jugé, ceux qui
 * n'ont pas encore rejoint en retrait. Voir les autres avancer dit qu'on
 * n'est pas seul à décider ; rien n'y dit CE qu'ils ont aimé.
 *
 * « Quitter » est un bouton nommé, pas une croix : la séance est partagée, et
 * la quitter la referme aussi chez l'autre quand on n'est que deux.
 */
export function AffinityHeader({ state, titleId, onQuit }: { state: WtAffinityStateDto; titleId: string; onQuit: () => void }) {
  const { t } = useTranslation("watchTogether");

  return (
    <header className="px-5 pb-2 pt-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        >
          <HeartHandshake className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-content-primary">{t("affinityTitle")}</h2>
          <p className="mt-0.5 text-[13px] text-content-tertiary">
            {t(KIND_LABEL_KEY[state.kind])} · {t("affinityDeckCount", { count: state.deckSize })}
            {" · "}
            <button
              type="button"
              onClick={() => showAffinityView("kinds")}
              className="rounded font-semibold text-[var(--brand-light)] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              {t("affinityChange")}
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={onQuit}
          aria-label={t("affinityQuitLabel")}
          title={t("affinityQuitLabel")}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-soft px-3.5 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {t("affinityQuit")}
        </button>
      </div>
      <AffinityParticipants state={state} />
    </header>
  );
}

function AffinityParticipants({ state }: { state: WtAffinityStateDto }) {
  const { t } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogether();
  if (!room) return null;
  const judged = new Map(state.participants.map((p) => [p.userId, p.judged]));

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {room.members.map((member) => {
        const count = judged.get(member.userId);
        const joined = count !== undefined;
        return (
          <li
            key={member.userId}
            className={`inline-flex items-center gap-2 rounded-full border border-line-subtle py-1 pl-1 pr-3 ${joined ? "bg-fill-faint" : "opacity-60"}`}
          >
            <WtAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} size={24} />
            <span className="text-xs font-medium text-content-primary">
              {member.userId === selfId ? t("affinityYou") : member.username}
            </span>
            <span className="text-xs tabular-nums text-content-tertiary">
              {joined ? t("affinityJudged", { count }) : t("affinityNotJoined")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
