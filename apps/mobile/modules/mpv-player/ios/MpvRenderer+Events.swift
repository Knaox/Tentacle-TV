// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV :
// sélection initiale par ff-index, erreurs de chargement remontées, tampon unifié.
import Foundation
import MPVKit

/// La boucle d'événements libmpv, sur la file mpv.
extension MpvRenderer {
  func processEvents() {
    queue.async { [weak self] in
      guard let self else { return }
      while self.mpv != nil && !self.isStopping {
        guard let handle = self.mpv, let eventPointer = mpv_wait_event(handle, 0) else { return }
        let event = eventPointer.pointee
        if event.event_id == MPV_EVENT_NONE { break }
        self.handleEvent(event, handle)
        if event.event_id == MPV_EVENT_SHUTDOWN { break }
      }
    }
  }

  private func handleEvent(_ event: mpv_event, _ handle: OpaquePointer) {
    switch event.event_id {
    case MPV_EVENT_FILE_LOADED:
      handleFileLoaded(handle)

    case MPV_EVENT_SEEK:
      isSeeking = true
      setLoading(true)

    case MPV_EVENT_PLAYBACK_RESTART:
      isSeeking = false
      setLoading(false)

    case MPV_EVENT_END_FILE:
      handleEndFile(event)

    case MPV_EVENT_PROPERTY_CHANGE:
      if let property = event.data?.assumingMemoryBound(to: mpv_event_property.self).pointee.name {
        refreshProperty(named: String(cString: property), handle)
      }

    case MPV_EVENT_SHUTDOWN:
      MpvLogger.shared.log("mpv arrêté", type: "Warn")

    case MPV_EVENT_LOG_MESSAGE:
      handleLogMessage(event)

    default:
      break
    }
  }

  /// Le fichier est ouvert, ses pistes énumérées : ajouter les sous-titres
  /// externes, appliquer la sélection demandée (par `ff-index`, résolu ici en
  /// identifiant mpv — posé avant `loadfile`, `sid`/`aid` ne tiennent pas pour
  /// les pistes intégrées), puis annoncer le chargement avec la liste complète.
  private func handleFileLoaded(_ handle: OpaquePointer) {
    let config = pendingConfig
    var externalSelected = false
    for external in config?.externalSubtitles ?? [] {
      // Synchrone : l'ordre d'ajout est l'ordre des pistes.
      commandSync(handle, ["sub-add", external.url, external.select ? "select" : "auto"])
      if external.select { externalSelected = true }
    }
    if let ffIndex = config?.initialAudioFfIndex, let id = trackId(handle, forFfIndex: ffIndex, type: "audio") {
      setPropertyNow(handle, "aid", String(id))
    }
    if externalSelected {
      applyBidiModeNow(handle, forTrack: Int(getInt64(handle, "sid") ?? -1))
    } else if let ffIndex = config?.initialSubtitleFfIndex,
              let id = trackId(handle, forFfIndex: ffIndex, type: "sub") {
      setPropertyNow(handle, "sid", String(id))
      applyBidiModeNow(handle, forTrack: id)
    } else {
      setPropertyNow(handle, "sid", "no")
    }
    fileLoaded = true
    isSeeking = false
    setLoading(false)
    let info = loadInfo(handle)
    notify { renderer, delegate in delegate.renderer(renderer, didLoad: info) }
  }

  /// Seule une vraie fin de fichier vaut « terminé » ; `stop`/`quit` arrivent
  /// au démontage et au remplacement de source. Une erreur de lecture remonte
  /// en `didFailWithError` : c'est elle qui déclenche le repli côté JS.
  private func handleEndFile(_ event: mpv_event) {
    guard let data = event.data else { return }
    let endFile = data.assumingMemoryBound(to: mpv_event_end_file.self).pointee
    if endFile.reason == MPV_END_FILE_REASON_EOF {
      notify { renderer, delegate in delegate.rendererDidReachEnd(renderer) }
    } else if endFile.reason == MPV_END_FILE_REASON_ERROR {
      let message = String(cString: mpv_error_string(endFile.error))
      fileLoaded = false
      setLoading(false)
      MpvLogger.shared.log("échec de lecture : \(message)", type: "Error")
      notify { renderer, delegate in delegate.renderer(renderer, didFailWithError: message) }
    }
  }

