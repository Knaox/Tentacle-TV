import { useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { backOutcome, createBackLayers, isPushedPage } from "@tentacle-tv/tv-core";
import { BackLayersContext } from "../../shared/back/BackLayersContext";
import type { BackScopeProps } from "../../shared/back/backScopeProps";

/**
 * L'APPLICATEUR du Retour sur Android TV — le pendant de `TvosBackScope` : la
 * MÊME pile de couches (tv-core `nav/backLayers`), les MÊMES issues
 * (`backOutcome` : couche, recul, sortie), au même endroit.
 *
 * Ce qui change, c'est le chemin du signal. Android ne tranche rien d'avance
 * (`ANDROIDTV_BINDINGS.traits.backDecidedAhead` est faux) : la touche Retour
 * arrive au JS par `BackHandler` (`onBackPressed` de l'activité, au
 * relâchement), et la portée décide AU GESTE, sur l'état du moment. Le relevé
 * B3 de tvOS (appui pris d'avance, puis plus personne pour le vouloir : avalé)
 * n'existe donc pas ici — l'issue est relue au relâchement.
 *
 * Chaque écran de la pile reste monté et garde sa portée : seule celle de
 * l'écran DEVANT répond (`navigation.isFocused`), les autres laissent passer.
 * Elle répond TOUJOURS quand elle est devant — `true` à BackHandler — pour que
 * le gestionnaire de React Navigation (qui dépilerait de lui-même, y compris
 * une page du rail) ne voie jamais l'appui : sur Apple TV, Menu ne dépile
 * jamais un écran de lui-même non plus.
 *
 * La sortie (`exit`) : `BackHandler.exitApp()`, le geste par défaut d'Android
 * (`onBackPressed` de l'activité racine) — là où UIKit quitte sur tvOS.
 *
 * Une `Modal` est une fenêtre à part (un `Dialog`) : Retour y va à son
 * `onRequestClose`, sans passer par ici — comme Menu sur tvOS. Elle inscrit
 * quand même sa couche « menu ».
 */
export function AndroidBackScope({ route, navigation, children }: BackScopeProps) {
  const [layers] = useState(createBackLayers);
  const latest = useRef({ route, navigation });
  latest.current = { route, navigation };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const { route: current, navigation: nav } = latest.current;
      if (nav.isFocused && !nav.isFocused()) return false;
      switch (backOutcome({ layered: layers.target() !== null, pushed: isPushedPage(current.name, nav.canGoBack()) })) {
        case "layer":
          layers.back();
          return true;
        case "pop":
          nav.goBack();
          return true;
        case "exit":
          BackHandler.exitApp();
          return true;
      }
    });
    return () => subscription.remove();
  }, [layers]);

  return <BackLayersContext.Provider value={layers}>{children}</BackLayersContext.Provider>;
}
