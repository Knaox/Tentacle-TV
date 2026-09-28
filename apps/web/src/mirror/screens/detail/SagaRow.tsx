import { memo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { sagaLabel, sagaSummary, sagaTitle, type MediaItem, type SagaEntry, type SagaView } from "@tentacle-tv/shared";
import { useDetailSaga } from "../../../components/detail/saga/useDetailSaga";
import { MediaCard } from "../../cards/MediaCard";
import { useCardWidth } from "../../useMirrorLayout";
import { ExternalResultCard } from "../search/ExternalResultCard";

/**
 * La saga d'un film dans le miroir (téléphone) — celle du bureau, à la
 * grammaire des rangées de l'app : titre 18 gras, le résumé 12 dessous
 * (« 8 films · 6 dans la bibliothèque · 2 vus » ne tient pas à côté du nom
 * sur 375 px), puis les volets dans l'ordre, l'étiquette sous chaque carte.
 * Le film ouvert est cerclé et inerte ; le rail se cale dessus.
 */
export const SagaRow = memo(function SagaRow({ item }: { item: MediaItem }) {
  const view = useDetailSaga(item);
  return view === null ? null : <SagaRail view={view} />;
});

function SagaRail({ view }: { view: SagaView }) {
  const { t } = useTranslation("media");
  const width = useCardWidth();
  const railRef = useRef<HTMLDivElement>(null);
  const title = sagaTitle(t, view);

  // Le film ouvert visible d'emblée, le volet d'avant en contexte.
  const currentKey = view.entries.find((e) => e.cue === "current")?.key ?? null;
  useEffect(() => {
    const rail = railRef.current;
    const current = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    const first = rail?.firstElementChild as HTMLElement | null | undefined;
    if (!rail || !current || !first) return;
    const anchor = (current.previousElementSibling as HTMLElement | null) ?? current;
    rail.scrollLeft = anchor.offsetLeft - first.offsetLeft;
  }, [currentKey]);

  return (
    <section className="mt-6" aria-label={title}>
      <div className="mb-2 px-4">
        <h2 className="truncate text-lg font-bold tracking-[-0.3px] text-content-primary">{title}</h2>
        <p className="mt-0.5 truncate text-xs font-medium text-content-tertiary">{sagaSummary(t, view)}</p>
      </div>
      {/* `py-1` : l'anneau du film ouvert déborde de 4 px, et le défilement
          horizontal rogne ce qui dépasse en hauteur. */}
      <div
        ref={railRef}
        className="mirror-no-scrollbar relative flex gap-3.5 overflow-x-auto overscroll-x-contain px-4 py-1"
        style={{ scrollPaddingInline: 16 }}
      >
        {view.entries.map((entry) => (
          <SagaColumn key={entry.key} entry={entry} width={width} />
        ))}
      </div>
    </section>
  );
}

const SagaColumn = memo(function SagaColumn({ entry, width }: { entry: SagaEntry; width: number }) {
  const { t } = useTranslation("media");
  const navigate = useNavigate();
  const { rank, cue } = sagaLabel(t, entry);
  const current = entry.kind === "library" && entry.cue === "current";

  return (
    <div className="shrink-0" style={{ width }} aria-current={current ? "page" : undefined}>
      {entry.kind === "external" ? (
        <ExternalResultCard item={entry.item} width={width} onPress={() => navigate(entry.item.href)} />
      ) : current ? (
        <div className="pointer-events-none rounded-[10px] ring-2 ring-[rgba(var(--brand-rgb),0.75)] ring-offset-2 ring-offset-surface-0">
          <MediaCard item={entry.item} width={width} />
        </div>
      ) : (
        <MediaCard item={entry.item} width={width} onPress={() => navigate(`/media/${entry.item.Id}`)} />
      )}
      <p className="mt-1 h-4 truncate text-[11.5px] font-medium leading-4 text-content-tertiary">
        {rank}
        {rank !== null && cue !== null && <span aria-hidden> · </span>}
        {cue !== null && <span className="font-semibold text-brand-light">{cue}</span>}
      </p>
    </div>
  );
});
