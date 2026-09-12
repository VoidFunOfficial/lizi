import Foundation

enum JwTransportError: Error {
    case invalidRequest, responseTooLarge, invalidResponse
}

// Keep this policy aligned with lib/student/jw/protocol.ts. Redirects are returned
// to JwSession, which validates every hop and supplies its own in-memory cookies.
enum JwRequestPolicy {
    static let maxResponse = 5 * 1024 * 1024
    static let teachingPaths: Set<String> = [
        "/njlgdx/indexsso.jsp", "/njlgdx/xk/LoginToXk", "/njlgdx/framework/main.jsp",
        "/njlgdx/xskb/xskb_list.do", "/njlgdx/xskb/xskb_print.do"
    ]
    static let services: Set<String> = Set(["https://ehall2.njust.edu.cn/login"])
        .union(["http", "https"].flatMap { scheme in
            ["/njlgdx/indexsso.jsp", "/njlgdx/framework/main.jsp", "/njlgdx/xk/LoginToXk"]
                .map { "\(scheme)://bkjw.njust.edu.cn\($0)" }
        })

    static func request(url raw: String, method: String, body: String, cookie: String) throws -> URLRequest {
        guard raw.utf16.count <= 4096,
              let parts = URLComponents(string: raw), let url = parts.url,
              parts.user == nil, parts.password == nil, parts.fragment == nil,
              ["GET", "POST"].contains(method), body.utf16.count <= 8192,
              cookie.utf16.count <= 8192, cookie.rangeOfCharacter(from: .newlines) == nil,
              method != "GET" || body.isEmpty else { throw JwTransportError.invalidRequest }
        let https = parts.scheme == "https" && (parts.port == nil || parts.port == 443)
        let http = parts.scheme == "http" && (parts.port == nil || parts.port == 80)
        let allowed: Bool
        switch parts.host?.lowercased() {
        case "ids.njust.edu.cn":
            allowed = https && ["/authserver/login", "/authserver/getCaptcha.htl"].contains(parts.percentEncodedPath)
        case "ehall2.njust.edu.cn":
            allowed = https && ["/login", "/", "/index.html", "/new/index.html"].contains(parts.percentEncodedPath)
        case "bkjw.njust.edu.cn":
            allowed = (https || http) && teachingPaths.contains(parts.percentEncodedPath)
        default: allowed = false
        }
        guard allowed, !(parts.percentEncodedQuery ?? "").lowercased().contains(where: { $0 == "\r" || $0 == "\n" }) else {
            throw JwTransportError.invalidRequest
        }
        let query = (parts.percentEncodedQuery ?? "").lowercased()
        guard !["exit", "logout", "delete"].contains(where: query.contains) else { throw JwTransportError.invalidRequest }
        for item in parts.queryItems ?? [] where item.name == "service" {
            guard let value = item.value, services.contains(value) else { throw JwTransportError.invalidRequest }
        }
        if method == "POST" && !["/authserver/login", "/njlgdx/xk/LoginToXk", "/njlgdx/xskb/xskb_list.do", "/njlgdx/xskb/xskb_print.do"].contains(parts.path) {
            throw JwTransportError.invalidRequest
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = method
        request.httpShouldHandleCookies = false
        request.setValue(cookie, forHTTPHeaderField: "Cookie")
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if method == "POST" { request.httpBody = Data(body.utf8) }
        return request
    }

    static func cookies(_ header: String) -> [String] {
        // Foundation may combine Set-Cookie fields. Do not split the comma in Expires.
        header.replacingOccurrences(of: ",(?=\\s*[^\\s;,=]+\\s*=)", with: "\n", options: .regularExpression)
            .components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}

struct JwHTTPResponse {
    let status: Int
    let contentType: String
    let location: String
    let cookies: [String]
    let data: Data
}

// One short-lived, non-persistent URLSession per call. All state lives on main;
// closing the JS login sheet cancels the request and discards buffered content.
final class JwHTTPTransport: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var response: HTTPURLResponse?
    private var data = Data()
    private var completion: ((Result<JwHTTPResponse, Error>) -> Void)?

    func start(_ request: URLRequest, protocolClasses: [AnyClass]? = nil,
               completion: @escaping (Result<JwHTTPResponse, Error>) -> Void) {
        precondition(Thread.isMainThread)
        self.completion = completion
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCache = nil
        config.urlCredentialStorage = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 25
        if let protocolClasses { config.protocolClasses = protocolClasses }
        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
        task = session?.dataTask(with: request)
        task?.resume()
    }

    func cancel() { finish(.failure(URLError(.cancelled))) }

    private func finish(_ result: Result<JwHTTPResponse, Error>) {
        guard let callback = completion else { return }
        completion = nil
        session?.invalidateAndCancel()
        task = nil
        session = nil
        response = nil
        data.removeAll(keepingCapacity: false)
        callback(result)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let http = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            finish(.failure(JwTransportError.invalidResponse))
            return
        }
        guard response.expectedContentLength <= JwRequestPolicy.maxResponse else {
            completionHandler(.cancel)
            finish(.failure(JwTransportError.responseTooLarge))
            return
        }
        self.response = http
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard completion != nil else { return }
        guard self.data.count + data.count <= JwRequestPolicy.maxResponse else {
            finish(.failure(JwTransportError.responseTooLarge))
            return
        }
        self.data.append(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error { finish(.failure(error)); return }
        guard let response else { finish(.failure(JwTransportError.invalidResponse)); return }
        finish(.success(JwHTTPResponse(
            status: response.statusCode,
            contentType: response.value(forHTTPHeaderField: "Content-Type") ?? "",
            location: response.value(forHTTPHeaderField: "Location") ?? "",
            cookies: JwRequestPolicy.cookies(response.value(forHTTPHeaderField: "Set-Cookie") ?? ""),
            data: data
        )))
    }
}
