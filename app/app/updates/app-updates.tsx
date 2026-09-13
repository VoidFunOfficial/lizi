'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowUpCircle, RefreshCw } from 'lucide-react';
import { version } from '../../../package.json';
import { checkLatestRelease } from '@/lib/updates/client';
import {
  CHECK_INTERVAL,
  RETRY_INTERVAL,
  isNewerVersion,
  type AppRelease,
} from '@/lib/updates/release';
import './updates.css';

type UpdateContext = { checking: boolean; message: string; check: () => void };
const Updates = createContext<UpdateContext | null>(null);

export function AppUpdates({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('启动时自动检查更新');
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [platform, setPlatform] = useState('web');
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const nextCheck = useRef(0);
  const dismissed = useRef('');
  const mounted = useRef(false);

  const check = useCallback(async (manual = false) => {
    if (pending.current || (!manual && Date.now() < nextCheck.current)) return;
    pending.current = true;
    setChecking(true);
    if (manual) setMessage('正在检查更新…');
    try {
      const latest = await checkLatestRelease();
      if (!mounted.current) return;
      nextCheck.current = Date.now() + CHECK_INTERVAL;
      if (latest && isNewerVersion(latest.version, version)) {
        setMessage(`发现新版本 v${latest.version}`);
        if (manual || dismissed.current !== latest.version) {
          setPlatform(Capacitor.getPlatform());
          setRelease(latest);
        }
      } else {
        setMessage('当前已是最新版本');
      }
    } catch {
      nextCheck.current = Date.now() + RETRY_INTERVAL;
      if (mounted.current) setMessage('暂时无法检查更新，请检查网络后重试');
    } finally {
      pending.current = false;
      if (mounted.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void check(), 1500);
    const resume = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [check]);

  useEffect(() => {
    if (release && !dialog.current?.open) dialog.current?.showModal();
  }, [release]);

  const dismiss = () => {
    if (release) dismissed.current = release.version;
    dialog.current?.close();
    setRelease(null);
  };

  return (
    <Updates.Provider
      value={{ checking, message, check: () => void check(true) }}
    >
      {children}
      <dialog
        className="app-update-dialog"
        ref={dialog}
        onCancel={dismiss}
        aria-labelledby="app-update-title"
      >
        {release && (
          <>
            <div className="app-update-icon">
              <ArrowUpCircle size={30} />
            </div>
            <p className="app-update-eyebrow">南梨有梨</p>
            <h2 id="app-update-title">发现新版本</h2>
            <p className="app-update-version">
              v{version} <span>→</span> v{release.version}
            </p>
            <div className="app-update-notes">
              {release.notes || '校园导航有了新的改进，查看发布说明了解详情。'}
            </div>
            <p className="app-update-hint">
              {platform === 'android'
                ? '下载完成后，打开安装包并按系统提示更新。'
                : platform === 'ios'
                  ? '前往发布页查看更新说明与 iOS 分发进度。'
                  : '前往发布页查看新版内容与下载方式。'}
            </p>
            <a
              className="app-update-primary"
              href={platform === 'android' ? release.androidUrl : release.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {platform === 'android' ? '下载更新' : '查看新版'}
            </a>
            <button className="app-update-later" onClick={dismiss}>
              稍后提醒
            </button>
          </>
        )}
      </dialog>
    </Updates.Provider>
  );
}

export function UpdateSettings() {
  const updates = useContext(Updates);
  if (!updates) return null;
  return (
    <section className="student-card app-update-settings" aria-label="应用更新">
      <div className="app-update-settings-heading">
        <span className="student-setting-icon">
          <ArrowUpCircle size={19} />
        </span>
        <strong>应用更新</strong>
        <span>v{version}</span>
      </div>
      <output>{updates.message}</output>
      <button
        className="student-secondary"
        disabled={updates.checking}
        onClick={updates.check}
      >
        <RefreshCw size={15} />
        {updates.checking ? '正在检查…' : '检查更新'}
      </button>
    </section>
  );
}
