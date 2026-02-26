import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateTicket,
  useMyTickets,
  useTicketDetail,
  useReplyTicket,
  useSearchItems,
  useSeasons,
  useEpisodes,
  useJellyfinClient,
} from "@tentacle/api-client";
import type { SupportTicket } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";

export function SupportPanel() {
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openTicket = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  return (
    <div className="px-4 md:px-12">
      {view === "list" && <TicketList onNew={() => setView("new")} onOpen={openTicket} />}
      {view === "new" && <NewTicketForm onBack={() => setView("list")} onCreated={(id) => openTicket(id)} />}
      {view === "detail" && selectedId && <TicketDetail ticketId={selectedId} onBack={() => setView("list")} />}
    </div>
  );
}

function TicketList({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation("tickets");
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useMyTickets(filter || undefined);
  const tickets = data?.results ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{t("tickets:myTickets")}</h2>
        <button onClick={onNew} className="flex-shrink-0 rounded-lg bg-tentacle-accent px-4 py-2 text-sm font-semibold text-white hover:bg-tentacle-accent/80">
          {t("tickets:newTicket")}
        </button>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: "", label: t("tickets:all") },
          { key: "open", label: t("tickets:open") },
          { key: "in_progress", label: t("tickets:inProgress") },
          { key: "resolved", label: t("tickets:resolved") },
          { key: "closed", label: t("tickets:closed") },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.key ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>{f.label}</button>
        ))}
      </div>
      {isLoading && <Spinner />}
      {!isLoading && tickets.length === 0 && <p className="py-20 text-center text-white/40">{t("tickets:noTickets")}</p>}
      {!isLoading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((tk) => <TicketRow key={tk.id} ticket={tk} onClick={() => onOpen(tk.id)} />)}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: SupportTicket; onClick: () => void }) {
  const { t } = useTranslation("tickets");

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: t("tickets:statusOpen"), color: "bg-green-500/20 text-green-400" },
    in_progress: { label: t("tickets:statusInProgress"), color: "bg-blue-500/20 text-blue-400" },
    resolved: { label: t("tickets:statusResolved"), color: "bg-purple-500/20 text-purple-400" },
    closed: { label: t("tickets:statusClosed"), color: "bg-white/10 text-white/40" },
  };

  const CATEGORIES: Record<string, string> = {
    general: t("tickets:categoryGeneral"),
    bug: t("tickets:categoryBug"),
    feature: t("tickets:categorySuggestion"),
    account: t("tickets:categoryAccount"),
  };

  const status = STATUS_LABELS[ticket.status];
  const date = new Date(ticket.updatedAt).toLocaleDateString("fr-FR");
  const catLabel = CATEGORIES[ticket.category] ?? ticket.category;

  return (
    <div onClick={onClick} className="flex cursor-pointer items-center gap-4 rounded-xl bg-white/5 px-5 py-4 transition-colors hover:bg-white/10">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
        <p className="mt-0.5 text-xs text-white/40">
          {catLabel} — {date}
          {ticket._count && <span className="ml-2">{ticket._count.messages} message{ticket._count.messages !== 1 ? "s" : ""}</span>}
        </p>
        {ticket.mediaItemName && (
          <p className="mt-1 text-xs text-purple-400 truncate">{ticket.mediaItemName}</p>
        )}
      </div>
      {status && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>}
    </div>
  );
}

// ── Media selector for ticket creation ──

interface MediaSelection {
  itemId: string;
  displayName: string;
}