  /// Le journal mpv, trié sur SON niveau (les échecs CoreAudio ne contiennent
  /// ni « error » ni « warn ») : erreurs et avertissements gardés, « info »
  /// seulement pour les résumés AO/VO, le verbeux imprimé en debug.
  private func handleLogMessage(_ event: mpv_event) {
    guard let pointer = event.data?.assumingMemoryBound(to: mpv_event_log_message.self) else { return }
    let component = String(cString: pointer.pointee.prefix)
    let text = String(cString: pointer.pointee.text).trimmingCharacters(in: .whitespacesAndNewlines)
    let level = pointer.pointee.log_level.rawValue
    if level <= MPV_LOG_LEVEL_ERROR.rawValue {
      MpvLogger.shared.log("mpv[\(component)] \(text)", type: "Error")
    } else if level <= MPV_LOG_LEVEL_WARN.rawValue {
      MpvLogger.shared.log("mpv[\(component)] \(text)", type: "Warn")
    } else if Self.isDiagnosticInfoLine(component: component, text: text) {
      MpvLogger.shared.log("mpv[\(component)] \(text)", type: "Info")
    } else {
      #if DEBUG
      print("[mpv][\(component)] \(text)")
      #endif
    }
  }

  private func refreshProperty(named name: String, _ handle: OpaquePointer) {
    switch name {
    case "duration":
      if let value = getDouble(handle, name) {
        cachedDuration = value
        notifyPosition()
      }

    case "time-pos":
      if let value = getDouble(handle, name) {
        cachedPosition = value
        // Chaque image traverse le pont JS sinon : une remontée toutes les
        // 500 ms suffit à la barre de progression ; immédiate pendant un saut.
        let now = CFAbsoluteTimeGetCurrent()
        if isSeeking || now - lastProgressUpdateTime >= 0.5 {
          lastProgressUpdateTime = now
          notifyPosition()
        }
      }

    case "demuxer-cache-duration":
      if let value = getDouble(handle, name) { cachedCacheSeconds = value }

    case "pause":
      if let paused = getFlag(handle, name), paused != isPaused {
        isPaused = paused
        notify { renderer, delegate in delegate.renderer(renderer, didChangePause: paused) }
      }

    case "paused-for-cache":
      if let flag = getFlag(handle, name) {
        pausedForCache = flag
        reportBuffering()
      }

    case "track-list/count":
      // Pendant le chargement, la liste se remplit piste par piste : on ne
      // remonte que les changements postérieurs (sous-titre ajouté, etc.).
      guard fileLoaded else { return }
      let tracks = trackList(handle)
      notify { renderer, delegate in delegate.renderer(renderer, didUpdateTracks: tracks) }

    case "current-ao":
      if let audioOutput = getStringProperty(handle, name) {
        notify { renderer, delegate in delegate.renderer(renderer, didSelectAudioOutput: audioOutput) }
      }

    case "video-params/gamma":
      // Les paramètres vidéo n'existent qu'après la première image décodée :
      // c'est ici que la plage dynamique réelle se connaît.
      guard fileLoaded, getStringProperty(handle, name) != nil else { return }
      let params = videoParams(handle)
      notify { renderer, delegate in delegate.renderer(renderer, didUpdateVideoParams: params) }

    default:
      break
    }
  }

  private func notifyPosition() {
    let position = cachedPosition
    let duration = cachedDuration
    let cacheSeconds = cachedCacheSeconds
    notify { renderer, delegate in
      delegate.renderer(renderer, didUpdatePosition: position, duration: duration, cacheSeconds: cacheSeconds)
    }
  }

  func setLoading(_ loading: Bool) {
    isLoading = loading
    reportBuffering()
  }

  /// Un seul état de tampon pour JS : chargement, saut ou cache à sec.
  func reportBuffering() {
    let buffering = isLoading || pausedForCache
    guard buffering != lastBufferingReported else { return }
    lastBufferingReported = buffering
    notify { renderer, delegate in delegate.renderer(renderer, didChangeBuffering: buffering) }
  }
}
