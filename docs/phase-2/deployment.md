# 🚀 部署指南

> Vercel 部署配置、环境变量设置与 CI/CD 流程

---

## 1. 部署架构

```
GitHub (main branch)
    │
    │ Push / PR Merge
    ▼
Vercel (自动构建)
    │
    ├── 静态资源 ──→ Vercel Edge CDN (全球加速)
    │
    └── /api/* ────→ Vercel Serverless Functions
                          │
                          ├── OpenAI API
                          └── (备选) Gemini API
```

---

## 2. Vercel 项目配置

### 2.1 vercel.json

```json
{
  "framework": "vite",
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "regions": ["hkg1"],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/fonts/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

> **Region**: 选择 `hkg1`（香港）以降低国内用户访问延迟

### 2.2 环境变量配置

在 Vercel Dashboard → Settings → Environment Variables 中设置：

| 变量名 | 值 | 环境 | 说明 |
|:-------|:---|:-----|:-----|
| `AI_PROVIDER` | `openai` | Production, Preview | AI 平台选择 |
| `OPENAI_API_KEY` | `sk-...` | Production, Preview | OpenAI Key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Production, Preview | 模型名 |
| `RATE_LIMIT_PER_DAY` | `5` | Production | 每日限额 |
| `GEMINI_API_KEY` | `AIza...` | Production, Preview | Gemini Key（备选） |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Production, Preview | Gemini 模型 |

### 2.3 GitHub 集成

1. 在 Vercel Dashboard 中 Import GitHub Repository
2. 选择 `LuckyEricYz/One-Day-One-Secret`
3. Framework Preset: Vite
4. Root Directory: `./`
5. 自动部署触发：push to `main` branch

---

## 3. 本地开发

### 3.1 环境准备

```bash
# 克隆项目
git clone https://github.com/LuckyEricYz/One-Day-One-Secret.git
cd One-Day-One-Secret

# 安装依赖
pnpm install

# 创建本地环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 API Keys

# 启动开发服务器
pnpm run dev
```

### 3.2 本地 Serverless 函数调试

```bash
# 安装 Vercel CLI
pnpm add -g vercel

# 链接项目
vercel link

# 拉取线上环境变量到本地
vercel env pull .env.local

# 使用 Vercel Dev 启动（支持 /api 路由）
vercel dev
```

---

## 4. CI/CD 流程

### 4.1 分支策略

```
main ────→ Production 自动部署
  │
  └── feature/* ──→ Preview 部署（每个 PR 独立 URL）
```

### 4.2 构建流程

```
1. pnpm install        (依赖安装)
2. pnpm run lint       (代码检查)
3. pnpm run build      (Vite 生产构建)
4. Vercel 自动部署
```

### 4.3 预览部署
- 每个 Pull Request 自动生成预览 URL
- 格式：`one-day-one-secret-{hash}.vercel.app`
- 用于代码 Review 和测试

---

## 5. 域名配置（后续）

### 5.1 当前
- 使用 Vercel 默认域名：`one-day-one-secret.vercel.app`

### 5.2 自定义域名绑定（后续操作）
1. 在 Vercel Dashboard → Settings → Domains
2. 添加自定义域名
3. 在域名注册商处添加 DNS 记录
4. 等待 SSL 证书自动签发

---

## 6. 监控与日志

### 6.1 Vercel Analytics（免费）
- 自动收集 Core Web Vitals
- 页面加载性能监控
- 无需额外配置

### 6.2 Serverless 函数日志
- Vercel Dashboard → Deployments → Functions
- 可查看每次 API 调用的日志与耗时
- 重点关注：AI API 响应时间、错误率

### 6.3 告警（后续）
- 可接入 Vercel 的 Webhook 通知
- API 错误率 > 10% 时触发告警
