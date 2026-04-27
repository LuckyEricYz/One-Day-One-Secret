import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { HexagramGlyph } from "./components/HexagramGlyph";
import { buildDailySnapshot } from "./shared/daily";
import { ROLE_PRESET_MAP, ROLE_PRESETS } from "./shared/roles";
import {
  ensureCurrentRoleStorageSchema,
  getStoredHistoryV2,
  getStoredRoleId,
  isDailyModalSeen,
  markDailyModalSeen,
  saveStoredRoleId,
  upsertStoredHistoryEntry
} from "./shared/storage-v2";
import { formatDateTime, getNextShanghaiMidnightIso } from "./shared/time";
import type { DailySnapshot, HistoryEntryV2, RoleId, RolePreset } from "./types";

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
  const transitionTimersRef = useRef<number[]>([]);
  const [routePath, setRoutePath] = useState<AppRoute>(() => readRoutePath());
  const [ready, setReady] = useState(false);
  const [roleId, setRoleId] = useState<RoleId | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<RoleId | null>(null);
  const [isRoleTransitioning, setIsRoleTransitioning] = useState(false);
  const [homeRevealKey, setHomeRevealKey] = useState(0);
  const [history, setHistory] = useState<HistoryEntryV2[]>([]);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHexagramOpen, setIsHexagramOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  function clearTransitionTimers() {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [];
  }

  function navigateToRoute(path: AppRoute, mode: "push" | "replace" = "push") {
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      const method = mode === "replace" ? "replaceState" : "pushState";
      window.history[method]({}, "", path);
    }

    setRoutePath(path);
  }

  useEffect(() => {
    ensureCurrentRoleStorageSchema();
    setRoleId(getStoredRoleId());
    const nextHistory = getStoredHistoryV2();
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
    return () => clearTransitionTimers();
  }, []);

  useEffect(() => {
    if (ready && !roleId && !pendingRoleId && routePath === "/") {
      navigateToRoute("/role", "replace");
    }
  }, [pendingRoleId, ready, roleId, routePath]);

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
    if (!roleId) {
      setSnapshot(null);
      setIsHexagramOpen(false);
      return;
    }

    const nextSnapshot = buildDailySnapshot(roleId, nowTimestamp);
    const nextHistory = upsertStoredHistoryEntry(nextSnapshot);
    const modalKey = `${roleId}:${nextSnapshot.dateKey}`;

    setSnapshot(nextSnapshot);
    setHistory(nextHistory);
    setHomeRevealKey((value) => value + 1);
    setSelectedHistoryId((current) =>
      current && nextHistory.some((entry) => entry.id === current)
        ? current
        : nextSnapshot.id
    );
    setIsHexagramOpen(!isDailyModalSeen(modalKey));
  }, [nowTimestamp, roleId]);

  function handleSelectRole(nextRoleId: RoleId) {
    if (nextRoleId === pendingRoleId) {
      return;
    }

    saveStoredRoleId(nextRoleId);
    clearTransitionTimers();
    setIsHistoryOpen(false);
    setIsHexagramOpen(false);
    navigateToRoute("/", "push");

    if (nextRoleId === roleId) {
      setPendingRoleId(null);
      setIsRoleTransitioning(false);
      setNowTimestamp(Date.now());
      return;
    }

    setPendingRoleId(nextRoleId);
    setIsRoleTransitioning(true);

    transitionTimersRef.current.push(
      window.setTimeout(() => {
        setRoleId(nextRoleId);
        setNowTimestamp(Date.now());
      }, 260)
    );

    transitionTimersRef.current.push(
      window.setTimeout(() => {
        setPendingRoleId(null);
        setIsRoleTransitioning(false);
      }, 700)
    );
  }

  function handleCloseHexagram() {
    if (snapshot) {
      markDailyModalSeen(`${snapshot.roleId}:${snapshot.dateKey}`);
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
  const activeRole = roleId ? ROLE_PRESET_MAP[roleId] : null;
  const transitionRole =
    (pendingRoleId && ROLE_PRESET_MAP[pendingRoleId]) ?? (activeRole ? activeRole : null);
  const isRolePage = routePath === "/role" || !activeRole || !snapshot;

  return (
    <div className={`relative min-h-dvh overflow-x-hidden px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 ${isRolePage ? "app-shell--role" : ""}`}>
      <div className="paper-wash paper-wash--one" aria-hidden="true" />
      <div className="paper-wash paper-wash--two" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-7xl flex-col">
        {isRolePage ? (
          <RolePage
            currentRoleId={roleId}
            isBusy={isRoleTransitioning}
            pendingRoleId={pendingRoleId}
            onGoHome={() => navigateToRoute("/", "push")}
            onSelectRole={handleSelectRole}
          />
        ) : activeRole && snapshot ? (
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
                role={activeRole}
                snapshot={snapshot}
                onOpenRolePage={() => navigateToRoute("/role", "push")}
                onReopenHexagram={() => setIsHexagramOpen(true)}
              />
            </motion.main>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {transitionRole && isRoleTransitioning ? (
          <RoleTransitionCurtain key={`transition-${transitionRole.id}`} role={transitionRole} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {routePath === "/" && snapshot && isHexagramOpen ? (
          <HexagramModal
            key={`modal-${snapshot.id}`}
            role={ROLE_PRESET_MAP[snapshot.roleId]}
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
  return (
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
          One Day One Secret
        </p>
        <h1 className="serif-title mt-3 text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[0.03em]">
          双角色每日养生
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)] sm:text-[15px]">
          今日以一卦定节律，再用动作、穴位与食谱把身心稳稳收回来。
        </p>
      </div>

      <div className="toolstrip">
        <ToolChip>{props.solarTermName}</ToolChip>
        <ToolChip>{props.calendarLabel}</ToolChip>
        <button className="tool-button" onClick={props.onOpenRolePage} type="button">
          切换角色
        </button>
        <button className="tool-button" onClick={props.onOpenHistory} type="button">
          历史快照 {props.historyCount > 0 ? `(${props.historyCount})` : ""}
        </button>
      </div>
    </header>
  );
}

function RolePage(props: {
  currentRoleId: RoleId | null;
  pendingRoleId: RoleId | null;
  isBusy: boolean;
  onGoHome: () => void;
  onSelectRole: (roleId: RoleId) => void;
}) {
  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="role-page flex flex-1 flex-col"
    >
      <div className="role-page__toolbar">
        <button className="role-page__icon-button" onClick={props.onGoHome} type="button" disabled={!props.currentRoleId}>
          ‹
        </button>
        <div className="role-page__title-pill">
          <span>选择角色</span>
          <span className="role-page__mini-dot" aria-hidden="true" />
          <span>⌄</span>
        </div>
      </div>

      <div className="role-page__content">
        <motion.div
          variants={staggerVariants}
          initial="hidden"
          animate="show"
          className="role-choice-grid"
        >
          {ROLE_PRESETS.map((role) => {
            const isPending = props.pendingRoleId === role.id;
            const isSelected = props.currentRoleId === role.id;
            const shouldDim = props.isBusy && props.pendingRoleId !== role.id;

            return (
              <motion.button
                key={role.id}
                variants={revealVariants}
                whileHover={props.isBusy ? undefined : { y: -6, scale: 1.01 }}
                whileTap={props.isBusy ? undefined : { scale: 0.992 }}
                className={`choice-card choice-card--role ${
                  isPending ? "choice-card--pending" : ""
                } ${isSelected ? "choice-card--selected" : ""
                } ${shouldDim ? "choice-card--muted" : ""}`}
                onClick={() => props.onSelectRole(role.id)}
                type="button"
                disabled={props.isBusy}
                aria-label={`选择${role.label}`}
              >
                <div className="role-card__status">
                  {isSelected ? "默认角色" : isPending ? "确认中" : "可选择"}
                </div>
                <div className="role-card__avatar" aria-hidden="true">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    poster={role.avatarPosterSrc}
                    src={role.avatarVideoSrc}
                  />
                  <span className="role-card__avatar-fallback">{role.shortLabel}</span>
                </div>
                <span className="sr-only">{role.avatarAlt}</span>

                <h2 className="role-card__name">{role.label}</h2>
                <p className="role-card__intro">{role.intro}</p>

                <div className="role-card__info">
                  <InfoBlock label="基础状态" values={role.baseStatus} compact />
                  <InfoBlock label="情绪特质" values={role.emotionTraits} compact />
                </div>

                <div className="role-card__year">
                  <span>今年喜忌</span>
                  <p>{role.baziSummary}</p>
                </div>

                <div className="role-card__signals">
                  {role.annualFocus.slice(0, 2).map((item) => (
                    <SignalChip key={item} label={`宜 · ${item}`} tone="good" />
                  ))}
                  {role.annualAvoids.slice(0, 1).map((item) => (
                    <SignalChip key={item} label={`忌 · ${item}`} tone="soft" />
                  ))}
                </div>

                <span className="role-card__radio" aria-hidden="true" />
                <span className="role-card__confirm">
                  {isPending ? "正在确认" : isSelected ? "进入首页" : "确认选择"}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </motion.main>
  );
}

function Dashboard(props: {
  homeRevealKey: number;
  role: RolePreset;
  snapshot: DailySnapshot;
  onOpenRolePage: () => void;
  onReopenHexagram: () => void;
}) {
  const [isMobileRoleOpen, setIsMobileRoleOpen] = useState(false);

  useEffect(() => {
    setIsMobileRoleOpen(false);
  }, [props.role.id]);

  return (
    <div className="dashboard-shell">
      <div className="hero-layout">
        <AnimatePresence mode="wait">
          <motion.section
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
                当日一卦
              </div>
              <button className="ghost-button ghost-button--small" onClick={props.onReopenHexagram} type="button">
                重看今日卦象
              </button>
            </div>

            <div className="hero-card__grid">
              <div className="hero-card__altar">
                <div className="hero-card__altar-mark">卦</div>
                <HexagramGlyph
                  animated
                  emphasis="hero"
                  lines={props.snapshot.hexagram.lines}
                  className="mx-auto max-w-[240px]"
                  staggerMs={90}
                />
                <div className="hero-card__altar-copy">
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
                  {buildHeroKicker(props.snapshot)}
                </motion.p>
                <motion.h2 variants={modalRevealVariants} className="serif-title hero-card__title">
                  {props.snapshot.hexagram.name}
                </motion.h2>
                <motion.p variants={modalRevealVariants} className="hero-card__headline">
                  {props.snapshot.hexagram.headline}
                </motion.p>
                <motion.p variants={modalRevealVariants} className="hero-card__summary">
                  {props.snapshot.hexagram.guidance}
                </motion.p>

                <motion.div variants={modalRevealVariants} className="hero-card__signals">
                  {props.snapshot.hexagram.focusTags.slice(0, 3).map((item) => (
                    <SignalChip key={item} label={`今日宜 · ${item}`} tone="good" />
                  ))}
                  {props.snapshot.hexagram.avoidTags.slice(0, 1).map((item) => (
                    <SignalChip key={item} label={`今日少做 · ${item}`} tone="warn" />
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
                      <span className="hero-card__note-title">今日少做</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </motion.section>
        </AnimatePresence>

        <RoleRail
          role={props.role}
          snapshot={props.snapshot}
          onOpenRolePage={props.onOpenRolePage}
          onReopenHexagram={props.onReopenHexagram}
        />
      </div>

      <RoleMobileAccordion
        open={isMobileRoleOpen}
        role={props.role}
        snapshot={props.snapshot}
        onOpenRolePage={props.onOpenRolePage}
        onReopenHexagram={props.onReopenHexagram}
        onToggle={() => setIsMobileRoleOpen((value) => !value)}
      />

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

function RoleRail(props: {
  role: RolePreset;
  snapshot: DailySnapshot;
  onOpenRolePage: () => void;
  onReopenHexagram: () => void;
}) {
  return (
    <aside className="paper-panel role-rail">
      <div className="role-rail__header">
        <span className="role-rail__eyebrow">角色侧栏</span>
        <span className="seal-stamp role-rail__seal">{props.role.seal}</span>
      </div>

      <div>
        <h3 className="serif-title text-3xl">{props.role.label}</h3>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">{props.role.intro}</p>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">当前角色</p>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
          {props.role.genderLabel} · {props.role.shortLabel}
        </p>
        <button className="ghost-button role-rail__action" onClick={props.onOpenRolePage} type="button">
          切换角色
        </button>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">年度摘要</p>
        <p className="text-sm leading-7 text-[color:var(--color-muted)]">{props.role.baziSummary}</p>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">基础状态</p>
        <div className="space-y-3">
          {props.role.baseStatus.map((item) => (
            <p key={item} className="text-sm leading-7 text-[color:var(--color-muted)]">
              {item}
            </p>
          ))}
        </div>
      </div>

      <div className="role-rail__section">
        <p className="role-rail__section-label">今日提醒</p>
        <p className="text-sm leading-7 text-[color:var(--color-muted)]">
          {props.snapshot.seasonalSummary}
        </p>
      </div>

      <button className="ghost-button" onClick={props.onReopenHexagram} type="button">
        重看今日卦象
      </button>
    </aside>
  );
}

function RoleMobileAccordion(props: {
  role: RolePreset;
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
          <span className="seal-stamp role-mobile-card__seal">{props.role.seal}</span>
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
              角色摘要
            </p>
            <p className="serif-title mt-1 text-2xl">{props.role.label}</p>
          </div>
        </div>
        <span className="text-sm text-[color:var(--color-muted)]">
          {props.open ? "收起" : "展开"}
        </span>
      </button>

      <div className={`role-mobile-card__content ${props.open ? "role-mobile-card__content--open" : ""}`}>
        <div className="mt-5 grid gap-4">
          <InfoBlock label="基础状态" values={props.role.baseStatus} compact />
          <p className="text-sm leading-7 text-[color:var(--color-muted)]">
            <span className="text-[color:var(--color-ink)]">年度摘要：</span>
            {props.role.baziSummary}
          </p>
          <p className="text-sm leading-7 text-[color:var(--color-muted)]">
            <span className="text-[color:var(--color-ink)]">今日提醒：</span>
            {props.snapshot.seasonalSummary}
          </p>
          <button className="ghost-button" onClick={props.onOpenRolePage} type="button">
            切换角色
          </button>
          <button className="ghost-button" onClick={props.onReopenHexagram} type="button">
            重看今日卦象
          </button>
        </div>
      </div>
    </section>
  );
}

function HexagramModal(props: {
  role: RolePreset;
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
                  {props.role.label} · {props.snapshot.calendar.solarTermName} ·{" "}
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
  history: HistoryEntryV2[];
  selectedId: string | null;
  selectedEntry: HistoryEntryV2 | null;
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
              还没有历史快照。选定角色后，系统会自动保存每天的内容。
            </p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                {props.history.map((entry) => {
                  const role = ROLE_PRESET_MAP[entry.roleId];
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
                        <ToolChip>{role.genderLabel}</ToolChip>
                      </div>
                      <h3 className="serif-title mt-3 text-2xl">{entry.snapshot.hexagram.name}</h3>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                        {role.label}
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

function HistoryPreview(props: { entry: HistoryEntryV2 }) {
  const role = ROLE_PRESET_MAP[props.entry.roleId];
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
          <ToolChip>{role.label}</ToolChip>
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

function RoleTransitionCurtain(props: { role: RolePreset }) {
  return (
    <motion.div
      className="selection-curtain"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="selection-curtain__paper"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
      >
        <span className="selection-curtain__seal">{props.role.seal}</span>
        <p className="selection-curtain__title">收印入场</p>
        <p className="selection-curtain__copy">
          今天先以 {props.role.label} 的视角，收下一页专属调理。
        </p>
      </motion.div>
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
  return `${snapshot.calendar.solarTermName}今日卦眼：先${firstFocus}，再让一天顺起来。`;
}

function buildHeroSubline(snapshot: DailySnapshot): string {
  const focus = snapshot.hexagram.focusTags[1] ?? snapshot.hexagram.focusTags[0] ?? "把日常落稳";
  return `今日主轴：${focus}`;
}
