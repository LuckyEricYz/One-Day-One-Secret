# 🚀 部署指南

> 当前采用混合模式：GitHub Actions 负责检查，Vercel Git 集成负责自动部署。

---

## 1. 目标结构

```text
Pull Request / main push
  ├── GitHub Actions
  │     └── pnpm check
  └── Vercel Git Integration
        ├── PR / feature branch -> Preview
        └── main -> Production
```

当前阶段先打通部署链路，不要求真实模型上线。因此 Preview 和 Production 都可以先使用 `AI_PROVIDER=fallback`。

---

## 2. 仓库内配置

### 2.1 GitHub Actions

仓库新增 [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)，在以下事件运行：

- `pull_request` 到 `main`
- `push` 到 `main`

执行内容固定为：

```text
1. pnpm install --frozen-lockfile
2. pnpm check
```

### 2.2 vercel.json

当前仓库的 [vercel.json](../../vercel.json) 负责：

- `framework = vite`
- `buildCommand = pnpm build`
- `outputDirectory = dist`
- `regions = ["hkg1"]`
- SPA 路由 rewrite 到 `index.html`

---

## 3. 你需要在平台里手动配置的内容

### 3.1 GitHub

- 仓库管理员权限
- 启用 GitHub Actions
- 给 `main` 配置 Branch protection
- 将 `CI / check` 设为 required status check

### 3.2 Vercel

1. 在 Vercel Dashboard 中导入当前 GitHub 仓库
2. Framework Preset 选择 `Vite`
3. Root Directory 保持 `./`
4. Production Branch 选择 `main`
5. 保持 Git Integration 开启

### 3.3 Vercel 环境变量

如果只是先打通部署，不接模型，最小配置只需要：

| 变量名 | 值 | 环境 | 说明 |
|:-------|:---|:-----|:-----|
| `AI_PROVIDER` | `fallback` | Preview, Production | 强制走本地 fallback，避免模型变量阻塞部署 |

等模型方案确认后，再补这些变量：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

> 当前方案不需要 GitHub Secrets 里的 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`，因为部署不走 Vercel CLI。

---

## 4. 本地与预览验证

### 4.1 本地

```bash
pnpm install
pnpm check
pnpm dev
AI_PROVIDER=fallback pnpm smoke
```

### 4.2 Preview

- 发起一个到 `main` 的 PR
- 确认 GitHub Actions 通过
- 确认 Vercel 自动生成 Preview URL
- 打开站点，验证：
  - 首页可访问
  - 前端路由刷新不 404
  - `/api/generate` 返回 200
  - 返回结果 `meta.provider = "fallback"`

### 4.3 Production

- 合并到 `main`
- 确认 GitHub Actions 在 `main` 通过
- 确认 Vercel 自动生成 Production Deployment
- 验证线上站点和 `/api/generate` 正常可用

---

## 5. 后续升级

部署链路打通后，再单独做这两件事：

- 把 Preview / Production 环境从 `fallback` 切到真实模型
- 增加自定义域名、监控和告警
