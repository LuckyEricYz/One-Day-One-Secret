# 🌌 一日天机 — 项目架构总览

> 天地人·三位一体养生玄学 H5 应用

---

## 1. 项目定位

「一日天机」是一款融合中国传统哲学（天干地支、节气、易经卦象）与现代养生科学的 H5 应用。用户通过"起卦"交互，每日获取个性化的养生天机卡——既有玄学韵味的判词，也有科学依据的健康建议。

### 核心差异化
- **不是算命**：所有输出都有科学养生依据支撑
- **不是说教**：AI 以「温柔的观察者」人设输出，用自然意象引导
- **不是千篇一律**：天（时空）+ 地（知识库）+ 人（个性化画像）三维加权，每人每日唯一

---

## 2. 技术选型

| 模块 | 技术 | 理由 |
|:-----|:-----|:-----|
| 前端框架 | **Vite + React 18** | 极速 HMR，构建快，生态成熟 |
| 样式方案 | **Tailwind CSS v4** | 快速实现"新中式"高级感，原子化 CSS |
| 交互动画 | **Framer Motion** | 粒子聚散、卡片翻转等复杂动效，API 友好 |
| 后端运行时 | **Vercel Serverless Functions** | 零配置，Edge Runtime，免费额度充足 |
| AI 引擎 | **多平台适配器（OpenAI 优先）** | 策略模式，通过环境变量切换 OpenAI / Gemini / Claude |
| 知识库（MVP） | **本地 JSON** | 第一阶段快速上线，无外部依赖 |
| 知识库（进阶） | **Supabase pgvector** | 第三阶段升级为语义检索 RAG |
| 图片导出 | **html2canvas** | 天机卡渲染为朋友圈长图 |
| 部署 | **Vercel (.vercel.app)** | GitHub 自动 CI/CD，后续绑定自定义域名 |
| 包管理 | **pnpm** | 快速、节省磁盘空间 |

---

## 3. 目录结构规划

```
One-Day-One-Secret/
├── public/
│   ├── fonts/                        # 新中式字体（霞鹜文楷等）
│   └── assets/
│       ├── textures/                 # 宣纸、水墨纹理背景
│       └── lottie/                   # Lottie 动画资源
│
├── src/
│   ├── core/                         # 核心算法层（纯逻辑，无 UI 依赖）
│   │   ├── calendar/
│   │   │   ├── solarTerms.js         # 24 节气计算引擎
│   │   │   └── heavenlyStemsAndBranches.js  # 天干地支推算
│   │   ├── divination/
│   │   │   ├── hexagrams.js          # 六十四卦数据库
│   │   │   └── castHexagram.js       # 起卦算法
│   │   ├── ai/
│   │   │   ├── aiAdapter.js          # 多平台 AI 适配器
│   │   │   ├── promptBuilder.js      # Prompt 模板构建器
│   │   │   └── providers/
│   │   │       ├── openai.js         # OpenAI 适配实现
│   │   │       └── gemini.js         # Gemini 适配实现
│   │   ├── knowledge/
│   │   │   └── retriever.js          # 知识库检索器
│   │   └── tianjiEngine.js           # 三位一体聚合引擎
│   │
│   ├── data/
│   │   └── knowledge/
│   │       ├── huangdiNeijing.json   # 《黄帝内经》养生语料
│   │       ├── modernNutrition.json  # 现代营养学数据
│   │       └── schema.json           # 知识条目 JSON Schema
│   │
│   ├── components/                   # React UI 组件
│   │   ├── BreathGuide/              # 呼吸引导（进入动画）
│   │   ├── LongPress/               # 长按起卦交互
│   │   ├── DivinationAnimation/     # 推演动画（粒子聚散成卦）
│   │   ├── TianjiCard/              # 天机卡（核心视觉）
│   │   ├── ProfileSetup/            # 首次体质录入（3-5 题）
│   │   ├── TongueDiagnosis/         # 简易舌诊选择（示意图选项）
│   │   ├── MoodSelector/            # Emoji 今日状态选择
│   │   └── EnergyTrend/             # 能量波动趋势图表（第三阶段）
│   │
│   ├── pages/
│   │   ├── Home.jsx                  # 主页（起卦入口）
│   │   ├── Result.jsx                # 天机卡结果页
│   │   ├── Profile.jsx               # 用户画像设置页
│   │   └── Archive.jsx               # 天机归档页（第三阶段）
│   │
│   ├── hooks/
│   │   ├── useLongPress.js           # 长按手势识别
│   │   ├── useGeolocation.js         # 地理位置获取
│   │   └── useWeather.js             # 天气/湿度信息
│   │
│   ├── styles/
│   │   └── theme.css                 # 新中式设计系统变量
│   │
│   ├── utils/
│   │   ├── imageExport.js            # 天机卡导出为长图
│   │   └── storage.js                # LocalStorage 封装
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── api/                              # Vercel Serverless Functions
│   └── generate.js                   # 天机生成 API（AI 代理 + 限流）
│
├── docs/                             # 项目文档
├── tests/                            # 测试文件
├── .env.local                        # 环境变量（API Keys，不提交 Git）
├── .gitignore
├── tailwind.config.js
├── vite.config.js
├── vercel.json
└── package.json
```

---

## 4. 核心数据流

```
用户长按屏幕
    │
    ▼
┌─────────────────────────────────────────────┐
│  前端：计算按压时长 + 采集环境数据            │
│  (时间戳、地理位置、天气)                      │
└─────────────────┬───────────────────────────┘
                  │ POST /api/generate
                  ▼
┌─────────────────────────────────────────────┐
│  Serverless Function                         │
│                                              │
│  1. 节气计算 ─────────┐                      │
│  2. 天干地支推算 ──────┤                      │
│  3. 起卦算法 ─────────┤──→ Prompt 组装       │
│  4. 知识库检索 ────────┤                      │
│  5. 用户画像解析 ──────┘                      │
│                                              │
│  6. 调用 AI API (OpenAI / Gemini)            │
│  7. 解析 & 校验 JSON 输出                     │
│  8. 返回天机数据                              │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  前端：渲染天机卡                             │
│  - 推演动画 → 卡片展示 → 可导出为长图          │
│  - 存储到 LocalStorage（归档用）              │
└─────────────────────────────────────────────┘
```

---

## 5. 环境变量

```bash
# .env.local（不提交到 Git）

# AI 平台选择：openai | gemini
AI_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Gemini（备选）
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash

# 限流配置
RATE_LIMIT_PER_DAY=5

# Supabase（第三阶段）
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_ANON_KEY=eyJ...
```

---

## 6. 阶段里程碑

| 阶段 | 周期 | 核心交付物 | 验收标准 |
|:-----|:-----|:-----------|:---------|
| **第一阶段** | 1 周 | 核心算法 Demo | 输入任意节气+卦象+体质，AI 稳定输出格式化天机文案 |
| **第二阶段** | 2 周 | H5 完整交互 | 从长按到天机卡展示全链路可用，长图可保存分享 |
| **第三阶段** | 1 月后 | 深度融合 | 舌诊拍照识别、7 天归档回顾、能量趋势图表 |

---

## 7. 已确认的设计决策

1. **AI 引擎**：多平台适配器模式，优先 OpenAI，环境变量一键切换
2. **用户录入**：首次 3-5 个体质问题 → 后续仅 Emoji 选今日状态
3. **部署**：先用 `.vercel.app`，后续绑定自定义域名
4. **字体**：霞鹜文楷（OFL 开源授权）
5. **知识库**：MVP 用本地 JSON，第三阶段升级 Supabase pgvector + RAG
