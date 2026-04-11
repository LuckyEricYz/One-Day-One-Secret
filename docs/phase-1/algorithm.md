# 生成算法说明

> 当前文档只保留 MVP 需要的确定规则，不再把未验证的复杂公式写成既定实现。

## 1. 总体流程

```text
timestamp
  -> 获取节气与干支上下文
pressDurationMs + touchEntropy
  -> 生成卦象
userProfile
  -> 参与知识检索和 Prompt 组装
calendarContext + hexagram + knowledge
  -> LLM 生成天机卡
```

## 2. 日历上下文

### 2.1 实现原则

- 节气和干支使用经过校验的农历/黄历能力获取
- MVP 不要求自行实现天文公式
- 实现结果必须对照 2024-2030 的参考表做验收

### 2.2 返回结构

```ts
type CalendarContext = {
  solarTermKey: string;
  solarTermName: string;
  solarTermStage: "start" | "middle" | "end";
  ganZhiSummary: string;
  dateKey: string;
};
```

### 2.3 solarTermStage 规则

- 节气开始后第 1-4 天：`start`
- 第 5-10 天：`middle`
- 第 11 天到下一个节气前：`end`

## 3. 起卦规则

### 3.1 输入

- `pressDurationMs`
- `timestamp`
- `touchEntropy`，缺省视为 `0`

### 3.2 随机种子

```text
seed = pressDurationMs * 131 + (timestamp % 100000) + touchEntropy
```

### 3.3 六爻生成

使用固定线性同余生成器，保证相同输入得到相同输出。

```text
next = (seed * 1103515245 + 12345) & 0x7fffffff

lineValue = next % 4
0 -> 老阴
1 -> 少阳
2 -> 少阴
3 -> 老阳
```

连续生成 6 次，按自下而上顺序组成卦象。

### 3.4 卦象结果结构

```ts
type HexagramContext = {
  key: string;
  name: string;
  changedName: string | null;
  lines: number[];
  changingLines: number[];
};
```

### 3.5 数据来源

- 64 卦基础表维护在本地 JSON
- 每条卦象只提供名称、基础语义和一条简短提示
- MVP 不单独维护复杂五行权重表

## 4. 问卷与画像判定

### 4.1 体质只用于内容分流

问卷结果只用于内容路由，不代表医学结论。

### 4.2 评分规则

前 4 题每题给 1 个或 2 个类型加分：

| 题目 | 选项 | 加分 |
|:-----|:-----|:-----|
| 睡眠 | 经常失眠浅眠 | `yin_deficiency +2` |
| 睡眠 | 偶尔不好 | `qi_deficiency +1` |
| 睡眠 | 一般都很好 | `balanced +2` |
| 手脚温度 | 经常冰凉 | `yang_deficiency +2` |
| 手脚温度 | 有时偏凉 | `qi_deficiency +1` |
| 手脚温度 | 一般温暖 | `balanced +2` |
| 消化 | 容易胀气不适 | `qi_stagnation +2` |
| 消化 | 容易腹泻 | `phlegm_dampness +2` |
| 消化 | 很少有问题 | `balanced +2` |
| 情绪 | 容易焦虑紧张 | `qi_stagnation +2` |
| 情绪 | 容易压抑低落 | `qi_stagnation +1`, `qi_deficiency +1` |
| 情绪 | 基本平稳 | `balanced +2` |

### 4.3 决胜规则

- 取得分最高的类型作为 `constitution`
- `balanced` 与其他类型并列时，优先选择其他类型
- 多个非 `balanced` 并列时，按以下优先级取第一项：
  `qi_stagnation > phlegm_dampness > yang_deficiency > yin_deficiency > qi_deficiency`

### 4.4 生活标签

第 5 题直接映射为 `healthTags`：

- 长期久坐 -> `sedentary`
- 经常熬夜 -> `late_sleep`
- 饮食不规律 -> `irregular_diet`
- 规律运动 -> `regular_exercise`
- 无以上情况 -> 不写入标签

## 5. 知识检索优先级

MVP 使用规则打分，不做向量检索。

| 命中项 | 分值 |
|:-------|:-----|
| 节气命中 | +4 |
| 体质命中 | +3 |
| 今日状态命中 | +2 |
| 每个生活标签命中 | +1 |

规则：

- 取得分最高的 5 条注入 Prompt
- 至少保留 1 条季节类条目
- 如果没有任何条目命中，使用“节气通用条目 + 睡眠通用条目”补齐

## 6. Prompt 组装优先级

Prompt 上下文优先顺序固定为：

1. 今日状态与体质
2. 节气与干支
3. 卦象语义
4. 命中的知识条目

这意味着模型生成建议时，优先考虑当日状态与行为建议，而不是把卦象扩展成过度解释。

## 7. 验收标准

- 相同输入必须生成相同卦象
- 节气与干支结果能通过参考日历抽样核对
- 问卷结果能稳定落到 6 个固定类型之一
- 检索结果在同一输入下顺序稳定
- 生成结果始终满足 API 输出结构
