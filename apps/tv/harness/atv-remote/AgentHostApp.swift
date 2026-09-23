import SwiftUI

// Hôte minimal : la cible de test UI en exige un, mais l'agent pilote
// l'application Tentacle par son identifiant, jamais cet hôte.
@main
struct AgentHostApp: App {
    var body: some Scene {
        WindowGroup {
            Text("atv-agent")
        }
    }
}
