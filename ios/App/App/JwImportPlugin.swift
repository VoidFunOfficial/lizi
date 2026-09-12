import Capacitor
import Foundation

@objc(JwImportPlugin)
public class JwImportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "JwImportPlugin"
    public let jsName = "JwImport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "encryptPassword", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    private var requests: [String: JwHTTPTransport] = [:]

    @objc func encryptPassword(_ call: CAPPluginCall) {
        do {
            let encrypted = try JwPasswordCipher.encrypt(password: call.getString("password") ?? "", salt: call.getString("salt") ?? "")
            call.resolve(["encrypted": encrypted])
        } catch { call.reject("登录参数无效，请刷新验证码后重试。", "INVALID_REQUEST") }
    }

    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            do {
                guard let raw = call.getString("url"), let method = call.getString("method"),
                      let requestID = call.getString("requestId"), UUID(uuidString: requestID) != nil,
                      requests[requestID] == nil, requests.count < 8 else { throw JwTransportError.invalidRequest }
                let request = try JwRequestPolicy.request(url: raw, method: method,
                    body: call.getString("body") ?? "", cookie: call.getString("cookie") ?? "")
                let transport = JwHTTPTransport()
                requests[requestID] = transport
                transport.start(request) { [weak self] result in
                    self?.requests.removeValue(forKey: requestID)
                    switch result {
                    case .success(let response):
                        call.resolve(["status": response.status, "contentType": response.contentType,
                            "location": response.location, "cookies": response.cookies,
                            "data": response.data.base64EncodedString()])
                    case .failure(let error):
                        if (error as? URLError)?.code == .cancelled {
                            call.reject("请求已取消。", "CANCELLED")
                        } else if case JwTransportError.responseTooLarge = error {
                            call.reject("教务响应超过 5 MB。", "TOO_LARGE")
                        } else {
                            // Never log login bodies, tickets, cookies or credentials.
                            call.reject("暂时无法连接教务系统，请检查校园网或稍后重试。", "NETWORK")
                        }
                    }
                }
            } catch { call.reject("教务请求无效，请重新打开自动导入。", "INVALID_REQUEST") }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            if let id = call.getString("requestId") { requests[id]?.cancel() }
            call.resolve()
        }
    }
}
