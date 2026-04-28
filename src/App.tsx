import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

import { HexagramGlyph } from "./components/HexagramGlyph";
import { buildDailySnapshot } from "./shared/daily";
import {
  ensureCurrentProfileStorageSchema,
  getStoredHistoryV3,
  getStoredProfileV3,
  isDailyModalSeen,
  markDailyModalSeen,
  saveStoredProfileV3,
  upsertStoredHistoryEntry
} from "./shared/storage-v3";
import { formatDateTime, getNextShanghaiMidnightIso } from "./shared/time";
import type {
  BirthHourBranch,
  DailySnapshot,
  Gender,
  HistoryEntryV3,
  StoredUserProfileV3
} from "./types";

type AppRoute = "/" | "/role";

const FITNESS_MEDIA = [
  {
    id: "health-2",
    title: "办公室拉伸",
    src: "/health/health-2.webm",
    poster: "/health/health-2-poster.webp"
  },
  {
    id: "health-3",
    title: "肩颈放松",
    src: "/health/health-3.webm",
    poster: "/health/health-3-poster.webp"
  },
  {
    id: "health-4",
    title: "下肢唤醒",
    src: "/health/health-4.webm",
    poster: "/health/health-4-poster.webp"
  }
] as const;

const BODY_RHYTHM_URL = "https://life-curve-deploy.vercel.app/";

const PROFILE_AVATAR_MEDIA: Record<Gender, { src: string; poster: string; label: string }> = {
  male: {
    src: "/roles/role_a.webm",
    poster: "/roles/role_a-poster.webp",
    label: "男生资料头像"
  },
  female: {
    src: "/roles/role_b.webm",
    poster: "/roles/role_b-poster.webp",
    label: "女生资料头像"
  }
};

const BIRTH_HOUR_OPTIONS: Array<{ value: BirthHourBranch; label: string }> = [
  { value: "zi", label: "子时 23:00-00:59" },
  { value: "chou", label: "丑时 01:00-02:59" },
  { value: "yin", label: "寅时 03:00-04:59" },
  { value: "mao", label: "卯时 05:00-06:59" },
  { value: "chen", label: "辰时 07:00-08:59" },
  { value: "si", label: "巳时 09:00-10:59" },
  { value: "wu", label: "午时 11:00-12:59" },
  { value: "wei", label: "未时 13:00-14:59" },
  { value: "shen", label: "申时 15:00-16:59" },
  { value: "you", label: "酉时 17:00-18:59" },
  { value: "xu", label: "戌时 19:00-20:59" },
  { value: "hai", label: "亥时 21:00-22:59" }
];

function readRoutePath(): AppRoute {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname === "/role" ? "/role" : "/";
}

const pageVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
};

const easeOutCurve = [0.22, 1, 0.36, 1] as const;

const staggerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04
    }
  }
};

const revealVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: easeOutCurve }
  }
};

const modalStaggerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.08
    }
  }
};

const modalRevealVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easeOutCurve }
  }
};

