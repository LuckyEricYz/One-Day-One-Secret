# API 接口规范

> 当前版本只定义一个对外接口：`POST /api/generate`。

## 1. 接口目标

接口职责固定为：

1. 校验输入
2. 校验额度
3. 计算节气与卦象上下文
4. 执行知识检索
5. 调用模型生成结构化结果
6. 返回结果并写入额度

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
  "pressDurationMs": 2000,
  "touchEntropy": 127,
  "userProfile": {
    "constitution": "qi_deficiency",
    "healthTags": ["late_sleep", "sedentary"],
    "todayMood": "tired",
    "tongueDiagnosis": null
  },
  "dailySupplement": {
    "headSense": "slightly_full",
    "sleepDuration": "short",
    "tongueCoating": "thin_white"
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
| `clientId` | string | ✅ | 前端首次生成并持久化的随机 UUID |
| `pressDurationMs` | number | ✅ | 成卦时长，范围 `2000-30000` |
| `touchEntropy` | number | ❌ | 交互扰动值，未提供时按 `0` 处理 |
| `userProfile` | object | ✅ | 长期画像对象 |
| `userProfile.constitution` | string | ✅ | `balanced` / `qi_deficiency` / `yang_deficiency` / `yin_deficiency` / `qi_stagnation` / `phlegm_dampness` |
| `userProfile.healthTags` | string[] | ✅ | `late_sleep` / `sedentary` / `irregular_diet` / `regular_exercise` |
| `userProfile.todayMood` | string | ✅ | `happy` / `calm` / `tired` / `anxious` / `sad` / `angry` |
| `userProfile.tongueDiagnosis` | string \| null | ❌ | 当前固定传 `null` |
| `dailySupplement` | object | ✅ | 当日补录，不写入长期画像 |
| `dailySupplement.headSense` | string | ✅ | `clear` / `slightly_full` / `rising` |
| `dailySupplement.sleepDuration` | string | ✅ | `short` / `medium` / `long` |
| `dailySupplement.tongueCoating` | string | ✅ | `thin_white` / `thick_white` / `slightly_yellow` |
| `context.timestamp` | number | ✅ | 客户端在“成卦瞬间”记录的时间戳 |
| `context.timezone` | string | ✅ | 当前固定为 `Asia/Shanghai` |
| `context.location` | object | ❌ | 用户授权后上传，仅用于增强，不持久化 |

说明：

- Web 端点击成卦时，`pressDurationMs` 默认使用 `2000`
- H5 端长按成卦时，前端在达到阈值时立即记录时间种子与时长

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
      "isFallback": false,
      "requestId": "9d7c3e1e-70b8-4604-b97f-cc5b2efdf6b8"
    }
  },
  "remainingQuota": 4
}
```

### 3.1 输出约束

- `mysticSaying` 为 4-16 个汉字短句
- `mysticExplanation` 为 18-52 个汉字
- `healthAdvice` 必须正好 3 条，每条 8-24 个汉字
- `dos` 与 `donts` 各 2 条，每条 2-10 个汉字
- `meta.knowledgeIds` 必须记录命中的知识条目 id

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
| `PRESS_TOO_SHORT` | 400 | 成卦时长不足 2 秒 |
| `RATE_LIMIT_EXCEEDED` | 429 | 当日额度已满 |
| `INTERNAL_ERROR` | 500 | 未捕获异常 |

## 5. 检索与平台策略

- 默认检索模式为 `hybrid`
- 若索引不可用、query embedding 缺失或维度不匹配，自动回退 `rules`
- `AI_PROVIDER=auto` 默认按 `OpenAI -> fallback` 执行
- Provider 输出非法 JSON 或结构不合法时，对当前平台最多修复重试 1 次
- 所有 provider 不可用时，返回本地 fallback 模板

## 6. 输入校验清单

- `pressDurationMs` 为整数且在范围内
- `clientId` 为非空字符串
- `healthTags` 不允许重复
- `dailySupplement` 必须完整且枚举合法
- `timezone` 必须等于 `Asia/Shanghai`
- 请求体总大小不超过 `10KB`

## 7. 不在当前接口中的内容

- 舌诊照片二进制上传
- 用户账号认证信息
- 单独暴露的向量检索接口
- 趋势分析或历史聚合结果
