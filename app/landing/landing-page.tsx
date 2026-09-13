'use client';

/* eslint-disable next/no-html-link-for-pages -- Native document navigation avoids the broken Vinext production Link runtime. */

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Accessibility,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Globe2,
  MapPin,
  Navigation,
  Search,
  Smartphone,
  Sun,
  CloudRain,
} from 'lucide-react';
import s from './landing.module.css';

const routeModes = [
  {
    name: '少走一点',
    icon: Navigation,
    title: '去想去的地方，\n走更直接的路。',
    text: '从宿舍到教室，从食堂到图书馆。选好目的地，把路上的摸索，交给南梨有梨。',
    color: '#3475ba',
    path: 'M95 290 L190 290 L190 175 L465 175 L465 105',
    label: '步行路线',
  },
  {
    name: '少晒一点',
    icon: Sun,
    title: '天气晴好的时候，\n也有阴凉的选择。',
    text: '结合晴天的建筑阴影，寻找更舒适的步行路线。让去上课的路上，多一点凉意。',
    color: '#4c796a',
    path: 'M95 290 L95 205 L285 205 L285 105 L465 105',
    label: '偏好建筑阴影',
  },
  {
    name: '少淋一点',
    icon: CloudRain,
    title: '下雨的日子，\n借一段有顶的路。',
    text: '优先考虑可通行的室内空间与有顶连廊。雨天出门，给自己多一个选择。',
    color: '#687995',
    path: 'M95 290 L190 290 L190 340 L380 340 L380 105 L465 105',
    label: '偏好有顶通道',
  },
  {
    name: '顺畅一点',
    icon: Accessibility,
    title: '绕开台阶，\n让每一步更顺畅。',
    text: '根据已标注的坡道与通道规划无障碍路线，避开楼梯，让校园出行更从容。',
    color: '#98754f',
    path: 'M95 290 L95 105 L465 105',
    label: '无障碍路线',
  },
];

function Mark({ className = '' }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/icon.png"
      width={34}
      height={34}
      alt=""
      aria-hidden="true"
    />
  );
}

function Reveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${s.reveal} ${className}`} data-reveal>
      {children}
    </div>
  );
}

function Phone() {
  return (
    <div className={s.phone} aria-label="校园地图与导航界面示意">
      <div className={s.phoneScreen}>
        <Image
          src="/map.jpg"
          alt="南京理工大学江阴校区导览图"
          fill
          priority
          sizes="340px"
          className={s.phoneMap}
        />
        <div className={s.phoneStatus}>
          <span>9:41</span>
          <span className={s.island} />
          <span>▮▮▮ ▰</span>
        </div>
        <div className={s.phoneSearch}>
          <Search size={17} />
          <span>搜索校园地点</span>
        </div>
        <svg
          viewBox="0 0 300 570"
          className={s.phoneRoute}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M263 228 215 238 188 218 122 218 122 256 147 256 147 301 120 301"
            stroke="white"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <path
            className={s.drawPath}
            d="M263 228 215 238 188 218 122 218 122 256 147 256 147 301 120 301"
            stroke="#3475ba"
            strokeWidth="6"
            strokeLinejoin="round"
            pathLength="1"
          />
          <circle
            cx="120"
            cy="301"
            r="8"
            fill="#3475ba"
            stroke="white"
            strokeWidth="4"
          />
        </svg>
        <div className={s.phoneDestination}>
          <div>
            <strong>图书馆</strong>
            <Navigation size={20} />
          </div>
          <p>校园里的下一站。</p>
          <span>
            开始导航 <ArrowRight size={15} />
          </span>
        </div>
        <div className={s.phoneTabs}>
          <span>
            <Compass size={17} />
            地图
          </span>
          <span>
            <CalendarDays size={17} />
            课表
          </span>
          <span>
            <Check size={17} />
            日程
          </span>
          <span>
            <Smartphone size={17} />
            我的
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [routeMode, setRouteMode] = useState(0);
  const [day, setDay] = useState(0);
  const route = routeModes[routeMode];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-visible', 'true');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    element.querySelectorAll('[data-reveal]').forEach((item) => {
      // Keep initial content visible, including when JS is unavailable.
      if (
        item.getBoundingClientRect().top > window.innerHeight &&
        !media.matches
      ) {
        item.setAttribute('data-pending', 'true');
      }
      observer.observe(item);
    });
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      element.style.setProperty(
        '--read-progress',
        `${max > 0 ? window.scrollY / max : 0}`,
      );
      element.style.setProperty(
        '--hero-shift',
        `${media.matches ? 0 : Math.min(window.scrollY * 0.12, 85)}px`,
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className={s.site} ref={root} id="top">
      <a href="#main" className={s.skip}>
        跳到主要内容
      </a>
      <header className={s.header}>
        <nav className={s.nav} aria-label="官网导航">
          <a className={s.brand} href="#top">
            <Mark />
            <span>南梨有梨</span>
          </a>
          <div className={s.navLinks}>
            <a href="#explore">探索</a>
            <a href="#everyday">校园日常</a>
            <a href="#download">下载 App</a>
          </div>
          <a className={s.navCta} href="/app">
            打开 Web 版 <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className={s.progress} />
      </header>

      <main id="main">
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.heroCopy}>
            <div className={s.eyebrow}>
              <span className={s.statusDot} /> 为南京理工大学 · 江阴校区
            </div>
            <h1 id="hero-title">
              把校园，
              <br />
              装进口袋<span className={s.titleDot}>。</span>
            </h1>
            <p className={s.heroDescription}>
              从第一次找路，到每一天的熟悉。
              <br />
              地图、课表、日程，一起随身出发。
            </p>
            <div className={s.actions}>
              <a className={s.primary} href="#download">
                获取南梨有梨 <ArrowDownToLine size={17} />
              </a>
              <a className={s.textLink} href="/app">
                直接使用 Web 版 <ArrowUpRight size={17} />
              </a>
            </div>
            <div className={s.availability}>
              <span>Android 已可下载</span>
              <i />
              iOS 正在开发中
            </div>
          </div>
          <div className={s.heroVisual}>
            <div className={s.heroOrbit} />
            <div className={s.heroOrbitInner} />
            <div className={s.heroPin}>
              <Mark />
            </div>
            <Phone />
            <div className={`${s.floatingNote} ${s.libraryNote}`}>
              <span className={s.noteIcon}>
                <MapPin size={21} />
              </span>
              <div>
                <small>下一站</small>
                <strong>图书馆</strong>
              </div>
              <ArrowUpRight size={19} />
            </div>
            <div className={`${s.floatingNote} ${s.courseNote}`}>
              <span className={s.courseDot} />
              <span>下一节课，也有方向。</span>
            </div>
            <span className={s.visualCaption}>整座校园。随身展开。</span>
          </div>
          <a className={s.scrollCue} href="#explore">
            <span>向下滚动，展开校园</span>
            <ArrowDown size={15} />
          </a>
          <span className={s.heroIndex}>01 / 一起出发</span>
        </section>

        <section
          id="explore"
          className={`${s.section} ${s.explore}`}
          aria-labelledby="explore-title"
        >
          <Reveal className={s.sectionIntro}>
            <span className={s.eyebrow}>01 — 校园，在手边</span>
            <h2 id="explore-title">
              初来乍到，
              <br />
              <span>也能轻车熟路。</span>
            </h2>
            <p>
              教室、食堂、图书馆，还有散步时想去的地方。
              <br />
              搜一搜，点一下，让陌生变熟悉。
            </p>
          </Reveal>
          <Reveal className={s.mapPanel}>
            <div className={s.mapPaper}>
              <Image
                src="/map.jpg"
                alt="江阴校区全景导览地图，包含教学楼、图书馆、食堂和宿舍"
                fill
                sizes="(max-width: 700px) 100vw, 1100px"
                className={s.campusMap}
              />
            </div>
            <div className={s.mapSearch}>
              <Search size={20} />
              <span>今天，想去哪里？</span>
              <span className={s.searchHint}>探索校园</span>
            </div>
            <a className={`${s.placePin} ${s.pinLibrary}`} href="/app">
              <MapPin size={18} />
              <span>图书馆</span>
              <ChevronRight size={14} />
            </a>
            <a className={`${s.placePin} ${s.pinFood}`} href="/app">
              <MapPin size={18} />
              <span>食堂</span>
              <ChevronRight size={14} />
            </a>
            <div className={s.mapBottom}>
              <span>
                <span className={s.statusDot} /> 南京理工大学 · 江阴校区
              </span>
              <a href="/app">
                展开你的地图 <ArrowUpRight size={16} />
              </a>
            </div>
          </Reveal>
        </section>

        <section
          className={`${s.section} ${s.routes}`}
          aria-labelledby="route-title"
        >
          <Reveal className={s.routeHeading}>
            <span className={s.eyebrow}>02 — 每一步，都有选择</span>
            <h2 id="route-title">
              不止一条路。
              <br />
              <span>选适合你的那条。</span>
            </h2>
          </Reveal>
          <Reveal className={s.routeLayout}>
            <div className={s.routeCopy}>
              <div className={s.routeOptions} aria-label="路线偏好示例">
                {routeModes.map((item, index) => (
                  <button
                    type="button"
                    key={item.name}
                    aria-pressed={routeMode === index}
                    onClick={() => setRouteMode(index)}
                    className={routeMode === index ? s.selected : ''}
                  >
                    <item.icon size={17} />
                    {item.name}
                  </button>
                ))}
              </div>
              <div className={s.routeText} key={route.name}>
                <h3>{route.title}</h3>
                <p>{route.text}</p>
              </div>
              <a className={s.textLink} href="/app">
                规划我的路线 <ArrowUpRight size={17} />
              </a>
            </div>
            <div
              className={s.routeArt}
              style={{ '--route-color': route.color } as React.CSSProperties}
            >
              <div className={s.routeArtLabel}>
                <route.icon size={18} />
                {route.label}
                <span>路线示意</span>
              </div>
              <svg
                viewBox="0 0 560 420"
                fill="none"

                aria-label={`${route.name}路线原理示意`}
              >
                <path
                  d="M35 105H530M35 205H530M35 290H530M35 340H530M95 65V385M190 65V385M285 65V385M380 65V385M465 65V385"
                  stroke="#e4e6e3"
                  strokeWidth="19"
                  strokeLinejoin="round"
                />
                <g fill="#c8dace">
                  <rect x="118" y="130" width="49" height="50" rx="6" />
                  <rect x="217" y="226" width="43" height="40" rx="6" />
                  <rect x="404" y="223" width="39" height="44" rx="6" />
                </g>
                <g fill="#d5d8d3">
                  <rect x="216" y="129" width="45" height="51" rx="4" />
                  <rect x="311" y="125" width="44" height="56" rx="4" />
                  <rect x="310" y="224" width="43" height="43" rx="4" />
                </g>
                <g fill="#b5c0b7">
                  <path d="m216 129 10-9h45l-10 9Z" />
                  <path d="m261 129 10-9v51l-10 9Z" />
                  <path d="m311 125 10-9h44l-10 9Z" />
                  <path d="m355 125 10-9v56l-10 9Z" />
                </g>
                {routeMode === 1 && (
                  <path
                    d="M217 180h55l25 30h-60ZM311 181h52l25 30h-57Z"
                    fill="#809b85"
                    opacity=".3"
                  />
                )}
                {routeMode === 2 && (
                  <path d="M178 318h214v38H178z" fill="#b7c9db" opacity=".65" />
                )}
                <path
                  d={route.path}
                  stroke="white"
                  strokeWidth="13"
                  strokeLinejoin="round"
                />
                <path
                  key={route.name}
                  className={s.routeLine}
                  d={route.path}
                  stroke={route.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                />
                <circle
                  cx="95"
                  cy="290"
                  r="10"
                  fill={route.color}
                  stroke="white"
                  strokeWidth="4"
                />
                <circle
                  cx="465"
                  cy="105"
                  r="11"
                  fill="white"
                  stroke={route.color}
                  strokeWidth="5"
                />
                <g fill="#606b64" fontSize="14">
                  <text x="69" y="321">
                    出发地
                  </text>
                  <text x="443" y="80">
                    目的地
                  </text>
                </g>
              </svg>
              <div className={s.routeFootnote}>少一点摸索，多一点从容。</div>
            </div>
          </Reveal>
          <p className={s.fineprint}>
            路线为原理示意。阴影偏好在晴天且天气可用时参与规划；通道开放及无障碍条件请以现场情况为准。
          </p>
        </section>

        <section
          id="everyday"
          className={`${s.section} ${s.everyday}`}
          aria-labelledby="day-title"
        >
          <Reveal className={s.dayCopy}>
            <span className={s.eyebrow}>03 — 从课表，到下一站</span>
            <h2 id="day-title">
              今天的安排，
              <br />
              <span>一眼就明白。</span>
            </h2>
            <p>
              导入课表，按周查看，按天展开。
              <br />
              从早到晚的 13 小节，连同课间的留白，
              <br />
              都清清楚楚。
            </p>
            <a className={s.textLink} href="/app">
              打开我的校园日常 <ArrowUpRight size={17} />
            </a>
            <div className={s.dayDetails}>
              <span>
                <Check size={16} /> 教务课表导入
              </span>
              <span>
                <Check size={16} /> 课程地点导航
              </span>
              <span>
                <Check size={16} /> 每日行程安排
              </span>
            </div>
          </Reveal>
          <Reveal className={s.schedule}>
            <div className={s.scheduleHeader}>
              <div>
                <span>我的课表</span>
                <h3>新的一周，有条不紊。</h3>
              </div>
              <CalendarDays size={25} />
            </div>
            <div className={s.scheduleWeek}>
              <strong>第 4 周</strong>
              <span>9 月 14 日 — 20 日</span>
              <small>示例课表</small>
            </div>
            <div className={s.weekdays} aria-label="查看示例课表日期">
              {['一', '二', '三', '四', '五', '六', '日'].map(
                (label, index) => (
                  <button
                    type="button"
                    aria-pressed={day === index}
                    key={label}
                    onClick={() => setDay(index)}
                    className={day === index ? s.activeDay : ''}
                  >
                    <span>{label}</span>
                    <strong>{14 + index}</strong>
                    <i />
                  </button>
                ),
              )}
            </div>
            <div className={s.lessons} key={day}>
              {day < 5 ? (
                <>
                  <div className={s.lesson}>
                    <time>
                      08:00<span>10:25</span>
                    </time>
                    <div className={s.blueLesson}>
                      <small>第 1 — 3 节</small>
                      <strong>{day % 2 ? '大学英语' : '高等数学'}</strong>
                      <span>
                        {day % 2 ? '格物楼 A' : '致远楼 A'}{' '}
                        <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </div>
                  <div className={s.break}>
                    <span>10:45</span>
                    <span>课间留白，也是一种安排。</span>
                  </div>
                  <div className={s.lesson}>
                    <time>
                      14:00<span>15:35</span>
                    </time>
                    <div className={s.greenLesson}>
                      <small>第 6 — 7 节</small>
                      <strong>{day % 2 ? '大学物理' : '线性代数'}</strong>
                      <span>
                        致远楼 C <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className={s.freeDay}>
                  <Sun size={38} />
                  <strong>把今天，留给自己。</strong>
                  <span>示例课表中，这一天没有课程。</span>
                  <a href="/app">
                    去校园走走 <ArrowUpRight size={16} />
                  </a>
                </div>
              )}
            </div>
          </Reveal>
        </section>

        <section className={s.together} aria-labelledby="together-title">
          <Reveal className={s.togetherIntro}>
            <span className={s.eyebrow}>一张地图，连接校园日常</span>
            <h2 id="together-title">
              去哪儿。做什么。
              <br />
              <span>都在一起。</span>
            </h2>
            <p>地图、课表与日程，在南梨有梨自然相连。</p>
          </Reveal>
          <Reveal className={s.togetherImage}>
            <Image
              src="/site/together.png"
              alt="南梨有梨宣传片中的地图、课表、日程三屏界面示意"
              width={1920}
              height={1080}
              sizes="(max-width: 700px) 100vw, 1100px"
            />
          </Reveal>
          <span className={s.togetherNote}>
            界面与课程为功能演示，实际内容以使用时为准。
          </span>
        </section>

        <section
          id="download"
          className={`${s.section} ${s.download}`}
          aria-labelledby="download-title"
        >
          <Reveal className={s.downloadIntro}>
            <Mark className={s.downloadMark} />
            <span className={s.eyebrow}>南梨有梨 · 为校园里的每一天</span>
            <h2 id="download-title">
              下一站，<span>从这里出发。</span>
            </h2>
            <p>下载到手机，或直接在浏览器中打开。</p>
          </Reveal>
          <Reveal className={s.downloadCards}>
            <a
              href="/api/updates?download=android"
              download="南梨有梨-Android.apk"
              className={`${s.downloadCard} ${s.androidCard}`}
            >
              <Smartphone size={30} strokeWidth={1.5} />
              <span className={s.platform}>Android</span>
              <span className={s.platformDesc}>让校园，一直在手边。</span>
              <span className={s.downloadAction}>
                下载 Android <ArrowDownToLine size={18} />
              </span>
              <small>APK · 38 MB · 测试版</small>
            </a>
            <div className={`${s.downloadCard} ${s.iosCard}`}>
              <svg
                width="30"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.1 12.4c0-2 1.6-3 1.7-3.1-1-1.5-2.5-1.7-3-1.7-1.3-.2-2.5.8-3.2.8-.6 0-1.6-.8-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2 2.6 1.9 1 0 1.4-.6 2.7-.6 1.2 0 1.6.6 2.7.6s1.8-1 2.5-2c.8-1.2 1.1-2.3 1.1-2.4-.1 0-2-.8-2-3.2ZM15 6.3c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.6-1.2Z" />
              </svg>
              <span className={s.platform}>iOS</span>
              <span className={s.platformDesc}>更多相遇，值得期待。</span>
              <span className={s.developing}>
                正在开发中 <span className={s.statusDot} />
              </span>
              <small>iPhone 用户可先使用 Web 版</small>
            </div>
            <a href="/app" className={s.downloadCard}>
              <Globe2 size={30} strokeWidth={1.5} />
              <span className={s.platform}>Web</span>
              <span className={s.platformDesc}>无需安装，即刻出发。</span>
              <span className={s.downloadAction}>
                打开 Web 版 <ArrowUpRight size={19} />
              </span>
              <small>手机、平板与电脑浏览器</small>
            </a>
          </Reveal>
        </section>
      </main>
      <footer className={s.footer}>
        <a className={s.brand} href="#top">
          <Mark />
          <span>南梨有梨</span>
        </a>
        <span>少一点摸索，多一点从容。</span>
        <div>
          <span>为南京理工大学江阴校区打造</span>
          <a href="/editor">
            地图编辑器 <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
}
