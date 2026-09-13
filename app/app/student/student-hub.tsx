'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  GraduationCap,
  Home,
  Map,
  MapPin,
  Navigation,
  Route,
  Settings2,
  Upload,
  UserRound,
  Utensils,
  X,
} from 'lucide-react';
import type { CampusNavigator } from '@/lib/campus-navigator';
import type { Place } from '@/lib/campus-model';
import { formatCampusDateTime } from '@/lib/campus-time';
import {
  addDays,
  calendarStatus,
  campusToday,
  minutes,
  PERIODS,
  TERMS,
  timeLabel,
  validDate,
  weekday,
  weekOf,
  WEEKDAYS,
  type AcademicTerm,
} from '@/lib/student/calendar';
import {
  courseTime,
  isOnline,
  scheduleForDate,
  type Timetable,
} from '@/lib/student/timetable';
import {
  createDailyPlan,
  resolveCoursePlace,
  type PlanLeg,
  type DailyPlan,
  type PlannerPreferences,
} from '@/lib/student/planner';
import {
  emptyStudentData,
  parseStudentData,
  STUDENT_STORAGE_KEY,
  validateTerm,
  type StudentData,
} from '@/lib/student/storage';
import './student.css';
import JwImport from './jw-import';
import { UpdateSettings } from '../updates/app-updates';
import {
  allowedPersonalPlaces,
  diningLabel,
  isDormitory,
} from '@/lib/student/places';

export type StudentTab = 'map' | 'today' | 'timetable' | 'profile';
type Props = {
  tab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  places: Place[];
  navigator: CampusNavigator;
  onNavigate: (leg: PlanLeg, date: string) => void;
  onPreview: (leg: PlanLeg, date: string) => void;
  onPreviewDay: (plan: DailyPlan, date: string) => void;
};
const TABS = [
  { id: 'map', title: '地图', icon: Map },
  { id: 'today', title: '行程', icon: Route },
  { id: 'timetable', title: '课表', icon: CalendarDays },
  { id: 'profile', title: '我的', icon: UserRound },
] as const;
const dateTitle = (date: string) =>
  `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`;

const PLANNER_MESSAGES: Record<string, string> = {
  '先在「我的」设置寝室，才能安排上下学路线。': '请设置寝室',
  '在「我的」选择常去的食堂，可自动比较顺路的用餐地点。': '请设置用餐地点',
  '请在「我的」对应教室地点': '教室未关联地图',
  '上课地点待公布，暂不能规划这段路线': '上课地点待公布',
  '地点未完善，用餐时间暂未计入完整步行时间': '步行用时待确认',
  '今天有全周安排，具体时间未提供；请以学院通知为准，餐食安排需自行核对。':
    '全周安排的时间、用餐需另行确认',
};
const plannerMessage = (message: string) =>
  PLANNER_MESSAGES[message] ?? message;

