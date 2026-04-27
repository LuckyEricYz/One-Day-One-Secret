# 纯本地生成算法说明

> 当前版本只保留确定性、本地可复现的个人资料驱动规则，不接 AI、不请求定位、不上传资料。

## 1. 总体流程

```text
StoredUserProfileV3 + timestamp
  -> 获取上海日期、节气、干支
  -> 规范化性别、出生日期、可选出生时辰、出生地、当前所在地
  -> 生成 profileHash
dateKey + profileHash + solarTermKey + birthDay
  -> 生成当日卦象索引
资料派生标签 + 节气季节
  -> 从本地动作 / 穴位 / 食谱池中选出内容
calendar + profile summary + almanac + hexagram + content
  -> 组合成 DailySnapshot
```

## 2. 资料输入

`StoredUserProfileV3` 包含：

- `gender`: `"male" | "female"`
- `birthDate`: `YYYY-MM-DD`
- `birthHourBranch`: 12 个传统时辰之一，允许 `null`
- `birthPlace`: 手动输入城市
- `currentPlace`: 手动输入城市
- `createdAt` / `updatedAt`
- `version: 1`

生成时会对城市文本做 trim 和空白规整。出生时辰为空时，不做精确时柱判断，只按出生日期、性别和所在地生成温和的今日节律提示。

## 3. 日历上下文

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

## 4. 卦象生成

输入：

- `dateKey`
- `profileHash`
- `solarTerm.monthNumber`
- 出生日期里的日数字

公式：

```text
hexagramIndex = (
  hash(`${dateKey}:${profileHash}`) + solarTerm.monthNumber * 3 + birthDay
) % 64
```

约束：

- 同一资料同一天结果固定
- 修改出生信息或当前所在地会生成新的 `profileHash`
- 不以角色预设或固定模板作为首页生成依据

## 5. 内容选择

资料会派生出内部内容标签，例如 `desk_relief`、`mobility`、`warmth`、`calm`、`digestive_balance`、`sleep_regulation`。这些标签只用于排序内容，不直接暴露成“基础状态”或“情绪特质”。

排序依据：

- 资料标签匹配数
- 节气季节匹配
- `profileHash + dateKey` 的固定哈希扰动

输出：

- 今日黄历：`宜 / 忌 / 今日主轴 / 状态提示`
- 卦象：1 个本地 64 卦结果
- 健身：1-2 条规则推荐，另展示 3 个静音演示视频
- 穴位：1 条
- 节气食谱：1 条

## 6. 历史去重

历史键固定为：

```text
id = `${profileHash}-${dateKey}`
```

规则：

- 相同 `id` 新快照覆盖旧快照
- 历史按日期倒序保存
- 默认保留最近 180 条
