import CommonCrypto
import Foundation
import Security

enum JwPasswordCipher {
    // Matches ids.njust.edu.cn's AES-CBC password form, including the random
    // 64-byte prefix discarded by the server. No secrets are persisted or logged.
    static func encrypt(password: String, salt: String) throws -> String {
        let key = Data(salt.utf8)
        guard !password.isEmpty, password.utf16.count <= 32, [16, 24, 32].contains(key.count) else {
            throw JwTransportError.invalidRequest
        }
        let alphabet = Array("ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678".utf8)
        var random = [UInt8](repeating: 0, count: 80)
        guard SecRandomCopyBytes(kSecRandomDefault, random.count, &random) == errSecSuccess else {
            throw JwTransportError.invalidRequest
        }
        let prefix = random.prefix(64).map { alphabet[Int($0) % alphabet.count] }
        let iv = random.suffix(16).map { alphabet[Int($0) % alphabet.count] }
        let input = Data(prefix) + Data(password.utf8)
        var output = Data(count: input.count + kCCBlockSizeAES128)
        let capacity = output.count
        var written = 0
        let status = key.withUnsafeBytes { keyBytes in
            iv.withUnsafeBytes { ivBytes in
                input.withUnsafeBytes { inputBytes in
                    output.withUnsafeMutableBytes { outputBytes in
                        CCCrypt(CCOperation(kCCEncrypt), CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding),
                                keyBytes.baseAddress, key.count, ivBytes.baseAddress, inputBytes.baseAddress, input.count,
                                outputBytes.baseAddress, capacity, &written)
                    }
                }
            }
        }
        guard status == kCCSuccess else { throw JwTransportError.invalidRequest }
        output.count = written
        return output.base64EncodedString()
    }
}
