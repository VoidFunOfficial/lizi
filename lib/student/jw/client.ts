import { Capacitor, registerPlugin } from '@capacitor/core';
import { encryptIdsPassword } from './session.ts';
import {
  type JwRequest,
  type JwResponse,
  type Transport,
  validateRequest,
} from './protocol.ts';

const native = registerPlugin<{
  request(input: JwRequest & { requestId?: string }): Promise<JwResponse>;
  cancel(input: { requestId: string }): Promise<void>;
  encryptPassword(input: {
    password: string;
    salt: string;
  }): Promise<{ encrypted: string }>;
}>('JwImport');

// Use native AES on iOS so login also works in WKWebView custom-scheme contexts
// where Web Crypto's secure-context methods may not be available.
export async function encryptJwPassword(password: string, salt: string) {
  if (Capacitor.getPlatform() === 'ios') {
    return (await native.encryptPassword({ password, salt })).encrypted;
  }
  return encryptIdsPassword(password, salt);
}

function requestIdentifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const jwTransport: Transport = async (input, signal) => {
  validateRequest(input);
  signal.throwIfAborted();
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable('JwImport'))
      throw new Error('当前应用尚未启用教务导入，请更新应用后重试。');
    const requestId =
      Capacitor.getPlatform() === 'ios' ? requestIdentifier() : undefined;
    const cancel = () => {
      if (requestId) void native.cancel({ requestId }).catch(() => undefined);
    };
    const request = native.request({
      ...input,
      ...(requestId ? { requestId } : {}),
    });
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    try {
      const result = await request;
      signal.throwIfAborted();
      return result;
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  }
  const response = await fetch('/api/student/jw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    credentials: 'omit',
    signal,
  });
  if (!response.ok)
    throw new Error('暂时无法连接教务系统，请检查网络或稍后重试。');
  return response.json() as Promise<JwResponse>;
};
