import SwiftUI
import WidgetKit

/// L'extension de widget de Tentacle TV : elle ne porte qu'une chose, la Live
/// Activity d'un titre gardé hors ligne pendant qu'il se prépare.
@main
struct TransferLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    TransferLiveActivityWidget()
  }
}
