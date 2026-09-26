import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Film, Info, Play } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { itemMeta, matchReason, personMeta, type SearchPersonHit, type SearchTopHit } from "@tentacle-tv/shared";
import { PersonAvatar } from "./SearchPeople";

interface Props {
  top: SearchTopHit;
  onOpen: (id: string) => void;
  onPlay: (id: string) => void;
  onPerson: (person: SearchPersonHit) => void;
}

/** Ce qui se lance tel quel ; une série ou une collection s'ouvre d'abord. */
const PLAYABLE = new Set(["Movie", "Episode"]);

const CTA = "flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm active:opacity-75";
const CTA_PRIMARY = `${CTA} bg-cta-primary-bg font-bold text-cta-primary-fg`;
const CTA_SECONDARY = `${CTA} border border-line-subtle bg-fill-soft font-semibold text-content-primary`;

/** La carte : 16 de marge, 12 au-dessus, 12 dedans, rayon 16, `fill.faint` bordé. */
function Card({ children }: { children: ReactNode }) {
  const { t } = useTranslation("search");
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-line-subtle bg-fill-faint p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.8px] text-content-tertiary">{t("topResult")}</p>
      {children}
    </div>
  );
}

/**
 * `TopResultCard` de l'app — le meilleur résultat mis en avant : affiche
 * 92 × 138 rayon 8, méta 12 (« Film · 2019 · ★ 7,1 »), titre 20 gras sur
 * deux lignes, raison 13 violet clair (« Avec Tom Hanks »), puis « Lire » /
 * « Reprendre » (blanc) et « Détails » en pilules de 40. Une personne : son
 * portrait 92 et « Filmographie ».
 */
export const TopResultCard = memo(function TopResultCard({ top, onOpen, onPlay, onPerson }: Props) {
  const { t, i18n } = useTranslation("search");
  const client = useJellyfinClient();
  const [broken, setBroken] = useState(false);

  if (top.kind === "person") {
    const person = top.hit;
    return (
      <Card>
        <button type="button" onClick={() => onPerson(person)} className="flex w-full items-center gap-3 text-left active:opacity-75">
          <PersonAvatar person={person} size={92} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="line-clamp-2 text-xl font-bold leading-6 tracking-[-0.3px] text-content-primary">{person.name}</span>
            <span className="line-clamp-2 text-xs font-medium text-content-tertiary">{personMeta(t, person)}</span>
            <span className={`${CTA_SECONDARY} mt-1 self-start`}>
              <Film size={15} aria-hidden />
              {t("filmography")}
            </span>
          </span>
        </button>
      </Card>
    );
  }

  const { item, match } = top.hit;
  const reason = matchReason(t, match);
  const playable = PLAYABLE.has(item.Type);
  const resume = (item.UserData?.PlayedPercentage ?? 0) > 0 && !item.UserData?.Played;
  const poster = item.ImageTags?.Primary && !broken
    ? client.getImageUrl(item.Id, "Primary", { height: 360, quality: 85 })
    : null;

  return (
    <Card>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpen(item.Id)}
          aria-label={item.Name}
          className="relative h-[138px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-surface-2"
        >
          {poster && (
            <img src={poster} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-xs font-medium text-content-tertiary">{itemMeta(t, item, i18n.language)}</p>
          <p className="line-clamp-2 text-xl font-bold leading-6 tracking-[-0.3px] text-content-primary">{item.Name}</p>
          {reason && <p className="truncate text-[13px] font-medium text-brand-light">{reason}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {playable && (
              <button type="button" onClick={() => onPlay(item.Id)} className={CTA_PRIMARY}>
                <Play size={15} aria-hidden />
                {resume ? t("resume") : t("play")}
              </button>
            )}
            <button type="button" onClick={() => onOpen(item.Id)} className={playable ? CTA_SECONDARY : CTA_PRIMARY}>
              <Info size={15} aria-hidden />
              {t("details")}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
});
