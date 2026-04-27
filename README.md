# 一日天机

> 一个纯本地运行的极简养生 Web/H5 应用：填写基础资料，生成每日黄历、身体节律与一站式调理面板。

## 当前版本定位

当前版本不走问卷、成卦仪式或 AI 生成链路，主流程固定为：

1. 首次访问 `/` 自动进入 `/role` 填写个人资料
2. 资料包含性别、出生日期、可选出生时辰、出生地、当前所在地
3. 自动弹出今日卦象弹窗
4. 首页查看今日黄历、状态提示、身体节律和调理模块
5. 每天按 `Asia/Shanghai` 自然日自动更新内容

首页固定展示：

- 今日黄历
- 今日状态提示
- 当日一卦
- 身体节律
- 带薪健身
- 每日穴位
- 节气食谱

产品口径：

- 纯本地规则化，默认离线可用
- 不请求浏览器定位，不上传资料
- 不提供医疗诊断、治疗方案、药物或保健品推荐
- 不做账号、同步、长图保存和每日额度
- 保留本地历史快照，同一资料同一天 1 条

## 技术口径

- 前端：Vite + React
- 样式：Tailwind CSS + CSS 变量
- 内容生成：个人资料 + 上海日期 + 节气规则 + 本地内容池
- 存储：`LocalStorage`
- 运行时默认不依赖 `/api/generate`、模型密钥或知识库构建

仓库中仍保留旧的服务端 AI 生成实验代码和旧角色素材，但它们不是当前版本的默认主链路。

## 本地开发

```bash
pnpm install
pnpm optimize:media
pnpm dev
pnpm typecheck
pnpm test:daily-rules
pnpm build
```

`pnpm optimize:media` 会把 `src/public/*.mov` 源素材转成运行时使用的 `public/roles/*.webm`、`public/health/*.webm` 和 poster 图片。当前首页只继续使用 `public/health` 的动作视频。

如需查看旧的服务端生成实验，可单独执行：

```bash
pnpm test:quality
pnpm smoke
```

## 文档入口

- [项目总览](./docs/project-overview.md)
- [文档中心](./docs/README.md)
- [交互流程](./docs/phase-2/interaction-flow.md)
- [视觉规范](./docs/phase-2/design-system.md)
- [性能策略](./docs/phase-2/performance.md)

## 维护规则

- 文档只保留当前实现口径，不保留互相冲突的旧流程
- “当前版本”默认指个人资料纯本地版，不指旧的 AI 生成实验
- 任何新增资料字段、存储键或内容模块，都要同步更新文档和测试
