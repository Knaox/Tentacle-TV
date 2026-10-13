import { memo, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ProfileTile, type TileRole } from "./ProfileTile";
import { nextTileIndex } from "./rowKeys";
import type { PickerProfile } from "./pickerTypes";

interface ProfileRowProps {
  profiles: readonly PickerProfile[];
  /** L'entrée en cours dans ce profil ; null au repos. */
  enteringId: string | null;
  /** Le profil qui reprend le focus à l'affichage (retour du pavé) ; le premier sinon. */
  focusId?: string | null;
  onPick: (id: string) => void;
}

/**
 * La rangée des profils, au clavier comme à la souris : une seule tuile dans
 * l'ordre de tabulation (tabulation itinérante), les flèches passent d'un
 * profil à l'autre, Début et Fin vont aux extrémités, Entrée ou Espace ouvre.
 * Le focus arrive sur le premier profil — le sien, en tête — à l'affichage.
 *
 * Pendant l'entrée dans un profil, plus rien ne se choisit : le choisi glisse
 * au centre de la rangée (décalage MESURÉ au moment du choix), les autres
 * s'effacent.
 */
export const ProfileRow = memo(function ProfileRow({ profiles, enteringId, focusId = null, onPick }: ProfileRowProps) {
  const { t } = useTranslation("profilePicker");
  const listRef = useRef<HTMLUListElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const [current, setCurrent] = useState(() => Math.max(0, profiles.findIndex((profile) => profile.id === focusId)));
  const [shiftX, setShiftX] = useState(0);
  const focusedIndex = Math.min(current, Math.max(0, profiles.length - 1));

  // Le premier focus, sans attendre un Tab : le profil d'où l'on revient (le
  // pavé refermé), sinon le premier — le sien. Une fois, à l'affichage :
  // ensuite, c'est l'utilisateur qui déplace le focus.
  const firstFocus = useRef(focusedIndex);
  useLayoutEffect(() => {
    tiles.current[firstFocus.current]?.focus({ preventScroll: true });
  }, []);

  // Le décalage du choisi vers le centre de la rangée, mesuré une fois.
  useLayoutEffect(() => {
    if (enteringId === null) {
      setShiftX(0);
      return;
    }
    const index = profiles.findIndex((profile) => profile.id === enteringId);
    const tile = tiles.current[index];
    const list = listRef.current;
    if (!tile || !list) return;
    const tileBox = tile.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    setShiftX(Math.round(listBox.left + listBox.width / 2 - (tileBox.left + tileBox.width / 2)));
  }, [enteringId, profiles]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tiles.current.indexOf(event.currentTarget);
    const next = nextTileIndex(event.key, index, profiles.length);
    if (next === null) return;
    event.preventDefault();
    setCurrent(next);
    tiles.current[next]?.focus();
  }, [profiles.length]);

  const onFocus = useCallback((id: string) => {
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index >= 0) setCurrent(index);
  }, [profiles]);

  const roleOf = (id: string): TileRole => (enteringId === null ? "idle" : id === enteringId ? "chosen" : "receding");

  return (
    <ul ref={listRef} aria-label={t("whoIsWatching")} className="flex max-w-5xl flex-wrap items-start justify-center gap-x-8 gap-y-6">
      {profiles.map((profile, index) => (
        <ProfileTile
          key={profile.id}
          ref={(node) => { tiles.current[index] = node; }}
          profile={profile}
          role={roleOf(profile.id)}
          shiftX={profile.id === enteringId ? shiftX : 0}
          tabbable={index === focusedIndex}
          disabled={enteringId !== null}
          onPick={onPick}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        />
      ))}
    </ul>
  );
});
