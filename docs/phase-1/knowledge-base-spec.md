# 📖 养生知识库整理规范

> 定义「一日天机」养生知识条目的采集标准、分类体系与数据格式

---

## 1. 知识库定位

### 1.1 角色
知识库是「地」维度的核心，为 AI 提供**有据可查的养生依据**,确保输出的天机建议不是臆造，而是有古典/现代依据支撑。

### 1.2 原则
- **古今融合**：传统中医 + 现代科学，各占约 50%
- **可操作性**：每条建议必须可落地执行
- **语义化标签**：每条数据都有结构化标签，支持精准检索
- **审慎态度**：不收纳有争议或可能误导的内容

---

## 2. 数据来源

### 2.1 中医典籍来源
| 来源 | 重点摘取内容 | 优先级 |
|:-----|:-------------|:-------|
| 《黄帝内经·素问》 | 四气调神、五脏养生、阴阳理论 | P0 |
| 《黄帝内经·灵枢》 | 经络、穴位、体质辨识 | P1 |
| 《伤寒杂病论》 | 常见病症的食疗与调理 | P2 |
| 《本草纲目》 | 食物/药材功效（仅取食疗部分） | P2 |
| 《饮膳正要》 | 饮食养生、食疗方 | P1 |

### 2.2 现代科学来源
| 来源 | 重点摘取内容 | 优先级 |
|:-----|:-------------|:-------|
| 中国居民膳食指南（2022） | 营养素摄入、膳食结构 | P0 |
| WHO 健康生活方式指南 | 运动、睡眠、心理健康 | P0 |
| 运动生理学教材 | 运动与代谢、恢复、心率 | P1 |
| PubMed 综述（高引用） | 季节与健康的关联研究 | P2 |

---

## 3. JSON Schema 规范

