import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  type JwRequest,
  type JwResponse,
  type Transport,
  validateRequest,
} from './protocol.ts';

const native = registerPlugin<{
  request(input: JwRequest): Promise<JwResponse>;
}>('JwImport');
export const jwTransport: Transport = async (input, signal) => {
  validateRequest(input);
  signal.throwIfAborted();
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable('JwImport'))
      throw new Error('请更新 Android 应用后使用自动导入。');
    const result = await native.request(input);
    signal.throwIfAborted();
    return result;
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
