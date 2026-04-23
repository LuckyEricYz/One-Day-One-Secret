# 当前接口与持久化边界

> 当前版本的运行时主链路是纯本地规则，不要求任何网络接口。

## 1. 当前公开边界

当前版本对外真正稳定的“接口”只有两类：

1. 前端本地计算 `DailySnapshot`
2. 本地存储当前角色、弹窗已读状态和历史快照

## 2. 本地域模型

### 2.1 角色预设

```ts
type RoleId = "male" | "female";

type RolePreset = {
  id: RoleId;
  genderLabel: string;
  label: string;
  seal: string;
  roleSeed: number;
  intro: string;
  baseStatus: string[];
  baziSummary: string;
  annualFocus: string[];
  annualAvoids: string[];
  emotionTraits: string[];
  contentTags: RolePreferenceTag[];
};
```

### 2.2 每日快照

```ts
type DailySnapshot = {
  id: string; // `${roleId}-${dateKey}`
  roleId: RoleId;
  dateKey: string;
  generatedAt: string;
  calendar: CalendarContext;
  seasonalSummary: string;
  roleDigest: string;
  hexagram: DailyHexagram;
  exercises: ExerciseItem[];
  acupoint: AcupointItem;
  recipe: RecipeItem;
};
```

### 2.3 历史快照

```ts
type HistoryEntryV2 = {
  id: string;
  roleId: RoleId;
  dateKey: string;
  savedAt: string;
  snapshot: DailySnapshot;
};
```

## 3. 本地存储键

```text
tianji_v2_role_id
tianji_v2_history
tianji_v2_modal_seen
```

规则：

- `tianji_v2_role_id` 只保存当前角色
- `tianji_v2_history` 保存去重后的历史快照
- `tianji_v2_modal_seen` 记录 `${roleId}:${dateKey}` 是否已读

## 4. 行为规则

- 同一角色同一天必须生成相同 `DailySnapshot`
- 每个角色每天只保留一条历史记录
- 切换角色后立即重新计算，并重新触发卦象弹窗
- 跨日后自动更新 `dateKey` 和快照内容

## 5. 旧接口说明

仓库中仍保留 `POST /api/generate` 及相关 AI / RAG 实验代码，供旧实验或对照使用，但它不再是当前版本的默认接口，也不是当前前端运行时的依赖。
