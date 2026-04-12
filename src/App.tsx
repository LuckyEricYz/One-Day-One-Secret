import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, type ReactNode, startTransition, useEffect, useRef, useState } from "react";

import { HexagramGlyph } from "./components/HexagramGlyph";
import { RitualSphere, type RitualActivation } from "./components/RitualSphere";
import { generateTianji, isGenerateSuccess } from "./core/api";
import { buildStoredProfile } from "./core/questionnaire";
import { getGrantedLocation, type OptionalLocation } from "./shared/location";
import {
  constitutionLabels,
  formatSupplementSummary,
  healthTagLabels,
  moodLabels
} from "./shared/labels";
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
import {
  defaultDailySupplement,
  supplementOptions,
  supplementQuestionCopy
} from "./shared/supplement";
import { formatDateTime, getShanghaiDateKey, MAX_DAILY_QUOTA } from "./shared/time";
import type {
  DailySupplement,
  GenerateRequestPayload,
  HistoryEntry,
  Mood,
  QuestionnaireAnswers,
  StoredProfile
} from "./types";

type View = "questionnaire" | "mood" | "ritual" | "supplement" | "result";

type QuestionnaireOption<T extends string> = {
  label: string;
  value: T;
};

const motionVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 }
};

const moodOrder: Mood[] = ["happy", "calm", "tired", "anxious", "sad", "angry"];

const moodSealGlyphs: Record<Mood, string> = {
  happy: "乐",
  calm: "静",
  tired: "倦",
  anxious: "忧",
  sad: "郁",
  angry: "燥"
};

const questionnaireSteps = [
  {
    key: "sleep",
    title: "你的睡眠质量如何？",
    subtitle: "长期画像只取稳定倾向，不判断好坏。",
    options: [
      { label: "经常失眠浅眠", value: "poor" },
      { label: "偶尔不好", value: "mixed" },
      { label: "一般都很好", value: "good" }
    ] satisfies QuestionnaireOption<QuestionnaireAnswers["sleep"]>[]
  },
  {
    key: "temperature",
    title: "你的手脚温度？",
    subtitle: "按平时最常见的体感来选。",
    options: [
      { label: "经常冰凉", value: "cold" },
      { label: "有时偏凉", value: "cool" },
      { label: "一般温暖", value: "warm" }
    ] satisfies QuestionnaireOption<QuestionnaireAnswers["temperature"]>[]
  },
  {
    key: "digestion",
    title: "你的消化状况？",
    subtitle: "只取日常感受，不做诊断含义。",
    options: [
      { label: "容易胀气不适", value: "bloating" },
      { label: "容易腹泻", value: "loose" },
      { label: "很少有问题", value: "stable" }
    ] satisfies QuestionnaireOption<QuestionnaireAnswers["digestion"]>[]
  },
  {
    key: "emotion",
    title: "你的情绪状态？",
    subtitle: "回想最近一段时间最常见的底色。",
    options: [
      { label: "容易焦虑紧张", value: "anxious" },
      { label: "容易压抑低落", value: "low" },
      { label: "基本平稳", value: "steady" }
    ] satisfies QuestionnaireOption<QuestionnaireAnswers["emotion"]>[]
  },
  {
    key: "healthTags",
    title: "你最近更接近哪些习惯？",
    subtitle: "这一题可多选，也可以空着。",
    options: [
      { label: "长期久坐", value: "sedentary" },
      { label: "经常熬夜", value: "late_sleep" },
      { label: "饮食不规律", value: "irregular_diet" },
      { label: "规律运动", value: "regular_exercise" }
    ] satisfies QuestionnaireOption<QuestionnaireAnswers["healthTags"][number]>[]
  }
] as const;

const knowledgeOriginLabels: Record<string, string> = {
  seasonal: "节气",
  diet: "饮食",
  sleep: "睡眠",
  exercise: "活动",
  emotion: "情绪"
};

