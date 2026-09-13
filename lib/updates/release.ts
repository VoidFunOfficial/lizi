export const RELEASE_ROOT = 'https://github.com/VoidFunOfficial/lizi/releases';
export const RELEASE_API =
  'https://api.github.com/repos/VoidFunOfficial/lizi/releases/latest';
export const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
export const RETRY_INTERVAL = 5 * 60 * 1000;

export type AppRelease = {
  version: string;
  notes: string;
  url: string;
  androidUrl: string;
};

function versionParts(version: string): number[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error('版本格式无效');
  const parts = version.split('.').map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part)))
    throw new Error('版本超出范围');
  return parts;
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  const next = versionParts(candidate);
  const current = versionParts(installed);
  for (let index = 0; index < 3; index++) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

export function parseRelease(value: unknown): AppRelease | null {
  if (!value || typeof value !== 'object') throw new Error('更新信息无效');
  const data = value as Record<string, unknown>;
  if (data.draft === true || data.prerelease === true) return null;
  if (
    data.draft !== false ||
    data.prerelease !== false ||
    typeof data.tag_name !== 'string'
  )
    throw new Error('更新信息无效');
  const version = data.tag_name.replace(/^v/, '');
  versionParts(version);
  const url = `${RELEASE_ROOT}/tag/v${version}`;
  const androidUrl = `${RELEASE_ROOT}/download/v${version}/njustmap-android.apk`;
  if (data.html_url !== url || !Array.isArray(data.assets))
    throw new Error('更新来源无效');
  // Do not offer a release until its installable artifact has finished uploading.
  const ready = data.assets.some((asset: unknown) => {
    if (!asset || typeof asset !== 'object') return false;
    const item = asset as Record<string, unknown>;
    return (
      item.name === 'njustmap-android.apk' &&
      item.state === 'uploaded' &&
      typeof item.size === 'number' &&
      item.size > 0 &&
      item.browser_download_url === androidUrl
    );
  });
  if (!ready) throw new Error('新版安装包尚未准备完成');
  return {
    version,
    url,
    androidUrl,
    notes: typeof data.body === 'string' ? data.body.slice(0, 6000) : '',
  };
}

export async function fetchRelease(
  request: () => Promise<{ status: number; data: unknown }>,
): Promise<AppRelease | null> {
  const response = await request();
  if (response.status === 404) return null;
  if (response.status !== 200) throw new Error('暂时无法检查更新，请稍后重试');
  return parseRelease(response.data);
}
