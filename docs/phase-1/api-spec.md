# API 接口规范

> MVP 只定义一个对外接口：`POST /api/generate`。

## 1. 接口目标

接口职责固定为：

1. 校验输入
2. 校验额度
3. 计算节气与卦象上下文
4. 检索本地知识条目
5. 调用 LLM 生成结构化结果
6. 返回结果并写入额度与历史

## 2. 请求规范

### 2.1 路由

```http
POST /api/generate
Content-Type: application/json
```

### 2.2 请求体

```json
{
  "clientId": "8f15b8a8-9176-4f88-a85d-20c4a5cf77e0",
  "pressDurationMs": 3460,
  "touchEntropy": 127,
  "userProfile": {
    "constitution": "qi_deficiency",
    "healthTags": ["late_sleep", "sedentary"],
    "todayMood": "tired",
    "tongueDiagnosis": null
  },
  "context": {
    "timestamp": 1775885400000,
    "timezone": "Asia/Shanghai",
    "location": {
      "latitude": 31.2304,
      "longitude": 121.4737
    }
  }
}
```

### 2.3 字段定义

| 字段 | 类型 | 必填 | 说明 |
|:-----|:-----|:-----|:-----|
| `clientId` | string | ✅ | 前端首次生成并持久化的随机 UUID，用于额度和历史归档 |
| `pressDurationMs` | number | ✅ | 长按时长，范围 `2000-30000` |
| `touchEntropy` | number | ❌ | 触摸扰动值，未提供时按 `0` 处理 |
| `userProfile` | object | ✅ | 画像对象 |
| `userProfile.constitution` | string | ✅ | 枚举：`balanced` / `qi_deficiency` / `yang_deficiency` / `yin_deficiency` / `qi_stagnation` / `phlegm_dampness` |
| `userProfile.healthTags` | string[] | ✅ | 允许值：`late_sleep` / `sedentary` / `irregular_diet` / `regular_exercise` |
| `userProfile.todayMood` | string | ✅ | 枚举：`happy` / `calm` / `tired` / `anxious` / `sad` / `angry` |
| `userProfile.tongueDiagnosis` | string \| null | ❌ | MVP 固定传 `null`，保留扩展枚举：`option_a` / `option_b` / `option_c` |
| `context.timestamp` | number | ✅ | 客户端时间戳，毫秒 |
| `context.timezone` | string | ✅ | 当前固定为 `Asia/Shanghai` |
| `context.location` | object | ❌ | 用户授权后上传，仅用于天气辅助，不持久化 |

## 3. 成功响应

```json
{
  "success": true,
  "data": {
    "mysticSaying": "震雷未息，宜收不宜争",
    "mysticExplanation": "今天更适合把力气收回到日常节奏里，先稳住身体和情绪。",
    "healthAdvice": [
      "午后慢走 20 分钟，给身体一个缓冲段",
      "晚餐保持七分饱，减少辛辣和酒精",
      "23:00 前结束高强度输入，给睡眠留余地"
    ],
    "dos": ["散步", "早睡"],
    "donts": ["熬夜", "暴食"],
    "meta": {
      "solarTermName": "清明",
      "ganZhiSummary": "丙午年 辛卯月 戊辰日",
      "hexagramName": "雷天大壮",
      "knowledgeIds": ["seasonal-003", "sleep-004"],
      "generatedAt": "2026-04-11T13:30:00.000Z",
      "provider": "openai",
      "isFallback": false
    }
  },
  "remainingQuota": 4
}
```

### 3.1 输出约束

- `mysticSaying` 不超过 20 个汉字
- `mysticExplanation` 为 1-2 句自然语言
- `healthAdvice` 必须正好 3 条
- `dos` 与 `donts` 各 2 条
- `meta.knowledgeIds` 必须记录命中的本地条目 id

## 4. 错误响应

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "今日天机已满，请明日再来。",
    "retryAfter": "2026-04-12T00:00:00+08:00"
  }
}
```

| 错误码 | HTTP 状态码 | 说明 |
|:-------|:-----------|:-----|
| `INVALID_INPUT` | 400 | 输入结构或枚举值非法 |
| `PRESS_TOO_SHORT` | 400 | 长按不足 2 秒 |
| `RATE_LIMIT_EXCEEDED` | 429 | 当日额度已满 |
| `AI_SERVICE_ERROR` | 502 | 主平台和备用平台都失败 |
| `AI_OUTPUT_INVALID` | 500 | 模型返回格式不合法 |
| `INTERNAL_ERROR` | 500 | 未归类内部错误 |

## 5. 限额与身份规则

### 5.1 限额

- 每个 `clientId` 每日最多 5 次
- 重置时间固定为 `Asia/Shanghai` `00:00`
- 只要成功返回一张天机卡，就计入 1 次
- 网络失败、输入校验失败不计数

### 5.2 身份标识

MVP 不使用设备指纹。前端首次启动时生成随机 UUID，保存到 `tianji_client_id`，后续请求复用该值。

## 6. 服务端内部接口

### 6.1 AI 适配器

```ts
type TianjiResult = {
  mysticSaying: string;
  mysticExplanation: string;
  healthAdvice: [string, string, string];
  dos: [string, string];
  donts: [string, string];
  meta: {
    solarTermName: string;
    ganZhiSummary: string;
    hexagramName: string;
    knowledgeIds: string[];
    generatedAt: string;
    provider: string;
    isFallback: boolean;
  };
};

interface AIAdapter {
  readonly providerName: string;
  generate(systemPrompt: string, userPrompt: string): Promise<TianjiResult>;
}
```

### 6.2 平台策略

- 默认使用 OpenAI
- OpenAI 失败后切换 Gemini 重试 1 次
- 两个平台都失败时返回本地 fallback 模板，并标记 `meta.isFallback = true`

## 7. 输入校验清单

- `pressDurationMs` 为整数且在范围内
- `clientId` 为非空字符串
- `healthTags` 不允许重复
- `timezone` 必须等于 `Asia/Shanghai`
- 请求体总大小不超过 `10KB`

## 8. 不在当前接口中的内容

以下能力不应在当前接口中提前落地：

- 舌诊照片二进制上传
- 用户账号认证信息
- 向量检索参数
- 趋势分析或历史聚合结果
