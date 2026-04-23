# 一日天机文档中心

> 当前文档分为两类：现行产品规格、保留中的旧实验资料。

## 现行规格

| 文档 | 用途 | 状态 |
|:-----|:-----|:-----|
| [project-overview.md](./project-overview.md) | 产品定位、技术口径、统一决策 | ✅ 当前版本 |
| [phase-1/api-spec.md](./phase-1/api-spec.md) | 当前版本的本地接口与持久化边界 | ✅ 当前版本 |
| [phase-1/algorithm.md](./phase-1/algorithm.md) | 双角色纯本地生成规则 | ✅ 当前版本 |
| [phase-2/interaction-flow.md](./phase-2/interaction-flow.md) | 角色选择、弹窗、首页、历史流程 | ✅ 当前版本 |
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

- 当前主链路：固定双角色 + 今日卦象弹窗 + 首页四模块
- 内容来源：纯本地规则化，不依赖实时网络或模型调用
- 本地键：`tianji_v2_role_id`、`tianji_v2_history`、`tianji_v2_modal_seen`
- 历史规则：每个角色每天 1 条快照
- 旧服务端生成链路仅作为保留实验，不是现行主链路
