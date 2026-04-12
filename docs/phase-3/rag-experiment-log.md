# Hybrid RAG 实验记录

> 记录时间：2026-04-12  
> 目的：沉淀本轮 Hybrid RAG 的实现路径、实验步骤、命令入口和当前结论，避免重复排查。

## 1. 本轮目标

本轮不是继续扩基础设施，而是验证三件事：

- 现有仓库能否落地一个可运行的 Hybrid RAG
- 当前 `.env.local` 对应的 OpenAI 兼容通道能否支撑索引构建
- `rules` 和 `hybrid` 在真实生成链路下是否有正向收益

## 2. 实现路径

本轮实际改动集中在以下几处：

- `src/server/rag.ts`
  - 新增检索模式 `rules | hybrid`
  - 新增索引策略 `embedding | chat_signature | mock_hash`
  - 新增索引构建、query 向量构建、向量相似度与序列化能力
- `src/server/knowledge.ts`
  - 把原规则检索升级为“规则分 + 向量加权”的融合排序
  - 增加检索诊断信息，包括请求模式、实际模式、fallback 原因、向量候选与最终命中
- `src/server/generate-service.ts`
  - 在生成前准备检索上下文和 query 向量
  - 当索引不可用或 query 向量失败时自动降级回 `rules`
- `server/build-knowledge-index.ts`
  - 新增离线索引构建脚本
- `server/evaluate-generation.ts`
  - 支持 `--mode=rules|hybrid|compare`
- `server/test-quality.ts`
  - 增加 Hybrid 检索和降级分支测试

## 3. 索引构建实验过程

### 3.1 初始方案

初始方案只尝试 OpenAI embedding：

```bash
pnpm build:knowledge-index
```

首次失败原因有两层：

- 本地沙箱网络限制，无法发起外部请求
- 放开网络后，`.env.local` 里的 OpenAI 兼容通道不支持 `text-embedding-3-small`

通过查询模型列表确认，该通道只暴露聊天模型，例如：

- `gpt-5.4`
- `gpt-4.1`
- `gpt-4o`
- `gpt-4o-mini`

没有任何 `text-embedding-*` 模型。

### 3.2 调整后的索引策略

为兼容当前通道，索引构建改成三级兜底：

1. 优先使用真实 embedding
2. embedding 不可用时，用聊天模型生成固定维度的语义签名 `chat_signature`
3. 再失败时退到本地可复现的 `mock_hash`

### 3.3 构建结果

最终构建成功，命中的是 `chat_signature`：

- 索引文件：`src/server/knowledge-index.generated.ts`
- 索引策略：`chat_signature`
- 模型：`gpt-5.4`
- 条目数：`39`
- 向量维度：`35`

执行命令：

```bash
pnpm build:knowledge-index
```

## 4. 验证步骤

### 4.1 本地类型与质量检查

```bash
pnpm typecheck
pnpm test:quality
pnpm check
```

结果：

- 全部通过

### 4.2 Hybrid Smoke 验证

```bash
RAG_RETRIEVAL_MODE=hybrid AI_PROVIDER=fallback pnpm smoke
```

验证点：

- 日志中 `retrieval=hybrid`
- `requestedRetrieval=hybrid`
- `retrievalFallback=none`

本次已验证通过，说明 Hybrid 检索已真实参与运行，而不是静默降级。

## 5. 对比实验

### 5.1 先用 fallback 固定生成侧

命令：

```bash
AI_PROVIDER=fallback pnpm eval:generate -- --mode=compare
```

目的：

- 排除生成模型波动
- 先确认 `rules` 和 `hybrid` 在“检索层”是否真的产生不同选条结果

结果：

- `rules` 平均分：`71.4`
- `hybrid` 平均分：`71.4`
- 有 `6/10` 个样本的知识条目选择发生变化

说明：

- Hybrid 检索已经生效
- 但 fallback 文本模板很强，检索变化没有明显反映到总分上

### 5.2 再用真实模型跑 compare

命令：

```bash
pnpm eval:generate -- --mode=compare
```

第一次本地直接执行时，真实模型请求被本地网络限制拦住，表现为：

- `provider=fallback`
- `reason=network`

放开外网后再次执行，真实模型请求成功发出，但部分样本没有通过现有质量门槛，最终回退到 fallback。失败原因主要是：

- `至少 1 条 advice 需要明显承接节气动作`
- `至少 1 条 advice 需要明显承接人物状态或生活标签动作`
- `3 条 advice 里至少 2 条要能看出来自已选知识动作`

## 6. 真实模型对比结论

本轮真实模型 compare 的整体结果：

- `rules` 平均分：`80.2`
- `hybrid` 平均分：`78.0`
- `rules` 真实模型成功：`4/10`
- `hybrid` 真实模型成功：`3/10`

真实模型成功样本：

- `rules`: `anxious-irregular`, `angry-late-sleep`, `happy-regular`, `happy-sedentary`
- `hybrid`: `calm-irregular`, `tired-late-sleep`, `happy-regular`

发生知识条目变化的样本共 `6` 个，其中：

- 变好：`1` 个
  - `calm-irregular`：`78 -> 100`
- 变差：`3` 个
  - `anxious-irregular`：`100 -> 78`
  - `angry-late-sleep`：`100 -> 78`
  - `happy-sedentary`：`100 -> 78`
- 持平：`2` 个
  - `anxious-balanced`
  - `sad-irregular`

## 7. 当前判断

当前结论很明确：

- Hybrid 已经实现并可运行
- 当前 `.env.local` 下不需要 embedding 模型，也能通过 `chat_signature` 启用 Hybrid
- 但按这一次真实模型评测结果，`hybrid` 还不适合默认打开
- 当前默认仍应保持 `RAG_RETRIEVAL_MODE=rules`

原因不是检索完全无效，而是：

- Hybrid 改变了知识选择
- 但新的候选组合并没有稳定帮助模型通过现有 grounding / schema gate
- 所以部分样本反而更容易回退到 fallback

## 8. 后续如果继续推进，优先做什么

如果后续继续，不要先扩 infra，优先做这三件事：

1. 针对这 6 个变化样本逐条复盘 `rules` / `hybrid` 的选条差异
2. 调整融合权重，尤其是情绪与恢复动作之间的平衡
3. 针对 Hybrid 场景补 prompt 或 quality gate，让模型更容易显式承接节气动作和人物动作

## 9. 可复用命令清单

```bash
# 构建索引
pnpm build:knowledge-index

# 验证 Hybrid 是否实际生效
RAG_RETRIEVAL_MODE=hybrid AI_PROVIDER=fallback pnpm smoke

# 固定 fallback，只看检索差异
AI_PROVIDER=fallback pnpm eval:generate -- --mode=compare

# 用真实模型做 compare
pnpm eval:generate -- --mode=compare

# 常规检查
pnpm typecheck
pnpm test:quality
pnpm check
```
