# Collaboration Guide — 双人分工文档

## 分工原则

项目分成两个独立模块，通过 **API 接口约定** 连接。两个人可以同时开发，互不阻塞。

```
┌─────────────────────┐     API 接口约定      ┌─────────────────────┐
│     Person A        │ ◄──────────────────► │     Person B        │
│  Expo 页面 + 组件    │                       │  Express API + AI   │
│  地图展示            │                       │  数据库              │
└─────────────────────┘                       └─────────────────────┘
```

---

## ✅ 已完成（Phase 1-2）

### Person A（前端）已完成
- `lib/theme.ts` — 全局设计 token
- `app/_layout.tsx` — Tab 导航
- `app/index.tsx` — Landing page
- `app/senior/register.tsx` — Senior 注册表单 → `POST /api/seniors`
- `app/volunteer/register.tsx` — Volunteer 注册表单 → `POST /api/volunteers`
- `app/senior/request.tsx` — 出行请求表单 → `POST /api/requests`

### Person B（后端）已完成
- Supabase 建表（seniors, volunteers, outing_requests, outings）
- Seed 数据（5 seniors, 2 volunteers）
- `POST/GET /api/seniors`
- `POST/GET /api/volunteers`
- `POST/GET /api/requests`
- `POST /api/match` — Claude AI 匹配 + DBSCAN 地理聚类
- `GET/PATCH /api/outings` — 查看 outings + 志愿者确认/取消
- `GET /api/stats` — Dashboard 统计

---

## 🔄 当前阶段（Phase 3）

### Person A — Volunteer Dashboard + Senior 状态页

**负责文件：**
- `app/volunteer/dashboard.tsx`
- `app/senior/status.tsx`

#### Volunteer Dashboard (`app/volunteer/dashboard.tsx`)
- 页面入口：Tab 底部 "Volunteer" → Dashboard
- 输入：URL 参数 `?volunteer_id=xxx`（注册后自动跳转过来）
- 调用：`GET /api/outings?volunteer_id=xxx`
- 展示每个 outing 卡片：
  - 几月几号、几点出发
  - 目的地类型
  - 几位乘客（seniors 名字列表）
  - Accept / Decline 按钮
- Accept → `PATCH /api/outings/:id` body: `{ "status": "confirmed" }`
- Decline → `PATCH /api/outings/:id` body: `{ "status": "cancelled" }`

#### Senior 状态页 (`app/senior/status.tsx`)
- 输入：URL 参数 `?senior_id=xxx`（注册后自动跳转过来）
- 调用：`GET /api/requests?senior_id=xxx`
- 展示每条请求的状态卡片：
  - 目的地、日期、时间
  - 状态 badge：pending（等待匹配）/ matched（已匹配）
  - matched 状态时显示"你已被分配志愿者"

---

### Person B — 匹配触发页 + Coordinator Dashboard

**负责文件：**
- `app/match/index.tsx`
- `components/OutingCard.tsx`（可选，供 A 复用）

#### 匹配触发页 (`app/match/index.tsx`)
- 一个大按钮 "Run AI Matching"
- 点击 → `POST /api/match`
- 显示 loading 状态
- 成功后展示匹配结果：
  - 几组被匹配
  - 每组几位 seniors + 志愿者名字
  - 未匹配的 seniors 和原因
- 同时展示 stats：调用 `GET /api/stats`
  - 总 seniors 数、总 volunteers 数
  - pending requests 数、matched 数

---

## 联调检查点

| 完成后 | 验证方式 |
|--------|---------|
| Volunteer Dashboard | 注册志愿者 → 跳转 Dashboard → 能看到分配的 outings → 点 Accept → Supabase outings 表 status 变 confirmed |
| Senior 状态页 | 注册 Senior → 提交请求 → 跳转状态页 → 能看到 pending 状态 → 跑匹配后刷新变 matched |
| 匹配触发页 | 点 Run Matching → Claude 返回分组 → 页面展示结果 |

---

## API 接口速查

| Method | Path | 用途 |
|--------|------|------|
| POST | `/api/seniors` | 注册 senior |
| GET | `/api/seniors` | 列出所有 seniors |
| POST | `/api/volunteers` | 注册 volunteer |
| GET | `/api/volunteers` | 列出所有 volunteers |
| POST | `/api/requests` | 创建出行请求 |
| GET | `/api/requests?senior_id=xxx` | 查某个 senior 的请求 |
| GET | `/api/requests?status=pending` | 查所有 pending 请求 |
| POST | `/api/match` | 触发 AI 匹配 |
| GET | `/api/outings?volunteer_id=xxx` | 查某志愿者的 outings |
| PATCH | `/api/outings/:id` | 确认/取消 outing |
| GET | `/api/stats` | Dashboard 统计数据 |

---

## 启动方式

```bash
# 终端 1 — 后端
cd server && npm run dev

# 终端 2 — 前端
npm start -- --clear
```

**手机上用 Expo Go 扫码，确保手机和 Mac 在同一 WiFi 下。**
`.env.local` 中 `EXPO_PUBLIC_SERVER_URL` 填 Mac 的局域网 IP + 端口，如：
`EXPO_PUBLIC_SERVER_URL=http://192.168.1.5:3001`
