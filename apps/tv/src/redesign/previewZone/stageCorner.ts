import { createContext } from "react";

/**
 * L'ARRONDI du cadre où la scène pose la vidéo d'aperçu (`PreviewStage`). Sur
 * Apple TV, le cadre arrondi et `overflow: hidden` rognent la couche
 * d'AVPlayer ; sur Android TV, la `TextureView` du lecteur d'aperçu natif
 * leur échappe (coins pointus relevés sur la Shield, 19/10) : elle lit cet
 * arrondi et se rogne elle-même (`PreviewVideoView.setCornerRadius`).
 */
export const StageCornerContext = createContext(0);
