# 一日天机项目总览

> 一款围绕“今日生活建议卡”展开的节气灵感 H5。

## 1. 产品定位

### 1.1 我们要做什么

「一日天机」把三类信息组合成一张每日建议卡：

- 天：日期、节气、干支
- 地：本地知识条目与卦象语义
- 人：基础画像、生活标签、当日状态

结果页只输出轻量生活方式建议，强调仪式感和可分享性。

### 1.2 我们不做什么

- 不做疾病诊断
- 不给治疗方案
- 不推荐药物、品牌或保健品
- 不把问卷结果表述为医学结论

## 2. MVP 范围

MVP 只保留以下能力：

1. 5 题首次问卷
2. 6 选 1 今日状态
3. 长按生成卦象
4. 本地知识检索 + LLM 生成
5. 展示与保存天机卡
6. 本地历史记录与每日额度控制

以下内容明确排除在 MVP 之外：

- 舌诊拍照识别
- 向量 RAG
- 用户账号与跨设备同步
- 长期健康趋势分析

## 3. 技术口径

| 模块 | 当前决策 | 说明 |
|:-----|:---------|:-----|
| 前端 | Vite + React | H5 主体 |
| 样式 | Tailwind CSS + CSS 变量 | 组件开发快，主题统一 |
| 动画 | Framer Motion | 只用于必要的入场与长按动效 |
| API | Vercel Serverless Function | 单接口 `POST /api/generate` |
| 默认 AI | OpenAI | 当前主平台 |
| 备用 AI | Gemini | 主平台失败时切换 |
| 知识库 | 本地 JSON | 先做稳定规则检索，不上 RAG |
| 存储 | LocalStorage | 保存画像、历史、额度、匿名 client id |

## 4. 统一数据模型

### 4.1 用户画像

```json
{
  "constitution": "qi_deficiency",
  "healthTags": ["late_sleep", "sedentary"],
  "todayMood": "tired",
  "tongueDiagnosis": null
}
```

#### constitution 枚举

- `balanced`
- `qi_deficiency`
- `yang_deficiency`
- `yin_deficiency`
- `qi_stagnation`
- `phlegm_dampness`

#### healthTags 枚举

- `late_sleep`
- `sedentary`
- `irregular_diet`
- `regular_exercise`

#### todayMood 枚举

- `happy`
- `calm`
- `tired`
- `anxious`
- `sad`
- `angry`

#### tongueDiagnosis

当前 MVP 默认 `null`。如后续引入手选舌象，仅允许：

- `option_a`
- `option_b`
- `option_c`

### 4.2 生成结果

```json
{
  "mysticSaying": "震雷未息，宜收不宜争",
  "mysticExplanation": "今天更适合把力气用在整理节奏，而不是继续加码。",
  "healthAdvice": [
    "午后慢走 20 分钟，给身体一个缓冲段",
    "晚餐保持七分饱，减少辛辣和酒精",
    "23:00 前结束高强度输入，给睡眠留余地"
  ],
  "dos": ["散步", "早睡"],
  "donts": ["熬夜", "暴食"],
  "meta": {
    "solarTermName": "清明",
    "ganZhiSummary": "丙午年 辛卯月 戊辰日",
    "hexagramName": "雷天大壮",
    "knowledgeIds": ["seasonal-003", "sleep-004"],
    "generatedAt": "2026-04-11T13:30:00.000Z",
    "provider": "openai",
    "isFallback": false
  }
}
```

## 5. 计划中的实现模块

以下结构是后续代码实现目标，不表示仓库当前已经具备这些文件：

```text
src/
  core/
    calendar/
    divination/
    knowledge/
    ai/
  components/
  pages/
  utils/
api/
  generate.ts
data/
  knowledge/
```

## 6. 关键流程

```text
进入应用
  -> 读取 tianji_client_id 和 tianji_profile
  -> 首次用户完成问卷
  -> 当日选择 mood
  -> 长按生成随机种子
  -> 服务端计算节气上下文、起卦、知识检索
  -> 调用 OpenAI
  -> 校验 JSON
  -> 返回结果并写入 tianji_history / tianji_quota
```

## 7. 统一决策

- 默认 AI 平台固定为 OpenAI，Gemini 只做故障切换
- 每次成功返回天机卡都计入 1 次额度，包括 fallback 结果
- 每日额度为 5 次，按 `Asia/Shanghai` 自然日 `00:00` 重置
- 本地存储键固定为 `tianji_client_id`、`tianji_profile`、`tianji_history`、`tianji_quota`
- 所有阶段三文档都视为升级规划，不作为当前实现依据
