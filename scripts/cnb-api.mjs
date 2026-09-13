/** CNB OpenAPI transport. Never forward the bearer token to object storage. */
export function cnbApi(token, request = fetch) {
  if (!token) throw new Error('CNB_TOKEN is required');
  const origin = 'https://api.cnb.cool';
  return async (path, { method = 'GET', body, allow404 = false } = {}) => {
    const url = new URL(path, origin);
    if (url.origin !== origin) throw new Error('Unexpected CNB API origin');
    const response = await request(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.cnb.api+json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok)
      throw new Error(`CNB ${method} ${url.pathname}: HTTP ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}

export async function publishRelease({
  api,
  tag,
  commit,
  notes,
  assets,
  upload,
}) {
  const root = '/voidfun/njustmap/-/releases';
  let release = await api(`${root}/tags/${encodeURIComponent(tag)}`, {
    allow404: true,
  });
  if (release && release.tag_commitish !== commit) {
    throw new Error('Release tag points to a different commit');
  }
  // Published binaries are immutable; do not invalidate installed clients on retry.
  if (release && !release.draft) {
    const names = new Set(release.assets?.map((asset) => asset.name));
    if (assets.some((asset) => !names.has(asset.name)))
      throw new Error(
        'Published release is incomplete; inspect it before replacing any binaries',
      );
    return release;
  }
  if (!release) {
    release = await api(root, {
      method: 'POST',
      body: {
        tag_name: tag,
        target_commitish: commit,
        name: tag,
        body: notes,
        draft: true,
        prerelease: false,
        make_latest: 'false',
      },
    });
  }
  const releasePath = `${root}/${encodeURIComponent(release.id)}`;
  for (const asset of assets) {
    const target = await api(`${releasePath}/asset-upload-url`, {
      method: 'POST',
      body: { asset_name: asset.name, size: asset.size, overwrite: true },
    });
    // Pre-signed storage URLs carry their own authorization, never CNB_TOKEN.
    if (new URL(target.upload_url).protocol !== 'https:')
      throw new Error('Insecure asset upload URL');
    await upload(target.upload_url, asset);
    await api(target.verify_url, { method: 'POST' });
  }
  const verified = await api(releasePath);
  for (const asset of assets) {
    const remote = verified.assets?.find((item) => item.name === asset.name);
    if (!remote || remote.size !== asset.size)
      throw new Error(`Asset verification failed: ${asset.name}`);
    if (
      remote.hash_algo?.toLowerCase().replace('-', '') === 'sha256' &&
      remote.hash_value !== asset.sha256
    ) {
      throw new Error(`Asset checksum mismatch: ${asset.name}`);
    }
  }
  const latest = await api(`${root}/latest`, { allow404: true });
  const parts = (value) => value.replace(/^v/, '').split('.').map(Number);
  const next = parts(tag),
    previous = latest ? parts(latest.tag_name) : [0, 0, 0];
  const comparison =
    next[0] - previous[0] || next[1] - previous[1] || next[2] - previous[2];
  await api(releasePath, {
    method: 'PATCH',
    body: {
      draft: false,
      prerelease: false,
      body: notes,
      make_latest: comparison >= 0 ? 'true' : 'false',
    },
  });
  return verified;
}
