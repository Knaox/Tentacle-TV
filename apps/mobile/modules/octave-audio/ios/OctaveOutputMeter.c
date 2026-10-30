// Octave (iOS) — le NIVEAU du son qui sort des platines mpv, pour la vague du lecteur plein écran.
//
// Le mpv embarqué (MPVKit) n'a pas de filtre de mesure (`astats`) ; on mesure donc à la SORTIE : sa sortie
// `ao_audiounit` crée une AudioUnit RemoteIO et la démarre par `AudioOutputUnitStart`. MPVKit est une archive
// STATIQUE liée dans l'exécutable : la définition ci-dessous de `AudioOutputUnitStart` (et de
// `AudioComponentInstanceDispose`) y prend la place de celle d'AudioToolbox pour les appels de l'exécutable —
// elle pose une notification de rendu (`AudioUnitAddRenderNotify`, API publique), puis passe la main à la vraie
// fonction, retrouvée par `dlsym(RTLD_NEXT)`. Aucune API privée, aucun échantillon modifié.
//
// La notification tourne sur le fil temps réel du son : aucune allocation, aucun verrou — un anneau d'atomiques
// (heure de sortie du tampon, niveau). Elle ne calcule rien tant que personne ne lit le niveau (`armed_until`).

#include "OctaveOutputMeter.h"
#include <AudioToolbox/AudioToolbox.h>
#include <dlfcn.h>
#include <math.h>
#include <mach/mach_time.h>
#include <stdatomic.h>
#include <stdint.h>

#define RING 64
#define SLOTS 8
#define SILENCE_DB (-120.0)
/// Au-delà de cet écart entre l'instant visé et la mesure la plus proche, la mesure ne dit plus le son présent.
#define STALE_SECONDS 0.4
/// Une lecture arme le compteur pour ce temps.
#define ARM_SECONDS 2.0

enum SampleKind { KIND_NONE = 0, KIND_FLOAT32 = 1, KIND_INT16 = 2, KIND_INT32 = 3 };

/// Une unité de sortie suivie : son adresse et la forme de ses échantillons.
static _Atomic(uintptr_t) slot_unit[SLOTS];
static _Atomic(int) slot_kind[SLOTS];

static _Atomic(uint64_t) ring_time[RING];
static _Atomic(double) ring_db[RING];
static _Atomic(uint32_t) ring_next;
static _Atomic(uint64_t) armed_until;

static double ticks_per_second(void) {
  static double value = 0;
  if (value == 0) {
    mach_timebase_info_data_t info;
    mach_timebase_info(&info);
    value = 1e9 * (double)info.denom / (double)info.numer;
  }
  return value;
}

static double rms_of(const AudioBufferList *io, int kind) {
  double sum = 0;
  uint64_t count = 0;
  for (UInt32 b = 0; b < io->mNumberBuffers; b++) {
    const AudioBuffer *buffer = &io->mBuffers[b];
    if (buffer->mData == NULL) continue;
    if (kind == KIND_FLOAT32) {
      const float *s = buffer->mData;
      UInt32 n = buffer->mDataByteSize / sizeof(float);
      for (UInt32 i = 0; i < n; i += 2) { sum += (double)s[i] * s[i]; count++; }
    } else if (kind == KIND_INT16) {
      const int16_t *s = buffer->mData;
      UInt32 n = buffer->mDataByteSize / sizeof(int16_t);
      for (UInt32 i = 0; i < n; i += 2) { double v = s[i] / 32768.0; sum += v * v; count++; }
    } else if (kind == KIND_INT32) {
      const int32_t *s = buffer->mData;
      UInt32 n = buffer->mDataByteSize / sizeof(int32_t);
      for (UInt32 i = 0; i < n; i += 2) { double v = s[i] / 2147483648.0; sum += v * v; count++; }
    }
  }
  return count == 0 ? -1 : sqrt(sum / (double)count);
}

static OSStatus on_render(void *ref, AudioUnitRenderActionFlags *flags, const AudioTimeStamp *stamp, UInt32 bus, UInt32 frames, AudioBufferList *io) {
  (void)bus; (void)frames;
  if (!(*flags & kAudioUnitRenderAction_PostRender) || io == NULL) return noErr;
  uint64_t now = mach_absolute_time();
  if (now > atomic_load_explicit(&armed_until, memory_order_relaxed)) return noErr;
  int kind = atomic_load_explicit(&slot_kind[(uintptr_t)ref % SLOTS], memory_order_relaxed);
  double rms = rms_of(io, kind);
  if (rms < 0) return noErr;
  double db = rms <= 1e-6 ? SILENCE_DB : fmax(SILENCE_DB, fmin(0.0, 20.0 * log10(rms)));
  // L'heure où ce tampon sort de l'appareil (sinon maintenant) : c'est elle que la lecture vise.
  uint64_t at = (stamp && (stamp->mFlags & kAudioTimeStampHostTimeValid)) ? stamp->mHostTime : now;
  uint32_t index = atomic_fetch_add_explicit(&ring_next, 1, memory_order_relaxed) % RING;
  atomic_store_explicit(&ring_db[index], db, memory_order_relaxed);
  atomic_store_explicit(&ring_time[index], at, memory_order_release);
  return noErr;
}

