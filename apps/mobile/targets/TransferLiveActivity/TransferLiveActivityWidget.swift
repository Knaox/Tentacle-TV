import ActivityKit
import SwiftUI
import WidgetKit

/// Le violet → rose de la marque, en touches.
private let violet = Color(red: 0x8B / 255, green: 0x5C / 255, blue: 0xF6 / 255)
private let pink = Color(red: 0xEC / 255, green: 0x48 / 255, blue: 0x99 / 255)
private let ink = Color(red: 0x0D / 255, green: 0x0B / 255, blue: 0x13 / 255)

/// La Live Activity : le titre (ou « 3 titres »), puis SOIT un compte à
/// rebours qui avance seul (`Text(timerInterval:)`, application suspendue
/// comprise), SOIT l'état en toutes lettres — jamais un faux compte à rebours
/// pendant une attente. Les mots viennent du JavaScript, déjà traduits.
struct TransferLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TransferActivityAttributes.self) { context in
      LockScreenView(state: context.state, stale: context.isStale)
        .padding(16)
        .activityBackgroundTint(ink.opacity(0.92))
        .activitySystemActionForegroundColor(.white)
        .widgetURL(URL(string: context.state.deepLink))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "arrow.down.circle.fill").font(.title2).foregroundStyle(violet)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let end = countdownEnd(context.state, stale: context.isStale) {
            Text(timerInterval: Date()...end, countsDown: true)
              .monospacedDigit().font(.headline).frame(maxWidth: 72, alignment: .trailing)
          }
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.state.headline).font(.headline).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            StatusLine(state: context.state, stale: context.isStale)
            Bar(fraction: context.state.fraction)
          }
        }
      } compactLeading: {
        Image(systemName: "arrow.down.circle.fill").foregroundStyle(violet)
      } compactTrailing: {
        if let end = countdownEnd(context.state, stale: context.isStale) {
          Text(timerInterval: Date()...end, countsDown: true)
            .monospacedDigit().frame(maxWidth: 48).font(.caption2)
        } else {
          Image(systemName: waitingSymbol(context.state.phase)).foregroundStyle(pink)
        }
      } minimal: {
        Image(systemName: "arrow.down.circle.fill").foregroundStyle(violet)
      }
      .widgetURL(URL(string: context.state.deepLink))
      .keylineTint(violet)
    }
  }
}

/// Le compte à rebours n'existe qu'en phase `transferring`, avec une fin à venir et une activité fraîche.
func countdownEnd(_ state: TransferActivityAttributes.ContentState, stale: Bool) -> Date? {
  guard state.phase == "transferring", !stale, let end = state.endsAt, end > Date() else { return nil }
  return end
}

func waitingSymbol(_ phase: String) -> String {
  switch phase {
  case "waitingWifi": return "wifi.exclamationmark"
  case "waitingNetwork": return "network.slash"
  case "paused": return "pause.circle.fill"
  default: return "hourglass"
  }
}

private struct LockScreenView: View {
  let state: TransferActivityAttributes.ContentState
  let stale: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text(state.headline).font(.headline).foregroundStyle(.white).lineLimit(1)
        Spacer(minLength: 8)
        if let end = countdownEnd(state, stale: stale) {
          Text(timerInterval: Date()...end, countsDown: true)
            .monospacedDigit().font(.title3.weight(.semibold)).foregroundStyle(.white)
            .multilineTextAlignment(.trailing).frame(maxWidth: 96, alignment: .trailing)
        }
      }
      StatusLine(state: state, stale: stale)
      Bar(fraction: state.fraction)
    }
  }
}

private struct StatusLine: View {
  let state: TransferActivityAttributes.ContentState
  let stale: Bool

  var body: some View {
    if countdownEnd(state, stale: stale) != nil {
      Text(state.readyInLabel).font(.subheadline).foregroundStyle(.white.opacity(0.7))
    } else {
      // Attente, pause, estimation, ou fin estimée dépassée : on DIT, on ne décompte pas.
      Label(state.status, systemImage: waitingSymbol(state.phase))
        .font(.subheadline).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
    }
  }
}

private struct Bar: View {
  let fraction: Double

  var body: some View {
    if fraction >= 0 {
      ProgressView(value: min(1, fraction)).tint(LinearGradient(colors: [violet, pink], startPoint: .leading, endPoint: .trailing))
    } else {
      ProgressView(value: 0).tint(violet).opacity(0.4)
    }
  }
}