export default function App() {
  const [routePath, setRoutePath] = useState<AppRoute>(() => readRoutePath());
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StoredUserProfileV3 | null>(null);
  const [homeRevealKey, setHomeRevealKey] = useState(0);
  const [history, setHistory] = useState<HistoryEntryV3[]>([]);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHexagramOpen, setIsHexagramOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  function navigateToRoute(path: AppRoute, mode: "push" | "replace" = "push") {
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      const method = mode === "replace" ? "replaceState" : "pushState";
      window.history[method]({}, "", path);
    }

    setRoutePath(path);
  }

  useEffect(() => {
    ensureCurrentProfileStorageSchema();
    setProfile(getStoredProfileV3());
    const nextHistory = getStoredHistoryV3();
    setHistory(nextHistory);
    setSelectedHistoryId(nextHistory[0]?.id ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedPath = readRoutePath();
    if (window.location.pathname !== normalizedPath) {
      window.history.replaceState({}, "", normalizedPath);
    }

    function handlePopState() {
      setRoutePath(readRoutePath());
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (ready && !profile && routePath === "/") {
      navigateToRoute("/role", "replace");
    }
  }, [profile, ready, routePath]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextMidnight = Date.parse(getNextShanghaiMidnightIso(nowTimestamp));
    const delay = Math.max(1000, nextMidnight - Date.now() + 1000);
    const timer = window.setTimeout(() => {
      setNowTimestamp(Date.now());
    }, delay);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        setNowTimestamp(Date.now());
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [nowTimestamp]);

  useEffect(() => {
    if (!profile) {
      setSnapshot(null);
      setIsHexagramOpen(false);
      return;
    }

    const nextSnapshot = buildDailySnapshot(profile, nowTimestamp);
    const nextHistory = upsertStoredHistoryEntry(nextSnapshot);
    const modalKey = `${nextSnapshot.profileHash}:${nextSnapshot.dateKey}`;

    setSnapshot(nextSnapshot);
    setHistory(nextHistory);
    setHomeRevealKey((value) => value + 1);
    setSelectedHistoryId((current) =>
      current && nextHistory.some((entry) => entry.id === current)
        ? current
        : nextSnapshot.id
    );
    setIsHexagramOpen(!isDailyModalSeen(modalKey));
  }, [nowTimestamp, profile]);

  function handleSaveProfile(nextProfile: StoredUserProfileV3) {
    saveStoredProfileV3(nextProfile);
    setIsHistoryOpen(false);
    setIsHexagramOpen(false);
    setProfile(nextProfile);
    setNowTimestamp(Date.now());
    navigateToRoute("/", "push");
  }

  function handleCloseHexagram() {
    if (snapshot) {
      markDailyModalSeen(`${snapshot.profileHash}:${snapshot.dateKey}`);
    }

    setIsHexagramOpen(false);
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-[color:var(--color-muted)]">
        正在展开今日纸面…
      </div>
    );
  }

  const selectedHistory =
    history.find((entry) => entry.id === selectedHistoryId) ?? history[0] ?? null;
  const isProfilePage = routePath === "/role" || !profile || !snapshot;

  return (
    <div className={`relative min-h-dvh overflow-x-hidden px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 ${isProfilePage ? "app-shell--role" : ""}`}>
      <div className="paper-wash paper-wash--one" aria-hidden="true" />
      <div className="paper-wash paper-wash--two" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-7xl flex-col">
        {isProfilePage ? (
          <ProfilePage
            currentProfile={profile}
            onGoHome={() => navigateToRoute("/", "push")}
            onSaveProfile={handleSaveProfile}
          />
        ) : profile && snapshot ? (
          <>
            <Header
              calendarLabel={snapshot.calendar.dateKey.replaceAll("-", ".")}
              historyCount={history.length}
              onOpenHistory={() => setIsHistoryOpen(true)}
              onOpenRolePage={() => navigateToRoute("/role", "push")}
              solarTermName={snapshot.calendar.solarTermName}
            />

            <motion.main
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1"
            >
              <Dashboard
                homeRevealKey={homeRevealKey}
                profile={profile}
                snapshot={snapshot}
                onOpenRolePage={() => navigateToRoute("/role", "push")}
                onReopenHexagram={() => setIsHexagramOpen(true)}
              />
            </motion.main>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {routePath === "/" && snapshot && isHexagramOpen ? (
          <HexagramModal
            key={`modal-${snapshot.id}`}
            snapshot={snapshot}
            onClose={handleCloseHexagram}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {routePath === "/" && isHistoryOpen ? (
          <HistoryDrawer
            history={history}
            selectedEntry={selectedHistory}
            selectedId={selectedHistoryId}
            onClose={() => setIsHistoryOpen(false)}
            onSelect={setSelectedHistoryId}
          />
        ) : null}
      </AnimatePresence>

      <footer className="mx-auto mt-8 w-full max-w-7xl text-center text-xs leading-6 text-[color:var(--color-muted)]">
        今日内容只提供轻量生活方式建议，不构成医学判断。
      </footer>
    </div>
  );
}

function Header(props: {
  historyCount: number;
  solarTermName: string;
  calendarLabel: string;
  onOpenHistory: () => void;
  onOpenRolePage: () => void;
}) {
  function handleSectionNav(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    event.preventDefault();

    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState({}, "", `#${sectionId}`);
  }

  return (
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
          One Day One Secret
        </p>
        <nav className="app-nav" aria-label="首页模块">
          <a
            className="app-nav__link app-nav__link--active"
            href="#daily-wellness"
            onClick={(event) => handleSectionNav(event, "daily-wellness")}
          >
            今日养生
          </a>
          <a
            className="app-nav__link"
            href={BODY_RHYTHM_URL}
            rel="noreferrer"
            target="_blank"
          >
            身体节律
            <span className="app-nav__external-mark" aria-hidden="true">↗</span>
          </a>
        </nav>
        <h1 className="serif-title mt-3 text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[0.03em]">
          今日养生
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)] sm:text-[15px]">
          每天按节气、卦象与当前状态，整理一页可执行的动作、穴位、饮食和节律提醒。
        </p>
      </div>

      <div className="toolstrip">
        <ToolChip>{props.solarTermName}</ToolChip>
        <ToolChip>{props.calendarLabel}</ToolChip>
        <button className="tool-button" onClick={props.onOpenRolePage} type="button">
          修改资料
        </button>
        <button className="tool-button" onClick={props.onOpenHistory} type="button">
          历史快照 {props.historyCount > 0 ? `(${props.historyCount})` : ""}
        </button>
      </div>
    </header>
  );
}

function createProfileFormState(profile: StoredUserProfileV3 | null) {
  return {
    gender: profile?.gender ?? "",
    birthDate: profile?.birthDate ?? "",
    birthHourBranch: profile?.birthHourBranch ?? "",
    birthPlace: profile?.birthPlace ?? "",
    currentPlace: profile?.currentPlace ?? ""
  };
}

function isProfileFormValid(form: ReturnType<typeof createProfileFormState>) {
  return (
    (form.gender === "male" || form.gender === "female") &&
    Boolean(normalizeBirthDateInput(form.birthDate)) &&
    form.birthPlace.trim().length > 0 &&
    form.currentPlace.trim().length > 0
  );
}

function padDatePart(value: string): string {
  return value.padStart(2, "0");
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeBirthDateInput(value: string): string | null {
  const trimmed = value.trim();
  const compactMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  const ymdMatch = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(trimmed);
  const dmyMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  const match = ymdMatch ?? compactMatch;

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return isRealCalendarDate(year, month, day)
      ? `${year}-${padDatePart(String(month))}-${padDatePart(String(day))}`
      : null;
  }

  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    return isRealCalendarDate(year, month, day)
      ? `${year}-${padDatePart(String(month))}-${padDatePart(String(day))}`
      : null;
  }

  return null;
}

function ProfilePage(props: {
  currentProfile: StoredUserProfileV3 | null;
  onGoHome: () => void;
  onSaveProfile: (profile: StoredUserProfileV3) => void;
}) {
  const [form, setForm] = useState(() => createProfileFormState(props.currentProfile));
  const isValid = isProfileFormValid(form);

  useEffect(() => {
    setForm(createProfileFormState(props.currentProfile));
  }, [props.currentProfile]);

  function updateForm<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedBirthDate = normalizeBirthDateInput(form.birthDate);
    if (!isValid || !normalizedBirthDate) {
      return;
    }

    const timestamp = new Date().toISOString();
    props.onSaveProfile({
      gender: form.gender as Gender,
      birthDate: normalizedBirthDate,
      birthHourBranch: form.birthHourBranch ? (form.birthHourBranch as BirthHourBranch) : null,
      birthPlace: form.birthPlace.trim(),
      currentPlace: form.currentPlace.trim(),
      createdAt: props.currentProfile?.createdAt ?? timestamp,
      updatedAt: timestamp,
      version: 1
    });
  }

  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="role-page flex flex-1 flex-col"
    >
      <div className="profile-page__content">
        <motion.div variants={revealVariants} initial="hidden" animate="show" className="profile-page__theme">
          <span className="profile-page__brand">Cyber Wellness</span>
          <h1 className="serif-title profile-page__theme-title">赛博养生</h1>
          <p>
            以出生信息、所在城市与今日节气，生成一页本地黄历和轻养生节律。
          </p>
          {props.currentProfile ? (
            <button className="ghost-button ghost-button--small profile-page__home-link" onClick={props.onGoHome} type="button">
              返回今日
            </button>
          ) : null}
        </motion.div>

        <motion.form
          variants={staggerVariants}
          initial="hidden"
          animate="show"
          className="paper-panel profile-form"
          onSubmit={handleSubmit}
        >
          <motion.div variants={revealVariants} className="profile-form__intro">
            <span className="profile-form__eyebrow">本地生成</span>
            <h1 className="serif-title profile-form__title">生成你的今日黄历</h1>
            <p>
              资料只保存在当前浏览器，用来生成当天宜忌、状态提示和轻养生建议。
            </p>
          </motion.div>

          <motion.div variants={revealVariants} className="profile-form__grid">
            <fieldset className="profile-field profile-field--wide">
              <legend>性别</legend>
              <div className="profile-segment">
                {[
                  ["male", "男"],
                  ["female", "女"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`profile-segment__button ${form.gender === value ? "profile-segment__button--active" : ""}`}
                    onClick={() => updateForm("gender", value as Gender)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="profile-field">
              <span>出生日期</span>
              <input
                required
                autoComplete="bday"
                inputMode="numeric"
                placeholder="YYYY-MM-DD"
                type="text"
                value={form.birthDate}
                onBlur={() => {
                  const normalized = normalizeBirthDateInput(form.birthDate);
                  if (normalized) {
                    updateForm("birthDate", normalized);
                  }
                }}
                onChange={(event) => updateForm("birthDate", event.target.value)}
              />
            </label>

            <label className="profile-field">
              <span>出生时辰</span>
              <select
                value={form.birthHourBranch}
                onChange={(event) => updateForm("birthHourBranch", event.target.value as BirthHourBranch | "")}
              >
                <option value="">不确定</option>
                {BIRTH_HOUR_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="profile-field">
              <span>出生地</span>
              <input
                required
                placeholder="例如：杭州"
                type="text"
                value={form.birthPlace}
                onChange={(event) => updateForm("birthPlace", event.target.value)}
              />
            </label>

            <label className="profile-field">
              <span>当前所在地</span>
              <input
                required
                placeholder="例如：上海"
                type="text"
                value={form.currentPlace}
                onChange={(event) => updateForm("currentPlace", event.target.value)}
              />
            </label>
          </motion.div>

          <motion.div variants={revealVariants} className="profile-form__footer">
            <p>不请求定位，不上传资料；未填出生时辰时会按日期与所在地估算。</p>
            <button className="seal-button profile-form__submit" disabled={!isValid} type="submit">
              生成今日内容
            </button>
          </motion.div>
        </motion.form>
      </div>
    </motion.main>
  );
}

function Dashboard(props: {
  homeRevealKey: number;
  profile: StoredUserProfileV3;
  snapshot: DailySnapshot;
  onOpenRolePage: () => void;
  onReopenHexagram: () => void;
}) {
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);

  useEffect(() => {
    setIsMobileProfileOpen(false);
  }, [props.snapshot.profileHash]);

  return (
    <div className="dashboard-shell">
      <div className="hero-layout">
        <AnimatePresence mode="wait">
          <motion.section
            id="daily-wellness"
            key={`hero-${props.snapshot.id}-${props.homeRevealKey}`}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.34, ease: "easeOut" }}
            className="paper-panel hero-card"
          >
            <div className="hero-card__topline">
              <div className="hero-card__eyebrow">
                <span className="hero-card__dot" />
                今日黄历
              </div>
              <button className="ghost-button ghost-button--small" onClick={props.onReopenHexagram} type="button">
                查看卦象
              </button>
            </div>

            <div className="hero-card__grid">
              <div className="hero-card__altar">
                <div className="hero-card__altar-mark">第 {props.snapshot.hexagram.index} 卦</div>
                <HexagramGlyph
                  animated
                  emphasis="hero"
                  lines={props.snapshot.hexagram.lines}
                  className="mx-auto max-w-[240px]"
                  staggerMs={90}
                />
                <div className="hero-card__altar-copy">
                  <span className="hero-card__hexagram-name">{props.snapshot.hexagram.name}</span>
                  <span className="hero-card__sealline">{props.snapshot.hexagram.image}</span>
                  <span className="hero-card__subseal">{buildHeroSubline(props.snapshot)}</span>
                </div>
              </div>

              <motion.div
                variants={staggerVariants}
                initial="hidden"
                animate="show"
                className="hero-card__content"
              >
                <motion.p variants={modalRevealVariants} className="hero-card__kicker">
                  {props.snapshot.almanac.statusTitle}
                </motion.p>
                <motion.h2 variants={modalRevealVariants} className="serif-title hero-card__title">
                  今日状态提示
                </motion.h2>
                <motion.p variants={modalRevealVariants} className="hero-card__headline">
                  {props.snapshot.almanac.statusSummary}
                </motion.p>
                <motion.p variants={modalRevealVariants} className="hero-card__summary">
                  {props.snapshot.birthTimeSummary}
                </motion.p>

                <motion.div variants={modalRevealVariants} className="hero-card__signals">
                  {props.snapshot.almanac.dos.map((item) => (
                    <SignalChip key={item} label={`宜 · ${item}`} tone="good" />
                  ))}
                  {props.snapshot.almanac.donts.slice(0, 1).map((item) => (
                    <SignalChip key={item} label={`忌 · ${item}`} tone="warn" />
                  ))}
                </motion.div>

                <motion.div variants={modalRevealVariants} className="hero-card__notes">
                  {props.snapshot.hexagram.advice.slice(0, 2).map((item) => (
                    <div key={item} className="hero-card__note hero-card__note--good">
                      <span className="hero-card__note-title">今日宜</span>
                      <p>{item}</p>
                    </div>
                  ))}
                  {props.snapshot.hexagram.cautions.slice(0, 1).map((item) => (
                    <div key={item} className="hero-card__note hero-card__note--warn">
                      <span className="hero-card__note-title">今日忌</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </motion.section>
        </AnimatePresence>

        <ProfileRail
          profile={props.profile}
          snapshot={props.snapshot}
          onOpenRolePage={props.onOpenRolePage}
          onReopenHexagram={props.onReopenHexagram}
        />
      </div>

      <ProfileMobileAccordion
        open={isMobileProfileOpen}
        profile={props.profile}
        snapshot={props.snapshot}
        onOpenRolePage={props.onOpenRolePage}
        onReopenHexagram={props.onReopenHexagram}
        onToggle={() => setIsMobileProfileOpen((value) => !value)}
      />

      <RhythmPanel snapshot={props.snapshot} />

      <motion.div
        key={`services-${props.snapshot.id}-${props.homeRevealKey}`}
        variants={staggerVariants}
        initial="hidden"
        animate="show"
        className="service-layout"
      >
        <motion.section variants={revealVariants} className="paper-panel service-card service-card--exercise">
          <ServiceHeader eyebrow="带薪健身" title={`${props.snapshot.exercises.length} 个轻动作`} />
          <div className="fitness-media-grid" aria-label="带薪健身动作演示">
            {FITNESS_MEDIA.map((item) => (
              <div key={item.id} className="fitness-media-card">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  poster={item.poster}
                  src={item.src}
                />
                <span>{item.title}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-4">
            {props.snapshot.exercises.map((item, index) => (
              <div key={item.id} className="exercise-item">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="exercise-item__order">动作 0{index + 1}</p>
                    <h3 className="serif-title mt-2 text-2xl">{item.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <ToolChip>{item.scene}</ToolChip>
                    <ToolChip>{item.duration}</ToolChip>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">{item.benefit}</p>
                <ol className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--color-muted)]">
                  {item.steps.map((step, stepIndex) => (
                    <li key={step} className="exercise-item__step">
                      <span className="exercise-item__step-index">{stepIndex + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
                  <span className="text-[color:var(--color-ink)]">注意：</span>
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        <div className="service-stack">
          <motion.section variants={revealVariants} className="paper-panel service-card service-card--small">
            <ServiceHeader eyebrow="每日穴位" title={props.snapshot.acupoint.name} />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[color:var(--color-muted)]">
              <InfoLine label="位置" value={props.snapshot.acupoint.location} />
              <InfoLine label="按法" value={props.snapshot.acupoint.method} />
              <div className="flex flex-wrap gap-2">
                <SignalChip label={`时长 · ${props.snapshot.acupoint.duration}`} tone="soft" />
                <SignalChip label="今天适合" tone="good" />
              </div>
              <p>{props.snapshot.acupoint.reason}</p>
            </div>
          </motion.section>

          <motion.section variants={revealVariants} className="paper-panel service-card service-card--small">
            <ServiceHeader eyebrow="节气食谱" title={props.snapshot.recipe.name} />
            <p className="mt-5 text-sm leading-7 text-[color:var(--color-muted)]">
              {props.snapshot.recipe.description}
            </p>
            <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
              <span className="text-[color:var(--color-ink)]">今天推荐原因：</span>
              {props.snapshot.recipe.benefit}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoBlock label="食材" values={props.snapshot.recipe.ingredients} compact />
              <InfoBlock label="做法" values={props.snapshot.recipe.steps} compact />
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

function getGenderLabel(gender: Gender): string {
  return gender === "male" ? "男" : "女";
}

function ProfileAvatar(props: { gender: Gender; className?: string }) {
  const media = PROFILE_AVATAR_MEDIA[props.gender];

  return (
    <span className={`profile-avatar profile-avatar--${props.gender} ${props.className ?? ""}`.trim()}>
      <video
        aria-label={media.label}
        autoPlay
        loop
        muted
        playsInline
        poster={media.poster}
        preload="metadata"
        src={media.src}
      />
    </span>
  );
}

function RhythmPanel(props: {
  snapshot: DailySnapshot;
}) {
  const rhythmItems = [
    {
      label: "节气",
      value: props.snapshot.calendar.solarTermName,
      copy: props.snapshot.seasonalSummary
    },
    {
      label: "主轴",
      value: props.snapshot.hexagram.theme,
      copy: props.snapshot.hexagram.headline
    },
    {
      label: "状态",
      value: props.snapshot.profileLabel,
      copy: props.snapshot.locationSummary
    }
  ];

  return (
    <motion.section
      id="body-rhythm"
      variants={revealVariants}
      initial="hidden"
      animate="show"
      className="paper-panel rhythm-card"
    >
      <div className="rhythm-card__heading">
        <ServiceHeader eyebrow="身体节律" title="今天的节奏线" compact />
        <ToolChip>{props.snapshot.calendar.ganZhiSummary}</ToolChip>
      </div>

      <div className="rhythm-card__grid">
        {rhythmItems.map((item) => (
          <div key={item.label} className="rhythm-card__item">
            <p className="rhythm-card__label">{item.label}</p>
            <h3 className="serif-title rhythm-card__value">{item.value}</h3>
            <p className="rhythm-card__copy">{item.copy}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function ProfileRail(props: {
  profile: StoredUserProfileV3;
  snapshot: DailySnapshot;
  onOpenRolePage: () => void;
  onReopenHexagram: () => void;
}) {
  return (
    <aside className="paper-panel role-rail">
      <div className="role-rail__header">
        <span className="role-rail__eyebrow">资料摘要</span>
        <ProfileAvatar gender={props.profile.gender} className="role-rail__avatar" />
      </div>

      <div>
        <h3 className="serif-title text-3xl">{props.snapshot.profileLabel}</h3>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
          {props.snapshot.profileDigest}
        </p>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">填写资料</p>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
          出生地：{props.profile.birthPlace}
          <br />
          当前所在地：{props.profile.currentPlace}
        </p>
        <button className="ghost-button role-rail__action" onClick={props.onOpenRolePage} type="button">
          修改资料
        </button>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">时辰说明</p>
        <p className="text-sm leading-7 text-[color:var(--color-muted)]">{props.snapshot.birthTimeSummary}</p>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">所在地提示</p>
        <p className="text-sm leading-7 text-[color:var(--color-muted)]">
          {props.snapshot.locationSummary}
        </p>
      </div>

      <button className="ghost-button" onClick={props.onReopenHexagram} type="button">
        查看卦象
      </button>
    </aside>
  );
}

function ProfileMobileAccordion(props: {
  profile: StoredUserProfileV3;
  snapshot: DailySnapshot;
  open: boolean;
  onToggle: () => void;
  onOpenRolePage: () => void;
  onReopenHexagram: () => void;
}) {
  return (
    <section className="paper-panel role-mobile-card lg:hidden">
      <button className="role-mobile-card__toggle" onClick={props.onToggle} type="button">
        <div className="flex items-center gap-3">
          <ProfileAvatar gender={props.profile.gender} className="role-mobile-card__avatar" />
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
              资料摘要
            </p>
            <p className="serif-title mt-1 text-2xl">{props.snapshot.profileLabel}</p>
          </div>
        </div>
        <span className="text-sm text-[color:var(--color-muted)]">
          {props.open ? "收起" : "展开"}
        </span>
      </button>

      <div className={`role-mobile-card__content ${props.open ? "role-mobile-card__content--open" : ""}`}>
        <div className="mt-5 grid gap-4">
          <p className="text-sm leading-7 text-[color:var(--color-muted)]">
            <span className="text-[color:var(--color-ink)]">出生信息：</span>
            {getGenderLabel(props.profile.gender)} · {props.profile.birthDate} · {props.profile.birthPlace}
          </p>
          <p className="text-sm leading-7 text-[color:var(--color-muted)]">
            <span className="text-[color:var(--color-ink)]">所在地：</span>
            {props.profile.currentPlace}
          </p>
          <p className="text-sm leading-7 text-[color:var(--color-muted)]">
            <span className="text-[color:var(--color-ink)]">时辰说明：</span>
            {props.snapshot.birthTimeSummary}
          </p>
          <button className="ghost-button" onClick={props.onOpenRolePage} type="button">
            修改资料
          </button>
          <button className="ghost-button" onClick={props.onReopenHexagram} type="button">
            查看卦象
          </button>
        </div>
      </div>
    </section>
  );
}

function HexagramModal(props: {
  snapshot: DailySnapshot;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
    >
      <motion.section
        className="paper-panel modal-panel ritual-sheet"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <motion.div
          variants={modalStaggerVariants}
          initial="hidden"
          animate="show"
          className="ritual-sheet__grid"
        >
          <motion.div variants={modalRevealVariants} className="ritual-sheet__altar">
            <span className="ritual-sheet__badge">今日纸签</span>
            <div className="ritual-sheet__glyph-shell">
              <HexagramGlyph
                animated
                emphasis="modal"
                lines={props.snapshot.hexagram.lines}
                className="mx-auto max-w-[260px]"
                staggerMs={110}
              />
            </div>
            <div className="ritual-sheet__caption">
              <span>{props.snapshot.hexagram.image}</span>
              <span>{buildHeroSubline(props.snapshot)}</span>
            </div>
          </motion.div>

          <div className="ritual-sheet__content">
            <motion.div variants={modalRevealVariants} className="flex items-start justify-between gap-4">
              <div>
                <p className="ritual-sheet__lead">{buildHeroKicker(props.snapshot)}</p>
                <h2 className="serif-title mt-3 text-[clamp(2.5rem,4vw,4.1rem)] leading-none">
                  {props.snapshot.hexagram.name}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
                  {props.snapshot.profileLabel} · {props.snapshot.calendar.solarTermName} ·{" "}
                  {props.snapshot.calendar.ganZhiSummary}
                </p>
              </div>
              <button className="ghost-button ghost-button--small" onClick={props.onClose} type="button">
                关闭
              </button>
            </motion.div>

            <motion.p variants={modalRevealVariants} className="ritual-sheet__headline">
              {props.snapshot.hexagram.headline}
            </motion.p>
            <motion.p variants={modalRevealVariants} className="ritual-sheet__summary">
              {props.snapshot.hexagram.guidance}
            </motion.p>

            <motion.div variants={modalRevealVariants} className="ritual-sheet__signals">
              {props.snapshot.hexagram.focusTags.slice(0, 3).map((item) => (
                <SignalChip key={item} label={`今日宜 · ${item}`} tone="good" />
              ))}
              {props.snapshot.hexagram.avoidTags.slice(0, 2).map((item) => (
                <SignalChip key={item} label={`今日少做 · ${item}`} tone="warn" />
              ))}
            </motion.div>

            <motion.div variants={modalRevealVariants} className="ritual-sheet__notes">
              {props.snapshot.hexagram.advice.map((item) => (
                <div key={item} className="hero-card__note hero-card__note--good">
                  <span className="hero-card__note-title">今日宜</span>
                  <p>{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={modalRevealVariants} className="mt-8 flex justify-end">
              <button className="seal-button" onClick={props.onClose} type="button">
                收下今日卦象
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}

function HistoryDrawer(props: {
  history: HistoryEntryV3[];
  selectedId: string | null;
  selectedEntry: HistoryEntryV3 | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.div
      className="modal-overlay modal-overlay--drawer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
    >
      <motion.aside
        className="drawer-shell"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="paper-scroll h-full overflow-y-auto">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
                History Archive
              </span>
              <h2 className="serif-title mt-3 text-[clamp(2rem,4vw,3rem)]">按日期回看</h2>
            </div>
            <button className="ghost-button ghost-button--small" onClick={props.onClose} type="button">
              关闭
            </button>
          </div>

          {props.history.length === 0 ? (
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              还没有历史快照。填写资料后，系统会自动保存每天的内容。
            </p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                {props.history.map((entry) => {
                  const selected = entry.id === props.selectedId;

                  return (
                    <button
                      key={entry.id}
                      className={`history-item ${selected ? "history-item--selected" : ""}`}
                      onClick={() => props.onSelect(entry.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[color:var(--color-muted)]">
                          {entry.dateKey.replaceAll("-", ".")}
                        </span>
                        <ToolChip>{entry.snapshot.profileLabel}</ToolChip>
                      </div>
                      <h3 className="serif-title mt-3 text-2xl">{entry.snapshot.hexagram.name}</h3>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                        {entry.snapshot.almanac.statusTitle}
                      </p>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {props.selectedEntry ? (
                  <HistoryPreview key={props.selectedEntry.id} entry={props.selectedEntry} />
                ) : null}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

function HistoryPreview(props: { entry: HistoryEntryV3 }) {
  const snapshot = props.entry.snapshot;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="space-y-4"
    >
      <section className="history-preview-card">
        <div className="flex flex-wrap items-center gap-3">
          <ToolChip>{snapshot.profileLabel}</ToolChip>
          <ToolChip>{snapshot.calendar.solarTermName}</ToolChip>
          <ToolChip>{formatDateTime(props.entry.savedAt)}</ToolChip>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="history-preview-card__glyph">
            <HexagramGlyph
              animated
              emphasis="default"
              lines={snapshot.hexagram.lines}
              compact
              className="max-w-[140px]"
            />
          </div>
          <div>
            <h3 className="serif-title text-3xl">{snapshot.hexagram.name}</h3>
            <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
              {snapshot.hexagram.guidance}
            </p>
          </div>
        </div>
      </section>

      <section className="history-preview-card">
        <ServiceHeader eyebrow="带薪健身" title="当天动作" compact />
        <div className="mt-4 space-y-2 text-sm leading-7 text-[color:var(--color-muted)]">
          {snapshot.exercises.map((item) => (
            <p key={item.id}>
              {item.name} · {item.duration}
            </p>
          ))}
        </div>
      </section>

      <section className="history-preview-card">
        <ServiceHeader eyebrow="每日穴位" title={snapshot.acupoint.name} compact />
        <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
          {snapshot.acupoint.duration} · {snapshot.acupoint.reason}
        </p>
      </section>

      <section className="history-preview-card">
        <ServiceHeader eyebrow="节气食谱" title={snapshot.recipe.name} compact />
        <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
          {snapshot.recipe.description}
        </p>
      </section>
    </motion.div>
  );
}

function ServiceHeader(props: { eyebrow: string; title: string; compact?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--color-muted)]">
        {props.eyebrow}
      </p>
      <h2 className={`serif-title mt-3 ${props.compact ? "text-2xl" : "text-[clamp(2rem,3vw,3rem)]"}`}>
        {props.title}
      </h2>
    </div>
  );
}

function InfoLine(props: { label: string; value: string }) {
  return (
    <p>
      <span className="text-[color:var(--color-ink)]">{props.label}：</span>
      {props.value}
    </p>
  );
}

function ToolChip(props: { children: ReactNode }) {
  return <span className="tool-chip">{props.children}</span>;
}

function SignalChip(props: {
  label: string;
  tone: "good" | "warn" | "soft";
}) {
  const className =
    props.tone === "good"
      ? "signal-chip signal-chip--good"
      : props.tone === "warn"
        ? "signal-chip signal-chip--warn"
        : "signal-chip signal-chip--soft";

  return <span className={className}>{props.label}</span>;
}

function InfoBlock(props: { label: string; values: string[]; compact?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
        {props.label}
      </p>
      <div className={`mt-3 ${props.compact ? "space-y-2" : "space-y-3"}`}>
        {props.values.map((item) => (
          <p key={item} className="text-sm leading-7 text-[color:var(--color-muted)]">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function buildHeroKicker(snapshot: DailySnapshot): string {
  const firstFocus = snapshot.hexagram.focusTags[0] ?? "稳住节奏";
  const focusLead = firstFocus.startsWith("先") ? firstFocus : `先${firstFocus}`;
  return `${snapshot.calendar.solarTermName}今日卦眼：${focusLead}，再让一天顺起来。`;
}

function buildHeroSubline(snapshot: DailySnapshot): string {
  const focus = snapshot.hexagram.focusTags[1] ?? snapshot.hexagram.focusTags[0] ?? "把日常落稳";
  return `今日主轴：${focus}`;
}