static int kind_of(AudioUnit unit) {
  AudioStreamBasicDescription format;
  UInt32 size = sizeof(format);
  if (AudioUnitGetProperty(unit, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 0, &format, &size) != noErr) return KIND_NONE;
  if (format.mFormatID != kAudioFormatLinearPCM) return KIND_NONE;
  if (format.mFormatFlags & kAudioFormatFlagIsFloat) return format.mBitsPerChannel == 32 ? KIND_FLOAT32 : KIND_NONE;
  if (format.mBitsPerChannel == 16) return KIND_INT16;
  if (format.mBitsPerChannel == 32) return KIND_INT32;
  return KIND_NONE;
}

/// La place d'une unité dans la table (la sienne si elle y est, sinon une libre), ou -1.
static int slot_for(uintptr_t unit, int *known) {
  int free_slot = -1;
  for (int i = 0; i < SLOTS; i++) {
    uintptr_t held = atomic_load(&slot_unit[i]);
    if (held == unit) { *known = 1; return i; }
    if (held == 0 && free_slot < 0) free_slot = i;
  }
  *known = 0;
  return free_slot;
}

OSStatus AudioOutputUnitStart(AudioUnit unit) {
  static OSStatus (*real)(AudioUnit) = NULL;
  if (real == NULL) real = (OSStatus (*)(AudioUnit))dlsym(RTLD_NEXT, "AudioOutputUnitStart");
  if (unit != NULL) {
    int known = 0;
    int slot = slot_for((uintptr_t)unit, &known);
    if (slot >= 0) {
      // La forme des échantillons se relit à chaque départ (mpv la pose avant).
      atomic_store(&slot_kind[slot], kind_of(unit));
      if (!known && AudioUnitAddRenderNotify(unit, on_render, (void *)(uintptr_t)slot) == noErr) {
        atomic_store(&slot_unit[slot], (uintptr_t)unit);
      }
    }
  }
  return real ? real(unit) : kAudioUnitErr_Uninitialized;
}

OSStatus AudioComponentInstanceDispose(AudioComponentInstance instance) {
  static OSStatus (*real)(AudioComponentInstance) = NULL;
  if (real == NULL) real = (OSStatus (*)(AudioComponentInstance))dlsym(RTLD_NEXT, "AudioComponentInstanceDispose");
  // Une unité détruite libère sa place : une autre peut naître à la même adresse.
  for (int i = 0; i < SLOTS; i++) {
    uintptr_t expected = (uintptr_t)instance;
    if (atomic_compare_exchange_strong(&slot_unit[i], &expected, 0)) atomic_store(&slot_kind[i], KIND_NONE);
  }
  return real ? real(instance) : kAudioUnitErr_Uninitialized;
}

double octave_output_level_db(double latencySeconds) {
  double tps = ticks_per_second();
  uint64_t now = mach_absolute_time();
  atomic_store_explicit(&armed_until, now + (uint64_t)(ARM_SECONDS * tps), memory_order_relaxed);
  double latency = latencySeconds > 0 && latencySeconds < 2 ? latencySeconds : 0;
  double target = (double)now - latency * tps;
  // La mesure la plus proche de l'instant visé ; deux platines (fondu) à 20 ms près : la plus forte, ce qu'on entend.
  double gaps[RING];
  double nearest = INFINITY;
  for (int i = 0; i < RING; i++) {
    uint64_t at = atomic_load_explicit(&ring_time[i], memory_order_acquire);
    gaps[i] = at == 0 ? INFINITY : fabs((double)at - target);
    nearest = fmin(nearest, gaps[i]);
  }
  if (nearest > STALE_SECONDS * tps) return NAN;
  double best = NAN;
  for (int i = 0; i < RING; i++) {
    if (gaps[i] > nearest + 0.02 * tps) continue;
    double db = atomic_load_explicit(&ring_db[i], memory_order_relaxed);
    if (isnan(best) || db > best) best = db;
  }
  return best;
}
