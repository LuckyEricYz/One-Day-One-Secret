# 🔌 API 接口规范

> AI 多平台适配器接口设计、天机生成 API 与错误处理规范

---

## 1. 架构概览

```
前端 App
   │
   │ POST /api/generate
   ▼
┌──────────────────────────────┐
│  Vercel Serverless Function  │
│                              │
│  ┌────────────────────────┐  │
│  │   Rate Limiter         │  │
│  │   (每用户每日 5 次)     │  │
│  └──────────┬─────────────┘  │
│             │                │
│  ┌──────────▼─────────────┐  │
│  │   tianjiEngine          │  │
│  │   (天地人聚合)          │  │
│  └──────────┬─────────────┘  │
│             │                │
│  ┌──────────▼─────────────┐  │
│  │   AI Adapter            │  │
│  │   ┌──────┬──────┐      │  │
│  │   │OpenAI│Gemini│ ...  │  │
│  │   └──────┴──────┘      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## 2. 天机生成 API

### 2.1 请求

```
POST /api/generate
Content-Type: application/json
```

**请求体：**
```json
{
  "pressDuration": 3456,
  "touchEntropy": 127,
  "userProfile": {
    "constitution": "qi_deficiency",
    "healthTags": ["长期熬夜", "血压波动", "消化不良"],
    "todayMood": "tired",
    "tongueDiagnosis": null
  },
  "location": {
    "latitude": 39.9042,
    "longitude": 116.4074
  },
  "timestamp": 1744329600000
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|:-----|:-----|:-----|:-----|
| pressDuration | number | ✅ | 用户长按时长（毫秒），最小 2000 |
| touchEntropy | number | ❌ | 触摸坐标的微小偏移值，增加随机性 |
| userProfile | object | ✅ | 用户画像 |
| userProfile.constitution | string | ✅ | 体质类型，九种体质之一 |
| userProfile.healthTags | string[] | ❌ | 健康标签列表 |
| userProfile.todayMood | string | ✅ | 今日状态：happy/calm/tired/anxious/sad/angry |
| userProfile.tongueDiagnosis | string | ❌ | 舌诊结果（第三阶段可用） |
| location | object | ❌ | 地理位置（用于天气获取） |
| timestamp | number | ✅ | 客户端时间戳（毫秒） |

### 2.2 成功响应

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "success": true,
  "data": {
    "mysticSaying": "震雷当头，宜敛不宜散",
    "mysticExplanation": "今日能量如雷般充沛，但不宜过度发散，内敛蓄力方为上策。",
    "healthAdvice": [
      "黄昏时慢走 20 分钟，让雷动之气化为绵绵暖流",
      "午后饮一杯菊花枸杞茶，清肝明目、平抑木气",
      "晚间 10 点前入眠，肝血归藏方能养木"
    ],
    "dos": ["散步", "饮花茶"],
    "donts": ["剧烈运动", "饮酒"],
    "acupoint": {
      "name": "太冲穴",
      "method": "用拇指按揉两足大趾与二趾之间凹陷处，每侧 2 分钟"
    },
    "energyScore": 72,
    "elementBalance": {
      "wood": 0.35,
      "fire": 0.15,
      "earth": 0.20,
      "metal": 0.10,
      "water": 0.20
    },
    "meta": {
      "solarTerm": {
        "name": "惊蛰",
        "element": "木",
        "energy": "动能",
        "dayIndex": 5
      },
      "ganZhi": {
        "summary": "丙午年 辛卯月 戊辰日 甲寅时"
      },
      "hexagram": {
        "name": "雷天大壮",
        "symbol": "䷡",
        "nature": "壮盛",
        "changed": null
      },
      "generatedAt": "2026-04-11T13:30:00.000Z",
      "aiProvider": "openai",
      "model": "gpt-4o-mini"
    }
  },
  "remainingQuota": 4
}
```

### 2.3 错误响应

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "今日天机次数已用尽，明日再来探索吧",
    "retryAfter": "2026-04-12T00:00:00.000Z"
  }
}
```