### 3.1 知识条目结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HealthKnowledgeEntry",
  "type": "object",
  "required": ["id", "source", "category", "content", "tags"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^(tcm|modern)-[0-9]{3}$",
      "description": "唯一标识。tcm=中医, modern=现代科学"
    },
    "source": {
      "type": "object",
      "properties": {
        "book": { "type": "string", "description": "来源书名/文献" },
        "chapter": { "type": "string", "description": "章节/篇名" },
        "year": { "type": "string", "description": "成书/发表年份" }
      },
      "required": ["book"]
    },
    "category": {
      "type": "string",
      "enum": ["dietary", "exercise", "sleep", "emotion", "acupoint", "seasonal", "constitution"],
      "description": "分类：饮食/运动/睡眠/情志/穴位/时令/体质"
    },
    "content": {
      "type": "object",
      "properties": {
        "original": { "type": "string", "description": "原文（古籍则保留原文）" },
        "interpretation": { "type": "string", "description": "现代语言解读" },
        "actionItems": {
          "type": "array",
          "items": { "type": "string" },
          "description": "可执行的具体行动，每条不超过 20 字"
        },
        "contraindications": {
          "type": "array",
          "items": { "type": "string" },
          "description": "禁忌/忌讳事项"
        }
      },
      "required": ["interpretation", "actionItems"]
    },
    "tags": {
      "type": "object",
      "properties": {
        "seasons": {
          "type": "array",
          "items": { "type": "string", "enum": ["spring", "summer", "autumn", "winter", "all"] }
        },
        "elements": {
          "type": "array",
          "items": { "type": "string", "enum": ["wood", "fire", "earth", "metal", "water"] }
        },
        "organs": {
          "type": "array",
          "items": { "type": "string", "enum": ["liver", "heart", "spleen", "lung", "kidney"] }
        },
        "solarTerms": {
          "type": "array",
          "items": { "type": "string" },
          "description": "适用的节气拼音列表（空 = 全部适用）"
        },
        "constitutions": {
          "type": "array",
          "items": { "type": "string", "enum": [
            "balanced", "qi_deficiency", "yang_deficiency", "yin_deficiency",
            "phlegm_dampness", "damp_heat", "blood_stasis", "qi_stagnation", "special"
          ]},
          "description": "适用的体质类型（九种体质分类法）"
        },
        "moods": {
          "type": "array",
          "items": { "type": "string", "enum": ["happy", "calm", "tired", "anxious", "sad", "angry"] },
          "description": "适用的情绪状态"
        }
      },
      "required": ["seasons", "elements", "organs"]
    },
    "weight": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "default": 0.5,
      "description": "推荐权重（0-1），权威来源或高频使用的条目权重更高"
    }
  }
}
```

### 3.2 示例条目

#### 中医条目
```json
{
  "id": "tcm-001",
  "source": {
    "book": "黄帝内经·素问",
    "chapter": "四气调神大论",
    "year": "约前 99 年"
  },
  "category": "seasonal",
  "content": {
    "original": "春三月，此谓发陈，天地俱生，万物以荣，夜卧早起，广步于庭，被发缓形，以使志生。",
    "interpretation": "春季三个月是万物复苏、生机勃发的季节。应当晚睡早起，在院子里散步，散开头发、放松身体，让意志舒畅生发。",
    "actionItems": [
      "早起后散步 15-30 分钟",
      "穿宽松衣物，不要束缚身体",
      "多食青色蔬菜（菠菜、芹菜、韭菜）",
      "保持心情舒畅，避免压抑情绪"
    ],
    "contraindications": [
      "忌过度发怒（伤肝）",
      "忌饮酒过量",
      "忌剧烈运动导致大汗"
    ]
  },
  "tags": {
    "seasons": ["spring"],
    "elements": ["wood"],
    "organs": ["liver"],
    "solarTerms": ["lichun", "yushui", "jingzhe", "chunfen", "qingming", "guyu"],
    "constitutions": ["balanced", "qi_stagnation", "qi_deficiency"],
    "moods": ["calm", "tired", "anxious"]
  },
  "weight": 0.9
}
```

#### 现代科学条目
```json
{
  "id": "modern-001",
  "source": {
    "book": "中国居民膳食指南",
    "chapter": "一般人群膳食指南",
    "year": "2022"
  },
  "category": "dietary",
  "content": {
    "original": "",
    "interpretation": "每日膳食中应保证充足的水分摄入。成年人每日饮水 1500-1700ml，少量多次，不要等口渴再喝。晨起一杯温水可促进肠胃蠕动。",
    "actionItems": [
      "晨起饮用 200ml 温水",
      "每 1-2 小时补水一次",
      "避免一次性大量饮水",
      "运动后补充含电解质的水"
    ],
    "contraindications": [
      "忌空腹大量饮用冰水",
      "忌用含糖饮料替代白水"
    ]
  },
  "tags": {
    "seasons": ["all"],
    "elements": ["water"],
    "organs": ["kidney", "spleen"],
    "solarTerms": [],
    "constitutions": ["balanced", "yin_deficiency", "phlegm_dampness"],
    "moods": ["happy", "calm", "tired", "anxious", "sad", "angry"]
  },
  "weight": 0.7
}
```

---

## 4. 知识检索逻辑

### 4.1 MVP 阶段（本地 JSON 检索）

```
检索流程：
1. 根据当前节气 → 筛选 tags.solarTerms 匹配的条目
2. 根据卦象五行 → 筛选 tags.elements 匹配的条目
3. 根据用户体质 → 筛选 tags.constitutions 匹配的条目
4. 根据今日状态 → 筛选 tags.moods 匹配的条目
5. 合并结果，按 weight 降序排列
6. 取 Top 5 条目注入 Prompt
```

### 4.2 第三阶段（向量检索 RAG）

```
升级流程：
1. 将每条知识条目向量化（使用 text-embedding-3-small）
2. 查询向量 = Embedding("惊蛰 木气升发 气虚体质 疲惫")
3. 在 Supabase pgvector 中进行余弦相似度搜索
4. 返回 Top 5 最相关条目
5. 与 JSON 检索结果合并去重
```

---

## 5. 数据采集要求

### 5.1 MVP 阶段目标数据量
| 类别 | 中医条目 | 现代条目 | 合计 |
|:-----|:---------|:---------|:-----|
| 饮食 | 20 | 15 | 35 |
| 运动 | 10 | 15 | 25 |
| 睡眠 | 8 | 10 | 18 |
| 情志 | 12 | 8 | 20 |
| 穴位 | 15 | 0 | 15 |
| 时令 | 24（每节气 1 条） | 12 | 36 |
| 体质 | 9（每体质 1 条） | 9 | 18 |
| **合计** | **98** | **69** | **167** |

### 5.2 质量标准
- 每条 `interpretation` 不超过 100 字
- 每条 `actionItems` 3-5 条，每条不超过 20 字
- 每条 `contraindications` 1-3 条
- 标签完整，至少覆盖 seasons + elements + organs
- 中医条目必须附上 `original` 原文
