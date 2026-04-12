import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, type ReactNode, useEffect, useMemo, useRef, useState, startTransition } from "react";

import { generateTianji, isGenerateSuccess } from "./core/api";
import { buildStoredProfile } from "./core/questionnaire";
import { getGrantedLocation, type OptionalLocation } from "./shared/location";
import { constitutionLabels, healthTagLabels, moodLabels } from "./shared/labels";
import {
  appendHistory,
  applyServerRemainingQuota,
  clearAllLocalData,
  ensureClientId,
  getQuotaSnapshot,
  getRemainingLocalQuota,
  getStoredHistory,
  getStoredProfile,
  incrementLocalQuota,
  saveStoredProfile
} from "./shared/storage";
import { formatDateTime, getShanghaiDateKey, MAX_DAILY_QUOTA, clamp } from "./shared/time";
import type {
  GenerateRequestPayload,
  HistoryEntry,
  Mood,
  QuestionnaireAnswers,
  StoredProfile,
  TianjiData
} from "./types";

import ParticleSphere from "./components/ParticleSphere";
import { TianjiCard } from "./components/TianjiCard";

type View = "intro" | "questionnaire" | "mood" | "press" | "result";

type QuestionnaireOption<T extends string> = {
  label: string;
  value: T;
  hint?: string;
};

const moodOrder: Mood[] = ["happy", "calm", "tired", "anxious", "sad", "angry"];

const moodEmoji: Record<Mood, string> = {
  happy: "😊",
  calm: "😌",
  tired: "😴",
  anxious: "😰",
  sad: "😢",
  angry: "😤"
};

const motionVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
};

