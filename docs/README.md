# 📚 一日天机 — 项目文档中心

> 本目录包含「一日天机」项目的全部技术文档与设计规范。

---

## 文档索引

### 🏗 项目总览
| 文档 | 说明 | 对应阶段 |
|:-----|:-----|:---------|
| [project-overview.md](./project-overview.md) | 项目架构总览、技术选型、目录结构 | 全局 |

### 🔮 第一阶段：核心算法 Demo（1 周）
| 文档 | 说明 | 状态 |
|:-----|:-----|:-----|
| [algorithm.md](./phase-1/algorithm.md) | 节气计算、天干地支推算、起卦算法的数学原理 | 📋 待实现 |
| [knowledge-base-spec.md](./phase-1/knowledge-base-spec.md) | 养生知识库的采集标准、分类体系、JSON Schema | 📋 待实现 |
| [prompt-tuning.md](./phase-1/prompt-tuning.md) | Prompt 工程手册：模板、调优记录、多平台适配 | 📋 待实现 |
| [api-spec.md](./phase-1/api-spec.md) | AI 多平台适配器接口规范 | 📋 待实现 |

### 🎴 第二阶段：H5 交互上线（2 周）
| 文档 | 说明 | 状态 |
|:-----|:-----|:-----|
| [design-system.md](./phase-2/design-system.md) | 新中式视觉设计系统：配色、字体、组件规范 | 📋 待实现 |
| [interaction-flow.md](./phase-2/interaction-flow.md) | 完整用户交互链路 + 异常处理 | 📋 待实现 |
| [deployment.md](./phase-2/deployment.md) | Vercel 部署配置、环境变量、域名绑定 | 📋 待实现 |
| [performance.md](./phase-2/performance.md) | 首屏加载优化、动画性能、图片压缩策略 | 📋 待实现 |

### 🧬 第三阶段：深度融合（1 个月后）
| 文档 | 说明 | 状态 |
|:-----|:-----|:-----|
| [tongue-diagnosis.md](./phase-3/tongue-diagnosis.md) | 舌诊 AI 接口对接方案 | 📋 待实现 |
| [data-storage.md](./phase-3/data-storage.md) | 数据持久化方案：LocalStorage → Supabase | 📋 待实现 |
| [rag-architecture.md](./phase-3/rag-architecture.md) | RAG 向量知识库架构设计 | 📋 待实现 |
| [privacy-policy.md](./phase-3/privacy-policy.md) | 用户健康数据隐私政策 | 📋 待实现 |

---

## 文档维护规则

- 每完成一个模块，更新对应文档状态为 `✅ 已完成`
- 文档中的代码示例应与实际实现保持同步
- 重大设计变更需在文档中记录变更日志
