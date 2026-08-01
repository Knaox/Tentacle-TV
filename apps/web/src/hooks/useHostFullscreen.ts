import { useEffect, useState } from "react";
import { listen } from "../desktop/bridge";

/**
 * La fenêtre de l'hôte est-elle en plein écran ?
 *
 * L'évènement existait déjà — `window://fullscreen`, émis par `main/window.ts` à
 * chaque entrée et sortie, et à l'ouverture d'une session de lecteur. Il n'était
 * écouté que par le lecteur (`useMpvCommands`), qui en fait un champ de son
 * état. Le bandeau d'hôte en a besoin AILLEURS que dans le lecteur : il vit à la
 * racine de l'application, et doit se démonter en plein écran quelle que soit la
 * page affichée.
 *
 * D'où ce hook plutôt qu'un second abonnement recopié : la valeur a désormais
 * deux lecteurs, et deux abonnements écrits séparément finiraient par diverger
 * sur le nom de l'évènement ou sur l'état initial.
 *
 * ⚠️ L'état initial est `false` et ne se devine pas : rien ne permet de LIRE le
 * plein écran depuis la page, seul l'évènement l'annonce. C'est sans
 * conséquence — l'application ne démarre jamais en plein écran, et l'hôte émet
 * l'évènement à chaque bascule.
 */
export function useHostFullscreen(): boolean {
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    let annule = false;
    let desabonner: (() => void) | undefined;

    void (async () => {
      try {
        const un = await listen<boolean>("window://fullscreen", (e) => {
          if (!annule) setPleinEcran(e.payload);
        });
        if (annule) un();
        else desabonner = un;
      } catch {
        // Hors coquille de bureau, ou évènement indisponible : la fenêtre n'a
        // alors pas de plein écran que nous pilotions, et `false` est juste.
      }
    })();

    return () => {
      annule = true;
      desabonner?.();
    };
  }, []);

  return pleinEcran;
}
