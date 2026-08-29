import AsyncStorage from "@react-native-async-storage/async-storage";

// La VALEUR de cette clé est gravée sur les appareils déjà installés : elle ne se
// renomme pas, sous peine d'oublier l'encodage laissé par la version d'avant.
const STORAGE_KEY = "tentacle_encodage_en_cours";

export interface EncodingSession {
  playSessionId: string;
  /** URL de base du client au moment de l'ouverture — un changement de serveur
   *  rend l'identifiant caduc, autant ne pas parler dans le vide. */
  baseUrl: string;
}

/**
 * Registre persistant de la DERNIÈRE session d'encodage ouverte par le lecteur.
 *
 * Il existe pour un seul cas, celui qu'aucun code JS ne peut couvrir : une
 * application tuée par le système, balayée depuis le sélecteur d'applications
 * ou qui plante. À cet instant rien ne tourne, aucun démontage n'a lieu, et
 * l'encodage reste vivant côté Jellyfin. La seule occasion suivante de le
 * libérer est le lancement d'après — d'où cette trace sur disque.
 *
 * Le registre n'est volontairement PAS effacé à la sortie propre : au pire on
 * émet au lancement suivant un `DELETE` sans effet sur une session déjà close
 * (204), au mieux on rattrape un arrêt brutal. Une garantie plutôt qu'une
 * course entre deux nettoyages.
 */
export function recordEncodingSession(playSessionId: string, baseUrl: string): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ playSessionId, baseUrl })).catch(() => {});
}

export async function readEncodingSession(): Promise<EncodingSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<EncodingSession>;
    if (!value?.playSessionId || !value.baseUrl) return null;
    return { playSessionId: value.playSessionId, baseUrl: value.baseUrl };
  } catch {
    return null;
  }
}

export function forgetEncodingSession(): void {
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
