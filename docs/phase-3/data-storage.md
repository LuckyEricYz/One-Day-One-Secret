# 数据存储方案

> 当前文档分为两部分：MVP 现行存储、后续升级方向。

## 1. MVP 现行存储

MVP 只使用浏览器本地存储，不做服务端持久化。

### 1.1 本地键

| Key | 作用 |
|:----|:-----|
| `tianji_client_id` | 匿名随机 UUID，用于额度和历史归属 |
| `tianji_profile` | 首次问卷结果 |
| `tianji_history` | 已生成结果卡历史 |
| `tianji_quota` | 当日使用次数 |

### 1.2 数据结构

#### `tianji_client_id`

```json
"8f15b8a8-9176-4f88-a85d-20c4a5cf77e0"
```

#### `tianji_profile`

```json
{
  "constitution": "qi_deficiency",
  "healthTags": ["late_sleep", "sedentary"],
  "createdAt": "2026-04-11T13:30:00.000Z",
  "updatedAt": "2026-04-11T13:30:00.000Z",
  "version": 1
}
```

#### `tianji_history`

```json
[
  {
    "id": "tj-20260411-001",
    "date": "2026-04-11",
    "mood": "tired",
    "supplementAnswers": {
      "headSense": "slightly_full",
      "sleepDuration": "short",
      "tongueCoating": "thin_white"
    },
    "result": {
      "mysticSaying": "震雷未息，宜收不宜争",
      "mysticExplanation": "今天更适合把力气收回到日常节奏里。",
      "healthAdvice": ["建议1", "建议2", "建议3"],
      "dos": ["散步", "早睡"],
      "donts": ["熬夜", "暴食"],
      "meta": {
        "solarTermName": "清明",
        "ganZhiSummary": "丙午年 辛卯月 戊辰日",
        "hexagramName": "雷天大壮",
        "knowledgeIds": ["seasonal-003"],
        "generatedAt": "2026-04-11T13:30:00.000Z",
        "provider": "openai",
        "isFallback": false,
        "requestId": "9d7c3e1e-70b8-4604-b97f-cc5b2efdf6b8"
      }
    }
  }
]
```

#### `tianji_quota`

```json
{
  "date": "2026-04-11",
  "count": 2,
  "maxPerDay": 5
}
```

### 1.3 MVP 规则

- 历史建议最多保留 90 天
- `supplementAnswers` 只保留在当次历史记录里，不并入长期画像
- 额度按 `Asia/Shanghai` 自然日重置
- 删除浏览器数据即清空本地信息

## 2. 为什么现在不上远端存储

当前阶段不上 Supabase 或自建数据库，原因固定为：

- MVP 目标是验证生成链路和分享意愿，不是验证账号系统
- 远端同步会引入认证、RLS、迁移和隐私告知成本
- 当前本地历史已经足够支持“今日查看”和“最近回看”

## 3. 后续升级触发条件

只有满足以下条件，才进入远端同步设计：

1. 用户明确需要跨设备同步
2. 本地历史已成为核心留存能力
3. 隐私政策、删除能力和导出能力准备完成

## 4. 后续升级方向

远端存储如需启动，优先级如下：

1. 匿名账号或短信登录
2. 历史同步
3. 删除与导出
4. 再考虑趋势分析

当前不提前冻结数据库表结构，不把未来 SQL 设计写成既定实现。
