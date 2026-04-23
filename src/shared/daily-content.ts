import type { AcupointItem, ExerciseItem, RecipeItem } from "../types.js";

export const EXERCISE_LIBRARY: ExerciseItem[] = [
  {
    id: "neck-release",
    name: "坐姿松颈开肩",
    scene: "办公室",
    duration: "1 分钟",
    benefit: "久坐后先把肩颈松开，减少一直绷着的感觉。",
    steps: ["坐直，肩膀轻轻向上提再放下 6 次", "头向左右各侧倾 3 次，动作慢一点"],
    note: "动作只做到微微拉开，不要猛压脖子。",
    tags: ["desk_relief", "mobility"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "seated-twist",
    name: "椅上醒脊扭转",
    scene: "办公室",
    duration: "1 分钟",
    benefit: "让背部和腰侧重新活动，缓解长时间坐着的僵住感。",
    steps: ["坐稳后双手扶椅背，身体向右轻转 3 次", "换左侧重复，保持呼吸顺畅"],
    note: "腰背不舒服时只做小幅度版本。",
    tags: ["desk_relief", "mobility", "digestive_balance"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "wall-calf-raise",
    name: "扶墙提踵",
    scene: "居家",
    duration: "1 分钟",
    benefit: "把下肢气血带起来，适合坐久后脚冷或腿沉的时候。",
    steps: ["双手扶墙站稳，脚跟抬起再落下 15 次", "最后保持脚跟抬起 10 秒"],
    note: "膝盖微屈，不要为了高度猛冲。",
    tags: ["warmth", "mobility"],
    seasons: ["autumn", "winter", "spring"]
  },
  {
    id: "breathing-reset",
    name: "四拍呼吸收心",
    scene: "办公室",
    duration: "1 分钟",
    benefit: "把呼吸拉长，适合焦躁、信息过载或会议切换太快时。",
    steps: ["吸气 4 拍，停 2 拍，呼气 4 拍", "连续做 4 轮，肩膀保持放松"],
    note: "只求节奏均匀，不要憋气用力。",
    tags: ["calm", "sleep_regulation"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "desk-chest-open",
    name: "桌边扩胸运动",
    scene: "办公室",
    duration: "1 分钟",
    benefit: "久坐含胸时做一组，胸口和肩前会松很多。",
    steps: ["双手在身后交握或扶桌边，胸口轻轻打开", "保持 15 秒，重复 3 轮"],
    note: "腰不要塌，用胸口向前上方延伸。",
    tags: ["desk_relief", "mobility"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "after-meal-walk",
    name: "饭后缓走",
    scene: "居家",
    duration: "8 分钟",
    benefit: "适合消化偏慢、晚饭偏饱或下午脑子发沉的时候。",
    steps: ["饭后休息 10 分钟再走", "步速保持能正常说话的强度"],
    note: "不是快走打卡，重点是让身体慢慢动起来。",
    tags: ["digestive_balance", "calm"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "ankle-circle",
    name: "踝关节画圈",
    scene: "办公室",
    duration: "1 分钟",
    benefit: "久坐后小腿和脚背容易发紧时，用来带动下肢循环。",
    steps: ["坐姿抬起一只脚，顺时针画圈 10 次", "换逆时针 10 次，再换另一侧"],
    note: "动作慢一点，感受脚踝活动开就够了。",
    tags: ["warmth", "desk_relief"],
    seasons: ["autumn", "winter", "spring"]
  },
  {
    id: "hip-shift",
    name: "站姿重心切换",
    scene: "居家",
    duration: "1 分钟",
    benefit: "站起来把髋部和腿侧唤醒，适合下午发沉和腰胯僵住时。",
    steps: ["双脚与肩同宽，重心左右缓慢切换 12 次", "最后配合手臂上举 6 次"],
    note: "膝盖方向顺着脚尖，不要猛晃。",
    tags: ["mobility", "warmth"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "eye-rest",
    name: "闭眼覆掌",
    scene: "办公室",
    duration: "30 秒",
    benefit: "长时间盯屏之后让眼和心一起降噪，适合午后补一段安静。",
    steps: ["双手搓热后轻覆眼周 20 秒", "放下手后眨眼 6 次"],
    note: "不要压眼球，只是轻轻盖住。",
    tags: ["calm", "desk_relief"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "bedtime-stretch",
    name: "睡前侧腰舒展",
    scene: "居家",
    duration: "1 分钟",
    benefit: "适合晚上脑子还很忙的时候，用简单动作提醒身体收尾。",
    steps: ["站姿双手上举，身体向左右轻侧弯各 4 次", "结束后做 2 次深呼吸"],
    note: "动作要柔和，不追求拉到很深。",
    tags: ["sleep_regulation", "mobility"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "morning-shake",
    name: "晨间抖手醒身",
    scene: "居家",
    duration: "45 秒",
    benefit: "早晨状态发沉、起步慢时很适合，先把身体轻轻唤醒。",
    steps: ["双手自然下垂，轻轻抖手 20 秒", "再原地踏步 20 秒"],
    note: "节奏轻快即可，不要做成激烈甩动。",
    tags: ["warmth", "mobility"],
    seasons: ["spring", "autumn", "winter"]
  },
  {
    id: "quiet-squat",
    name: "靠墙半蹲停留",
    scene: "居家",
    duration: "40 秒",
    benefit: "当任务很多但身体发散时，用短暂停留把精神收回来。",
    steps: ["背靠墙，半蹲停留 20 秒", "起身后缓慢深呼吸 2 次，再做一轮"],
    note: "膝盖不舒服就改成扶桌半蹲。",
    tags: ["calm", "mobility"],
    seasons: ["autumn", "winter", "spring"]
  }
];

export const ACUPOINT_LIBRARY: AcupointItem[] = [
  {
    id: "hegu",
    name: "合谷",
    location: "手背虎口处，拇指与食指骨头交会的凹陷附近。",
    method: "拇指按住后缓缓打圈，左右手各按压。",
    duration: "每侧 30 秒",
    reason: "适合久盯屏、肩颈发紧或整个人有点堵的时候。",
    tags: ["desk_relief", "mobility"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "neiguan",
    name: "内关",
    location: "前臂内侧，手腕横纹上约三指处。",
    method: "用拇指轻按后停 5 秒，再放松，循环进行。",
    duration: "每侧 30 秒",
    reason: "适合会前紧张、胸口发闷或饭后有点顶的时候。",
    tags: ["calm", "digestive_balance"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "zusanli",
    name: "足三里",
    location: "膝盖外下方约四横指处。",
    method: "用指腹按到微酸即可，左右交替按压。",
    duration: "每侧 40 秒",
    reason: "适合想稳住脾胃、改善腿沉和恢复一点元气的时候。",
    tags: ["digestive_balance", "warmth"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "sanyinjiao",
    name: "三阴交",
    location: "内踝尖上约四横指，胫骨后缘处。",
    method: "用拇指缓慢按揉，力度以能放松为准。",
    duration: "每侧 30 秒",
    reason: "适合换季发冷、睡前难收尾或下肢发沉的时候。",
    tags: ["warmth", "sleep_regulation"],
    seasons: ["autumn", "winter", "spring"]
  },
  {
    id: "taichong",
    name: "太冲",
    location: "脚背大脚趾与二脚趾骨缝往上推的凹陷处。",
    method: "从脚趾方向慢慢推向凹陷点，停住再放松。",
    duration: "每侧 30 秒",
    reason: "适合情绪上头、烦躁或脑子转不停的时候。",
    tags: ["calm", "mobility"],
    seasons: ["spring", "summer", "autumn"]
  },
  {
    id: "fengchi",
    name: "风池",
    location: "后脑勺下方，两侧发际边缘的凹陷处。",
    method: "双手拇指托住两侧，向上轻按并小范围打圈。",
    duration: "20-30 秒",
    reason: "适合久坐后后颈僵、头面发闷或午后眼疲劳的时候。",
    tags: ["desk_relief", "calm"],
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  {
    id: "laogong",
    name: "劳宫",
    location: "掌心中央，握拳时中指尖大致所指处。",
    method: "用另一只手拇指按住后缓慢揉压。",
    duration: "每侧 20 秒",
    reason: "适合情绪燥、手心热或开会前想快速稳一下心神时。",
    tags: ["calm", "sleep_regulation"],
    seasons: ["summer", "autumn", "spring"]
  },
  {
    id: "yongquan",
    name: "涌泉",
    location: "脚掌前部凹陷处，大致在脚底前三分之一位置。",
    method: "坐下后用拇指由轻到稳地按压，再搓热脚底。",
    duration: "每侧 40 秒",
    reason: "适合晚上头脑停不下来、脚冷或整个人悬着的时候。",
    tags: ["sleep_regulation", "warmth"],
    seasons: ["autumn", "winter", "spring"]
  }
];

export const RECIPE_LIBRARY: RecipeItem[] = [
  {
    id: "xiaohan-yam-porridge",
    solarTermKeys: ["xiaohan"],
    name: "山药小米粥",
    description: "小寒时节用温热、软和的早餐稳住胃口和体力。",
    ingredients: ["小米", "山药", "红枣 2-3 枚"],
    steps: ["山药切块与小米同煮", "煮到黏稠后再放红枣焖 5 分钟"],
    benefit: "适合寒气重时先把脾胃暖起来。",
    tags: ["warmth", "digestive_balance"]
  },
  {
    id: "dahan-ginger-soup",
    solarTermKeys: ["dahan"],
    name: "姜丝牛肉汤",
    description: "大寒适合温热带汤水的家常做法，少吃寒凉硬菜。",
    ingredients: ["牛肉片", "姜丝", "白菜心"],
    steps: ["姜丝下锅煸香后加水", "放牛肉片和白菜煮熟后调味"],
    benefit: "寒深时先顾保暖与恢复。",
    tags: ["warmth"]
  },
  {
    id: "lichun-greens-noodle",
    solarTermKeys: ["lichun"],
    name: "青菜鸡丝面",
    description: "立春吃得轻一点，让身体慢慢从冬天切到舒展状态。",
    ingredients: ["细面", "鸡丝", "小青菜"],
    steps: ["面煮熟后捞出", "鸡丝和青菜快煮后浇在面上"],
    benefit: "适合刚入春时稳稳提起食欲和节奏。",
    tags: ["digestive_balance", "mobility"]
  },
  {
    id: "yushui-tremella-soup",
    solarTermKeys: ["yushui"],
    name: "银耳雪梨羹",
    description: "雨水时节湿意上来，清润但不寒凉更合适。",
    ingredients: ["银耳", "雪梨", "枸杞少量"],
    steps: ["银耳先煮软", "放雪梨块后再煮 10 分钟"],
    benefit: "适合想清爽一点又不想太凉的时候。",
    tags: ["calm", "digestive_balance"]
  },
  {
    id: "jingzhe-leek-egg",
    solarTermKeys: ["jingzhe"],
    name: "韭菜炒鸡蛋",
    description: "惊蛰动能起来了，家常快手菜最适合把节奏带起来。",
    ingredients: ["韭菜", "鸡蛋", "少量姜丝"],
    steps: ["鸡蛋炒散盛出", "韭菜快炒后回锅翻匀"],
    benefit: "适合忙起来时保持简单、温热、不过饱。",
    tags: ["mobility", "digestive_balance"]
  },
  {
    id: "chunfen-carrot-rice",
    solarTermKeys: ["chunfen"],
    name: "胡萝卜鸡肉饭",
    description: "春分讲究平衡，一锅饭解决正餐最省心。",
    ingredients: ["大米", "鸡腿肉", "胡萝卜丁"],
    steps: ["鸡肉和胡萝卜先翻炒", "与米一起焖熟即可"],
    benefit: "适合节奏平衡期把三餐拉回规律。",
    tags: ["digestive_balance"]
  },
  {
    id: "qingming-broad-bean-soup",
    solarTermKeys: ["qingming"],
    name: "蚕豆青菜汤",
    description: "清明适合轻一点、绿一点，也别把晚饭吃得太重。",
    ingredients: ["鲜蚕豆", "青菜", "豆腐"],
    steps: ["蚕豆先煮熟", "放豆腐和青菜再煮 3-5 分钟"],
    benefit: "适合外出走动多、晚上想吃清爽一点的时候。",
    tags: ["digestive_balance", "calm"]
  },
  {
    id: "guyu-coix-rice",
    solarTermKeys: ["guyu"],
    name: "薏米南瓜饭",
    description: "谷雨湿意渐重，用熟软主食比冷食和甜品更稳。",
    ingredients: ["大米", "薏米", "南瓜块"],
    steps: ["薏米提前浸泡", "和米、南瓜一起焖熟"],
    benefit: "适合湿重时先顾脾胃。",
    tags: ["digestive_balance", "warmth"]
  },
  {
    id: "lixia-tomato-egg",
    solarTermKeys: ["lixia"],
    name: "番茄鸡蛋面",
    description: "立夏不要一下吃得太燥，酸甜温热的家常面更稳。",
    ingredients: ["番茄", "鸡蛋", "挂面"],
    steps: ["番茄炒出汁后加水", "打入鸡蛋后下面煮熟"],
    benefit: "适合热势初起时保持清爽和饱腹平衡。",
    tags: ["calm", "digestive_balance"]
  },
  {
    id: "xiaoman-bitter-gourd",
    solarTermKeys: ["xiaoman"],
    name: "苦瓜炒蛋",
    description: "小满热和湿并行，餐桌上留一点清爽会舒服很多。",
    ingredients: ["苦瓜", "鸡蛋", "蒜片少量"],
    steps: ["苦瓜焯水后快炒", "加入鸡蛋翻匀即可"],
    benefit: "适合天热又容易口重的时候。",
    tags: ["calm"]
  },
  {
    id: "mangzhong-loofah",
    solarTermKeys: ["mangzhong"],
    name: "丝瓜豆腐汤",
    description: "芒种事情多时，更适合做一锅简单热汤稳住晚饭。",
    ingredients: ["丝瓜", "北豆腐", "虾皮少量"],
    steps: ["丝瓜先煮软", "再放豆腐和虾皮煮开"],
    benefit: "适合忙碌时减少油腻和额外负担。",
    tags: ["digestive_balance", "calm"]
  },
  {
    id: "xiazhi-mung-bean",
    solarTermKeys: ["xiazhi"],
    name: "绿豆百合粥",
    description: "夏至心火易旺，清一点但别冰着最关键。",
    ingredients: ["绿豆", "大米", "百合"],
    steps: ["绿豆先煮开花", "加入米和百合煮到软糯"],
    benefit: "适合热盛时让心神缓下来。",
    tags: ["calm"]
  },
  {
    id: "xiaoshu-cucumber-chicken",
    solarTermKeys: ["xiaoshu"],
    name: "黄瓜鸡丝拌面",
    description: "小暑宜清爽，但主食和蛋白还是要稳住。",
    ingredients: ["熟面", "鸡丝", "黄瓜丝"],
    steps: ["面煮熟后过温水", "拌入鸡丝和黄瓜丝即可"],
    benefit: "适合天气热、胃口轻的时候。",
    tags: ["digestive_balance"]
  },
  {
    id: "dashu-winter-melon",
    solarTermKeys: ["dashu"],
    name: "冬瓜虾仁汤",
    description: "大暑热势最重，家常热汤比冰饮更能帮身体缓下来。",
    ingredients: ["冬瓜", "虾仁", "姜片"],
    steps: ["姜片煮水后下冬瓜", "冬瓜透明后放虾仁煮熟"],
    benefit: "适合暑热重时减轻油腻感。",
    tags: ["calm"]
  },
  {
    id: "liqiu-lotus-root",
    solarTermKeys: ["liqiu"],
    name: "莲藕排骨汤",
    description: "立秋开始往收敛走，一锅汤最适合慢慢把节奏收回来。",
    ingredients: ["排骨", "莲藕", "胡萝卜"],
    steps: ["排骨焯水后炖煮", "再放莲藕和胡萝卜煮软"],
    benefit: "适合入秋时顾恢复力和正餐质量。",
    tags: ["warmth", "digestive_balance"]
  },
  {
    id: "chushu-yam-ribs",
    solarTermKeys: ["chushu"],
    name: "山药蒸排骨",
    description: "处暑热退一些，吃得家常、熟软，比重口更舒服。",
    ingredients: ["排骨", "山药", "姜片"],
    steps: ["排骨腌好后铺上山药", "一起蒸熟即可"],
    benefit: "适合天气转换时稳脾胃。",
    tags: ["digestive_balance", "warmth"]
  },
  {
    id: "bailu-pear-porridge",
    solarTermKeys: ["bailu"],
    name: "梨丁燕麦粥",
    description: "白露开始偏燥，早餐做得润一点更顺口。",
    ingredients: ["燕麦", "大米", "雪梨丁"],
    steps: ["米和燕麦先煮开", "再加入雪梨丁煮软"],
    benefit: "适合早晨口干、想吃得柔和些的时候。",
    tags: ["calm", "digestive_balance"]
  },
  {
    id: "qiufen-pumpkin-soup",
    solarTermKeys: ["qiufen"],
    name: "南瓜玉米浓汤",
    description: "秋分讲究平稳，一碗热汤很适合做晚餐收尾。",
    ingredients: ["南瓜", "玉米粒", "牛奶少量"],
    steps: ["南瓜蒸熟后打碎", "加玉米粒煮开后调味"],
    benefit: "适合想吃得顺口、又不太重的时候。",
    tags: ["warmth", "digestive_balance"]
  },
  {
    id: "hanlu-chicken-congee",
    solarTermKeys: ["hanlu"],
    name: "鸡丝香菇粥",
    description: "寒露之后早餐和晚餐都更适合偏温一点。",
    ingredients: ["大米", "鸡丝", "香菇丁"],
    steps: ["先把粥煮开花", "再放鸡丝和香菇煮熟"],
    benefit: "适合凉意上来时把胃和身体一起顾住。",
    tags: ["warmth", "digestive_balance"]
  },
  {
    id: "shuangjiang-radish-stew",
    solarTermKeys: ["shuangjiang"],
    name: "白萝卜炖牛腩",
    description: "霜降适合用一顿稳当正餐来收气，不必再追求花样刺激。",
    ingredients: ["牛腩", "白萝卜", "姜片"],
    steps: ["牛腩炖软后加入萝卜", "继续炖到萝卜入味"],
    benefit: "适合天气更凉时补充稳定能量。",
    tags: ["warmth"]
  },
  {
    id: "lidong-black-sesame",
    solarTermKeys: ["lidong"],
    name: "黑芝麻核桃糊",
    description: "立冬之后，早餐多一点温润感会比冷饮更舒服。",
    ingredients: ["黑芝麻", "核桃", "燕麦"],
    steps: ["原料打碎后加水煮开", "小火煮到顺滑即可"],
    benefit: "适合立冬时把恢复力往回收。",
    tags: ["warmth", "sleep_regulation"]
  },
  {
    id: "xiaoxue-cabbage-tofu",
    solarTermKeys: ["xiaoxue"],
    name: "白菜豆腐煲",
    description: "小雪不需要大补，热腾腾的清炖家常菜反而最稳。",
    ingredients: ["白菜", "北豆腐", "粉丝少量"],
    steps: ["白菜先煮软", "放豆腐和粉丝煮透后调味"],
    benefit: "适合寒意渐深时吃得暖、吃得轻。",
    tags: ["warmth", "digestive_balance"]
  },
  {
    id: "daxue-red-date-chicken",
    solarTermKeys: ["daxue"],
    name: "红枣鸡汤",
    description: "大雪之后更适合喝点热汤，把晚上的节奏往慢里收。",
    ingredients: ["鸡块", "红枣", "姜片"],
    steps: ["鸡块焯水后炖煮", "加入红枣和姜片煮到汤香"],
    benefit: "适合寒重、疲劳感更明显的时候。",
    tags: ["warmth", "sleep_regulation"]
  },
  {
    id: "dongzhi-dumpling",
    solarTermKeys: ["dongzhi"],
    name: "冬至暖汤饺",
    description: "冬至更适合一顿热乎、不过量的家常正餐。",
    ingredients: ["饺子", "青菜", "紫菜少量"],
    steps: ["饺子煮熟后盛出", "用原汤加青菜和紫菜做汤底"],
    benefit: "适合冬至当天把身体和情绪都收进温暖里。",
    tags: ["warmth", "calm"]
  }
];
