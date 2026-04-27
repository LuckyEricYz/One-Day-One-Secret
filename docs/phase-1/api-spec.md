# 当前接口与持久化边界

> 当前版本的运行时主链路是纯本地规则，不要求任何网络接口。

## 1. 当前公开边界

当前版本对外真正稳定的“接口”只有两类：

1. 前端本地计算 `DailySnapshot`
2. 本地存储个人资料、弹窗已读状态和历史快照

## 2. 本地域模型

### 2.1 个人资料

```ts
type Gender = "male" | "female";
type BirthHourBranch =
  | "zi" | "chou" | "yin" | "mao"
  | "chen" | "si" | "wu" | "wei"
  | "shen" | "you" | "xu" | "hai";

type StoredUserProfileV3 = {
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  birthHourBranch: BirthHourBranch | null;
  birthPlace: string;
  currentPlace: string;
  createdAt: string;
  updatedAt: string;
  version: 1;
};
```

### 2.2 每日快照

```ts
type DailySnapshot = {
  id: string; // `${profileHash}-${dateKey}`
  profileHash: string;
  profileLabel: string;
  dateKey: string;
  generatedAt: string;
  calendar: CalendarContext;
  seasonalSummary: string;
  profileDigest: string;
  birthTimeSummary: string;
  locationSummary: string;
  almanac: {
    dos: string[];
    donts: string[];
    statusTitle: string;
    statusSummary: string;
    hourNote: string;
    locationNote: string;
  };
  hexagram: DailyHexagram;
  exercises: ExerciseItem[];
  acupoint: AcupointItem;
  recipe: RecipeItem;
};
```

### 2.3 历史快照

```ts
type HistoryEntryV3 = {
  id: string;
  profileHash: string;
  dateKey: string;
  savedAt: string;
  snapshot: DailySnapshot;
};
```

## 3. 本地存储键

```text
tianji_v3_profile
tianji_v3_history
tianji_v3_modal_seen
tianji_v3_profile_schema
```

规则：

- `tianji_v3_profile` 保存用户主动填写的资料
- `tianji_v3_history` 保存去重后的历史快照
- `tianji_v3_modal_seen` 记录 `${profileHash}:${dateKey}` 是否已读
- `tianji_v3_profile_schema` 标记当前资料 schema
- 首次进入 v3 会清理旧 `tianji_v2_*` 角色数据

## 4. 行为规则

- 同一资料同一天必须生成相同 `DailySnapshot`
- 同一资料每天只保留一条历史记录
- 修改资料后立即重新计算，并重新触发卦象弹窗
- 跨日后自动更新 `dateKey` 和快照内容
- 不请求浏览器定位，不调用远端生成接口

## 5. 旧接口说明

仓库中仍保留 `POST /api/generate` 及相关 AI / RAG 实验代码，供旧实验或对照使用，但它不再是当前版本的默认接口，也不是当前前端运行时的依赖。
