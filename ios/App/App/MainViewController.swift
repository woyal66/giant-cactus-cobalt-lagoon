import UIKit
import Capacitor

/// The app's web view controller. Registers plugins that live in this app
/// target rather than in an npm package.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CriticalAlertPlugin())
    }
}
