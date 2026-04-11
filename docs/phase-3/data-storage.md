# 💾 数据持久化方案

> 从 LocalStorage 到 Supabase 的渐进式数据存储迁移计划

---

## 1. 存储演进路线

```
第二阶段 (MVP)            第三阶段 (深度融合)
┌───────────────┐         ┌──────────────────────┐
│ LocalStorage  │  ──→    │ Supabase (PostgreSQL) │
│ - 用户画像    │          │ - 用户账号体系         │
│ - 每日天机    │          │ - 天机归档历史         │
│ - 使用配额    │          │ - 跨设备同步           │
│ 限制：单设备  │          │ - 数据分析             │
└───────────────┘         └──────────────────────┘
```

---

## 2. MVP 阶段：LocalStorage

### 2.1 存储键值表

| Key | 数据类型 | 大小估算 | 说明 |
|:----|:---------|:---------|:-----|
| `tianji_profile` | Object | ~0.5KB | 用户体质画像 |
| `tianji_history` | Array | ~2KB/天 | 天机归档（保留 90 天） |
| `tianji_quota` | Object | ~0.1KB | 每日使用配额 |
| `tianji_settings` | Object | ~0.2KB | 用户设置偏好 |
| **总计（90天）** | - | **~180KB** | 远小于 5MB 限制 |

### 2.2 数据结构定义

#### 用户画像
```javascript
// key: tianji_profile
{
  version: 1,
  constitution: 'qi_deficiency',       // 九种体质之一
  healthTags: ['长期熬夜', '久坐'],      // 健康标签
  tongueDiagnosis: {                    // 舌诊结果（可选）
    type: 'manual',                     // manual: 手选 | ai: AI识别
    result: 'A',                        // 手选结果 或 AI 返回的结构化数据
    updatedAt: '2026-04-11'
  },
  createdAt: '2026-04-11T13:30:00.000Z',
  updatedAt: '2026-04-11T13:30:00.000Z'
}
```

#### 天机历史
```javascript
// key: tianji_history
[
  {
    id: 'tj-20260411-001',              // 唯一标识
    date: '2026-04-11',
    mood: 'tired',                       // 今日 Emoji 状态
    solarTerm: {
      name: '清明',
      element: '木'
    },
    hexagram: {
      name: '雷天大壮',
      symbol: '䷡'
    },
    result: {
      mysticSaying: '震雷当头，宜敛不宜散',
      mysticExplanation: '...',
      healthAdvice: ['...', '...', '...'],
      dos: ['...', '...'],
      donts: ['...', '...'],
      energyScore: 72,
      elementBalance: { wood: 0.35, fire: 0.15, earth: 0.20, metal: 0.10, water: 0.20 }
    },
    meta: {
      aiProvider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: '2026-04-11T13:30:00.000Z'
    }
  }
]
```

#### 每日配额
```javascript
// key: tianji_quota
{
  date: '2026-04-11',
  count: 2,
  maxPerDay: 5
}
```

### 2.3 数据操作封装

```javascript
// src/utils/storage.js

class TianjiStorage {
  // 获取/更新用户画像
  static getProfile() { ... }
  static setProfile(profile) { ... }
  
  // 天机历史 CRUD
  static getHistory(limit = 30) { ... }
  static addHistory(entry) { ... }
  static getHistoryByDate(date) { ... }
  
  // 每日配额
  static getRemainingQuota() { ... }
  static consumeQuota() { ... }
  static resetQuotaIfNewDay() { ... }
  
  // 数据清理（保留最近 90 天）
  static pruneOldHistory() { ... }
  
  // 数据导出（迁移用）
  static exportAll() { ... }
  static importAll(data) { ... }
}
```

---

## 3. 第三阶段：Supabase 迁移

### 3.1 为什么迁移
- **跨设备同步**：用户换手机后数据不丢失
- **数据分析**：统计用户群体的体质分布、节气健康趋势
- **RAG 知识库**：pgvector 向量存储
- **用户增长**：支持更多数据维度

### 3.2 数据库表设计

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint TEXT UNIQUE,       -- 设备指纹（匿名登录）
  constitution TEXT,                     -- 体质类型
  health_tags TEXT[],                    -- 健康标签数组
  tongue_diagnosis JSONB,               -- 舌诊结果
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 天机历史表
CREATE TABLE tianji_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  mood TEXT NOT NULL,                    -- happy/calm/tired/anxious/sad/angry
  solar_term TEXT NOT NULL,
  hexagram_name TEXT NOT NULL,
  hexagram_symbol TEXT,
  result JSONB NOT NULL,                 -- 完整天机结果
  energy_score INTEGER,
  element_balance JSONB,
  ai_provider TEXT,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date, created_at)     -- 同一天可多次但时间不同
);

-- 每日配额表
CREATE TABLE daily_quotas (
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- 知识库向量表（RAG 用）
CREATE TABLE knowledge_embeddings (
  id TEXT PRIMARY KEY,                   -- 知识条目 ID
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),               -- text-embedding-3-small 维度
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为向量搜索创建索引
CREATE INDEX ON knowledge_embeddings 
  USING ivfflat (embedding vector_cosine_ops);
```

### 3.3 用户认证方案

**MVP 阶段不需要登录**，第三阶段引入匿名认证：

```
方案：设备指纹 + Supabase Anonymous Auth

流程：
1. 首次使用时生成设备指纹（UserAgent + 屏幕 + 时区 hash）
2. 使用 Supabase Anonymous Sign-in
3. 数据自动关联到匿名用户
4. 后续可选绑定微信/手机号（升级为实名用户）
```

### 3.4 数据迁移策略

```
从 LocalStorage 到 Supabase 的无缝迁移：

1. 检测用户是否有本地数据
2. 如果有 → 创建 Supabase 匿名用户
3. 调用 exportAll() 获取本地全部数据
4. 批量写入 Supabase
5. 验证写入成功后标记本地数据为"已同步"
6. 后续请求优先读 Supabase，降级读 LocalStorage
```

---

## 4. RLS（行级安全策略）

```sql
-- 用户只能访问自己的数据
ALTER TABLE tianji_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records" ON tianji_records
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own records" ON tianji_records
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 知识库对所有人只读
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knowledge is public readable" ON knowledge_embeddings
  FOR SELECT
  USING (true);
```

---

## 5. 备份与合规

### 5.1 数据备份
- Supabase 自动每日备份（免费版保留 7 天）
- 重要版本发布前手动导出一份

### 5.2 数据合规
- 不收集任何实名信息（MVP 阶段）
- 舌诊照片不存储，仅存储分析结果文本
- 用户可随时删除自己的全部数据
- 参见 `privacy-policy.md`
