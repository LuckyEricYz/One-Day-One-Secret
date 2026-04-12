# RAG 架构说明

> 当前仓库默认以 `hybrid` 检索运行；当索引或 query vector 不可用时，自动回退到 `rules`。

## 1. 当前状态

默认链路为：

```text
规则检索
  -> 保留节气和显式标签命中
本地 embedding 索引
  -> 补充语义候选
融合排序
  -> 继续输出 seasonal / targeted / recovery / supplemental
```

## 2. 当前实现边界

- 向量索引文件保存在仓库内，由 `pnpm build:knowledge-index` 离线生成
- 索引构建优先走 OpenAI embedding；若通道不支持，则退到 chat signature；再失败才退到本地 mock hash
- Runtime query 向量会跟随索引策略自动选择对应实现
- 不接入 pgvector、外部向量库或独立检索服务
- `POST /api/generate` 的请求/响应结构保持不变

## 3. 启用方式

```bash
pnpm build:knowledge-index
pnpm dev
AI_PROVIDER=fallback pnpm smoke
pnpm eval:generate -- --mode=compare
```

## 4. 降级规则

- 缺少或未构建 embedding 索引时，自动回退到 `rules`
- Query embedding 获取失败时，自动回退到 `rules`
- 索引版本或向量维度不可用时，自动回退到 `rules`

## 5. 近期不做

- 当前不接入 pgvector
- 当前不做在线知识管理后台
- 当前不把 query embedding 暴露成独立接口