export default function StudentHub({
  tab,
  onTabChange,
  places,
  navigator,
  onNavigate,
  onPreview,
  onPreviewDay,
}: Props) {
  const [data, setData] = useState<StudentData>(emptyStudentData);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoImportOpen, setAutoImportOpen] = useState(false);
  const [preview, setPreview] = useState<{
    table: Timetable;
    fileName: string;
  } | null>(null);
  const [previewTermId, setPreviewTermId] = useState('');
  const [termDraft, setTermDraft] = useState<AcademicTerm>(TERMS[0]);
  const [overrideDate, setOverrideDate] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [clearRequested, setClearRequested] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const tabBarRef = useRef<HTMLElement>(null);
  const dormitories = places.filter(isDormitory);
  const diningPlaces = places
    .filter((p) => diningLabel(p))
    .sort(
      (a, b) =>
        ['芙蓉', '兰苑', '樱花'].indexOf(diningLabel(a)!) -
        ['芙蓉', '兰苑', '樱花'].indexOf(diningLabel(b)!),
    );
  const personalPlaces = allowedPersonalPlaces(data.preferences, places);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STUDENT_STORAGE_KEY);
        if (stored) {
          const restored = parseStudentData(stored);
          setData(restored);
          setTermDraft(restored.term);
        }
      } catch {
        setMessage('课表读取失败，请重新导入。');
      }
      setLoaded(true);
    }, 0);
    const tick = () => setNow(new Date());
    const clockTimer = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(clockTimer);
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  useEffect(() => {
    if (tab !== 'map') panelRef.current?.scrollTo(0, 0);
  }, [tab]);
  useEffect(() => {
    const bar = tabBarRef.current;
    const shell = bar?.closest<HTMLElement>('.app-shell');
    if (!bar || !shell) return;
    const measure = () =>
      shell.style.setProperty('--student-tab-height', `${bar.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, []);
  const today = now ? campusToday(now) : '';
  const date = selectedDate || today;
  const calendar = date ? calendarStatus(date) : null;
  const schedule = useMemo(
    () =>
      data.timetable && date
        ? scheduleForDate(data.timetable, data.term, date, data.overrides)
        : null,
    [data.timetable, data.term, date, data.overrides],
  );
  const liveSchedule = useMemo(
    () =>
      data.timetable && today
        ? scheduleForDate(data.timetable, data.term, today, data.overrides)
        : null,
    [data.timetable, data.term, today, data.overrides],
  );
  const currentMinutes = now ? minutes(formatCampusDateTime(now).slice(11)) : 0;
  const current =
    liveSchedule?.courses.filter((c) => {
      const t = courseTime(c);
      return t.start <= currentMinutes && currentMinutes < t.end;
    }) ?? [];
  const next = liveSchedule?.courses.find(
    (c) => courseTime(c).start > currentMinutes,
  );
  const plan = useMemo(
    () =>
      schedule && tab === 'today'
        ? createDailyPlan(schedule, date, places, navigator, data.preferences)
        : null,
    [schedule, tab, date, places, navigator, data.preferences],
  );
  const locations = useMemo(
    () => [
      ...new Set(
        data.timetable?.courses
          .filter((c) => c.location && !isOnline(c))
          .map((c) => c.location) ?? [],
      ),
    ],
    [data.timetable],
  );
  const unresolved =
    data.timetable?.courses.filter(
      (c) =>
        Boolean(c.location) &&
        !isOnline(c) &&
        !resolveCoursePlace(c, places, data.preferences.locationBindings),
    ) ?? [];
  const monday = date ? addDays(date, 1 - weekday(date)) : '';

  useEffect(() => {
    if (tab === 'timetable') panelRef.current?.scrollTo(0, 0);
  }, [date, tab]);

  function commit(nextData: StudentData, success?: string) {
    setData(nextData);
    try {
      window.localStorage.setItem(
        STUDENT_STORAGE_KEY,
        JSON.stringify(nextData),
      );
      if (success) setMessage(success);
    } catch {
      setMessage('保存失败，刷新后需要重新导入。');
    }
  }
  function preferences(patch: Partial<PlannerPreferences>) {
    commit({
      ...data,
      preferences: allowedPersonalPlaces(
        { ...data.preferences, ...patch },
        places,
      ),
    });
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      setMessage('请选择教务系统导出的 .xls 或 .xlsx 课表。');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('请选择 5 MB 以内的课表。');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { importTimetable } = await import('@/lib/student/import');
      const table = importTimetable(await file.arrayBuffer());
      setPreview({ table, fileName: file.name });
      setPreviewTermId(TERMS.find((t) => t.id === table.termId)?.id ?? '');
      onTabChange('profile');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '课表读取失败，请重新导出后导入。',
      );
    } finally {
      setBusy(false);
    }
  }
  function importFromJw(table: Timetable) {
    const term = TERMS.find((t) => t.id === table.termId);
    setAutoImportOpen(false);
    if (!term || table.warnings.length) {
      setPreview({ table, fileName: '教务系统自动导入' });
      setPreviewTermId(term?.id ?? '');
      setMessage(
        !term ? '课表已读取，请选择学期。' : '课表已读取，有部分内容需要核对。',
      );
      onTabChange('profile');
      return;
    }
    commit(
      {
        ...data,
        timetable: table,
        term: { ...term },
        overrides: {},
        importedAt: new Date().toISOString(),
        fileName: '教务系统自动导入',
      },
      `已自动导入 ${new Set(table.courses.map((c) => c.name)).size} 门课程，课表和行程已更新。`,
    );
    setTermDraft(term);
    setPreview(null);
    setSelectedDate('');
    onTabChange('timetable');
  }
  function confirmImport() {
    const term = TERMS.find((t) => t.id === previewTermId);
    if (!preview || !term) return;
    commit(
      {
        ...data,
        timetable: preview.table,
        term: { ...term },
        overrides: {},
        importedAt: new Date().toISOString(),
        fileName: preview.fileName,
      },
      '课表已导入。',
    );
    setTermDraft(term);
    setPreview(null);
    setSelectedDate('');
  }
  function saveOverride(target: string | null) {
    const actual = overrideDate || date;
    if (
      !validDate(actual) ||
      (target !== null &&
        (!validDate(target) ||
          target < data.term.weekOne ||
          target > data.term.end))
    ) {
      setMessage('请选择有效日期，参照日期需位于课表学期内。');
      return;
    }
    commit(
      { ...data, overrides: { ...data.overrides, [actual]: target } },
      '调课已保存，课表和行程已更新。',
    );
  }
  const goToday = () => {
    setSelectedDate('');
    onTabChange('today');
  };
  const importButton = (
    <button
      className="student-secondary"
      disabled={busy || !loaded || autoImportOpen}
      onClick={() => fileRef.current?.click()}
    >
      <Upload size={17} />
      {busy ? '正在读取课表…' : '从 Excel 文件导入'}
    </button>
  );
  const datePicker = date && (
    <div className="student-date-picker">
      <button
        aria-label="前一天"
        onClick={() => setSelectedDate(addDays(date, -1))}
      >
        <ChevronLeft size={18} />
      </button>
      <label>
        <span>
          {dateTitle(date)} · 星期{WEEKDAYS[weekday(date) - 1]}
        </span>
        <input
          aria-label="查看日期"
          type="date"
          value={date}
          onInput={(e) => {
            if (validDate(e.currentTarget.value))
              setSelectedDate(e.currentTarget.value);
          }}
          onChange={(e) => {
            if (validDate(e.target.value)) setSelectedDate(e.target.value);
          }}
        />
      </label>
      <button
        aria-label="后一天"
        onClick={() => setSelectedDate(addDays(date, 1))}
      >
        <ChevronRight size={18} />
      </button>
      <button
        className="student-today-button"
        onClick={() => setSelectedDate('')}
      >
        今天
      </button>
    </div>
  );

  return (
    <>
      <input
        ref={fileRef}
        className="student-file-input"
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          void importFile(e);
        }}
        aria-label="选择 Excel 课表"
        tabIndex={-1}
      />
      {tab !== 'map' && (
        <section
          className="student-page"
          ref={panelRef}
          aria-label={TABS.find((item) => item.id === tab)?.title}
        >
          <div className="student-content">
            {message && (
              <output className="student-notice">
                <span>{message}</span>
                <button aria-label="关闭提示" onClick={() => setMessage('')}>
                  <X size={16} />
                </button>
              </output>
            )}
            {!loaded || !now ? (
              <div className="student-empty">正在载入…</div>
            ) : (
              <>
                {tab === 'profile' && (
                  <>
                    <section className="student-card student-identity">
                      <div className="student-avatar">
                        <GraduationCap size={30} />
                      </div>
                      <div>
                        <strong>{data.timetable?.student || '同学'}</strong>
                        <p>
                          {data.timetable
                            ? [data.timetable.college, data.timetable.className]
                                .filter(Boolean)
                                .join(' · ') || '课表已导入'
                            : '尚未导入课表'}
                        </p>
                      </div>
                    </section>
                    {data.timetable && (
                      <button
                        className="student-card student-current"
                        onClick={goToday}
                      >
                        <span className="student-soft-icon">
                          <BookOpen size={23} />
                        </span>
                        <div>
                          <small>
                            {current.length
                              ? current.length > 1
                                ? '当前有课程冲突'
                                : '正在上课'
                              : next
                                ? '下一节课'
                                : '今日'}
                          </small>
                          <strong>
                            {current.length
                              ? current.map((c) => c.name).join(' / ')
                              : next?.name ||
                                (!data.timetable
                                  ? '尚未导入课表'
                                  : liveSchedule?.activities[0]?.name ||
                                    liveSchedule?.reason ||
                                    '今天没有课程')}
                          </strong>
                          <p>
                            {current[0] || next
                              ? `${timeLabel(courseTime(current[0] || next!).start)}–${timeLabel(courseTime(current[0] || next!).end)} · ${(current[0] || next!).location || '教室待公布'}`
                              : '查看行程'}
                          </p>
                        </div>
                        <ChevronRight size={19} />
                      </button>
                    )}
                  </>
                )}

                {tab === 'profile' && (
                  <section className="student-card student-import">
                    {data.timetable && (
                      <div className="student-import-info">
                        <CalendarDays size={22} />
                        <span>
                          {
                            new Set(data.timetable.courses.map((c) => c.name))
                              .size
                          }{' '}
                          门课程
                        </span>
                        <span className="student-subtle">
                          {data.term.label}
                        </span>
                      </div>
                    )}
                    <button
                      className="student-primary"
                      disabled={busy || !loaded}
                      onClick={() => {
                        setPreview(null);
                        setAutoImportOpen(true);
                      }}
                    >
                      <Download size={17} />
                      一键自动导入课程
                    </button>
                    {importButton}
                  </section>
                )}

                {tab === 'profile' && autoImportOpen && (
                  <JwImport
                    replacing={Boolean(data.timetable)}
                    onImported={importFromJw}
                    onClose={() => setAutoImportOpen(false)}
                  />
                )}

                {preview && tab === 'profile' && (
                  <section
                    className="student-card student-preview"
                    aria-label="课表导入预览"
                  >
                    <div className="student-section-title">
                      <span>{preview.fileName}</span>
                      <button
                        className="student-icon-button"
                        aria-label="取消导入"
                        onClick={() => setPreview(null)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <p>
                      {preview.table.student || '学生课表'} ·{' '}
                      {preview.table.termId || '未识别学期'}
                    </p>
                    <p>
                      {new Set(preview.table.courses.map((c) => c.name)).size}{' '}
                      门课程 · {preview.table.courses.length} 条安排 ·
                      {preview.table.activities.length} 项全周安排
                    </p>
                    <label className="student-field">
                      学期
                      <select
                        value={previewTermId}
                        onChange={(e) => setPreviewTermId(e.target.value)}
                      >
                        <option value="">请选择对应学期</option>
                        {TERMS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {previewTermId &&
                      previewTermId !== preview.table.termId && (
                        <p className="student-warning">
                          与课表学期不同，请核对。
                        </p>
                      )}
                    <div className="student-preview-list">
                      {preview.table.courses.slice(0, 4).map((c) => (
                        <div key={c.id}>
                          <strong>{c.name}</strong>
                          <span>
                            周{WEEKDAYS[c.weekday - 1]} · {c.weekText} ·{' '}
                            {c.location || '地点待公布'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {preview.table.warnings.map((w, i) => (
                      <p className="student-warning" key={i}>
                        {w}
                      </p>
                    ))}
                    <p className="student-footnote">
                      将替换课表、清除旧调课，保留地点偏好。
                    </p>
                    <button
                      className="student-primary"
                      disabled={!previewTermId}
                      onClick={confirmImport}
                    >
                      <Check size={17} />
                      确认导入
                    </button>
                  </section>
                )}

                {tab === 'today' && data.timetable && (
                  <>
                    {datePicker}
                    <div className="student-week-label">
                      <span>
                        {calendar?.label}
                        {calendar?.week ? ` · 第 ${calendar.week} 周` : ''}
                      </span>
                      <span>
                        课表第 {schedule?.week} 周
                        {schedule && schedule.referenceDate !== date
                          ? ' · 已调课'
                          : ''}
                      </span>
                    </div>
                    {schedule?.reason && (
                      <div className="student-info">
                        {schedule.reason}。
                        {schedule.reason === '停课考试'
                          ? '考试时间请另行核对。'
                          : ''}
                      </div>
                    )}
                    {schedule?.activities.map((a, i) => (
                      <div className="student-info" key={i}>
                        <strong>{a.name} · 全周安排</strong>
                        {a.detail && <p>{a.detail}</p>}
                      </div>
                    ))}
                  </>
                )}

                {tab === 'timetable' && data.timetable && date && (
                  <>
                    <div className="student-week-browser">
                      <div className="student-week-navigation">
                        <button
                          onClick={() => setSelectedDate(addDays(date, -7))}
                        >
                          <ChevronLeft size={17} />
                          上一周
                        </button>
                        <strong>
                          {date >= data.term.weekOne && date <= data.term.end
                            ? `第 ${weekOf(date, data.term.weekOne)} 周`
                            : '学期外'}
                          <span>
                            {dateTitle(monday)} —{' '}
                            {dateTitle(addDays(monday, 6))}
                          </span>
                        </strong>
                        <button
                          onClick={() => setSelectedDate(addDays(date, 7))}
                        >
                          下一周
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      <fieldset
                        className="student-week-strip"
                        aria-label="选择星期"
                      >
                        {WEEKDAYS.map((label, i) => {
                          const d = addDays(monday, i);
                          const day = scheduleForDate(
                            data.timetable!,
                            data.term,
                            d,
                            data.overrides,
                          );
                          return (
                            <button
                              key={d}
                              className="student-day-head"
                              aria-pressed={d === date}
                              aria-label={`${dateTitle(d)}，星期${label}${d === today ? '，今天' : ''}，${day.courses.length} 门课`}
                              aria-controls="student-day-periods"
                              data-today={d === today}
                              onClick={() => setSelectedDate(d)}
                            >
                              <span>{label}</span>
                              <strong>{Number(d.slice(8))}</strong>
                              <i
                                className={
                                  day.courses.length || day.activities.length
                                    ? 'has-events'
                                    : ''
                                }
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </fieldset>
                    </div>
                    <div className="student-day-summary">
                      <div aria-live="polite" aria-atomic="true">
                        <strong id="student-day-title">
                          {dateTitle(date)} · 星期{WEEKDAYS[weekday(date) - 1]}
                        </strong>
                        <span>
                          {schedule?.courses.length
                            ? `${schedule.courses.length} 门课 · 江阴校区`
                            : '当天无课 · 江阴校区'}
                        </span>
                      </div>
                      <button
                        className="student-icon-button"
                        onClick={() => setSelectedDate('')}
                      >
                        今天
                      </button>
                    </div>
                    {schedule?.referenceDate !== date && schedule && (
                      <div className="student-info">
                        已调课 · 按 {dateTitle(schedule.referenceDate)}（第{' '}
                        {schedule.week} 周）的课程上课
                      </div>
                    )}
                    {schedule?.reason && (
                      <div className="student-info">
                        {schedule.reason}
                        {schedule.reason === '停课考试'
                          ? '，考试时间请另行核对。'
                          : ''}
                      </div>
                    )}
                    {schedule?.activities.map((activity, i) => (
                      <div className="student-info" key={i}>
                        <strong>{activity.name} · 全周安排</strong>
                        {activity.detail && <p>{activity.detail}</p>}
                      </div>
                    ))}
                    <section
                      id="student-day-periods"
                      className="student-periods"
                      aria-labelledby="student-day-title"
                    >
                      {[
                        { label: '上午', start: 1, end: 5 },
                        { label: '下午', start: 6, end: 10 },
                        { label: '晚上', start: 11, end: 13 },
                      ].map((group) => (
                        <section
                          className="student-period-group"
                          key={group.label}
                          aria-label={group.label}
                        >
                          <h3>{group.label}</h3>
                          <ol
                            className="student-period-list"
                            start={group.start}
                          >
                            {PERIODS.slice(group.start - 1, group.end).map(
                              ([start, end], index) => {
                                const period = group.start + index;
                                const courses =
                                  schedule?.courses.filter(
                                    (course) =>
                                      course.startPeriod <= period &&
                                      course.endPeriod >= period,
                                  ) ?? [];
                                const inProgress =
                                  date === today &&
                                  currentMinutes >= minutes(start) &&
                                  currentMinutes < minutes(end);
                                return (
                                  <li
                                    className="student-period-row"
                                    key={period}
                                    data-current={inProgress}
                                  >
                                    <div className="student-period-time">
                                      <strong>第 {period} 节</strong>
                                      <span>
                                        {start}–{end}
                                      </span>
                                      {inProgress && <small>当前时段</small>}
                                    </div>
                                    <div className="student-period-content">
                                      {courses.length > 1 && (
                                        <span className="student-warning">
                                          课程时间冲突
                                        </span>
                                      )}
                                      {courses.length ? (
                                        courses.map((course) => (
                                          <button
                                            key={course.id}
                                            className={`student-period-course course-tone-${course.startPeriod % 4}`}
                                            onClick={() => onTabChange('today')}
                                            aria-label={`第 ${period} 节，${course.name}，${course.location || '地点待公布'}，查看当天行程`}
                                          >
                                            <span className="student-course-detail">
                                              <strong>{course.name}</strong>
                                              <span>
                                                {course.location ||
                                                  '地点待公布'}
                                                {course.teacher
                                                  ? ` · ${course.teacher}`
                                                  : ''}
                                              </span>
                                            </span>
                                            <ChevronRight
                                              size={16}
                                              aria-hidden="true"
                                            />
                                          </button>
                                        ))
                                      ) : (
                                        <span className="student-period-free">
                                          无课
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                );
                              },
                            )}
                          </ol>
                        </section>
                      ))}
                    </section>
                  </>
                )}

                {tab === 'today' && plan && (
                  <>
                    <div className="student-plan-meta">
                      <span>{schedule?.courses.length ?? 0} 节课</span>
                      <span>
                        {plan.stops.filter((s) => s.kind === 'meal').length}{' '}
                        次用餐
                      </span>
                      <span>
                        {plan.legs.filter((l) => l.route).length} 段步行
                      </span>
                      <button
                        aria-label="行程偏好"
                        onClick={() => onTabChange('profile')}
                      >
                        <Settings2 size={18} />
                      </button>
                    </div>
                    {plan.warnings.length > 0 && (
                      <div className="student-info">
                        {plan.warnings.map(plannerMessage).join(' · ')}
                      </div>
                    )}
                    <div className="student-timeline">
                      {plan.stops.map((stop) => {
                        const leg = plan.legs.find(
                          (l) => l.destinationId === stop.id,
                        );
                        const active =
                          date === today &&
                          stop.start <= currentMinutes &&
                          currentMinutes < stop.end;
                        const completed =
                          date === today && stop.end <= currentMinutes;
                        const Icon =
                          stop.kind === 'course'
                            ? BookOpen
                            : stop.kind === 'meal'
                              ? Utensils
                              : Home;
                        return (
                          <article
                            className={`student-timeline-item ${active ? 'is-current' : ''} ${completed ? 'is-complete' : ''}`}
                            key={stop.id}
                          >
                            <div className="student-timeline-time">
                              <strong>{timeLabel(stop.start)}</strong>
                              <span>
                                {stop.kind === 'home'
                                  ? '返程'
                                  : timeLabel(stop.end)}
                              </span>
                              <span className="student-timeline-dot">
                                <Icon size={15} />
                              </span>
                            </div>
                            <div className="student-card student-stop">
                              <div className="student-stop-heading">
                                <strong>{stop.title}</strong>
                                {active && (
                                  <span className="student-pill">进行中</span>
                                )}
                              </div>
                              <p>
                                <MapPin size={13} />
                                {stop.detail}
                                {stop.online ? ' · 无需前往教室' : ''}
                              </p>
                              {stop.kind === 'course' &&
                                stop.place &&
                                stop.place.name !== stop.detail && (
                                  <small className="student-subtle">
                                    前往 {stop.place.name}
                                  </small>
                                )}
                              {stop.warnings.map((w, i) => (
                                <p className="student-warning" key={i}>
                                  {plannerMessage(w)}
                                </p>
                              ))}
                              {leg &&
                                leg.message !== '地点未确定，路线待完善' && (
                                  <div className="student-leg">
                                    <span>
                                      <ArrowDown size={13} />
                                      {leg.from} → {leg.to}
                                    </span>
                                    {leg.route ? (
                                      <>
                                        <small>
                                          {timeLabel(leg.departure)} 出发 ·
                                          步行约{' '}
                                          {Math.max(
                                            1,
                                            Math.ceil(
                                              leg.route.metrics
                                                .estimatedSeconds / 60,
                                            ),
                                          )}{' '}
                                          分钟
                                          {leg.route.metrics.distanceMeters ===
                                          undefined
                                            ? ''
                                            : ` · ${Math.round(leg.route.metrics.distanceMeters)} 米`}
                                        </small>
                                        <div className="student-leg-actions">
                                          <button
                                            onClick={() => onPreview(leg, date)}
                                          >
                                            <Route size={14} />
                                            路线预览
                                          </button>
                                          <button
                                            onClick={() =>
                                              onNavigate(leg, date)
                                            }
                                          >
                                            <Navigation size={14} />
                                            导航
                                            <ArrowRight size={14} />
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <small>{leg.message}</small>
                                    )}
                                  </div>
                                )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {plan.stops.length > 0 && (
                      <div className="student-day-preview">
                        <button
                          className="student-secondary"
                          onClick={() => onPreviewDay(plan, date)}
                        >
                          <Route size={17} />
                          全天路程预览
                        </button>
                      </div>
                    )}
                    {!plan.stops.length && (
                      <div className="student-empty">
                        <CalendarDays size={32} />
                        <p>当天无行程</p>
                      </div>
                    )}
                  </>
                )}

                {!data.timetable &&
                  (tab === 'today' || tab === 'timetable') && (
                    <div className="student-empty">
                      <CalendarDays size={32} />
                      <p>还没有课表</p>
                      <button
                        className="student-secondary"
                        onClick={() => onTabChange('profile')}
                      >
                        前往我的
                      </button>
                    </div>
                  )}

                {tab === 'profile' && (
                  <>
                    <details className="student-card student-settings">
                      <summary>
                        <span className="student-setting-icon">
                          <Home size={19} />
                        </span>
                        <span>我的寝室</span>
                        <span className="student-setting-value">
                          {dormitories.find(
                            (p) => p.id === personalPlaces.homeId,
                          )?.name || '未设置'}
                        </span>
                        <ChevronRight
                          className="student-disclosure-chevron"
                          size={17}
                        />
                      </summary>
                      <div className="student-settings-body">
                        <label className="student-field">
                          寝室
                          <select
                            aria-label="我的寝室"
                            value={personalPlaces.homeId}
                            onChange={(e) =>
                              preferences({ homeId: e.target.value })
                            }
                          >
                            <option value="">选择寝室</option>
                            {dormitories.map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!dormitories.length && (
                          <p className="student-note">暂无可选寝室</p>
                        )}
                      </div>
                    </details>
                    <details className="student-card student-settings">
                      <summary>
                        <span className="student-setting-icon">
                          <Utensils size={19} />
                        </span>
                        <span>偏好食堂</span>
                        <span className="student-setting-value">
                          {diningPlaces
                            .filter((p) =>
                              personalPlaces.diningIds.includes(p.id),
                            )
                            .map((p) => diningLabel(p))
                            .join('、') || '未设置'}
                        </span>
                        <ChevronRight
                          className="student-disclosure-chevron"
                          size={17}
                        />
                      </summary>
                      <div className="student-settings-body">
                        <fieldset className="student-dining">
                          <legend>选择食堂 · 可多选</legend>
                          <div className="student-place-chips">
                            {diningPlaces.map((p) => (
                              <label key={p.id}>
                                <input
                                  type="checkbox"
                                  checked={personalPlaces.diningIds.includes(
                                    p.id,
                                  )}
                                  onChange={(e) =>
                                    preferences({
                                      diningIds: e.target.checked
                                        ? [...personalPlaces.diningIds, p.id]
                                        : personalPlaces.diningIds.filter(
                                            (id) => id !== p.id,
                                          ),
                                    })
                                  }
                                />
                                <span>{diningLabel(p)}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </div>
                    </details>
                    <details className="student-card student-settings">
                      <summary>
                        <span className="student-setting-icon">
                          <Utensils size={19} />
                        </span>
                        <span>用餐与出发</span>
                        <ChevronRight
                          className="student-disclosure-chevron"
                          size={17}
                        />
                      </summary>
                      <div className="student-settings-body">
                        <label className="student-toggle">
                          <span>自动安排三餐</span>
                          <input
                            type="checkbox"
                            checked={data.preferences.meals}
                            onChange={(e) =>
                              preferences({ meals: e.target.checked })
                            }
                          />
                        </label>
                        <div className="student-fields-grid">
                          {(['breakfast', 'lunch', 'dinner'] as const).map(
                            (key, i) => (
                              <label className="student-field" key={key}>
                                {['早餐', '午餐', '晚餐'][i]}时间
                                <input
                                  type="time"
                                  value={data.preferences[key]}
                                  onInput={(e) => {
                                    if (e.currentTarget.value)
                                      preferences({
                                        [key]: e.currentTarget.value,
                                      });
                                  }}
                                  onChange={(e) => {
                                    if (e.target.value)
                                      preferences({ [key]: e.target.value });
                                  }}
                                />
                              </label>
                            ),
                          )}
                          <label className="student-field">
                            每餐用时
                            <select
                              value={data.preferences.mealMinutes}
                              onChange={(e) =>
                                preferences({
                                  mealMinutes: Number(e.target.value),
                                })
                              }
                            >
                              {[20, 30, 40, 45, 60].map((m) => (
                                <option value={m} key={m}>
                                  {m} 分钟
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="student-field">
                            提前到达
                            <select
                              value={data.preferences.arrivalBuffer}
                              onChange={(e) =>
                                preferences({
                                  arrivalBuffer: Number(e.target.value),
                                })
                              }
                            >
                              {[5, 10, 15, 20].map((m) => (
                                <option value={m} key={m}>
                                  {m} 分钟
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </details>
                    {data.timetable && (
                      <>
                        <details className="student-card student-settings">
                          <summary>
                            <span className="student-setting-icon">
                              <BookOpen size={19} />
                            </span>
                            <span>教室地点</span>
                            <span className="student-setting-value">
                              {unresolved.length === 0
                                ? '已设置'
                                : `${unresolved.length} 项待设置`}
                            </span>
                            <ChevronRight
                              className="student-disclosure-chevron"
                              size={17}
                            />
                          </summary>
                          <div className="student-settings-body">
                            {locations.map((location) => {
                              const course = data.timetable!.courses.find(
                                (c) => c.location === location,
                              )!;
                              const match = resolveCoursePlace(
                                course,
                                places,
                                data.preferences.locationBindings,
                              );
                              return (
                                <label className="student-field" key={location}>
                                  {location}
                                  <select
                                    value={match?.id ?? ''}
                                    onChange={(e) =>
                                      preferences({
                                        locationBindings: {
                                          ...data.preferences.locationBindings,
                                          [location]: e.target.value,
                                        },
                                      })
                                    }
                                  >
                                    <option value="">
                                      {match ? '恢复自动匹配' : '请选择地点'}
                                    </option>
                                    {places.map((p) => (
                                      <option value={p.id} key={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              );
                            })}
                            {data.timetable.courses.some(
                              (c) => !c.location,
                            ) && (
                              <p className="student-warning">
                                部分课程的上课地点待公布。
                              </p>
                            )}
                          </div>
                        </details>
                        <details className="student-card student-settings">
                          <summary>
                            <span className="student-setting-icon">
                              <Settings2 size={19} />
                            </span>
                            <span>学期与周次</span>
                            <ChevronRight
                              className="student-disclosure-chevron"
                              size={17}
                            />
                          </summary>
                          <div className="student-settings-body">
                            <label className="student-field">
                              学期
                              <select
                                value={termDraft.id}
                                onChange={(e) => {
                                  const t = TERMS.find(
                                    (item) => item.id === e.target.value,
                                  );
                                  if (t) setTermDraft({ ...t });
                                }}
                              >
                                {TERMS.map((t) => (
                                  <option value={t.id} key={t.id}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="student-fields-grid student-calendar-fields">
                              <label className="student-field">
                                第 1 周周一
                                <input
                                  type="date"
                                  value={termDraft.weekOne}
                                  onInput={(e) =>
                                    setTermDraft({
                                      ...termDraft,
                                      weekOne: e.currentTarget.value,
                                    })
                                  }
                                  onChange={(e) =>
                                    setTermDraft({
                                      ...termDraft,
                                      weekOne: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="student-field">
                                学期结束
                                <input
                                  type="date"
                                  value={termDraft.end}
                                  onInput={(e) =>
                                    setTermDraft({
                                      ...termDraft,
                                      end: e.currentTarget.value,
                                    })
                                  }
                                  onChange={(e) =>
                                    setTermDraft({
                                      ...termDraft,
                                      end: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <button
                              className="student-secondary"
                              onClick={() => {
                                if (!validateTerm(termDraft)) {
                                  setMessage(
                                    '第 1 周须为周一，结束日期须晚于起始日期，且学期不超过一年。',
                                  );
                                  return;
                                }
                                commit(
                                  { ...data, term: { ...termDraft } },
                                  '学期与周次已更新。',
                                );
                              }}
                            >
                              保存
                            </button>
                          </div>
                        </details>
                        <details className="student-card student-settings">
                          <summary>
                            <span className="student-setting-icon">
                              <Clock3 size={19} />
                            </span>
                            <span>调课</span>
                            <ChevronRight
                              className="student-disclosure-chevron"
                              size={17}
                            />
                          </summary>
                          <div className="student-settings-body">
                            <label className="student-field">
                              调课日期
                              <input
                                type="date"
                                value={overrideDate || date}
                                onInput={(e) =>
                                  setOverrideDate(e.currentTarget.value)
                                }
                                onChange={(e) =>
                                  setOverrideDate(e.target.value)
                                }
                              />
                            </label>
                            <label className="student-field">
                              参照课表日期
                              <input
                                type="date"
                                value={referenceDate}
                                onInput={(e) =>
                                  setReferenceDate(e.currentTarget.value)
                                }
                                onChange={(e) =>
                                  setReferenceDate(e.target.value)
                                }
                              />
                            </label>
                            <div className="student-actions">
                              <button
                                className="student-secondary"
                                onClick={() => saveOverride(referenceDate)}
                              >
                                保存调课
                              </button>
                              <button
                                className="student-secondary"
                                onClick={() => saveOverride(null)}
                              >
                                当天停课
                              </button>
                            </div>
                            {Object.entries(data.overrides)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([actual, target]) => (
                                <div className="student-override" key={actual}>
                                  <span>
                                    {actual} ·{' '}
                                    {target ? `按 ${target} 上课` : '停课'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const overrides = { ...data.overrides };
                                      delete overrides[actual];
                                      commit(
                                        { ...data, overrides },
                                        '已恢复原课表。',
                                      );
                                    }}
                                  >
                                    恢复
                                  </button>
                                </div>
                              ))}
                          </div>
                        </details>
                        <div className="student-clear">
                          {clearRequested ? (
                            <>
                              <p>清除这台设备上的课表、地点偏好与调课记录？</p>
                              <button
                                onClick={() => {
                                  try {
                                    window.localStorage.removeItem(
                                      STUDENT_STORAGE_KEY,
                                    );
                                    setData(emptyStudentData());
                                    setTermDraft(TERMS[0]);
                                    setPreview(null);
                                    setClearRequested(false);
                                    setMessage('本机个人数据已清除。');
                                  } catch {
                                    setMessage(
                                      '设备存储不可用，未能清除数据。',
                                    );
                                  }
                                }}
                              >
                                确认清除
                              </button>
                              <button onClick={() => setClearRequested(false)}>
                                取消
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setClearRequested(true)}>
                              清除本机数据
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    <section
                      className="student-card student-author"
                      aria-label="关注作者 v0idfun"
                    >
                      <div className="student-author-heading">
                        <span className="student-setting-icon">
                          <UserRound size={19} />
                        </span>
                        <strong>关注作者</strong>
                        <span className="student-setting-value">v0idfun</span>
                      </div>
                      <a
                        href="https://space.bilibili.com/678915971"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="在 B 站关注 v0idfun（新窗口打开）"
                      >
                        <span>B 站</span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </a>
                      <a
                        href="https://www.douyin.com/user/MS4wLjABAAAAAeGB_AxY-81nWT7Z1VMZ1NYxvdXgDGHakp22MroYIibaBnnQ3NFaUyxMbgC5hB6t"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="在抖音关注 v0idfun（新窗口打开）"
                      >
                        <span>抖音</span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </a>
                    </section>
                    <UpdateSettings />
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}
      <nav
        ref={tabBarRef}
        className="student-tab-bar"
        aria-label="校园 App 导航"
      >
        {TABS.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => {
              if (id !== tab) setAutoImportOpen(false);
              onTabChange(id);
            }}
          >
            <Icon size={21} strokeWidth={tab === id ? 2.2 : 1.8} />
            <span>{title}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
