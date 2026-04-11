export type SolarTermDefinition = {
  key: string;
  name: string;
  month: number;
  day: number;
  season: "spring" | "summer" | "autumn" | "winter";
  monthNumber: number;
  summary: string;
  actions: string[];
  avoids: string[];
};

export const SOLAR_TERMS: SolarTermDefinition[] = [
  {
    key: "xiaohan",
    name: "小寒",
    month: 1,
    day: 5,
    season: "winter",
    monthNumber: 12,
    summary: "寒气未尽，宜收敛体力，稳定作息。",
    actions: ["午后活动控制在轻量强度", "晚餐少生冷，多温热汤水", "让睡眠提前半小时"],
    avoids: ["连续熬夜", "空腹喝冰饮"]
  },
  {
    key: "dahan",
    name: "大寒",
    month: 1,
    day: 20,
    season: "winter",
    monthNumber: 12,
    summary: "寒气最深，适合保暖、早睡和减少无谓消耗。",
    actions: ["注意肩颈和腰腹保暖", "夜间减少外卖和酒精", "把剧烈运动换成舒展活动"],
    avoids: ["通宵工作", "大汗后吹风"]
  },
  {
    key: "lichun",
    name: "立春",
    month: 2,
    day: 4,
    season: "spring",
    monthNumber: 1,
    summary: "生发初起，适合舒展身心，慢慢提起节奏。",
    actions: ["晨间散步 15 分钟", "饮食增加青色蔬菜", "给当天安排留一点弹性"],
    avoids: ["起床后立刻高强度工作", "情绪硬顶"]
  },
  {
    key: "yushui",
    name: "雨水",
    month: 2,
    day: 19,
    season: "spring",
    monthNumber: 1,
    summary: "湿气渐起，适合清淡饮食和稳定脾胃。",
    actions: ["晚餐控制在七分饱", "把奶茶换成温水或热茶", "多做轻度拉伸"],
    avoids: ["重油重辣", "久坐不动"]
  },
  {
    key: "jingzhe",
    name: "惊蛰",
    month: 3,
    day: 5,
    season: "spring",
    monthNumber: 2,
    summary: "动能上扬，适合舒展，不适合继续透支。",
    actions: ["午后快走 20 分钟", "少量多次补水", "把紧张工作拆成小段完成"],
    avoids: ["情绪硬撑", "晚间继续加班"]
  },
  {
    key: "chunfen",
    name: "春分",
    month: 3,
    day: 20,
    season: "spring",
    monthNumber: 2,
    summary: "昼夜平衡，适合调匀饮食和作息。",
    actions: ["三餐时间尽量固定", "给眼睛和肩颈留休息段", "保持中等活动量"],
    avoids: ["暴饮暴食", "忽冷忽热"]
  },
  {
    key: "qingming",
    name: "清明",
    month: 4,
    day: 4,
    season: "spring",
    monthNumber: 3,
    summary: "气机清升，适合外出走动和整理身体节奏。",
    actions: ["午后散步 15-20 分钟", "减少夜间油腻进食", "让睡前 1 小时安静下来"],
    avoids: ["连续熬夜", "饮食过饱"]
  },
  {
    key: "guyu",
    name: "谷雨",
    month: 4,
    day: 20,
    season: "spring",
    monthNumber: 3,
    summary: "湿意渐重，适合健脾、少冷饮、少久坐。",
    actions: ["主食和热食保持规律", "下班后做一组舒展动作", "避免空腹吃冰冷食物"],
    avoids: ["重甜重冰", "饭后立刻躺下"]
  },
  {
    key: "lixia",
    name: "立夏",
    month: 5,
    day: 5,
    season: "summer",
    monthNumber: 4,
    summary: "热势初起，适合放慢午后节奏，避免躁进。",
    actions: ["午后留 10 分钟静息", "减少高油重辣", "给晚间运动降一点强度"],
    avoids: ["顶着疲惫硬撑", "临睡前大量进食"]
  },
  {
    key: "xiaoman",
    name: "小满",
    month: 5,
    day: 21,
    season: "summer",
    monthNumber: 4,
    summary: "热与湿并行，适合清淡、通风和稳定作息。",
    actions: ["补水频率拉高", "午餐尽量清爽一点", "夜间保持卧室通风"],
    avoids: ["辛辣酒精叠加", "长时间闷热环境"]
  },
  {
    key: "mangzhong",
    name: "芒种",
    month: 6,
    day: 5,
    season: "summer",
    monthNumber: 5,
    summary: "事务容易扎堆，适合做减法，先守睡眠。",
    actions: ["晚上减少无效社交", "把待办拆成三件最重要的事", "睡前停止高强度输入"],
    avoids: ["通宵赶工", "空腹咖啡顶状态"]
  },
  {
    key: "xiazhi",
    name: "夏至",
    month: 6,
    day: 21,
    season: "summer",
    monthNumber: 5,
    summary: "阳气最盛，适合养心神、降躁气、少过劳。",
    actions: ["午后闭眼静息 10 分钟", "把晚间运动改成散步", "减少夜间辛辣和酒"],
    avoids: ["大汗后吹空调", "情绪上头时争执"]
  },
  {
    key: "xiaoshu",
    name: "小暑",
    month: 7,
    day: 7,
    season: "summer",
    monthNumber: 6,
    summary: "暑气渐显，适合补水、降燥、减少额外消耗。",
    actions: ["分次饮水而不是一次猛灌", "把下午茶换成清爽饮品", "给工作安排留出缓冲段"],
    avoids: ["长时间暴晒", "重口味宵夜"]
  },
  {
    key: "dashu",
    name: "大暑",
    month: 7,
    day: 22,
    season: "summer",
    monthNumber: 6,
    summary: "暑热最重，适合低强度活动和稳定补水。",
    actions: ["出门避开最热时段", "吃饭以清淡和易消化为主", "把训练降为恢复性活动"],
    avoids: ["暴晒后冷饮猛降温", "疲惫时继续透支"]
  },
  {
    key: "liqiu",
    name: "立秋",
    month: 8,
    day: 7,
    season: "autumn",
    monthNumber: 7,
    summary: "收敛之势开始，适合把节奏慢慢收回来。",
    actions: ["晚间减少社交和酒精", "散步代替高冲击训练", "把睡眠重新拉回规律"],
    avoids: ["辛辣过量", "连续夜生活"]
  },
  {
    key: "chushu",
    name: "处暑",
    month: 8,
    day: 23,
    season: "autumn",
    monthNumber: 7,
    summary: "暑气渐退，适合补足睡眠和调整胃口。",
    actions: ["早餐恢复稳定", "晚餐不宜过晚", "把久坐拆成多次起身"],
    avoids: ["忽冷忽热", "空腹喝冰饮"]
  },
  {
    key: "bailu",
    name: "白露",
    month: 9,
    day: 7,
    season: "autumn",
    monthNumber: 8,
    summary: "燥意渐起，适合润燥、少熬夜、少辛辣。",
    actions: ["白天分次补水", "晚间给皮肤和喉咙多一点休息", "把咖啡量控制在白天"],
    avoids: ["深夜辛辣烧烤", "睡前情绪过激"]
  },
  {
    key: "qiufen",
    name: "秋分",
    month: 9,
    day: 23,
    season: "autumn",
    monthNumber: 8,
    summary: "气机平衡，适合修整饮食和日常节律。",
    actions: ["保持三餐稳定", "晚饭后轻走 15 分钟", "给当天安排留收尾时间"],
    avoids: ["极端饮食", "临睡前仍高强度工作"]
  },
  {
    key: "hanlu",
    name: "寒露",
    month: 10,
    day: 8,
    season: "autumn",
    monthNumber: 9,
    summary: "凉意加深，适合保暖、润燥和早点休息。",
    actions: ["早晚注意添衣", "让饮食偏温一点", "减少夜间久坐吹风"],
    avoids: ["贪凉", "夜里受寒"]
  },
  {
    key: "shuangjiang",
    name: "霜降",
    month: 10,
    day: 23,
    season: "autumn",
    monthNumber: 9,
    summary: "肃降之势明显，适合收尾和养护脾胃。",
    actions: ["晚餐减少油炸和生冷", "把运动集中在白天", "给身体留一段安静收尾时间"],
    avoids: ["空腹冷饮", "持续晚睡"]
  },
  {
    key: "lidong",
    name: "立冬",
    month: 11,
    day: 7,
    season: "winter",
    monthNumber: 10,
    summary: "收藏开始，适合早睡、保暖和稳住体力。",
    actions: ["夜间减少外出吹风", "热食热汤优先", "把作息往前提一点"],
    avoids: ["熬夜透支", "受凉后硬扛"]
  },
  {
    key: "xiaoxue",
    name: "小雪",
    month: 11,
    day: 22,
    season: "winter",
    monthNumber: 10,
    summary: "寒意渐稳，适合储备精力而不是继续消耗。",
    actions: ["运动以恢复性为主", "给双脚和腰腹保暖", "减少晚间高糖零食"],
    avoids: ["大汗淋漓", "夜里受寒"]
  },
  {
    key: "daxue",
    name: "大雪",
    month: 12,
    day: 7,
    season: "winter",
    monthNumber: 11,
    summary: "寒气更深，适合温补和控制情绪波动。",
    actions: ["白天多晒一点自然光", "饮食保持温热规律", "把工作峰值尽量前移"],
    avoids: ["空腹冷食", "深夜争执"]
  },
  {
    key: "dongzhi",
    name: "冬至",
    month: 12,
    day: 21,
    season: "winter",
    monthNumber: 11,
    summary: "阴极阳生，适合早睡、静养和恢复体力。",
    actions: ["晚间把节奏放慢", "安排一顿温热而不过量的正餐", "减少不必要的社交消耗"],
    avoids: ["过劳", "熬夜补偿白天压力"]
  }
];

