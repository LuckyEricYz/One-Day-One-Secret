# ⚡ 性能优化策略

> 首屏加载、动画性能、资源优化与 H5 特殊注意事项

---

## 1. 性能目标

| 指标 | 目标值 | 测量工具 |
|:-----|:-------|:---------|
| Lighthouse Performance | ≥ 90 | Chrome DevTools |
| First Contentful Paint (FCP) | < 1.5s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Total Bundle Size (gzip) | < 200KB | `pnpm run build` |
| API 响应时间 (P95) | < 3s | Vercel Analytics |

---

## 2. 首屏加载优化

### 2.1 代码拆分

```javascript
// 路由级别 lazy loading
const Home = lazy(() => import('./pages/Home'));
const Result = lazy(() => import('./pages/Result'));
const Profile = lazy(() => import('./pages/Profile'));
const Archive = lazy(() => import('./pages/Archive'));

// 重型组件 lazy loading
const DivinationAnimation = lazy(() => import('./components/DivinationAnimation'));
const TianjiCard = lazy(() => import('./components/TianjiCard'));
```

### 2.2 关键渲染路径

```
首次加载加载的资源（< 100KB gzip）：
├── index.html
├── main.js (核心逻辑 + 路由)
├── Home chunk (首页组件)
├── theme.css (CSS 变量)
└── 字体预加载 (LXGW WenKai woff2)

延迟加载：
├── Result chunk (天机卡页 - 起卦后加载)
├── DivinationAnimation chunk
├── Profile chunk (首次使用时加载)
├── html2canvas (保存长图时加载)
└── 纹理/Lottie 素材
```

### 2.3 预加载策略

```html
<!-- 关键字体预加载 -->
<link rel="preload" href="/fonts/LXGWWenKai-Regular.woff2" as="font" type="font/woff2" crossorigin>

<!-- 关键 CSS 内联 -->
<style>
  /* 首屏关键 CSS (background, font-face) 内联到 HTML 中 */
  body { background: #0d0d0f; color: #f5f0e8; }
</style>
```

---

## 3. 动画性能

### 3.1 GPU 加速原则

```css
/* 所有动画元素启用 GPU 层 */
.animated-element {
  will-change: transform, opacity;
  transform: translateZ(0);  /* 强制 GPU 层 */
}
```

### 3.2 粒子动画优化

- 粒子数量控制在 30-50 个（性能与效果平衡点）
- 使用 `transform` 而非 `top/left` 移动粒子
- 低端设备检测：如果帧率 < 30fps，减少粒子数到 15 个
- 粒子使用 CSS 或 Canvas，不使用 DOM 元素

```javascript
// 低端设备检测
function isLowEndDevice() {
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = navigator.deviceMemory || 2;
  return hardwareConcurrency <= 2 || deviceMemory <= 2;
}
```

### 3.3 Framer Motion 优化

```javascript
// 使用 layout animation 时传入 layoutDependency 减少重新匹配
// 禁用不需要的 layout 属性
<motion.div
  layout={false}  // 不需要 layout 时关闭
  initial={false}  // 首次渲染不做动画
/>
```

---

## 4. 资源优化

### 4.1 图片

- 所有纹理图片使用 WebP 格式
- 宣纸纹理：512×512，< 30KB（可平铺）
- CSS 背景图使用 `image-set()` 提供多分辨率

### 4.2 字体

- 仅加载需要的字重（LXGW WenKai: Regular）
- 使用 `unicode-range` 按需加载字符子集（如果字体支持）
- `font-display: swap` 避免 FOIT

### 4.3 第三方库体积控制

| 库 | gzip 体积 | 备注 |
|:---|:---------|:-----|
| React + ReactDOM | ~42KB | 必要 |
| Framer Motion | ~30KB | 可选：仅导入需要的模块 |
| html2canvas | ~40KB | 延迟加载（仅在保存时） |
| **总计** | **~112KB** | 在预算内 |

```javascript
// Framer Motion tree-shaking
import { motion, AnimatePresence } from 'framer-motion';
// 不要 import * from 'framer-motion'
```

---

## 5. API 性能

### 5.1 AI 响应时间优化

- 选择低延迟模型（gpt-4o-mini / gemini-2.5-flash）
- `max_tokens` 限制在 800（够用且快速）
- Serverless Function Region: `hkg1`（香港，离中国大陆近）

### 5.2 并行请求

```javascript
// 在用户长按期间预先发起部分计算
// 松开后只需发送最终的 pressDuration
async function handleLongPressEnd(duration) {
  // 这些可以在长按期间就准备好
  const [location, weather] = await Promise.all([
    getGeolocation(),
    getWeather()
  ]);
  
  // 只有 duration 是松开后才知道的
  const result = await fetch('/api/generate', {
    body: JSON.stringify({ pressDuration: duration, location, weather, ... })
  });
}
```

### 5.3 缓存策略

- 同一天内用户主动刷新，返回相同结果（基于日期+用户画像 hash）
- 可选：Service Worker 缓存离线天机模板

---

## 6. H5 特殊注意事项

### 6.1 iOS Safari

- `100vh` 问题：使用 `dvh` 单位或 JS 动态计算
- 橡皮筋效果：`overscroll-behavior: none` 在主页面
- touch 事件延迟：`touch-action: manipulation`

### 6.2 微信内置浏览器

- 微信分享 JSSDK 配置（如需微信分享功能）
- 微信浏览器的 `position: fixed` 问题
- 长图保存：微信内无法直接调用 share API，引导用户长按保存

### 6.3 Android WebView

- 低端安卓机的动画性能：自动降级粒子数量
- 振动反馈 API 兼容性：`navigator.vibrate` 检测

---

## 7. 监控 Checklist

- [ ] Lighthouse Performance ≥ 90
- [ ] 首屏加载 < 2s（3G 网络）
- [ ] 动画帧率 ≥ 50fps（中端设备）
- [ ] API P95 < 3s
- [ ] Bundle gzip < 200KB
- [ ] 无布局偏移 (CLS < 0.1)
