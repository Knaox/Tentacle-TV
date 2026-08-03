/**
 * hls.js, évincé.
 *
 * Sur un téléviseur, le décodage passe par la puce de la dalle : elle lit le
 * HLS nativement, en HEVC comme en Dolby Vision, là où un démultiplexeur en
 * JavaScript ferait transiter chaque segment par le processeur.
 *
 * Le remplacement ne demande aucune condition dans le lecteur. `useVideoSource`
 * teste `Hls.isSupported()` avant d'instancier quoi que ce soit ; en répondant
 * faux, on tombe dans la branche qui pose `video.src = url` — exactement ce
 * qu'il faut. Le vrai paquet, lui, disparaît du bundle.
 *
 * Les objets d'événements et d'erreurs sont conservés vides : ils sont
 * déréférencés à la construction des gestionnaires, avant même que la branche
 * hls.js soit choisie.
 */

const Hls = {
  isSupported(): boolean {
    return false;
  },
  Events: {} as Record<string, string>,
  ErrorTypes: {} as Record<string, string>,
  ErrorDetails: {} as Record<string, string>,
};

export type HlsConfig = Record<string, unknown>;

export default Hls;
