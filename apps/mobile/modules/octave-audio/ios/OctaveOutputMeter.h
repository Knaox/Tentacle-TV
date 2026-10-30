// Octave (iOS) — le NIVEAU du son qui sort des platines mpv (`OctaveOutputMeter.c`), pour la vague du lecteur
// plein écran (`audio_level` du pont).
#ifndef OctaveOutputMeter_h
#define OctaveOutputMeter_h

/// Le niveau RMS (dBFS) du son entendu maintenant — la sortie mesurée il y a `latencySeconds` (la latence de la
/// route : AirPods, AirPlay) —, ou NAN : rien de mesuré (pause, attente, aucune platine). Chaque lecture garde le
/// compteur armé deux secondes : sans lecteur ouvert qui le lit, la mesure ne coûte rien.
double octave_output_level_db(double latencySeconds);

#endif
