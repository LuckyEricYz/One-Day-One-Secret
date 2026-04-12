# 一日天机项目总览

> 一款以“粒子成卦 + 纸本天机卡”为核心体验的节气灵感 Web/H5 应用。

## 1. 产品定位

「一日天机」把三类信息折成一张当日生活建议卡：

- 天：日期、节气、干支
- 地：本地知识条目与 Hybrid RAG 检索结果
- 人：长期画像、今日情绪、当日补录体感

产品目标不是算命，也不是健康诊断，而是提供一张有仪式感、可分享、低风险的“一日避坑指南”。

## 2. 当前版本范围

当前版本主链路固定为：

1. 首次 5 题问卷，生成长期画像
2. 今日选择 1 个情绪状态
3. Web 点击 / H5 长按粒子球，让混沌成卦
4. 即时显示卦象与一句“天机语”
5. 完成 3 题当日补录
6. 生成融合节气、卦象与知识库的“一日天机卡”
7. 保存长图 / 查看历史

当前明确不做：

- 疾病诊断
- 治疗方案、药物、品牌推荐
- 舌诊拍照识别
- 账号与跨设备同步
- 长期趋势分析

## 3. 技术口径

| 模块 | 当前决策 | 说明 |
|:-----|:---------|:-----|
| 前端 | Vite + React | 单仓 Web/H5 共用 |
| 样式 | Tailwind CSS + CSS 变量 | 纸本主题 token + 组件样式 |
| 动画 | Framer Motion + 轻量 canvas | 页面转场 + 粒子成卦 |
| API | Vercel Serverless Function | 单接口 `POST /api/generate` |
| 默认检索 | `hybrid` | 索引不可用时自动回退 `rules` |
| 默认模型路径 | OpenAI | 失败后回本地 fallback |
| 存储 | LocalStorage | 画像、历史、额度、匿名 client id |

## 4. 统一数据模型

### 4.1 长期画像

```json
{
  "constitution": "qi_deficiency",
  "healthTags": ["late_sleep", "sedentary"],
  "createdAt": "2026-04-11T13:30:00.000Z",
  "updatedAt": "2026-04-11T13:30:00.000Z",
  "version": 1
}
```

### 4.2 当日补录

```json
{
  "headSense": "slightly_full",
  "sleepDuration": "short",
  "tongueCoating": "thin_white"
}
```

枚举固定为：

- `headSense`: `clear` / `slightly_full` / `rising`
- `sleepDuration`: `short` / `medium` / `long`
- `tongueCoating`: `thin_white` / `thick_white` / `slightly_yellow`

### 4.3 结果卡

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
    "isFallback": false,
    "requestId": "9d7c3e1e-70b8-4604-b97f-cc5b2efdf6b8"
  }
}
```

## 5. 关键流程

```text
进入应用
  -> 读取 tianji_client_id / tianji_profile / tianji_history / tianji_quota
  -> 首次用户完成 5 题画像问卷
  -> 选择今日情绪
  -> Web 点击或 H5 长按粒子球
  -> 前端本地即时起卦，显示卦象 + 天机语
  -> 用户完成 3 题当日补录
  -> 服务端计算节气、复用同一卦象种子、执行 Hybrid RAG 检索
  -> 调用模型生成结构化结果
  -> 校验 JSON
  -> 返回终极卡并写入 tianji_history / tianji_quota
```

## 6. 统一决策

- 默认输出始终是生活方式建议，不作医学结论
- 当日补录只参与本次生成，不写入长期画像
- 每次成功返回天机卡都计入 1 次额度，包括 fallback 结果
- 每日额度为 5 次，按 `Asia/Shanghai` 自然日 `00:00` 重置
- 本地存储键固定为 `tianji_client_id`、`tianji_profile`、`tianji_history`、`tianji_quota`
