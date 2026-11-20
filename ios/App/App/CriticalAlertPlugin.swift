import Foundation
import Capacitor
import UserNotifications

/// Anchor alarms that get through the ringer switch, Do Not Disturb and Focus.
///
/// Critical Alerts need the `com.apple.developer.usernotifications.critical-alerts`
/// entitlement, which Apple grants on request. Until it's granted (or if the
/// user turns Critical Alerts off) alarms go out as Time Sensitive, which breaks
/// through Focus but not the silent switch, and still play the klaxon.
@objc(CriticalAlertPlugin)
public class CriticalAlertPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CriticalAlertPlugin"
    public let jsName = "CriticalAlert"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private static let soundFile = "anchor_alarm.wav"
    private static let prefix = "anchormate-alarm-"

    private func describe(_ settings: UNNotificationSettings) -> [String: Any] {
        return [
            "granted": settings.authorizationStatus == .authorized
                || settings.authorizationStatus == .provisional,
            "critical": settings.criticalAlertSetting == .enabled,
            "timeSensitive": settings.timeSensitiveSetting == .enabled
        ]
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        // .criticalAlert is silently ignored by iOS until the entitlement is granted.
        center.requestAuthorization(options: [.alert, .sound, .badge, .criticalAlert]) { _, _ in
            center.getNotificationSettings { settings in
                call.resolve(self.describe(settings))
            }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            call.resolve(self.describe(settings))
        }
    }

    @objc func notify(_ call: CAPPluginCall) {
        let id = call.getInt("id") ?? 1
        let title = call.getString("title") ?? "Anchor Mate"
        let body = call.getString("body") ?? ""
        let center = UNUserNotificationCenter.current()

        center.getNotificationSettings { settings in
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            let name = UNNotificationSoundName(CriticalAlertPlugin.soundFile)
            if settings.criticalAlertSetting == .enabled {
                content.sound = UNNotificationSound.criticalSoundNamed(name, withAudioVolume: 1.0)
                content.interruptionLevel = .critical
            } else {
                content.sound = UNNotificationSound(named: name)
                content.interruptionLevel = .timeSensitive
            }
            let request = UNNotificationRequest(
                identifier: CriticalAlertPlugin.prefix + String(id),
                content: content,
                trigger: nil
            )
            center.add(request) { error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["critical": settings.criticalAlertSetting == .enabled])
                }
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let ids = (call.getArray("ids", Int.self) ?? []).map { CriticalAlertPlugin.prefix + String($0) }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
        call.resolve()
    }
}
