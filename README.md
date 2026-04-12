# 一日天机

> 一个以“粒子成卦 + 纸本天机卡”为核心体验的节气生活方式应用。

## 项目定位

「一日天机」不是算命工具，也不是健康诊断产品。它把节气语境、轻量个体信息和知识检索结果折成一张可分享的“今日避坑指南”。

当前输出固定为：

- 1 句判词
- 1 段白话解释
- 3 条可执行建议
- 2 组宜忌

## 当前主链路

1. 首次进入完成 5 题问卷，生成长期画像
2. 当日选择 1 个情绪状态
3. Web 点击 / H5 长按粒子球，让混沌成卦
4. 即时显示卦象与一句天机语
5. 完成 3 题当日补录
6. 生成融合节气、卦象与知识库的“一日天机卡”
7. 保存长图或查看历史

## 当前约束

- 不提供疾病诊断、治疗建议、药物或保健品推荐
- 不做舌诊拍照识别
- 不做账号体系和跨设备同步
- 不做长期趋势分析

## 技术口径

- 前端：Vite + React
- 样式：Tailwind CSS + CSS 变量
- 动画：Framer Motion + 轻量 canvas
- API：`POST /api/generate`
- 默认检索：`hybrid`，不可用时自动回退 `rules`
- 默认模型路径：OpenAI，失败后回本地 fallback
- 存储：`LocalStorage`

## 本地联调

```bash
cp .env.example .env.local
# 编辑 .env.local 填入真实密钥

pnpm dev
pnpm typecheck
pnpm test:quality
pnpm build
AI_PROVIDER=fallback pnpm smoke
RAG_RETRIEVAL_MODE=hybrid AI_PROVIDER=fallback pnpm smoke
```

说明：

- `.env.local` 提供默认值，命令行环境变量会覆盖同名配置
- `AI_PROVIDER` 支持 `auto`、`openai`、`kimi`、`gemini`、`fallback`
- `RAG_RETRIEVAL_MODE` 支持 `hybrid`、`rules`，默认使用 `hybrid`
- `pnpm build:knowledge-index` 会按 `embedding -> chat signature -> mock hash` 顺序构建索引

## 文档入口

- [项目总览](./docs/project-overview.md)
- [文档中心](./docs/README.md)
- [API 规范](./docs/phase-1/api-spec.md)
- [交互流程](./docs/phase-2/interaction-flow.md)
- [视觉规范](./docs/phase-2/design-system.md)
- [隐私政策](./docs/phase-3/privacy-policy.md)

## 文档维护规则

- 只保留当前实现口径，不保留互相冲突的旧流程
- 阶段文档优先服务实现，不写无法落地的伪规格
- 后续规划必须明确标注为“非当前版本”
