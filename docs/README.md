# 一日天机文档中心

> 当前文档分为两类：MVP 现行规格、后续升级规划。

## MVP 现行规格

| 文档 | 用途 | 状态 |
|:-----|:-----|:-----|
| [project-overview.md](./project-overview.md) | 产品定位、技术口径、统一决策 | ✅ 已收敛 |
| [phase-1/api-spec.md](./phase-1/api-spec.md) | 请求/响应结构、错误码、限额规则 | ✅ 已收敛 |
| [phase-1/algorithm.md](./phase-1/algorithm.md) | 节气上下文、起卦和生成上下文规则 | ✅ 已收敛 |
| [phase-1/knowledge-base-spec.md](./phase-1/knowledge-base-spec.md) | 本地知识条目格式与检索规则 | ✅ 已收敛 |
| [phase-1/prompt-tuning.md](./phase-1/prompt-tuning.md) | Prompt、安全边界与兜底策略 | ✅ 已收敛 |
| [phase-2/interaction-flow.md](./phase-2/interaction-flow.md) | MVP 用户链路、问卷和本地状态流转 | ✅ 已收敛 |
| [phase-2/design-system.md](./phase-2/design-system.md) | MVP 视觉约束与核心组件规范 | ✅ 已收敛 |
| [phase-2/performance.md](./phase-2/performance.md) | MVP 性能目标与降级策略 | ✅ 已收敛 |
| [phase-2/deployment.md](./phase-2/deployment.md) | 部署与运维说明 | 📋 待实施 |

## 后续升级规划

| 文档 | 用途 | 状态 |
|:-----|:-----|:-----|
| [phase-3/data-storage.md](./phase-3/data-storage.md) | 本地存储现状与未来同步升级方向 | 🧭 规划中 |
| [phase-3/rag-architecture.md](./phase-3/rag-architecture.md) | 实验性 Hybrid RAG 的启用方式与边界 | 🛠 实验版 |
| [phase-3/rag-experiment-log.md](./phase-3/rag-experiment-log.md) | 本轮 Hybrid RAG 的操作路径、实验步骤与结论 | 📝 记录中 |
| [phase-3/tongue-diagnosis.md](./phase-3/tongue-diagnosis.md) | 舌象输入升级路线 | 🧭 规划中 |
| [phase-3/privacy-policy.md](./phase-3/privacy-policy.md) | MVP 隐私承诺与后续能力边界 | ✅ 已收敛 |

## 当前统一口径

- 产品类型：生活方式建议应用，不做医疗诊断
- AI 默认平台：OpenAI，Gemini 仅作备用
- MVP 知识库：本地 JSON
- MVP 限额：每日 5 次，`Asia/Shanghai` 零点重置
- MVP 本地键：`tianji_client_id`、`tianji_profile`、`tianji_history`、`tianji_quota`

## 维护规则

- 文档一旦出现冲突，以 `project-overview.md` 和 `api-spec.md` 为准
- 后续规划不得回写成“当前已实现”
- 任何新增输入字段，必须同步更新 API、存储和隐私文档
