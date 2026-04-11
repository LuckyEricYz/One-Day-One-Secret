# 一日天机

> 一个以节气、卦象和日常状态为输入的生活方式建议 H5。

## 项目定位

「一日天机」的目标不是算命，也不是健康诊断工具，而是把节气语境和轻量个体信息组合成一张可分享的“今日建议卡”。

产品输出只做三件事：

- 给出一句有意境的判词
- 给出一段白话解释
- 给出 3 条可执行的生活方式建议和 2 组宜忌

以下内容不属于当前 MVP：

- 疾病诊断、治疗建议、药物或保健品推荐
- 舌诊拍照识别
- RAG 向量检索
- 跨设备同步和账号体系

## 当前 MVP

MVP 只覆盖一条完整闭环：

1. 首次进入完成 5 题问卷，生成基础画像
2. 当日选择 1 个情绪状态
3. 长按生成今日天机
4. 查看结果卡
5. 保存长图或查看历史

MVP 统一决策如下：

- AI 默认平台：OpenAI
- 备用平台：Gemini
- 知识来源：本地 JSON 条目
- 每日额度：5 次
- 重置时间：`Asia/Shanghai` 自然日 `00:00`
- 本地存储键：`tianji_client_id`、`tianji_profile`、`tianji_history`、`tianji_quota`

## 输入与输出

核心输入：

- 节气与干支上下文
- 长按产生的随机种子
- 用户画像：体质类型、生活标签、今日状态

MVP 输出结构：

```json
{
  "mysticSaying": "一句不超过 20 字的判词",
  "mysticExplanation": "1-2 句白话解释",
  "healthAdvice": ["建议 1", "建议 2", "建议 3"],
  "dos": ["宜 1", "宜 2"],
  "donts": ["忌 1", "忌 2"],
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

## 文档入口

- [项目总览](./docs/project-overview.md)
- [文档中心](./docs/README.md)
- [API 规范](./docs/phase-1/api-spec.md)
- [交互流程](./docs/phase-2/interaction-flow.md)
- [隐私政策](./docs/phase-3/privacy-policy.md)

## 目录现状

当前仓库以文档为主，代码结构仍处于规划阶段。文档中的“计划目录”表示后续实现目标，不代表仓库已经具备对应实现。

## 文档维护规则

- 总览文档只写已确认决策，不保留互相冲突的备选口径
- 阶段文档优先服务实现，不用“看起来完整但无法落地”的伪规格
- 后续规划文档必须明确标注“非 MVP”
