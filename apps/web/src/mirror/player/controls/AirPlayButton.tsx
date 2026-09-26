import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Airplay } from "lucide-react";
import { PLAYER } from "../playerColors";
import { TouchButton } from "./TouchButton";

type AirPlayVideo = HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void };
type AvailabilityEvent = Event & { availability?: string };

const EVENT = "webkitplaybacktargetavailabilitychanged";

/**
 * Le bouton AirPlay de l'app (`AirPlaySection`, iOS seulement) — ici celui de
 * Safari : il n'existe que si le navigateur annonce une cible AirPlay pour
 * CETTE vidéo (`webkitplaybacktargetavailabilitychanged`). Ailleurs (Chrome,
 * Firefox, Android), aucun événement ne vient : le bouton ne s'affiche pas.
 * Icône 18, fond `borderSubtle`, rayon 8, marge 8 — comme l'app.
 */
export function AirPlayButton({ videoRef }: { videoRef: MutableRefObject<HTMLVideoElement | null> }) {
  const [available, setAvailable] = useState(false);
  const boundRef = useRef<{ video: HTMLVideoElement; onChange: (e: Event) => void } | null>(null);

  // Sans dépendances : le lecteur remplace sa balise <video> quand la sorte de
  // source change (directe ↔ MSE) — on se rebranche sur la nouvelle, une fois.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || video === boundRef.current?.video) return;
    if (!("WebKitPlaybackTargetAvailabilityEvent" in window)) return;
    boundRef.current?.video.removeEventListener(EVENT, boundRef.current.onChange);
    const onChange = (e: Event) => setAvailable((e as AvailabilityEvent).availability === "available");
    video.addEventListener(EVENT, onChange);
    boundRef.current = { video, onChange };
  });
  useEffect(() => () => {
    boundRef.current?.video.removeEventListener(EVENT, boundRef.current.onChange);
    boundRef.current = null;
  }, []);

  if (!available) return null;
  return (
    <TouchButton
      label="AirPlay"
      slop={0}
      onPress={() => (videoRef.current as AirPlayVideo | null)?.webkitShowPlaybackTargetPicker?.()}
      style={{ padding: 8, backgroundColor: PLAYER.borderSubtle, borderRadius: 8 }}
    >
      <Airplay size={18} color={PLAYER.textSecondary} />
    </TouchButton>
  );
}
