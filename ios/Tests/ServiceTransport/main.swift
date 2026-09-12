import Foundation
import CommonCrypto

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}

func exchange(_ request: URLRequest, cancel: Bool = false) -> Result<JwHTTPResponse, Error> {
    let transport = JwHTTPTransport()
    var result: Result<JwHTTPResponse, Error>?
    transport.start(request) { result = $0 }
    if cancel { transport.cancel() }
    let deadline = Date().addingTimeInterval(30)
    while result == nil && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
    expect(result != nil, "transport timed out without completing")
    return result!
}

let login = "https://ids.njust.edu.cn/authserver/login?service=https%3A%2F%2Fehall2.njust.edu.cn%2Flogin"
for url in [login, "https://ids.njust.edu.cn/authserver/getCaptcha.htl?t=1", "http://bkjw.njust.edu.cn/njlgdx/xskb/xskb_print.do?xnxq01id=2026-2027-1"] {
    _ = try JwRequestPolicy.request(url: url, method: "GET", body: "", cookie: "")
}
for url in [
    "https://example.com/authserver/login", "http://ids.njust.edu.cn/authserver/login",
    "https://ids.njust.edu.cn:8443/authserver/login", "https://user@ids.njust.edu.cn/authserver/login",
    "https://ids.njust.edu.cn/authserver/login#fragment", "https://ids.njust.edu.cn/authserver/logout",
    "https://ids.njust.edu.cn/authserver/login?service=https%3A%2F%2Fevil.test%2F",
    "https://bkjw.njust.edu.cn/njlgdx/xskb/xskb_print.do?action=delete",
    "https://ids.njust.edu.cn/authserver/%6cogin"
] {
    do { _ = try JwRequestPolicy.request(url: url, method: "GET", body: "", cookie: ""); fatalError("unsafe URL accepted") }
    catch JwTransportError.invalidRequest {} catch { fatalError("unexpected error") }
}
for (method, body, cookie) in [("DELETE", "", ""), ("GET", "data", ""), ("GET", "", "abc\r\nX-Test: 1"), ("POST", String(repeating: "x", count: 8193), "")] {
    do { _ = try JwRequestPolicy.request(url: login, method: method, body: body, cookie: cookie); fatalError("invalid request accepted") }
    catch JwTransportError.invalidRequest {} catch { fatalError("unexpected error") }
}
let cookies = JwRequestPolicy.cookies("SID=a; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT, SID=b; Path=/authserver; HttpOnly, TOKEN=c; Secure")
expect(cookies.count == 3 && cookies[0].contains("Wed, 21"), "Set-Cookie boundaries must preserve Expires and same-name paths")
print("PASS destination policy, request bounds and cookie header parsing")

let testPassword = "test-中文-password"
for size in [16, 24, 32] {
    let salt = String(repeating: "s", count: size)
    // Test all AES key lengths; keys below are fixture-only values.
    let key = Data(salt.utf8)
    let encrypted = try JwPasswordCipher.encrypt(password: testPassword, salt: salt)
    let bytes = Data(base64Encoded: encrypted)!
    var clear = Data(count: bytes.count + kCCBlockSizeAES128)
    let capacity = clear.count
    var written = 0
    let iv = [UInt8](repeating: 0, count: 16)
    let status = key.withUnsafeBytes { k in iv.withUnsafeBytes { v in bytes.withUnsafeBytes { b in clear.withUnsafeMutableBytes { c in
        CCCrypt(CCOperation(kCCDecrypt), CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding), k.baseAddress,
                key.count, v.baseAddress, b.baseAddress, bytes.count, c.baseAddress, capacity, &written)
    } } } }
    expect(status == kCCSuccess, "native AES ciphertext must decrypt")
    expect(String(data: clear.prefix(written).dropFirst(64), encoding: .utf8) == testPassword, "school prefix-discard decryption must recover Unicode password")
}
print("PASS native AES-CBC school password encryption")

if CommandLine.arguments.contains("--live") {
    let page = try exchange(JwRequestPolicy.request(url: login, method: "GET", body: "", cookie: "")).get()
    expect(page.status == 200, "live login must return 200")
    expect(String(data: page.data, encoding: .utf8)?.contains("pwdFromId") == true, "official password form missing")
    let cookie = page.cookies.map { $0.components(separatedBy: ";")[0] }.joined(separator: "; ")
    let captcha = try exchange(JwRequestPolicy.request(url: "https://ids.njust.edu.cn/authserver/getCaptcha.htl", method: "GET", body: "", cookie: cookie)).get()
    expect(captcha.status == 200 && captcha.contentType.hasPrefix("image/") && !captcha.data.isEmpty, "live captcha response invalid")
    print("PASS live Apple URLSession: official login form + captcha (\(captcha.contentType), \(captcha.data.count) bytes); no account login attempted")
    exit(0)
}

let base = CommandLine.arguments[1]
func local(_ path: String) -> URLRequest {
    var request = URLRequest(url: URL(string: base + path)!)
    request.httpShouldHandleCookies = false
    return request
}
let redirected = try exchange(local("/redirect")).get()
expect(redirected.status == 302 && redirected.location == base + "/must-not-follow", "redirect must be returned to JS without following")
let first = try exchange(local("/set-cookie")).get()
expect(first.cookies.count == 2, "separate Set-Cookie headers must survive")
let noCookies = try exchange(local("/echo-cookie")).get()
expect(String(data: noCookies.data, encoding: .utf8) == "", "native cookie storage must remain isolated")
var explicit = local("/echo-cookie")
explicit.setValue("SID=explicit", forHTTPHeaderField: "Cookie")
let explicitResponse = try exchange(explicit).get()
expect(String(data: explicitResponse.data, encoding: .utf8) == "SID=explicit", "JS cookie must reach request")
for path in ["/large-length", "/large-chunked"] {
    switch exchange(local(path)) {
    case .failure(JwTransportError.responseTooLarge): break
    case .failure(let error): fatalError("oversized response \(path) returned \(error)")
    case .success: fatalError("oversized response must be rejected: \(path)")
    }
}
switch exchange(local("/cancel"), cancel: true) {
case .failure(let error): expect((error as? URLError)?.code == .cancelled, "cancel must resolve with cancelled error")
case .success: fatalError("cancelled request succeeded")
}
print("PASS real HTTP: manual redirects, isolated/explicit cookies, declared and streamed size limits, cancellation")
