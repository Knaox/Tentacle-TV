import ExpoModulesCore

/// Le module Expo « OctaveAudio » : la porte du pont audio (`../README.md`). Une commande, ses arguments en
/// JSON ; un évènement, `onBridgeEvent`. Tout le travail se fait sur la file du moteur.
public class OctaveAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OctaveAudio")

    Events("onBridgeEvent")

    // Ce build lit un flux DIRECT (`open: "direct"`, repli `fallbackUrl`) : la page peut l'adopter.
    Constants(["directStreams": true])

    OnCreate {
      OctaveAudioEngine.shared.emit = { [weak self] json in
        self?.sendEvent("onBridgeEvent", ["json": json])
      }
    }

    AsyncFunction("invoke") { (command: String, argsJson: String, promise: Promise) in
      let engine = OctaveAudioEngine.shared
      engine.queue.async {
        let result = engine.handle(command, BridgeJson.parse(argsJson))
        promise.resolve(result.map { BridgeJson.string($0) } ?? "")
      }
    }
  }
}