export default function App() {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState("");
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<View>("questionnaire");
  const [selectedMood, setSelectedMood] = useState<Mood>("calm");
  const [location, setLocation] = useState<OptionalLocation>(null);
  const [result, setResult] = useState<TianjiData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [quotaVersion, setQuotaVersion] = useState(0);

  useEffect(() => {
    const nextClientId = ensureClientId();
    const nextProfile = getStoredProfile();
    const nextHistory = getStoredHistory();

    setClientId(nextClientId);
    setProfile(nextProfile);
    setHistory(nextHistory);
    setView(nextProfile ? "mood" : "intro");
    setReady(true);
  }, []);

  useEffect(() => {
    if (view !== "press") {
      return;
    }

    let cancelled = false;
    getGrantedLocation().then((nextLocation) => {
      if (!cancelled) {
        setLocation(nextLocation);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [view]);

  const quota = useMemo(() => getQuotaSnapshot(), [quotaVersion]);
  const remainingQuota = useMemo(() => getRemainingLocalQuota(), [quotaVersion]);

  async function handleGenerate(pressDurationMs: number, touchEntropy: number) {
    if (!profile || !clientId) {
      return;
    }

    if (remainingQuota <= 0) {
      setErrorMessage("今日天机已满，请查看历史或明日再来。");
      return;
    }

    const timestamp = Date.now();
    const payload: GenerateRequestPayload = {
      clientId,
      pressDurationMs,
      touchEntropy,
      userProfile: {
        constitution: profile.constitution,
        healthTags: profile.healthTags,
        todayMood: selectedMood,
        tongueDiagnosis: null
      },
      context: {
        timestamp,
        timezone: "Asia/Shanghai",
        ...(location ? { location } : {})
      }
    };

    setErrorMessage("");
    setIsGenerating(true);

    try {
      const response = await generateTianji(payload);
      if (!isGenerateSuccess(response)) {
        if (response.error.code === "RATE_LIMIT_EXCEEDED") {
          applyServerRemainingQuota(0, timestamp);
          setQuotaVersion((value) => value + 1);
        }
        setErrorMessage(response.error.message);
        return;
      }

      incrementLocalQuota(timestamp);
      applyServerRemainingQuota(response.remainingQuota, timestamp);
      setQuotaVersion((value) => value + 1);

      const entry: HistoryEntry = {
        id: `tj-${getShanghaiDateKey(timestamp).replaceAll("-", "")}-${String(history.length + 1).padStart(3, "0")}`,
        date: getShanghaiDateKey(timestamp),
        mood: selectedMood,
        result: response.data
      };

      const nextHistory = appendHistory(entry);
      startTransition(() => {
        setHistory(nextHistory);
        setResult(response.data);
        setView("result");
      });
    } catch {
      setErrorMessage("网络暂时不可用，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleQuestionnaireComplete(answers: QuestionnaireAnswers) {
    const nextProfile = buildStoredProfile(answers);
    saveStoredProfile(nextProfile);
    setProfile(nextProfile);
    setSelectedMood("calm");
    setView("mood");
  }

  async function handleSaveImage() {
    if (!cardRef.current) {
      return;
    }

    setIsSavingImage(true);

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#17171b",
        scale: Math.min(window.devicePixelRatio, 2)
      });
      const link = document.createElement("a");
      link.download = `tianji-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsSavingImage(false);
    }
  }

  function handleSelectHistory(entry: HistoryEntry) {
    setResult(entry.result);
    setSelectedMood(entry.mood);
    setIsHistoryOpen(false);
    setView("result");
  }

  function handleResetLocalData() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("这会清空本地画像、历史和今日额度。是否继续？");
      if (!confirmed) {
        return;
      }
    }

    clearAllLocalData();

    const nextClientId = ensureClientId();
    setClientId(nextClientId);
    setProfile(null);
    setHistory([]);
    setResult(null);
    setSelectedMood("calm");
    setLocation(null);
    setErrorMessage("");
    setIsHistoryOpen(false);
    setQuotaVersion((value) => value + 1);
    setView("intro");
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-[var(--color-muted)]">
        正在整理今日天机…
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-md flex-col">
        <Header
          remainingQuota={remainingQuota}
          historyCount={history.length}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {view === "intro" ? (
              <ScreenFrame key="intro">
                <IntroFlow onStart={() => setView("questionnaire")} />
              </ScreenFrame>
            ) : null}

            {view === "questionnaire" ? (
              <ScreenFrame key="questionnaire">
                <QuestionnaireFlow onComplete={handleQuestionnaireComplete} />
              </ScreenFrame>
            ) : null}

            {view === "mood" ? (
              <ScreenFrame key="mood">
                <MoodSelection
                  selectedMood={selectedMood}
                  onSelectMood={(mood) => {
                    setSelectedMood(mood);
                    setErrorMessage("");
                    setView("press");
                  }}
                  onRevisitProfile={() => setView("questionnaire")}
                  profile={profile}
                />
              </ScreenFrame>
            ) : null}

            {view === "press" ? (
              <ScreenFrame key="press">
                <PressToGenerate
                  mood={selectedMood}
                  isGenerating={isGenerating}
                  remainingQuota={remainingQuota}
                  locationGranted={Boolean(location)}
                  errorMessage={errorMessage}
                  onBack={() => setView("mood")}
                  onLongPressComplete={handleGenerate}
                />
              </ScreenFrame>
            ) : null}

            {view === "result" && result ? (
              <ScreenFrame key="result">
                <TianjiCard
                  ref={cardRef}
                  mood={selectedMood}
                  result={result}
                  onSaveImage={handleSaveImage}
                  onRegenerate={() => {
                    setErrorMessage("");
                    setView("mood");
                  }}
                  onOpenHistory={() => setIsHistoryOpen(true)}
                  isSavingImage={isSavingImage}
                />
              </ScreenFrame>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <HistoryDrawer
        history={history}
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelect={handleSelectHistory}
        onResetLocalData={handleResetLocalData}
      />

      <footer className="mx-auto mt-4 w-full max-w-md text-center text-xs text-[var(--color-muted)]">
        当前仅提供生活方式建议，不构成医学判断。
      </footer>
    </div>
  );
}

function Header(props: {
  remainingQuota: number;
  historyCount: number;
  onOpenHistory: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-muted)]">One Day One Secret</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">一日天机</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-full border border-[var(--color-border)] bg-white/5 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">Today</p>
          <p className="mt-1 text-sm text-[var(--color-text)]">{props.remainingQuota}/{MAX_DAILY_QUOTA}</p>
        </div>
        <button
          className="rounded-full border border-[var(--color-border)] bg-white/5 px-3 py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          onClick={props.onOpenHistory}
          type="button"
        >
          历史 {props.historyCount > 0 ? `(${props.historyCount})` : ""}
        </button>
      </div>
    </div>
  );
}

function IntroFlow(props: { onStart: () => void }) {
  return (
    <div className="flex h-full flex-col justify-center items-center text-center">
      <div className="mb-12">
        <h2 className="text-4xl font-bold text-[var(--color-text)] [font-family:'LXGW_WenKai','STKaiti',serif] tracking-widest mb-4">
          入局
        </h2>
        <p className="text-sm text-[var(--color-muted)] px-8 leading-relaxed">
          天地一统，万物有灵。<br/>在测算今日天机之前，你需要先为卡牌注入一丝你的本因。
        </p>
      </div>

      <button
        type="button"
        onClick={props.onStart}
        className="rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-bold text-[#f7f3ec] shadow-[0_8px_20px_rgba(176,58,46,0.3)] transition hover:-translate-y-1 active:translate-y-0 tracking-wide"
      >
        注入你的生理能量，开启避坑指南
      </button>
    </div>
  );
}

function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={motionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function QuestionnaireFlow(props: { onComplete: (answers: QuestionnaireAnswers) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    bloodPressure: "steady",
    sleepDuration: "normal",
    tongueCoating: "pale_thin",
    healthTags: []
  });

  const steps = [
    {
      key: "bloodPressure",
      title: "你近日的血压感受？",
      subtitle: "这会影响气血运转的判断。",
      options: [
        { label: "近期偏高或头晕起伏大", value: "high" },
        { label: "近期偏低或容易眼黑", value: "low" },
        { label: "大多平稳，无明显不适", value: "steady" }
      ] satisfies QuestionnaireOption<QuestionnaireAnswers["bloodPressure"]>[]
    },
    {
      key: "sleepDuration",
      title: "你近期的睡眠时长？",
      subtitle: "睡眠乃养精蓄锐之本。",
      options: [
        { label: "不足 6 小时", value: "short" },
        { label: "常规 7 - 8 小时", value: "normal" },
        { label: "常常超过 9 小时", value: "long" }
      ] satisfies QuestionnaireOption<QuestionnaireAnswers["sleepDuration"]>[]
    },
    {
      key: "tongueCoating",
      title: "你今晨的舌苔颜色？",
      subtitle: "舌为心之苗，反映微观状态。",
      options: [
        { label: "发白且苔厚", value: "white_thick" },
        { label: "偏红且少苔", value: "red_thin" },
        { label: "淡红且薄白（正常）", value: "pale_thin" }
      ] satisfies QuestionnaireOption<QuestionnaireAnswers["tongueCoating"]>[]
    },
    {
      key: "healthTags",
      title: "补充一下日常偏好",
      subtitle: "可多选，没有可直接跳过。",
      options: [
        { label: "长期久坐", value: "sedentary" },
        { label: "经常熬夜", value: "late_sleep" },
        { label: "饮食不规律", value: "irregular_diet" },
        { label: "规律运动", value: "regular_exercise" }
      ] satisfies QuestionnaireOption<QuestionnaireAnswers["healthTags"][number]>[]
    }
  ] as const;

  const progress = ((step + 1) / steps.length) * 100;
  const current = steps[step];

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.6)] p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">
            初次问卷 {step + 1}/{steps.length}
          </p>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <h2 className="mt-6 text-2xl font-semibold text-[var(--color-text)]">{current.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{current.subtitle}</p>

          {current.key !== "healthTags" ? (
            <div className="mt-6 space-y-3">
              {current.options.map((option) => {
                const selected = answers[current.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [current.key]: option.value }));
                      if (step < steps.length - 1) {
                        setTimeout(() => setStep((value) => value + 1), 120);
                      }
                    }}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      selected
                        ? "border-[var(--color-accent)] bg-[rgba(199,168,106,0.12)] text-[var(--color-text)]"
                        : "border-[var(--color-border)] bg-white/4 text-[var(--color-text)] hover:border-white/20"
                    }`}
                  >
                    <span className="block text-base">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {current.options.map((option) => {
                const selected = answers.healthTags.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        healthTags: selected
                          ? prev.healthTags.filter((tag) => tag !== option.value)
                          : [...prev.healthTags, option.value]
                      }))
                    }
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selected
                        ? "border-[var(--color-accent)] bg-[rgba(199,168,106,0.12)] text-[var(--color-text)]"
                        : "border-[var(--color-border)] bg-white/4 text-[var(--color-text)] hover:border-white/20"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0}
          className="rounded-full border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一步
        </button>

        {step === steps.length - 1 ? (
          <button
            type="button"
            onClick={() => props.onComplete(answers)}
            className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-[#f7f3ec] shadow-md"
          >
            结印生成
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
            className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-[#f7f3ec] shadow-sm"
          >
            下一题
          </button>
        )}
      </div>
    </div>
  );
}

function MoodSelection(props: {
  selectedMood: Mood;
  onSelectMood: (mood: Mood) => void;
  onRevisitProfile: () => void;
  profile: StoredProfile | null;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.6)] p-6 shadow-sm backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-muted)]">今日状态</p>
        <h2 className="mt-4 text-3xl font-semibold text-[var(--color-text)]">此刻你的状态如何？</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          基础画像会保持稳定，今天只需要补充一个当下状态。
        </p>

        {props.profile ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>{constitutionLabels[props.profile.constitution]}</Badge>
            {props.profile.healthTags.map((tag) => (
              <Badge key={tag}>{healthTagLabels[tag]}</Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {moodOrder.map((mood) => {
            const selected = props.selectedMood === mood;
            return (
              <button
                key={mood}
                type="button"
                onClick={() => props.onSelectMood(mood)}
                  className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-[var(--color-accent)] bg-[rgba(176,58,46,0.08)] shadow-sm"
                    : "border-[var(--color-border)] bg-transparent hover:border-[var(--color-accent)]/40 hover:bg-white/40"
                }`}
              >
                <div className="text-3xl">{moodEmoji[mood]}</div>
                <p className="mt-3 text-base text-[var(--color-text)]">{moodLabels[mood]}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">点击后进入起卦页</p>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={props.onRevisitProfile}
        className="mt-6 self-start rounded-full border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text)]"
      >
        重新填写画像
      </button>
    </div>
  );
}

function PressToGenerate(props: {
  mood: Mood;
  isGenerating: boolean;
  remainingQuota: number;
  locationGranted: boolean;
  errorMessage: string;
  onBack: () => void;
  onLongPressComplete: (pressDurationMs: number, touchEntropy: number) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-between">
      <div className="w-full rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.6)] p-6 text-center shadow-sm backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-muted)]">今日起卦</p>
        <h2 className="mt-4 text-3xl font-semibold text-[var(--color-text)]">{moodEmoji[props.mood]} {moodLabels[props.mood]}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          长按至少 2 秒，让节气、状态和当下节奏一起落成今天的建议卡。
        </p>

        <div className="mt-8 flex justify-center py-6">
          <ParticleSphere
            disabled={props.remainingQuota <= 0 || props.isGenerating}
            loading={props.isGenerating}
            onComplete={props.onLongPressComplete}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--color-muted)]">
          <Badge>剩余 {props.remainingQuota}/{MAX_DAILY_QUOTA}</Badge>
          <Badge>{props.locationGranted ? "已读取定位增强" : "未请求定位"}</Badge>
          <Badge>低于 2 秒不会生成</Badge>
        </div>

        {props.errorMessage ? (
          <p className="mt-5 rounded-2xl border border-[rgba(198,106,85,0.4)] bg-[rgba(198,106,85,0.12)] px-4 py-3 text-sm text-[var(--color-text)]">
            {props.errorMessage}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={props.onBack}
        className="mt-6 self-start rounded-full border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text)]"
      >
        返回状态选择
      </button>
    </div>
  );
}


function HistoryDrawer(props: {
  history: HistoryEntry[];
  open: boolean;
  onClose: () => void;
  onSelect: (entry: HistoryEntry) => void;
  onResetLocalData: () => void;
}) {
  return (
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭历史"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />
          <motion.aside
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[76dvh] w-full max-w-md rounded-t-[20px] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_80px_rgba(47,42,36,0.25)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto h-1.5 w-16 rounded-full bg-white/10" />
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-muted)]">历史归档</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--color-text)]">最近生成</h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
                onClick={props.onClose}
              >
                关闭
              </button>
            </div>

            <div className="mt-5 space-y-3 overflow-y-auto pb-4">
              {props.history.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-white/50 p-4 text-sm text-[var(--color-muted)]">
                  还没有历史记录。生成第一张天机卡后会出现在这里。
                </div>
              ) : (
                props.history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => props.onSelect(entry)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white/50 p-4 text-left transition hover:border-[var(--color-accent)]/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--color-accent)]">{entry.result.meta.hexagramName}</p>
                        <p className="mt-1 text-base text-[var(--color-text)]">{entry.result.mysticSaying}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl">{moodEmoji[entry.mood]}</p>
                        <p className="mt-2 text-xs text-[var(--color-muted)]">
                          {formatDateTime(entry.result.meta.generatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={props.onResetLocalData}
                className="w-full rounded-2xl border border-[rgba(198,106,85,0.35)] bg-[rgba(198,106,85,0.08)] px-4 py-3 text-sm text-[var(--color-negative)] transition hover:border-[rgba(198,106,85,0.55)]"
              >
                重置本地数据
              </button>
              <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                会清空本地画像、历史记录、额度和设备标识，适合重新验证生成链路。
              </p>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}


function Badge(props: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const className =
    props.tone === "positive"
      ? "border-[rgba(109,154,107,0.35)] bg-[rgba(109,154,107,0.08)] text-[var(--color-positive)]"
      : props.tone === "negative"
        ? "border-[rgba(198,106,85,0.35)] bg-[rgba(198,106,85,0.08)] text-[var(--color-negative)]"
        : "border-[var(--color-border)] bg-white/6 text-[var(--color-muted)]";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs ${className}`}>
      {props.children}
    </span>
  );
}