function MediaSelector({ onSelect, selection }: { onSelect: (s: MediaSelection | null) => void; selection: MediaSelection | null }) {
  const { t } = useTranslation("tickets");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [pickedSeries, setPickedSeries] = useState<MediaItem | null>(null);
  const [pickedSeasonId, setPickedSeasonId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const client = useJellyfinClient();

  const { data: results } = useSearchItems(search);
  const { data: seasons } = useSeasons(pickedSeries?.Id);
  const { data: episodes } = useEpisodes(pickedSeries?.Id, pickedSeasonId ?? undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectItem = (item: MediaItem) => {
    if (item.Type === "Series") {
      setPickedSeries(item);
      setPickedSeasonId(null);
      return;
    }
    const name = item.Type === "Episode"
      ? `${item.SeriesName} — S${item.ParentIndexNumber}E${item.IndexNumber} — ${item.Name}`
      : item.Name;
    onSelect({ itemId: item.Id, displayName: name });
    setShowDropdown(false);
    setSearch("");
    setPickedSeries(null);
  };

  const selectEpisode = (ep: MediaItem) => {
    const name = `${pickedSeries?.Name} — S${ep.ParentIndexNumber}E${ep.IndexNumber} — ${ep.Name}`;
    onSelect({ itemId: ep.Id, displayName: name });
    setShowDropdown(false);
    setSearch("");
    setPickedSeries(null);
    setPickedSeasonId(null);
  };

  const clear = () => {
    onSelect(null);
    setPickedSeries(null);
    setPickedSeasonId(null);
    setSearch("");
  };

  if (selection) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
        <span className="flex-1 text-sm text-purple-300 truncate">{selection.displayName}</span>
        <button onClick={clear} className="text-white/40 hover:text-white" type="button">&times;</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setPickedSeries(null); }}
        onFocus={() => setShowDropdown(true)}
        placeholder={t("tickets:searchMedia")}
        className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-tentacle-bg shadow-xl">
          {pickedSeries ? (
            <SeriesEpisodePicker
              series={pickedSeries}
              seasons={seasons}
              episodes={episodes}
              selectedSeasonId={pickedSeasonId}
              onSeasonChange={setPickedSeasonId}
              onEpisodeSelect={selectEpisode}
              onBack={() => setPickedSeries(null)}
              client={client}
            />
          ) : (
            <>
              {search.length < 2 && <p className="px-4 py-3 text-xs text-white/30">{t("tickets:typeAtLeast")}</p>}
              {search.length >= 2 && (!results || results.length === 0) && <p className="px-4 py-3 text-xs text-white/30">{t("tickets:noResults")}</p>}
              {results?.map((item) => (
                <SearchResultRow key={item.Id} item={item} client={client} onClick={() => selectItem(item)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({ item, client, onClick }: { item: MediaItem; client: any; onClick: () => void }) {
  const { t } = useTranslation("common");
  const poster = item.ImageTags?.Primary ? client.getImageUrl(item.Id, "Primary", { width: 60, quality: 80 }) : null;
  return (
    <button onClick={onClick} type="button"
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5">
      {poster ? (
        <img src={poster} alt="" className="h-10 w-7 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-7 items-center justify-center rounded bg-white/5 text-xs text-white/30">?</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{item.Name}</p>
        <p className="text-xs text-white/40">
          {item.Type === "Series" ? t("common:series") : t("common:movie")}
          {item.ProductionYear ? ` — ${item.ProductionYear}` : ""}
        </p>
      </div>
      {item.Type === "Series" && <span className="text-xs text-white/30">&rsaquo;</span>}
    </button>
  );
}

function SeriesEpisodePicker({ series, seasons, episodes, selectedSeasonId, onSeasonChange, onEpisodeSelect, onBack, client }: {
  series: MediaItem;
  seasons: MediaItem[] | undefined;
  episodes: MediaItem[] | undefined;
  selectedSeasonId: string | null;
  onSeasonChange: (id: string) => void;
  onEpisodeSelect: (ep: MediaItem) => void;
  onBack: () => void;
  client: any;
}) {
  const { t } = useTranslation("common");

  useEffect(() => {
    if (seasons && seasons.length > 0 && !selectedSeasonId) {
      onSeasonChange(seasons[0].Id);
    }
  }, [seasons, selectedSeasonId, onSeasonChange]);

  return (
    <div>
      <button onClick={onBack} type="button" className="flex w-full items-center gap-2 border-b border-white/5 px-4 py-2.5 text-xs text-white/50 hover:text-white">
        &larr; {series.Name}
      </button>
      {seasons && seasons.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2">
          {seasons.map((s) => (
            <button key={s.Id} type="button" onClick={() => onSeasonChange(s.Id)}
              className={`flex-shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${selectedSeasonId === s.Id ? "bg-purple-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
              {s.Name}
            </button>
          ))}
        </div>
      )}
      {!episodes && <p className="px-4 py-3 text-xs text-white/30">{t("common:loading")}</p>}
      {episodes?.map((ep) => {
        const thumb = ep.ImageTags?.Primary ? client.getImageUrl(ep.Id, "Primary", { width: 120, quality: 70 }) : null;
        return (
          <button key={ep.Id} type="button" onClick={() => onEpisodeSelect(ep)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/5">
            {thumb ? (
              <img src={thumb} alt="" className="h-8 w-14 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-14 items-center justify-center rounded bg-white/5 text-xs text-white/20">{ep.IndexNumber}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">E{ep.IndexNumber} — {ep.Name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Ticket creation form ──

function NewTicketForm({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation("tickets");

  const CATEGORIES = [
    { value: "general", label: t("tickets:categoryGeneral") },
    { value: "bug", label: t("tickets:categoryBug") },
    { value: "feature", label: t("tickets:categorySuggestion") },
    { value: "account", label: t("tickets:categoryAccount") },
  ] as const;

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"general" | "bug" | "feature" | "account">("general");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaSelection | null>(null);
  const createMut = useCreateTicket();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    createMut.mutate(
      {
        subject: subject.trim(),
        category,
        body: body.trim(),
        mediaItemId: media?.itemId,
        mediaItemName: media?.displayName,
      },
      { onSuccess: (tk) => onCreated(tk.id) }
    );
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-white/50 hover:text-white">{t("tickets:backToTickets")}</button>
      <h2 className="mb-6 text-lg font-semibold text-white">{t("tickets:newTicket")}</h2>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-xs text-white/50">{t("tickets:subject")}</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("tickets:subjectPlaceholder")}
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50" maxLength={300} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">{t("tickets:category")}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as any)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">{t("tickets:relatedMedia")}</label>
          <MediaSelector selection={media} onSelect={setMedia} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">{t("tickets:message")}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("tickets:messagePlaceholder")} rows={6}
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50 resize-none" maxLength={5000} />
        </div>
        <button type="submit" disabled={createMut.isPending || !subject.trim() || !body.trim()}
          className="rounded-lg bg-tentacle-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50">
          {createMut.isPending ? t("common:sending") : t("tickets:createTicket")}
        </button>
      </form>
    </div>
  );
}

// ── Ticket detail view ──

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { t } = useTranslation("tickets");

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: t("tickets:statusOpen"), color: "bg-green-500/20 text-green-400" },
    in_progress: { label: t("tickets:statusInProgress"), color: "bg-blue-500/20 text-blue-400" },
    resolved: { label: t("tickets:statusResolved"), color: "bg-purple-500/20 text-purple-400" },
    closed: { label: t("tickets:statusClosed"), color: "bg-white/10 text-white/40" },
  };

  const CATEGORIES: Record<string, string> = {
    general: t("tickets:categoryGeneral"),
    bug: t("tickets:categoryBug"),
    feature: t("tickets:categorySuggestion"),
    account: t("tickets:categoryAccount"),
  };

  const { data: ticket, isLoading } = useTicketDetail(ticketId);
  const [reply, setReply] = useState("");
  const replyMut = useReplyTicket();

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    replyMut.mutate({ ticketId, body: reply.trim() }, { onSuccess: () => setReply("") });
  };

  if (isLoading || !ticket) return <Spinner />;

  const status = STATUS_LABELS[ticket.status];
  const isClosed = ticket.status === "closed";

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-white/50 hover:text-white">{t("tickets:backToTickets")}</button>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{ticket.subject}</h2>
          {status && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>}
        </div>
        <p className="mt-1 text-xs text-white/40">
          {CATEGORIES[ticket.category] ?? ticket.category} — {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
        </p>
        {ticket.mediaItemName && (
          <p className="mt-2 text-xs text-purple-400">{ticket.mediaItemName}</p>
        )}
      </div>
      <div className="max-w-3xl space-y-3">
        {ticket.messages?.map((msg) => (
          <div key={msg.id} className={`rounded-xl p-4 ${msg.isAdmin ? "border border-purple-500/20 bg-purple-500/10" : "bg-white/5"}`}>
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className={`font-medium ${msg.isAdmin ? "text-purple-400" : "text-white/70"}`}>{msg.username}</span>
              {msg.isAdmin && <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-[10px] text-purple-300">{t("tickets:adminBadge")}</span>}
              <span className="text-white/30">{new Date(msg.createdAt).toLocaleString("fr-FR")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-white/80">{msg.body}</p>
          </div>
        ))}
      </div>
      {!isClosed && (
        <form onSubmit={handleReply} className="mt-6 max-w-3xl">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("tickets:replyPlaceholder")} rows={3}
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50 resize-none" maxLength={5000} />
          <button type="submit" disabled={replyMut.isPending || !reply.trim()}
            className="mt-2 rounded-lg bg-tentacle-accent px-5 py-2 text-sm font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50">
            {replyMut.isPending ? t("common:sending") : t("common:send")}
          </button>
        </form>
      )}
      {isClosed && <p className="mt-6 text-sm text-white/40">{t("tickets:ticketClosed")}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}
