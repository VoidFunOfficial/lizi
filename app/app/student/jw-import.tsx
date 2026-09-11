'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import Image from 'next/image';
import { Download, RefreshCw, X } from 'lucide-react';
import { JwSession } from '@/lib/student/jw/session';
import { jwTransport } from '@/lib/student/jw/client';
import type { Timetable } from '@/lib/student/timetable';

export default function JwImport({
  replacing,
  onImported,
  onClose,
}: {
  replacing: boolean;
  onImported: (table: Timetable) => void;
  onClose: () => void;
}) {
  const session = useRef<JwSession | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [message, setMessage] = useState('正在连接教务系统…');
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const current = new JwSession(jwTransport);
    session.current = current;
    void current
      .captcha()
      .then((src) => {
        if (session.current !== current) return;
        setImage(src);
        setMessage('');
      })
      .catch(() => {
        if (session.current === current)
          setError('验证码加载失败，请检查网络后重试。');
      })
      .finally(() => {
        if (session.current === current) setRefreshing(false);
      });
    form.current?.querySelector<HTMLInputElement>('[name="username"]')?.focus();
    return () => {
      active.current = false;
      session.current?.close();
      session.current = null;
      current.close();
    };
  }, []);
  async function refresh() {
    if (busy || refreshing) return;
    setRefreshing(true);
    setImage('');
    setError('');
    const input =
      form.current?.querySelector<HTMLInputElement>('[name="captcha"]');
    if (input) input.value = '';
    session.current?.close();
    const current = new JwSession(jwTransport);
    session.current = current;
    try {
      const src = await current.captcha();
      if (active.current) {
        setImage(src);
        setMessage('');
      }
    } catch {
      if (active.current) setError('验证码加载失败，请检查网络后重试。');
    } finally {
      if (active.current) setRefreshing(false);
    }
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || refreshing || !image || !session.current) return;
    const fields = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = fields.get(name);
      return typeof value === 'string' ? value : '';
    };
    setBusy(true);
    setError('');
    try {
      const buffer = await session.current.import(
        field('username'),
        field('password'),
        field('captcha'),
        setMessage,
      );
      const { importTimetable } = await import('@/lib/student/import');
      const table = importTimetable(buffer);
      if (!active.current) return;
      form.current?.reset();
      session.current.close();
      onImported(table);
    } catch (e) {
      if (!active.current) return;
      setError(e instanceof Error ? e.message : '导入失败，请重试。');
      setMessage('');
      setImage('');
      // A failed login may consume the challenge. Never reuse or retry credentials.
    } finally {
      fields.delete('password');
      if (active.current) setBusy(false);
    }
  }
  return (
    <section className="student-card student-jw" aria-label="教务一键导入">
      <div className="student-section-title">
        <span>教务一键导入</span>
        <button
          className="student-icon-button"
          aria-label="关闭自动导入"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <form
        ref={form}
        onSubmit={(e) => {
          void submit(e);
        }}
        autoComplete="off"
      >
        <fieldset disabled={busy}>
          <label className="student-field">
            用户名
            <input
              name="username"
              placeholder="请输入学号"
              maxLength={32}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <label className="student-field">
            密码
            <input
              name="password"
              type="password"
              placeholder="教务系统密码"
              maxLength={32}
              autoComplete="off"
              required
            />
          </label>
          <div className="student-jw-captcha">
            <label className="student-field">
              验证码
              <input
                name="captcha"
                placeholder="输入右侧字符"
                maxLength={6}
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="off"
                required
              />
            </label>
            <button
              className="student-jw-image"
              type="button"
              disabled={refreshing || busy}
              onClick={() => {
                void refresh();
              }}
              aria-label="刷新验证码"
            >
              {image ? (
                <Image
                  src={image}
                  alt="教务登录验证码"
                  width={90}
                  height={36}
                  unoptimized
                />
              ) : (
                <RefreshCw size={20} />
              )}
              <span>{refreshing ? '加载中…' : '换一张'}</span>
            </button>
          </div>
        </fieldset>
        {error && (
          <p className="student-warning" role="alert">
            {error}
            {!image && ' 点击「换一张」获取新验证码。'}
          </p>
        )}
        {replacing && (
          <p className="student-footnote">导入后替换现有课表，清除旧调课。</p>
        )}
        <button
          className="student-primary"
          type="submit"
          disabled={busy || refreshing || !image}
        >
          <Download size={17} />
          {busy ? message || '正在导入…' : '登录并一键导入'}
        </button>
        <output className="student-jw-status" aria-live="polite">
          {busy || refreshing ? message : ''}
        </output>
      </form>
    </section>
  );
}
