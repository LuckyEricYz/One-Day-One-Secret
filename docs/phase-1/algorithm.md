# 纯本地生成算法说明

> 当前版本只保留确定性、本地可复现的日内容生成规则。

## 1. 总体流程

```text
timestamp
  -> 获取上海日期、节气、干支
roleId
  -> 读取固定角色预设
dateKey + roleSeed + solarTermKey
  -> 生成当日卦象索引
角色标签 + 节气季节
  -> 从本地动作 / 穴位 / 食谱池中选出内容
calendar + role + hexagram + content
  -> 组合成 DailySnapshot
```

## 2. 日历上下文

返回结构：

```ts
type CalendarContext = {
  solarTermKey: string;
  solarTermName: string;
  solarTermStage: "start" | "middle" | "end";
  ganZhiSummary: string;
  dateKey: string;
};
```

规则：

- 节气以本地固定边界表计算
- `solarTermStage` 仍按 `1-4 / 5-10 / 11+` 天分段
- 所有日期都以 `Asia/Shanghai` 为准

## 3. 卦象生成

### 3.1 输入

- `dateKey`
- `roleSeed`
- `solarTerm.monthNumber`

### 3.2 公式

```text
hexagramIndex = (hash(dateKey) + roleSeed + solarTerm.monthNumber * 3) % 64
```

约束：

- 同一角色同一天结果固定
- 两个角色同一天必然落到不同卦象索引

### 3.3 卦象库

- 本地完整维护 64 卦名称与六爻结构
- 每卦至少提供：
  - 卦名
  - 六爻
  - 卦象主题
  - 焦点标签
  - 避免项标签

## 4. 内容选择

### 4.1 动作与穴位

排序依据：

- 角色标签匹配数
- 季节匹配
- 固定哈希扰动

输出：

- 健身固定 1-2 条
- 穴位固定 1 条

### 4.2 节气食谱

- 每个节气至少 1 个家常食谱
- 食谱描述允许按角色标签改写推荐理由
- 不引入外部接口或知识检索

## 5. 历史去重

历史键固定为：

```text
id = `${roleId}-${dateKey}`
```

规则：

- 相同 `id` 新快照覆盖旧快照
- 历史按日期倒序保存
- 默认保留最近 180 条