**错误码表：**
| 错误码 | HTTP 状态码 | 说明 | 用户提示 |
|:-------|:-----------|:-----|:---------|
| INVALID_INPUT | 400 | 请求参数校验失败 | 输入信息有误，请重试 |
| PRESS_TOO_SHORT | 400 | 长按时间不足 2 秒 | 请再静心长按一会儿 |
| RATE_LIMIT_EXCEEDED | 429 | 超过每日限额 | 今日天机已尽，明日再来 |
| AI_SERVICE_ERROR | 502 | AI 平台调用失败 | 天机暂隐，请稍后再试 |
| AI_OUTPUT_INVALID | 500 | AI 输出格式校验失败 | 天机生成有误，请重新起卦 |
| INTERNAL_ERROR | 500 | 未知内部错误 | 系统异常，请稍后再试 |

---

## 3. AI 适配器接口规范

### 3.1 适配器抽象接口

```javascript
/**
 * AI 适配器基类
 * 所有平台适配器必须实现此接口
 */
class AIAdapter {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - 平台 API Key
   * @param {string} config.model  - 模型名称
   * @param {Object} config.options - 平台特有选项
   */
  constructor(config) {}

  /**
   * 发送对话请求
   * @param {string} systemPrompt - System 级别 Prompt
   * @param {string} userPrompt   - User 级别 Prompt
   * @returns {Promise<AIResponse>}
   */
  async chat(systemPrompt, userPrompt) {}

  /**
   * 获取平台名称
   * @returns {string}
   */
  get providerName() {}
}

/**
 * @typedef {Object} AIResponse
 * @property {Object} data       - 解析后的 JSON 数据
 * @property {string} rawText    - 原始文本响应
 * @property {Object} usage      - Token 使用量
 * @property {number} usage.input  - 输入 Token 数
 * @property {number} usage.output - 输出 Token 数
 * @property {string} model      - 实际使用的模型名称
 */
```

### 3.2 工厂函数

```javascript
/**
 * 创建 AI 客户端
 * 根据环境变量自动选择平台，支持运行时切换
 * 
 * @param {string} [provider] - 平台标识：'openai' | 'gemini' | 'claude'
 *                              不传则读取 AI_PROVIDER 环境变量，默认 'openai'
 * @returns {AIAdapter}
 * 
 * 环境变量：
 *   AI_PROVIDER     - 默认平台
 *   OPENAI_API_KEY  - OpenAI Key
 *   OPENAI_MODEL    - OpenAI 模型 (默认 gpt-4o-mini)
 *   GEMINI_API_KEY  - Gemini Key
 *   GEMINI_MODEL    - Gemini 模型 (默认 gemini-2.5-flash)
 */
function createAIClient(provider) {}
```

---

## 4. 限流策略

### 4.1 规则
- 每个用户每日 5 次天机生成（依据 IP 或设备指纹）
- 每日凌晨 0:00 (UTC+8) 重置
- 限流数据存储在 Vercel KV（或降级为内存 Map + TTL）

### 4.2 设备标识
```
设备指纹 = SHA256(UserAgent + IP + ScreenResolution + Timezone)
```

> MVP 阶段可简化为仅使用 IP 地址

---

## 5. 安全措施

### 5.1 API Key 保护
- 所有 AI API Key 仅存在于服务端（Vercel 环境变量）
- 前端永远不暴露 Key
- `.env.local` 已加入 `.gitignore`

### 5.2 输入校验
- `pressDuration`：必须为 2000-30000 之间的整数
- `todayMood`：必须为枚举值之一
- `constitution`：必须为九种体质之一
- `healthTags`：最多 10 个，每个不超过 20 字
- 总请求体大小 < 10KB

### 5.3 输出过滤
- AI 输出经过结构化校验（见 prompt-tuning.md 中的校验函数）
- 过滤潜在的 XSS 内容
- 天机语中不应出现品牌名、URL 等
