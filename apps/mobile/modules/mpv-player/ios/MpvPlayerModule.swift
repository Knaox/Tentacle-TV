// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MpvPlayerModule.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV :
// props déclaratives, sélection par ff-index, route AirPlay.
import AVFoundation
import CoreMedia
import ExpoModulesCore
import VideoToolbox

/// Le module Expo « MpvPlayer » : quelques fonctions d'appareil et la vue
/// vidéo du lecteur avancé. Le contrat côté JS est `src/MpvPlayer.types.ts`.
public class MpvPlayerModule: Module {
  private var logObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("MpvPlayer")

    Events("onNativeLog")

    // Le journal natif ne traverse le pont que si JS écoute.
    OnStartObserving {
      guard self.logObserver == nil else { return }
      self.logObserver = NotificationCenter.default.addObserver(
        forName: MpvLogger.notificationName, object: nil, queue: nil
      ) { [weak self] note in
        guard let message = note.userInfo?["message"] as? String else { return }
        self?.sendEvent("onNativeLog", ["message": message, "type": note.userInfo?["type"] as? String ?? "Info"])
      }
    }

    OnStopObserving {
      if let observer = self.logObserver {
        NotificationCenter.default.removeObserver(observer)
        self.logObserver = nil
      }
    }

    /// La sortie audio courante est-elle un récepteur AirPlay ? Le routeur
    /// choisit alors le lecteur système avant même de demander PlaybackInfo.
    Function("isAirPlayRouteActive") { () -> Bool in
      MpvEngine.isAirPlayRouteActive()
    }

    /// AV1 matériel : A17 Pro, A18, M3 et plus. Ailleurs, dav1d décode en
    /// logiciel — lisible en 1080p, pas en 4K.
    Function("supportsAv1HardwareDecode") { () -> Bool in
      VTIsHardwareDecodeSupported(kCMVideoCodecType_AV1)
    }

    /// Au simulateur : décodage logiciel et sous-titres non composités.
    Function("isSimulator") { () -> Bool in
      #if targetEnvironment(simulator)
      return true
      #else
      return false
      #endif
    }

    View(MpvPlayerView.self) {
      Events(
        "onLoad", "onProgress", "onBuffering", "onEnd", "onError", "onTracksChanged",
        "onVideoParams", "onPipChanged", "onPlaybackStateChange", "onAirPlayRoute")

      Prop("source") { (view: MpvPlayerView, source: [String: Any]?) in
        guard let source, let config = MpvLoadConfig.parse(source) else { return }
        view.load(config)
      }

      Prop("paused") { (view: MpvPlayerView, paused: Bool) in
        view.setPaused(paused)
      }

      Prop("speed") { (view: MpvPlayerView, speed: Double) in
        view.setSpeed(speed > 0 ? speed : 1.0)
      }

      Prop("nowPlaying") { (view: MpvPlayerView, metadata: [String: Any]?) in
        view.setNowPlaying(metadata)
      }

      Prop("subtitleScale") { (view: MpvPlayerView, scale: Double) in
        view.setSubtitleScale(scale > 0 ? scale : 1.0)
      }

      Prop("subtitlePosition") { (view: MpvPlayerView, position: Int) in
        view.setSubtitlePosition(min(max(position, 0), 150))
      }

      Prop("subtitleDelay") { (view: MpvPlayerView, seconds: Double) in
        view.setSubtitleDelay(seconds)
      }

      Prop("audioDelay") { (view: MpvPlayerView, seconds: Double) in
        view.setAudioDelay(seconds)
      }

      Prop("pipAutoStart") { (view: MpvPlayerView, enabled: Bool) in
        view.setPipAutoStart(enabled)
      }

      AsyncFunction("seekTo") { (view: MpvPlayerView, seconds: Double) in
        view.seek(to: seconds)
      }

      AsyncFunction("getPosition") { (view: MpvPlayerView) -> Double in
        view.getPosition()
      }

      /// Identifiant mpv (négatif = aucune piste). La correspondance avec
      /// l'index Jellyfin se fait côté JS à partir de `ffIndex`.
      AsyncFunction("setAudioTrack") { (view: MpvPlayerView, id: Int) in
        view.setAudioTrack(id)
      }

      AsyncFunction("setSubtitleTrack") { (view: MpvPlayerView, id: Int) in
        view.setSubtitleTrack(id)
      }

      AsyncFunction("addSubtitle") { (view: MpvPlayerView, url: String, select: Bool) in
        view.addSubtitle(url: url, select: select)
      }

      // Les lectures bloquantes de mpv ne tournent jamais sur le thread JS ni
      // le principal : la promesse se résout depuis la file mpv.
      AsyncFunction("getTracks") { (view: MpvPlayerView, promise: Promise) in
        view.getTracks { promise.resolve($0) }
      }

      AsyncFunction("getTechnicalInfo") { (view: MpvPlayerView, promise: Promise) in
        view.getTechnicalInfo { promise.resolve($0) }
      }

      AsyncFunction("startPictureInPicture") { (view: MpvPlayerView) in
        view.startPictureInPicture()
      }

      AsyncFunction("stopPictureInPicture") { (view: MpvPlayerView) in
        view.stopPictureInPicture()
      }

      AsyncFunction("isPictureInPictureSupported") { (view: MpvPlayerView) -> Bool in
        view.isPictureInPictureSupported()
      }

      AsyncFunction("isPictureInPictureActive") { (view: MpvPlayerView) -> Bool in
        view.isPictureInPictureActive()
      }

      /// Détruit l'instance mpv (décodeur, cache) avant de quitter l'écran.
      AsyncFunction("stop") { (view: MpvPlayerView) in
        view.stop()
      }
    }
  }
}
