# 本地知识库规范

> MVP 的知识库目标是“可追溯、可检索、可解释”，不是做一个庞杂的养生百科。

## 1. 作用边界

知识库只承担两件事：

- 给 LLM 提供可信、可追溯的建议素材
- 限制输出范围，避免模型自由发挥成诊断或说教

以下内容不进入 MVP 知识库：

- 疾病治疗方案
- 药物、处方、保健品品牌
- 争议性强的疗法结论
- 需要专业医疗判断才能执行的建议

## 2. 数据来源

MVP 只保留两类来源：

| 类型 | 用途 | 要求 |
|:-----|:-----|:-----|
| 经典节气/起居文本 | 提供语言语境与季节生活建议 | 必须转写为现代可执行表达 |
| 现代公共健康指南 | 提供饮食、睡眠、运动、情绪建议 | 以公开指南和综述为主 |

## 3. 条目结构

```json
{
  "id": "seasonal-003",
  "sourceType": "classic",
  "sourceTitle": "黄帝内经·素问",
  "sourceSection": "四气调神大论",
  "category": "seasonal",
  "summary": "清明前后宜舒展、踏青、减少过饱和熬夜。",
  "actionItems": [
    "午后散步 15-20 分钟",
    "晚餐控制在七分饱",
    "23:00 前结束高强度工作"
  ],
  "avoidItems": ["暴食", "连续熬夜"],
  "tags": {
    "solarTerms": ["qingming"],
    "constitutions": ["balanced", "qi_deficiency"],
    "moods": ["tired", "anxious"],
    "healthTags": ["late_sleep"]
  },
  "priority": 0.9
}
```

### 3.1 字段要求

| 字段 | 说明 |
|:-----|:-----|
| `id` | 全局唯一，按类别前缀命名 |
| `summary` | 1-2 句简述，不超过 80 字 |
| `actionItems` | 2-3 条，可直接给用户执行 |
| `avoidItems` | 0-2 条，语气克制 |
| `priority` | `0-1`，用于同分排序 |

### 3.2 category 枚举

- `seasonal`
- `diet`
- `sleep`
- `exercise`
- `emotion`

### 3.3 tags 枚举

#### constitutions

- `balanced`
- `qi_deficiency`
- `yang_deficiency`
- `yin_deficiency`
- `qi_stagnation`
- `phlegm_dampness`

#### moods

- `happy`
- `calm`
- `tired`
- `anxious`
- `sad`
- `angry`

#### healthTags

- `late_sleep`
- `sedentary`
- `irregular_diet`
- `regular_exercise`

## 4. 检索规则

MVP 使用规则打分：

1. 节气命中 `+4`
2. 体质命中 `+3`
3. 状态命中 `+2`
4. 每个生活标签命中 `+1`
5. 按 `score DESC, priority DESC, id ASC` 排序
6. 取前 5 条

额外约束：

- Top 5 中至少包含 1 条 `seasonal`
- 同一类别最多取 2 条
- 如果没有命中条目，至少返回 1 条 `seasonal` 和 1 条 `sleep` 通用条目

## 5. 数据规模

MVP 目标为 60-80 条，优先覆盖：

| 类别 | 目标条数 |
|:-----|:---------|
| seasonal | 24 |
| diet | 12 |
| sleep | 10 |
| exercise | 8 |
| emotion | 8 |

## 6. 编写原则

- summary 必须能独立成立，不依赖上下文
- actionItems 必须是低风险、低门槛行为
- avoidItems 使用“减少/避免/不妨暂缓”语气，不使用命令式医疗表达
- 经典来源要转写成现代语句，避免直接把原文丢给模型

## 7. 样例

```json
{
  "id": "sleep-004",
  "sourceType": "guideline",
  "sourceTitle": "健康生活方式指南",
  "sourceSection": "睡眠建议",
  "category": "sleep",
  "summary": "疲惫状态下，比补偿性熬夜更有效的是提前结束输入，保证连续睡眠。",
  "actionItems": [
    "睡前 1 小时停止高强度工作",
    "把入睡时间提前 30 分钟",
    "晚间减少酒精和高糖零食"
  ],
  "avoidItems": ["熬夜追剧", "夜间暴食"],
  "tags": {
    "solarTerms": [],
    "constitutions": ["balanced", "qi_deficiency"],
    "moods": ["tired"],
    "healthTags": ["late_sleep"]
  },
  "priority": 0.8
}
```