export default function App() {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState("");
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<HistoryEntry | null>(null);
  const [view, setView] = useState<View>("questionnaire");
  const [selectedMood, setSelectedMood] = useState<Mood>("calm");
  const [ritualActivation, setRitualActivation] = useState<RitualActivation | null>(null);
  const [supplementAnswers, setSupplementAnswers] = useState<DailySupplement>(defaultDailySupplement);
  const [location, setLocation] = useState<OptionalLocation>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [, setQuotaVersion] = useState(0);
  const [platform, setPlatform] = useState<"web" | "h5">("web");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const nextClientId = ensureClientId();
    const nextProfile = getStoredProfile();
    const nextHistory = getStoredHistory();

    setClientId(nextClientId);
    setProfile(nextProfile);
    setHistory(nextHistory);
    setView(nextProfile ? "mood" : "questionnaire");
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pointerMedia = window.matchMedia("(pointer: coarse)");
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const lowPower =
      (navigator.hardwareConcurrency ?? 4) <= 2 ||
      memory <= 2;

    function syncPlatform() {
      setPlatform(pointerMedia.matches || (navigator.maxTouchPoints ?? 0) > 0 ? "h5" : "web");
      setReducedMotion(reducedMedia.matches || lowPower);
    }

    function bindMediaChange(media: MediaQueryList) {
      if ("addEventListener" in media) {
        media.addEventListener("change", syncPlatform);
        return () => media.removeEventListener("change", syncPlatform);
      }

      const legacyMedia = media as MediaQueryList & {
        addListener: (listener: (event: MediaQueryListEvent) => void) => void;
        removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
      };

      legacyMedia.addListener(syncPlatform);
      return () => legacyMedia.removeListener(syncPlatform);
    }

    syncPlatform();
    const unbindPointer = bindMediaChange(pointerMedia);
    const unbindReduced = bindMediaChange(reducedMedia);

    return () => {
      unbindPointer();
      unbindReduced();
    };
  }, []);

  useEffect(() => {
    if ((view !== "ritual" && view !== "supplement") || locationRequested) {
      return;
    }

    let cancelled = false;
    setLocationRequested(true);
    getGrantedLocation().then((nextLocation) => {
      if (!cancelled) {
        setLocation(nextLocation);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [locationRequested, view]);

  const quota = getQuotaSnapshot();
  const remainingQuota = getRemainingLocalQuota();

  function resetCurrentRitual() {
    setRitualActivation(null);
    setSupplementAnswers(defaultDailySupplement);
    setErrorMessage("");
  }

  function handleQuestionnaireComplete(answers: QuestionnaireAnswers) {
    const nextProfile = buildStoredProfile(answers);
    saveStoredProfile(nextProfile);
    setProfile(nextProfile);
    setSelectedMood("calm");
    setActiveEntry(null);
    resetCurrentRitual();
    setView("mood");
  }

  function handleMoodEnter(nextMood: Mood) {
    setSelectedMood(nextMood);
    setActiveEntry(null);
    resetCurrentRitual();
    setView("ritual");
  }

  function handleRitualActivate(nextActivation: RitualActivation) {
    if (remainingQuota <= 0) {
      setErrorMessage("今日天机已满，请查看历史或明日再来。");
      return;
    }

    setRitualActivation(nextActivation);
    setSupplementAnswers(defaultDailySupplement);
    setErrorMessage("");
  }

  async function handleGenerate() {
    if (!profile || !clientId || !ritualActivation) {
      return;
    }

    if (remainingQuota <= 0) {
      setErrorMessage("今日天机已满，请查看历史或明日再来。");
      return;
    }

    const payload: GenerateRequestPayload = {
      clientId,
      pressDurationMs: ritualActivation.pressDurationMs,
      touchEntropy: ritualActivation.touchEntropy,
      userProfile: {
        constitution: profile.constitution,
        healthTags: profile.healthTags,
        todayMood: selectedMood,
        tongueDiagnosis: null
      },
      dailySupplement: supplementAnswers,
      context: {
        timestamp: ritualActivation.timestamp,
        timezone: "Asia/Shanghai",
        ...(location ? { location } : {})
      }
    };

    setIsGenerating(true);
    setErrorMessage("");

    try {
      const response = await generateTianji(payload);
      if (!isGenerateSuccess(response)) {
        if (response.error.code === "RATE_LIMIT_EXCEEDED") {
          applyServerRemainingQuota(0, ritualActivation.timestamp);
          setQuotaVersion((value) => value + 1);
        }
        setErrorMessage(response.error.message);
        return;
      }

      incrementLocalQuota(ritualActivation.timestamp);
      applyServerRemainingQuota(response.remainingQuota, ritualActivation.timestamp);
      setQuotaVersion((value) => value + 1);

      const entry: HistoryEntry = {
        id: `tj-${getShanghaiDateKey(ritualActivation.timestamp).replaceAll("-", "")}-${String(history.length + 1).padStart(3, "0")}`,
        date: getShanghaiDateKey(ritualActivation.timestamp),
        mood: selectedMood,
        supplementAnswers,
        result: response.data
      };

      const nextHistory = appendHistory(entry);
      startTransition(() => {
        setHistory(nextHistory);
        setActiveEntry(entry);
        setView("result");
      });
    } catch {
      setErrorMessage("网络暂时不可用，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveImage() {
    if (!cardRef.current) {
      return;
    }

    setIsSavingImage(true);
    setErrorMessage("");

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#f7f0df",
        scale: Math.min(window.devicePixelRatio, 2)
      });
      const link = document.createElement("a");
      link.download = `tianji-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("save image failed", error);
      setErrorMessage("保存长图失败，请稍后重试。");
    } finally {
      setIsSavingImage(false);
    }
  }

  function handleSelectHistory(entry: HistoryEntry) {
    setActiveEntry(entry);
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
    setActiveEntry(null);
    setSelectedMood("calm");
    setLocation(null);
    setLocationRequested(false);
    setErrorMessage("");
    setIsHistoryOpen(false);
    setQuotaVersion((value) => value + 1);
    resetCurrentRitual();
    setView("questionnaire");
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-[color:var(--color-muted)]">
        正在铺开今日的纸面…
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8">
      <div className="paper-wash paper-wash--one" aria-hidden="true" />
      <div className="paper-wash paper-wash--two" aria-hidden="true" />

      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-6xl flex-col">
        <Header
          historyCount={history.length}
          onOpenHistory={() => setIsHistoryOpen(true)}
          platform={platform}
          quota={quota}
          remainingQuota={remainingQuota}
        />

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {view === "questionnaire" ? (
              <ScreenFrame key="questionnaire">
                <QuestionnaireFlow onComplete={handleQuestionnaireComplete} />
              </ScreenFrame>
            ) : null}

            {view === "mood" ? (
              <ScreenFrame key="mood">
                <MoodSelection
                  profile={profile}
                  selectedMood={selectedMood}
                  onSelectMood={handleMoodEnter}
                  onRevisitProfile={() => setView("questionnaire")}
                />
              </ScreenFrame>
            ) : null}

            {view === "ritual" ? (
              <ScreenFrame key="ritual">
                <RitualScreen
                  activation={ritualActivation}
                  errorMessage={errorMessage}
                  locationGranted={Boolean(location)}
                  mood={selectedMood}
                  onActivate={handleRitualActivate}
                  onBack={() => {
                    resetCurrentRitual();
                    setView("mood");
                  }}
                  onContinue={() => {
                    if (!ritualActivation) {
                      return;
                    }

                    setErrorMessage("");
                    setView("supplement");
                  }}
                  onReset={resetCurrentRitual}
                  platform={platform}
                  reducedMotion={reducedMotion}
                  remainingQuota={remainingQuota}
                />
              </ScreenFrame>
            ) : null}

            {view === "supplement" && ritualActivation ? (
              <ScreenFrame key="supplement">
                <SupplementFlow
                  answers={supplementAnswers}
                  errorMessage={errorMessage}
                  isGenerating={isGenerating}
                  mood={selectedMood}
                  onBack={() => setView("ritual")}
                  onChange={setSupplementAnswers}
                  onSubmit={handleGenerate}
                  ritualActivation={ritualActivation}
                />
              </ScreenFrame>
            ) : null}

            {view === "result" && activeEntry ? (
              <ScreenFrame key={`result-${activeEntry.id}`}>
                <ResultView
                  ref={cardRef}
                  entry={activeEntry}
                  isSavingImage={isSavingImage}
                  mood={activeEntry.mood}
                  onOpenHistory={() => setIsHistoryOpen(true)}
                  onRegenerate={() => {
                    setActiveEntry(null);
                    resetCurrentRitual();
                    setView("mood");
                  }}
                  onSaveImage={handleSaveImage}
                  ritualActivation={
                    ritualActivation &&
                    ritualActivation.hexagram.name === activeEntry.result.meta.hexagramName
                      ? ritualActivation
                      : null
                  }
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
        onResetLocalData={handleResetLocalData}
        onSelect={handleSelectHistory}
      />

      <footer className="mx-auto mt-6 w-full max-w-6xl text-center text-xs leading-6 text-[color:var(--color-muted)]">
        一日天机只提供节气语境下的生活方式建议，不构成医学判断。
      </footer>
    </div>
  );
}

function Header(props: {
  historyCount: number;
  onOpenHistory: () => void;
  platform: "web" | "h5";
  quota: ReturnType<typeof getQuotaSnapshot>;
  remainingQuota: number;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
          One Day One Secret
        </p>
        <h1 className="mt-3 text-[2.2rem] leading-none text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong','Noto_Serif_SC',serif] sm:text-[3rem]">
          一日天机
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
          以混沌粒子成卦，以当日补录收束一张纸本天机卡。桌面端更重沉浸转场，触屏端更重长按仪式。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge>{props.platform === "web" ? "Web 沉浸版" : "H5 长按版"}</Badge>
        <Badge>今日剩余 {props.remainingQuota}/{MAX_DAILY_QUOTA}</Badge>
        <Badge>{props.quota.date.replaceAll("-", ".")}</Badge>
        <button
          className="seal-button"
          onClick={props.onOpenHistory}
          type="button"
        >
          历史归档 {props.historyCount > 0 ? `(${props.historyCount})` : ""}
        </button>
      </div>
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
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function PaperPanel(props: { children: ReactNode; className?: string }) {
  return <section className={`paper-panel ${props.className ?? ""}`.trim()}>{props.children}</section>;
}

function QuestionnaireFlow(props: { onComplete: (answers: QuestionnaireAnswers) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    sleep: "mixed",
    temperature: "cool",
    digestion: "stable",
    emotion: "steady",
    healthTags: []
  });

  const progress = ((step + 1) / questionnaireSteps.length) * 100;
  const current = questionnaireSteps[step];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.14fr)_minmax(280px,0.86fr)]">
      <PaperPanel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              初次问卷 {step + 1}/{questionnaireSteps.length}
            </p>
            <h2 className="mt-3 text-3xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
              {current.title}
            </h2>
          </div>
          <div className="seal-stamp">画像</div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">{current.subtitle}</p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(40,26,14,0.08)]">
          <div
            className="h-full rounded-full bg-[color:var(--color-vermillion)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {current.key !== "healthTags" ? (
          <div className="mt-8 space-y-3">
            {current.options.map((option) => {
              const selected = answers[current.key] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [current.key]: option.value }));
                    if (step < questionnaireSteps.length - 1) {
                      window.setTimeout(() => setStep((value) => value + 1), 110);
                    }
                  }}
                  className={`paper-choice w-full text-left ${
                    selected ? "paper-choice--selected" : ""
                  }`}
                >
                  <span className="text-base text-[color:var(--color-ink)]">{option.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
                  className={`paper-choice text-left ${selected ? "paper-choice--selected" : ""}`}
                >
                  <span className="text-base text-[color:var(--color-ink)]">{option.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
            className="ghost-button disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一步
          </button>

          {step === questionnaireSteps.length - 1 ? (
            <button
              type="button"
              onClick={() => props.onComplete(answers)}
              className="seal-button"
            >
              完成入卷
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(questionnaireSteps.length - 1, value + 1))}
              className="seal-button"
            >
              下一问
            </button>
          )}
        </div>
      </PaperPanel>

      <PaperPanel className="flex flex-col justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
            长期画像
          </p>
          <h3 className="mt-3 text-2xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
            这一部分只回答一次
          </h3>
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
            问卷只形成基础画像，用于长期体感倾向。真正影响今天结果的，是后面的粒子成卦与当日补录。
          </p>
        </div>

        <div className="space-y-3">
          <Badge>首次 5 题</Badge>
          <Badge>只存本地</Badge>
          <Badge>不做医学结论</Badge>
        </div>
      </PaperPanel>
    </div>
  );
}

function MoodSelection(props: {
  profile: StoredProfile | null;
  selectedMood: Mood;
  onSelectMood: (mood: Mood) => void;
  onRevisitProfile: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.14fr)_minmax(280px,0.86fr)]">
      <PaperPanel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              今日起念
            </p>
            <h2 className="mt-3 text-3xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
              此刻你的状态如何？
            </h2>
          </div>
          <div className="seal-stamp">今日</div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
          先选今天的情绪底色，再让粒子球为你显出一卦。
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {moodOrder.map((mood) => {
            const selected = props.selectedMood === mood;
            return (
              <button
                key={mood}
                type="button"
                onClick={() => props.onSelectMood(mood)}
                className={`paper-choice text-left ${selected ? "paper-choice--selected" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-full border border-[color:var(--color-line)] px-3 py-1 text-sm text-[color:var(--color-vermillion)]">
                    {moodSealGlyphs[mood]}
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
                    Tap In
                  </p>
                </div>
                <p className="mt-5 text-lg text-[color:var(--color-ink)]">{moodLabels[mood]}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
                  选中后立即进入粒子成卦。
                </p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={props.onRevisitProfile}
          className="ghost-button mt-8"
        >
          重新填写长期画像
        </button>
      </PaperPanel>

      <PaperPanel className="flex flex-col justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
            当前画像
          </p>
          <h3 className="mt-3 text-2xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
            稳定底色仍会参与推演
          </h3>
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
            今天只补一个情绪入口，长期画像会继续作为知识检索和建议约束的一部分。
          </p>
        </div>

        {props.profile ? (
          <div className="flex flex-wrap gap-2">
            <Badge>{constitutionLabels[props.profile.constitution]}</Badge>
            {props.profile.healthTags.map((tag) => (
              <Badge key={tag}>{healthTagLabels[tag]}</Badge>
            ))}
          </div>
        ) : null}
      </PaperPanel>
    </div>
  );
}

function RitualScreen(props: {
  activation: RitualActivation | null;
  errorMessage: string;
  locationGranted: boolean;
  mood: Mood;
  onActivate: (activation: RitualActivation) => void;
  onBack: () => void;
  onContinue: () => void;
  onReset: () => void;
  platform: "web" | "h5";
  reducedMotion: boolean;
  remainingQuota: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
      <PaperPanel className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              混沌天场
            </p>
            <h2 className="mt-3 text-3xl leading-tight text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
              让流动粒子先替今天显出一卦
            </h2>
          </div>
          <div className="seal-stamp">{moodSealGlyphs[props.mood]}</div>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
          {props.platform === "web"
            ? "桌面端按下后松开即可成卦，粒子会在纸面上收拢成六爻，再给出一句即时天机语。"
            : "H5 端以长按成卦，按住 2 秒后粒子会缓缓落纸，先给你一句即时天机语。"}
        </p>

        <div className="mt-8 flex justify-center">
          <RitualSphere
            activation={props.activation}
            disabled={props.remainingQuota <= 0}
            mood={props.mood}
            onActivate={props.onActivate}
            platform={props.platform}
            reducedMotion={props.reducedMotion}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge>今日剩余 {props.remainingQuota}/{MAX_DAILY_QUOTA}</Badge>
          <Badge>{props.locationGranted ? "已读取定位增强" : "定位未开启，不影响主链路"}</Badge>
          <Badge>{props.platform === "web" ? "按下松开显卦" : "长按显卦"}</Badge>
        </div>

        {props.errorMessage ? (
          <p className="mt-5 rounded-3xl border border-[rgba(182,72,50,0.25)] bg-[rgba(182,72,50,0.08)] px-4 py-3 text-sm text-[color:var(--color-ink)]">
            {props.errorMessage}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={props.onBack} className="ghost-button">
            返回状态选择
          </button>
          {props.activation ? (
            <button type="button" onClick={props.onReset} className="ghost-button">
              重新聚卦
            </button>
          ) : null}
        </div>
      </PaperPanel>

      <AnimatePresence mode="wait">
        {props.activation ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <PreviewPanel activation={props.activation} onContinue={props.onContinue} />
          </motion.div>
        ) : (
          <motion.div
            key="ritual-copy"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <PaperPanel className="flex h-full flex-col justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
                  即时反馈
                </p>
                <h3 className="mt-3 text-2xl leading-tight text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
                  卦象会先以纸上六爻出现，再给一句天机语
                </h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
                  这一句是即时预览，不等待接口。等你完成补录后，终极卡会把 RAG 知识库、节气与今日体感一起收进去。
                </p>
              </div>

              <div className="space-y-3">
                <Badge>先显卦，再补录</Badge>
                <Badge>补录 3 题必答</Badge>
                <Badge>终极卡融合知识库</Badge>
              </div>
            </PaperPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreviewPanel(props: { activation: RitualActivation; onContinue: () => void }) {
  return (
    <PaperPanel className="flex h-full flex-col justify-between gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
          即时天机语
        </p>
        <div className="mt-5 rounded-[28px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.35)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm tracking-[0.3em] text-[color:var(--color-muted)]">卦象已成</p>
              <h3 className="mt-3 text-2xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
                {props.activation.hexagram.name}
              </h3>
            </div>
            <div className="seal-stamp">显</div>
          </div>

          <HexagramGlyph
            className="mt-6"
            compact
            lines={props.activation.hexagram.lines}
            changingLines={props.activation.hexagram.changingLines}
          />

          <blockquote className="mt-6 text-2xl leading-[1.65] text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong','Noto_Serif_SC',serif]">
            「{props.activation.previewCue}」
          </blockquote>
        </div>
      </div>

      <div>
        <p className="text-sm leading-7 text-[color:var(--color-muted)]">
          继续补录 3 个当日体感项，终极卡会把这句天机语收束成更完整的纸本避坑指南。
        </p>
        <button type="button" onClick={props.onContinue} className="seal-button mt-6 w-full">
          注入你的生理能量，开启避坑指南
        </button>
      </div>
    </PaperPanel>
  );
}

function SupplementFlow(props: {
  answers: DailySupplement;
  errorMessage: string;
  isGenerating: boolean;
  mood: Mood;
  onBack: () => void;
  onChange: (answers: DailySupplement) => void;
  onSubmit: () => void;
  ritualActivation: RitualActivation;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
      <PaperPanel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              今日补录
            </p>
            <h2 className="mt-3 text-3xl leading-tight text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
              把今天的体感补进纸面
            </h2>
          </div>
          <div className="seal-stamp">补录</div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
          这 3 题会真实进入检索与生成，不会写入长期画像。它们只服务今天这张天机卡。
        </p>

        <div className="mt-8 space-y-6">
          <SupplementQuestion
            description={supplementQuestionCopy.headSense.description}
            options={supplementOptions.headSense}
            title={supplementQuestionCopy.headSense.title}
            value={props.answers.headSense}
            onChange={(value) => props.onChange({ ...props.answers, headSense: value })}
          />
          <SupplementQuestion
            description={supplementQuestionCopy.sleepDuration.description}
            options={supplementOptions.sleepDuration}
            title={supplementQuestionCopy.sleepDuration.title}
            value={props.answers.sleepDuration}
            onChange={(value) => props.onChange({ ...props.answers, sleepDuration: value })}
          />
          <SupplementQuestion
            description={supplementQuestionCopy.tongueCoating.description}
            options={supplementOptions.tongueCoating}
            title={supplementQuestionCopy.tongueCoating.title}
            value={props.answers.tongueCoating}
            onChange={(value) => props.onChange({ ...props.answers, tongueCoating: value })}
          />
        </div>

        {props.errorMessage ? (
          <p className="mt-6 rounded-3xl border border-[rgba(182,72,50,0.25)] bg-[rgba(182,72,50,0.08)] px-4 py-3 text-sm text-[color:var(--color-ink)]">
            {props.errorMessage}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={props.onBack} className="ghost-button">
            返回天机语
          </button>
          <button type="button" onClick={props.onSubmit} className="seal-button" disabled={props.isGenerating}>
            {props.isGenerating ? "正在合成一日天机卡…" : "生成一日天机卡"}
          </button>
        </div>
      </PaperPanel>

      <PaperPanel className="flex h-full flex-col justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
            预览摘要
          </p>
          <h3 className="mt-3 text-2xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
            {props.ritualActivation.hexagram.name}
          </h3>
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
            当前情绪为 {moodLabels[props.mood]}。补录提交后，会基于这句预览天机继续扩成终极卡。
          </p>
        </div>

        <div className="rounded-[28px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.35)] p-5">
          <HexagramGlyph
            compact
            lines={props.ritualActivation.hexagram.lines}
            changingLines={props.ritualActivation.hexagram.changingLines}
          />
          <blockquote className="mt-5 text-2xl leading-[1.65] text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
            「{props.ritualActivation.previewCue}」
          </blockquote>
        </div>

        <div className="flex flex-wrap gap-2">
          {formatSupplementSummary(props.answers).map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </div>
      </PaperPanel>
    </div>
  );
}

function SupplementQuestion<T extends string>(props: {
  description: string;
  options: Array<{ value: T; label: string }>;
  title: string;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <section className="rounded-[26px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.28)] p-5">
      <h3 className="text-xl leading-tight text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
        {props.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{props.description}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            className={`paper-choice text-left ${props.value === option.value ? "paper-choice--selected" : ""}`}
          >
            <span className="text-sm leading-6 text-[color:var(--color-ink)]">{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const ResultView = forwardRef<HTMLDivElement, {
  entry: HistoryEntry;
  isSavingImage: boolean;
  mood: Mood;
  onOpenHistory: () => void;
  onRegenerate: () => void;
  onSaveImage: () => void;
  ritualActivation: RitualActivation | null;
}>(function ResultView(
  props: {
    entry: HistoryEntry;
    isSavingImage: boolean;
    mood: Mood;
    onOpenHistory: () => void;
    onRegenerate: () => void;
    onSaveImage: () => void;
    ritualActivation: RitualActivation | null;
  },
  ref
) {
  const result = props.entry.result;
  const currentHexagram = props.ritualActivation?.hexagram ?? null;
  const originChips = getKnowledgeOriginChips(result.meta.knowledgeIds);
  const supplementSummary = props.entry.supplementAnswers
    ? formatSupplementSummary(props.entry.supplementAnswers)
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_320px]">
      <motion.div
        ref={ref}
        className="paper-scroll"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              一日天机卡
            </p>
            <h2 className="mt-3 text-3xl leading-none text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
              {result.meta.hexagramName}
            </h2>
          </div>
          <div className="seal-stamp">机</div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge>{result.meta.solarTermName}</Badge>
          <Badge>{result.meta.ganZhiSummary}</Badge>
          <Badge>{result.meta.isFallback ? "基础 fallback" : result.meta.provider}</Badge>
        </div>

        {currentHexagram ? (
          <div className="mt-8 rounded-[28px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.34)] p-5">
            <HexagramGlyph lines={currentHexagram.lines} changingLines={currentHexagram.changingLines} />
          </div>
        ) : null}

        <blockquote className="mt-8 text-[2.2rem] leading-[1.55] text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong','Noto_Serif_SC',serif]">
          「{result.mysticSaying}」
        </blockquote>

        <p className="mt-5 text-base leading-8 text-[color:var(--color-muted)]">
          {result.mysticExplanation}
        </p>

        <div className="ink-divider mt-7" />

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              一日避坑指南
            </p>
            <div className="flex flex-wrap gap-2">
              {originChips.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </div>

          <ol className="mt-5 space-y-3">
            {result.healthAdvice.map((item, index) => (
              <li
                key={item}
                className="rounded-[24px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.28)] px-4 py-4 text-sm leading-7 text-[color:var(--color-ink)]"
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(182,72,50,0.24)] bg-[rgba(182,72,50,0.08)] text-xs text-[color:var(--color-vermillion)]">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </section>

        {supplementSummary.length > 0 ? (
          <section className="mt-7">
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
              今日注能
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {supplementSummary.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[26px] border border-[rgba(88,112,71,0.22)] bg-[rgba(88,112,71,0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--color-positive)]">宜</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.dos.map((item) => (
                <Badge key={item} tone="positive">
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-[rgba(154,80,61,0.22)] bg-[rgba(154,80,61,0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--color-negative)]">忌</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.donts.map((item) => (
                <Badge key={item} tone="negative">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-7 rounded-[26px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.26)] px-4 py-4 text-sm leading-7 text-[color:var(--color-muted)]">
          <p>{formatDateTime(result.meta.generatedAt)}</p>
          <p>request id: {result.meta.requestId.slice(0, 8)}</p>
        </div>
      </motion.div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <PaperPanel>
          <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
            今日印记
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="seal-stamp">{moodSealGlyphs[props.mood]}</div>
            <div>
              <p className="text-sm text-[color:var(--color-muted)]">情绪底色</p>
              <p className="mt-1 text-lg text-[color:var(--color-ink)]">{moodLabels[props.mood]}</p>
            </div>
          </div>

          {props.ritualActivation ? (
            <div className="mt-5 rounded-[24px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.26)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
                即时天机语
              </p>
              <p className="mt-3 text-base leading-7 text-[color:var(--color-ink)]">
                {props.ritualActivation.previewCue}
              </p>
            </div>
          ) : null}
        </PaperPanel>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={props.onSaveImage}
            disabled={props.isSavingImage}
            className="seal-button"
          >
            {props.isSavingImage ? "正在导出…" : "保存长图"}
          </button>
          <button type="button" onClick={props.onRegenerate} className="ghost-button">
            再起一卦
          </button>
          <button type="button" onClick={props.onOpenHistory} className="ghost-button">
            查看历史
          </button>
        </div>
      </div>
    </div>
  );
});

function HistoryDrawer(props: {
  history: HistoryEntry[];
  open: boolean;
  onClose: () => void;
  onResetLocalData: () => void;
  onSelect: (entry: HistoryEntry) => void;
}) {
  return (
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭历史"
            className="fixed inset-0 z-40 bg-[rgba(38,22,10,0.36)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />

          <motion.aside
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[78dvh] w-full max-w-3xl rounded-t-[34px] border border-[color:var(--color-line)] bg-[linear-gradient(180deg,rgba(248,243,232,0.98),rgba(242,231,213,0.98))] px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_80px_rgba(76,48,19,0.18)] sm:px-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto h-1.5 w-16 rounded-full bg-[rgba(40,26,14,0.14)]" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--color-muted)]">
                  历史归档
                </p>
                <h3 className="mt-3 text-2xl text-[color:var(--color-ink)] [font-family:'Songti_SC','STSong',serif]">
                  最近生成的天机卡
                </h3>
              </div>
              <button type="button" onClick={props.onClose} className="ghost-button">
                关闭
              </button>
            </div>

            <div className="mt-5 space-y-3 overflow-y-auto pb-4">
              {props.history.length === 0 ? (
                <div className="rounded-[26px] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.32)] p-4 text-sm leading-7 text-[color:var(--color-muted)]">
                  还没有历史记录。显出第一卦之后，它会静静留在这里。
                </div>
              ) : (
                props.history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => props.onSelect(entry)}
                    className="paper-choice w-full text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-[32rem]">
                        <p className="text-sm tracking-[0.26em] text-[color:var(--color-muted)]">
                          {entry.result.meta.hexagramName}
                        </p>
                        <p className="mt-2 text-lg text-[color:var(--color-ink)]">{entry.result.mysticSaying}</p>
                        {entry.supplementAnswers ? (
                          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
                            {formatSupplementSummary(entry.supplementAnswers).join(" / ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="seal-stamp">{moodSealGlyphs[entry.mood]}</div>
                        <p className="mt-3 text-xs leading-5 text-[color:var(--color-muted)]">
                          {formatDateTime(entry.result.meta.generatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="ink-divider mt-2" />

            <div className="mt-4">
              <button
                type="button"
                onClick={props.onResetLocalData}
                className="w-full rounded-[22px] border border-[rgba(154,80,61,0.28)] bg-[rgba(154,80,61,0.08)] px-4 py-3 text-sm text-[color:var(--color-negative)]"
              >
                重置本地数据
              </button>
              <p className="mt-2 text-xs leading-6 text-[color:var(--color-muted)]">
                会清空长期画像、历史、今日额度和设备标识，适合重新验证完整链路。
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
      ? "border-[rgba(88,112,71,0.22)] bg-[rgba(88,112,71,0.08)] text-[color:var(--color-positive)]"
      : props.tone === "negative"
        ? "border-[rgba(154,80,61,0.22)] bg-[rgba(154,80,61,0.08)] text-[color:var(--color-negative)]"
        : "border-[color:var(--color-line)] bg-[rgba(255,255,255,0.26)] text-[color:var(--color-muted)]";

  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs ${className}`}>{props.children}</span>;
}

function getKnowledgeOriginChips(knowledgeIds: string[]): string[] {
  const labels = new Set<string>();

  knowledgeIds.forEach((id) => {
    const category = id.split("-")[0];
    if (knowledgeOriginLabels[category]) {
      labels.add(knowledgeOriginLabels[category]);
    }
  });

  return [...labels];
}
