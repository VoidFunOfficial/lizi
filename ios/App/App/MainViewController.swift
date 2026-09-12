import Capacitor

final class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(JwImportPlugin())
        bridge?.registerPluginInstance(HeadingPlugin())
    }
}
