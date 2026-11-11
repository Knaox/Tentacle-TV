import { ArrowDownIcon } from "@phosphor-icons/react/dist/csr/ArrowDown";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WtChatMessageDto } from "@tentacle-tv/shared";
import { WtAvatar } from "../WatchTogetherRows";
import { buildThread, type ThreadRow } from "./chatThread";
import "./chatThread.css";

/** À moins de 48 px du bas, le fil est « tenu en bas » : il suit les messages qui arrivent. */
const STICK_PX = 48;

/** L'heure dans la langue de l'INTERFACE (24 h en français), pas dans celle du système. */
function formatTime(at: number, language: string): string {
  return new Date(at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
}

const MessageRow = memo(function MessageRow({ row, arriving, language }: { row: ThreadRow; arriving: boolean; language: string }) {
  const { message, isSelf, first, last, emojiOnly } = row;
  const time = formatTime(message.at, language);
  return (
    <div className={arriving ? "wtc-row wtc-row--in" : "wtc-row"} data-self={isSelf} data-first={first} data-last={last}>
      {!isSelf && (
        <div className="wtc-row__avatar">
          {first && <WtAvatar userId={message.userId} name={message.username} size={28} />}
        </div>
      )}
      <div className="wtc-row__body">
        {first && (
          <div className="wtc-meta">
            {!isSelf && <span className="wtc-meta__name">{message.username}</span>}
            <time className="wtc-meta__time" dateTime={new Date(message.at).toISOString()}>{time}</time>
          </div>
        )}
        {/* L'heure de CHAQUE message reste lisible au survol, même au milieu d'une suite. */}
        <div className="wtc-bubble" data-emoji={emojiOnly} title={time}>{message.text}</div>
      </div>
    </div>
  );
});

interface ChatMessagesProps {
  messages: readonly WtChatMessageDto[];
  selfId: string | null;
  /** Le premier message non lu à l'ouverture du panneau : la marque passe au-dessus de lui. */
  unreadFromId: string | null;
  /** Le sélecteur d'emojis couvre le bas du fil : le fil se réserve sa hauteur (`chat.css`). */
  pickerOpen: boolean;
}

/**
 * Watch Together — le fil des messages : suites groupées par auteur (avatar, nom et heure sur
 * le premier), les siens à droite, les emojis seuls en grand ; la marque « Nouveaux messages »
 * à l'ouverture ; l'arrivée animée des messages reçus panneau ouvert.
 *
 * # Tenu en bas
 *
 * Le fil suit les messages qui arrivent tant qu'on est en bas (à 48 px près). Dès qu'on remonte
 * lire, il ne bouge plus : ce qui arrive dessous se compte dans une pilule (« 2 nouveaux
 * messages »), qui y ramène. Un message qu'on envoie soi-même ramène toujours en bas.
 */
export function ChatMessages({ messages, selfId, unreadFromId, pickerOpen }: ChatMessagesProps) {
  const { t, i18n } = useTranslation("watchTogether");
  const listRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const stuck = useRef(true);
  const [away, setAway] = useState(false);
  const [below, setBelow] = useState(0);

  // Ce qui était là à l'OUVERTURE du panneau ne s'anime pas ; tout message inséré ensuite porte
  // la classe d'arrivée (`@starting-style` ne joue qu'à l'insertion d'un élément : un fil relu
  // à la reconnexion, mêmes identifiants, ne rejoue rien).
  const [baseline] = useState(() => new Set(messages.map((m) => m.id)));
  // Les messages déjà comptés (pour suivre ou compter ce qui arrive) — lu dans les effets seulement.
  const known = useRef<Set<string>>(new Set(baseline));

  const rows = useMemo(() => buildThread(messages, selfId, unreadFromId), [messages, selfId, unreadFromId]);

  const toBottom = useCallback((smooth: boolean) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    stuck.current = true;
    setAway(false);
    setBelow(0);
  }, []);

  // À l'ouverture : en bas — ou sur la marque des non-lus quand ils débordent la fenêtre.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const divider = dividerRef.current;
    if (divider && list.scrollHeight - divider.offsetTop > list.clientHeight) {
      list.scrollTop = Math.max(0, divider.offsetTop - 8);
      stuck.current = false;
      setAway(true);
    } else {
      list.scrollTop = list.scrollHeight;
    }
  }, []);

  // Un message arrive : on suit si l'on était en bas (ou si c'est le sien), sinon on compte.
  useLayoutEffect(() => {
    const set = known.current;
    const fresh = messages.filter((m) => !set.has(m.id));
    for (const m of messages) set.add(m.id);
    if (fresh.length === 0) return;
    const list = listRef.current;
    if (!list) return;
    const mine = fresh.some((m) => selfId !== null && m.userId === selfId);
    if (stuck.current || mine) {
      list.scrollTop = list.scrollHeight;
      stuck.current = true;
      setAway(false);
      setBelow(0);
    } else {
      setBelow((n) => n + fresh.length);
    }
  }, [messages, selfId]);

  // Le sélecteur s'ouvre ou se ferme : le bas du fil se réserve (ou rend) sa hauteur — tenu en
  // bas, le fil y reste, et le dernier message se lit au-dessus du sélecteur.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stuck.current) list.scrollTop = list.scrollHeight;
  }, [pickerOpen]);

  // Le panneau change de taille (poignée) : un fil tenu en bas y reste.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (stuck.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_PX;
    stuck.current = atBottom;
    setAway(!atBottom);
    if (atBottom) setBelow(0);
  }, []);

  return (
    <>
      <div ref={listRef} onScroll={onScroll} className="wtc-list" role="log" aria-live="polite" aria-relevant="additions" aria-label={t("chatTitle")}>
        {rows.length === 0 ? (
          <div className="wtc-empty">
            <ChatsCircleIcon size={28} aria-hidden />
            <p>{t("chatEmpty")}</p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.message.id}>
              {row.message.id === unreadFromId && (
                <div ref={dividerRef} className="wtc-divider" role="separator">{t("chatNewDivider")}</div>
              )}
              <MessageRow row={row} arriving={!baseline.has(row.message.id)} language={i18n.language} />
            </div>
          ))
        )}
      </div>
      {away && (
        <button type="button" className="wtc-jump" onClick={() => toBottom(true)} aria-label={below > 0 ? t("chatJump", { count: below }) : t("chatJumpLatest")} title={t("chatJumpLatest")}>
          <ArrowDownIcon size={14} weight="bold" aria-hidden />
          {below > 0 && <span>{t("chatJump", { count: below })}</span>}
        </button>
      )}
    </>
  );
}
