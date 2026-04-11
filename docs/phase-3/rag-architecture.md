# 🧠 RAG 向量知识库架构

> 从本地 JSON 检索到语义向量检索的升级方案

---

## 1. 架构演进

```
MVP（本地 JSON）                      第三阶段（向量 RAG）
┌─────────────────┐                 ┌──────────────────────────┐
│  JSON 知识库     │                 │   Supabase pgvector       │
│  关键词标签匹配  │     ──→         │   语义相似度检索           │
│  精确但不灵活    │                 │   理解上下文含义           │
└─────────────────┘                 └──────────────────────────┘
```

---

## 2. MVP 检索（精确匹配）

### 2.1 检索流程

```javascript
function retrieveKnowledge(solarTerm, hexagram, userProfile) {
  const allEntries = [...huangdiNeijing.entries, ...modernNutrition.entries];
  
  return allEntries
    .filter(entry => {
      // 节气匹配
      const termMatch = entry.tags.solarTerms.length === 0 
        || entry.tags.solarTerms.includes(solarTerm.key);
      
      // 五行匹配
      const elementMatch = entry.tags.elements.includes(
        solarTerm.element.toLowerCase()
      );
      
      // 体质匹配
      const constMatch = entry.tags.constitutions?.includes(
        userProfile.constitution
      ) ?? true;
      
      return termMatch || elementMatch || constMatch;
    })
    .sort((a, b) => {
      // 计算匹配维度数作为排序权重
      const scoreA = calculateMatchScore(a, solarTerm, hexagram, userProfile);
      const scoreB = calculateMatchScore(b, solarTerm, hexagram, userProfile);
      return scoreB - scoreA;
    })
    .slice(0, 5);  // 取 Top 5
}
```

### 2.2 局限性
- 只能做精确的标签匹配，无法理解语义
- 新增知识条目需要人工打标签
- 无法处理模糊查询（如"感觉身体发沉"）

---

## 3. 向量 RAG 升级

### 3.1 整体架构

```
用户上下文
(节气 + 卦象 + 体质 + 状态)
        │
        ▼
┌─────────────────┐
│  生成查询文本     │
│  "惊蛰时节，      │
│   木气升发，       │
│   气虚体质，       │
│   今日疲惫"        │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│  Embedding 模型   │   OpenAI text-embedding-3-small
│  文本 → 向量       │   维度: 1536
└───────┬─────────┘
        │ 查询向量
        ▼
┌─────────────────┐
│  Supabase        │
│  pgvector        │   余弦相似度搜索
│  向量索引         │   Top K = 5
└───────┬─────────┘
        │ 最相关的知识条目
        ▼
┌─────────────────┐
│  注入 Prompt      │
│  提供给 LLM       │
└─────────────────┘
```

### 3.2 向量化流程

#### 数据准备

```javascript
// 将每条知识条目转换为适合 Embedding 的文本
function prepareEmbeddingText(entry) {
  const parts = [
    entry.content.interpretation,
    `分类：${entry.category}`,
    `季节：${entry.tags.seasons.join('、')}`,
    `五行：${entry.tags.elements.join('、')}`,
    `脏腑：${entry.tags.organs.join('、')}`,
    `体质：${entry.tags.constitutions?.join('、') || '通用'}`,
    `建议：${entry.content.actionItems.join('；')}`,
    entry.content.contraindications 
      ? `禁忌：${entry.content.contraindications.join('；')}` 
      : ''
  ];
  
  return parts.filter(Boolean).join('。');
}
```

#### 批量向量化脚本

```javascript
// scripts/vectorize-knowledge.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

async function vectorizeAll() {
  const entries = loadAllKnowledgeEntries();
  
  for (const entry of entries) {
    const text = prepareEmbeddingText(entry);
    
    // 生成向量
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    
    // 写入 Supabase
    await supabase.from('knowledge_embeddings').upsert({
      id: entry.id,
      source: entry.source.book,
      category: entry.category,
      content: text,
      embedding: embedding.data[0].embedding,
      tags: entry.tags
    });
  }
}
```

### 3.3 查询流程

```javascript
async function semanticRetrieve(context) {
  // 1. 构建查询文本
  const queryText = `
    ${context.solarTerm.name}时节，
    ${context.solarTerm.element}气${context.solarTerm.energy}，
    ${context.hexagram.name}卦（${context.hexagram.nature}），
    ${context.userProfile.constitution}体质，
    今日状态：${context.userProfile.todayMood}
  `.trim();
  
  // 2. 生成查询向量
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText
  });
  
  // 3. 向量相似度搜索
  const { data: results } = await supabase.rpc('match_knowledge', {
    query_embedding: queryEmbedding.data[0].embedding,
    match_threshold: 0.7,   // 相似度阈值
    match_count: 5           // 返回条数
  });
  
  return results;
}
```

### 3.4 Supabase RPC 函数

```sql
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id TEXT,
  source TEXT,
  category TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.source,
    ke.category,
    ke.content,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 4. 混合检索策略

第三阶段将**本地标签检索**与**向量语义检索**结合：

```javascript
async function hybridRetrieve(context) {
  // 并行执行两种检索
  const [tagResults, vectorResults] = await Promise.all([
    tagBasedRetrieve(context),      // 本地 JSON 标签匹配
    semanticRetrieve(context)        // Supabase 向量检索
  ]);
  
  // 合并去重（按 id）
  const merged = new Map();
  
  // 标签检索结果权重 0.4
  tagResults.forEach(r => merged.set(r.id, { ...r, score: r.matchScore * 0.4 }));
  
  // 向量检索结果权重 0.6
  vectorResults.forEach(r => {
    if (merged.has(r.id)) {
      // 双重命中，叠加分数
      merged.get(r.id).score += r.similarity * 0.6;
    } else {
      merged.set(r.id, { ...r, score: r.similarity * 0.6 });
    }
  });
  
  // 按综合分数排序，取 Top 5
  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

---

## 5. 成本估算

### 5.1 Embedding 成本

| 项目 | 数量 | 单价 | 费用 |
|:-----|:-----|:-----|:-----|
| 知识库向量化（一次性） | ~167 条 × 平均 200 tokens | $0.02/1M tokens | ~$0.001 |
| 每日查询 Embedding | ~100 次/天 × 50 tokens | $0.02/1M tokens | ~ $0.0001/天 |

> 成本几乎可以忽略不计

### 5.2 Supabase 免费额度
- 数据库: 500MB（绰绰有余）
- API: 5GB 带宽/月
- Auth: 50,000 月活用户

---

## 6. 质量评估

### 6.1 评估方法

```
准备 20 组测试用例：
  输入：节气 + 卦象 + 体质 + 状态
  期望：人工标注的 Top 5 最相关知识条目

对比指标：
  - Recall@5: 前 5 条中包含多少标注条目
  - MRR: 最相关的条目排在第几位

目标：
  - Recall@5 ≥ 0.6（至少命中 3/5）
  - MRR ≥ 0.5（最相关条目平均在前 2 位）
```

### 6.2 持续优化
- 收集用户未点击"重新起卦"的天机卡 → 视为正反馈
- 定期更新 Embedding（知识库扩充后重新向量化）
- 调整混合检索权重比例
