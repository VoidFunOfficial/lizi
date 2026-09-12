import Capacitor
import CoreLocation
import UIKit

@objc(HeadingPlugin)
public class HeadingPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "HeadingPlugin"
    public let jsName = "Heading"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLocation", returnType: CAPPluginReturnPromise)
    ]
    private var manager: CLLocationManager?
    private var requested = false
    private var listening = false
    private var lastEmission: TimeInterval = 0
    private var heartbeat: Timer?
    private var latest: [String: Any]?
    private var observers: [NSObjectProtocol] = []

    public override func load() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let center = NotificationCenter.default
            self.observers = [
                center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                    self?.end()
                    self?.notifyListeners("heading", data: ["status": "paused"])
                },
                center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                    if self?.requested == true { self?.begin() }
                }
            ]
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard CLLocationManager.headingAvailable() else {
                call.reject("这台设备不支持指南针。", "UNAVAILABLE")
                return
            }
            requested = true
            if UIApplication.shared.applicationState == .active { begin() }
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            requested = false
            end()
            call.resolve()
        }
    }

    // Core Location computes declination itself. This method matches Android's
    // bridge API; true-north location updates begin only after GPS permission.
    @objc func setLocation(_ call: CAPPluginCall) {
        guard let latitude = call.getDouble("latitude"), let longitude = call.getDouble("longitude"),
              latitude.isFinite, longitude.isFinite, abs(latitude) <= 90, abs(longitude) <= 180 else {
            call.reject("无效的位置")
            return
        }
        DispatchQueue.main.async { [self] in
            updateLocationAuthorization()
            call.resolve()
        }
    }

    private func begin() {
        guard !listening else { return }
        if manager == nil {
            manager = CLLocationManager()
            manager?.delegate = self
            manager?.headingFilter = kCLHeadingFilterNone
            manager?.desiredAccuracy = kCLLocationAccuracyHundredMeters
            manager?.distanceFilter = 100
        }
        listening = true
        latest = nil
        lastEmission = 0
        updateOrientation()
        manager?.startUpdatingHeading()
        updateLocationAuthorization()
        notifyListeners("heading", data: ["status": "initializing"])
        // A stationary compass need not emit new readings. Keep JS's watchdog
        // alive with the last valid reading, retaining its original timestamp.
        heartbeat = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self, self.listening else { return }
            self.updateOrientation()
            if let latest = self.latest { self.notifyListeners("heading", data: latest) }
        }
    }

    private func end() {
        heartbeat?.invalidate()
        heartbeat = nil
        manager?.stopUpdatingHeading()
        manager?.stopUpdatingLocation()
        listening = false
        latest = nil
    }

    private func updateOrientation() {
        switch bridge?.viewController?.view.window?.windowScene?.interfaceOrientation {
        // Interface rotation is the inverse of the physical device rotation.
        case .landscapeLeft: manager?.headingOrientation = .landscapeRight
        case .landscapeRight: manager?.headingOrientation = .landscapeLeft
        case .portraitUpsideDown: manager?.headingOrientation = .portraitUpsideDown
        default: manager?.headingOrientation = .portrait
        }
    }

    private func updateLocationAuthorization() {
        guard listening, let manager else { return }
        if [.authorizedAlways, .authorizedWhenInUse].contains(manager.authorizationStatus) {
            manager.startUpdatingLocation()
        } else { manager.stopUpdatingLocation() }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { updateLocationAuthorization() }

    public func locationManager(_ manager: CLLocationManager, didUpdateHeading heading: CLHeading) {
        guard listening else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastEmission >= 0.1 else { return }
        lastEmission = now
        guard heading.headingAccuracy >= 0, heading.magneticHeading.isFinite else {
            latest = ["status": "unreliable"]
            notifyListeners("heading", data: latest!)
            return
        }
        var reading: [String: Any] = [
            "status": heading.headingAccuracy > 20 ? "low" : "ready",
            "magneticHeading": heading.magneticHeading,
            "timestamp": heading.timestamp.timeIntervalSince1970 * 1000
        ]
        if heading.trueHeading >= 0, heading.trueHeading.isFinite { reading["trueHeading"] = heading.trueHeading }
        latest = reading
        notifyListeners("heading", data: reading)
    }

    public func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { requested }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard listening, (error as? CLError)?.code == .headingFailure else { return }
        latest = ["status": "unreliable"]
        notifyListeners("heading", data: latest!)
    }

    deinit {
        heartbeat?.invalidate()
        manager?.stopUpdatingHeading()
        manager?.stopUpdatingLocation()
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
    }
}
