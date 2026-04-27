# 一日天机文档中心

> 当前文档分为两类：现行产品规格、保留中的旧实验资料。

## 现行规格

| 文档 | 用途 | 状态 |
|:-----|:-----|:-----|
| [project-overview.md](./project-overview.md) | 产品定位、技术口径、统一决策 | ✅ 当前版本 |
| [phase-1/api-spec.md](./phase-1/api-spec.md) | 当前版本的本地接口与持久化边界 | ✅ 当前版本 |
| [phase-1/algorithm.md](./phase-1/algorithm.md) | 个人资料纯本地生成规则 | ✅ 当前版本 |
| [phase-2/interaction-flow.md](./phase-2/interaction-flow.md) | 资料填写、弹窗、首页、历史流程 | ✅ 当前版本 |
| [phase-2/design-system.md](./phase-2/design-system.md) | 纸本留白视觉约束与组件规范 | ✅ 当前版本 |
| [phase-2/performance.md](./phase-2/performance.md) | 当前版本性能目标与降级策略 | ✅ 当前版本 |
| [phase-3/privacy-policy.md](./phase-3/privacy-policy.md) | 隐私边界与非医疗口径 | ✅ 当前版本 |

## 保留资料

以下文档对应旧的 AI / RAG 实验链路，仓库保留资料，但不代表当前版本默认能力：

- [phase-1/knowledge-base-spec.md](./phase-1/knowledge-base-spec.md)
- [phase-1/prompt-tuning.md](./phase-1/prompt-tuning.md)
- [phase-3/data-storage.md](./phase-3/data-storage.md)
- [phase-3/rag-architecture.md](./phase-3/rag-architecture.md)
- [phase-3/rag-experiment-log.md](./phase-3/rag-experiment-log.md)
- [phase-3/tongue-diagnosis.md](./phase-3/tongue-diagnosis.md)

## 当前统一口径

- 当前主链路：个人资料 + 今日卦象弹窗 + 今日黄历 + 首页调理模块
- 内容来源：纯本地规则化，不依赖实时网络或模型调用
- 本地键：`tianji_v3_profile`、`tianji_v3_history`、`tianji_v3_modal_seen`、`tianji_v3_profile_schema`
- 历史规则：同一资料每天 1 条快照
- 旧服务端生成链路仅作为保留实验，不是现行主链路
