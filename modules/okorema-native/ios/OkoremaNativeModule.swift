import ExpoModulesCore
import EventKit

public class OkoremaNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OkoremaNative")

    Function("canScheduleExactAlarms") { () -> Bool in
      true
    }

    Function("openExactAlarmSettings") {
      // iOS has no exact-alarm setting. Time Sensitive is a system notification setting.
    }

    Function("canUseFullScreenIntent") { () -> Bool in
      true
    }

    Function("openFullScreenIntentSettings") {
    }

    Function("syncAlarms") { (_: String) in
      // Escalation notifications on iOS go through UNUserNotificationCenter.
    }

    Function("showCountdown") { (_: String, _: Double) in
    }

    Function("hideCountdown") {
    }

    Function("setWidgetSnapshot") { (_: String) in
    }

    Function("consumePendingActions") { () -> String in
      "[]"
    }

    Function("shareToKeep") { (_: String, _: String) -> Bool in
      false
    }

    AsyncFunction("importDeviceReminders") { (promise: Promise) in
      let store = EKEventStore()
      store.requestFullAccessToReminders { granted, _ in
        guard granted else {
          promise.resolve(["granted": false, "items": []])
          return
        }
        let predicate = store.predicateForReminders(in: nil)
        store.fetchReminders(matching: predicate) { reminders in
          let formatter = ISO8601DateFormatter()
          let items: [[String: Any]] = (reminders ?? []).compactMap { reminder in
            let repeating = !(reminder.recurrenceRules ?? []).isEmpty
            guard let components = reminder.dueDateComponents,
                  let date = Calendar.current.date(from: components),
                  !repeating else {
              return nil
            }
            return [
              "title": reminder.title ?? "",
              "notes": reminder.notes ?? "",
              "dueAt": formatter.string(from: date),
              "listName": reminder.calendar.title,
              "repeating": false,
            ]
          }
          promise.resolve(["granted": true, "items": items])
        }
      }
    }
  }
}
