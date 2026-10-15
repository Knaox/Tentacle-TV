import { useEffect, useState } from "react";

export type DecodedImageState = "none" | "pending" | "ready" | "failed";

/**
 * Une image chargée ET décodée hors de l'écran (`img.decode()`) : montrée
 * seulement à `ready`, elle se peint dès sa première image — jamais un cadre
 * vide qui se remplit sous les yeux. `none` sans adresse.
 */
export function useDecodedImage(url: string | null): DecodedImageState {
  const [decoded, setDecoded] = useState<{ url: string; state: "ready" | "failed" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    image.decode().then(
      () => { if (alive) setDecoded({ url, state: "ready" }); },
      () => { if (alive) setDecoded({ url, state: "failed" }); },
    );
    return () => {
      alive = false;
    };
  }, [url]);
  if (!url) return "none";
  return decoded?.url === url ? decoded.state : "pending";
}
