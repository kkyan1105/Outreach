# Collaboration Guide — 双人分工文档

## 分工原则

项目分成两个独立模块，通过 **API 接口约定** 连接。两个人可以同时开发，互不阻塞。

```
┌─────────────────────┐     API 接口约定      ┌─────────────────────┐
│     Person A        │ ◄──────────────────► │     Person B        │
│  前端页面 + UI 组件  │                       │  后端 API + AI 匹配  │
│  地图展示            │                       │  数据库              │
└─────────────────────┘                       └─────────────────────┘
```

---

## Person A — 前端 + 地图

**负责：** 所有页面、表单、UI 组件、地图可视化

### 任务清单

#### Phase 1 (0-8h)
- [ ] 项目初始化：`npx create-next-app@latest --typescript --tailwind`
- [ ] 基础 layout：`src/app/layout.tsx`（Navbar、Footer）
- [ ] Landing page：`src/app/page.tsx`（项目介绍 + 统计数据 + CTA 按钮）

#### Phase 2 (8-16h)
- [ ] Senior 注册页：`src/app/senior/register/page.tsx`
- [ ] Volunteer 注册页：`src/app/volunteer/register/page.tsx`
- [ ] 出行请求页：`src/app/senior/request/page.tsx`
- [ ] 地址输入组件（Google Places Autocomplete）

#### Phase 3 (16-26h)
- [ ] Volunteer Dashboard：`src/app/volunteer/dashboard/page.tsx`
  - 展示分配给自己的 outings
  - Accept / Decline 按钮
- [ ] Senior 状态页：`src/app/senior/status/page.tsx`
  - 展示我的请求状态（pending / matched）

#### Phase 4 (26-34h)
- [ ] 地图组件：`src/components/MapView.tsx`
  - Google Maps 显示所有匹配的老人 + 志愿者位置
  - 画出接送路线
- [ ] Outing 详情页：`src/app/match/page.tsx`
  - 地图 + 乘客列表 + 时间 + 目的地

#### Phase 5 (34-40h)
- [ ] Landing page 美化
- [ ] 全局 responsive 适配
- [ ] 加载状态、空状态、错误提示

### 开发阶段无后端时怎么办？

在后端没 ready 之前，用 mock 数据开发。创建这个文件：

```typescript
// src/lib/mock-data.ts

export const mockSeniors = [
  {
    id: "s1",
    name: "Alice Johnson",
    phone: "615-555-0101",
    address: "1000 Broadway, Nashville, TN",
    lat: 36.1580,
    lng: -86.7816,
    interests: ["grocery", "church"],
    mobility_notes: "Uses a walker",
  },
  {
    id: "s2",
    name: "Bob Williams",
    phone: "615-555-0102",
    address: "1200 West End Ave, Nashville, TN",
    lat: 36.1510,
    lng: -86.7980,
    interests: ["grocery", "library"],
    mobility_notes: "",
  },
  {
    id: "s3",
    name: "Carol Davis",
    phone: "615-555-0103",
    address: "900 Rosa L Parks Blvd, Nashville, TN",
    lat: 36.1685,
    lng: -86.7903,
    interests: ["park", "museum"],
    mobility_notes: "Wheelchair accessible vehicle needed",
  },
];

export const mockVolunteers = [
  {
    id: "v1",
    name: "David Chen",
    phone: "615-555-0201",
    address: "500 Church St, Nashville, TN",
    lat: 36.1627,
    lng: -86.7787,
    vehicle_type: "SUV",
    max_passengers: 4,
    availability: ["monday_morning", "wednesday_morning", "saturday_morning"],
  },
];

export const mockRequests = [
  {
    id: "r1",
    senior_id: "s1",
    destination_type: "grocery",
    destination_name: "Kroger on 21st Ave",
    preferred_date: "2026-03-30",
    preferred_time_start: "09:00",
    preferred_time_end: "12:00",
    status: "pending",
  },
  {
    id: "r2",
    senior_id: "s2",
    destination_type: "grocery",
    destination_name: "Publix on Broadway",
    preferred_date: "2026-03-30",
    preferred_time_start: "10:00",
    preferred_time_end: "13:00",
    status: "pending",
  },
  {
    id: "r3",
    senior_id: "s3",
    destination_type: "park",
    destination_name: "Centennial Park",
    preferred_date: "2026-03-31",
    preferred_time_start: "14:00",
    preferred_time_end: "17:00",
    status: "pending",
  },
];

export const mockOutings = [
  {
    id: "o1",
    volunteer_id: "v1",
    request_ids: ["r1", "r2"],
    scheduled_date: "2026-03-30",
    scheduled_time: "10:00",
    destination_type: "grocery",
    status: "pending",
    seniors: [mockSeniors[0], mockSeniors[1]],
    volunteer: mockVolunteers[0],
  },
];
```

**用法：** 页面里先 `import { mockSeniors } from '@/lib/mock-data'`，等后端 ready 后替换成真实 API 调用。

---

## Person B — 后端 API + 数据库 + AI 匹配

**负责：** Supabase 建表、所有 API 接口、Claude 匹配逻辑

### 任务清单

#### Phase 1 (0-8h)
- [ ] Supabase 创建 project + 建表（见下方 SQL）
- [ ] `src/lib/supabase.ts` — Supabase client
- [ ] `src/lib/types.ts` — 共享 TypeScript 类型
- [ ] `.env.local` 配置

#### Phase 2 (8-16h)
- [ ] `POST /api/seniors` — 注册老人
- [ ] `GET /api/seniors` — 列出所有老人
- [ ] `POST /api/volunteers` — 注册志愿者
- [ ] `GET /api/volunteers` — 列出所有志愿者
- [ ] `POST /api/requests` — 创建出行请求
- [ ] `GET /api/requests` — 列出请求（支持 ?status=pending 过滤）
- [ ] `src/lib/geocode.ts` — 地址转经纬度

#### Phase 3 (16-26h) ⭐ 核心
- [ ] `POST /api/match` — AI 匹配接口
  - 获取所有 pending requests
  - 获取所有 available volunteers
  - 调 Claude API 做分组
  - 将匹配结果写入 outings 表
  - 更新 request status → matched
- [ ] `GET /api/outings` — 列出所有匹配结果（支持 ?volunteer_id= 过滤）
- [ ] `PATCH /api/outings/[id]` — 志愿者确认/拒绝

#### Phase 4 (26-34h)
- [ ] 匹配逻辑优化（处理边界情况：没有志愿者、时间不重叠等）
- [ ] Seed 脚本：`scripts/seed.ts` 批量插入 demo 数据

#### Phase 5 (34-40h)
- [ ] API 错误处理完善
- [ ] 部署到 Vercel，确认环境变量配置正确

### Supabase 建表 SQL

登录 Supabase → SQL Editor → 执行：

```sql
-- 老人表
CREATE TABLE seniors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  interests TEXT[] DEFAULT '{}',
  mobility_notes TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 志愿者表
CREATE TABLE volunteers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  vehicle_type TEXT DEFAULT 'sedan',
  max_passengers INTEGER DEFAULT 4,
  availability TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 出行请求表
CREATE TABLE outing_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  destination_type TEXT NOT NULL,
  destination_name TEXT DEFAULT '',
  preferred_date DATE NOT NULL,
  preferred_time_start TIME NOT NULL,
  preferred_time_end TIME NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 匹配结果表
CREATE TABLE outings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  volunteer_id UUID REFERENCES volunteers(id),
  request_ids UUID[] NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  destination_type TEXT NOT NULL,
  route_info JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 共享约定 — 接口契约

**两个人必须对齐的东西：** 数据类型 + API 接口格式。

### 共享类型文件 `src/lib/types.ts`

```typescript
// ====== Database Models ======

export interface Senior {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  interests: string[];       // "grocery" | "church" | "park" | "museum" | "library" | "restaurant" | "social_club" | "other"
  mobility_notes: string;
  emergency_contact: string;
  created_at: string;
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  vehicle_type: string;
  max_passengers: number;
  availability: string[];    // e.g. ["monday_morning", "saturday_afternoon"]
  created_at: string;
}

export interface OutingRequest {
  id: string;
  senior_id: string;
  destination_type: string;
  destination_name: string;
  preferred_date: string;    // "YYYY-MM-DD"
  preferred_time_start: string; // "HH:mm"
  preferred_time_end: string;
  status: "pending" | "matched" | "completed" | "cancelled";
  created_at: string;
}

export interface Outing {
  id: string;
  volunteer_id: string;
  request_ids: string[];
  scheduled_date: string;
  scheduled_time: string;
  destination_type: string;
  route_info: object;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
}

// ====== API Request / Response ======

export interface CreateSeniorRequest {
  name: string;
  phone: string;
  address: string;            // raw address, backend will geocode
  interests: string[];
  mobility_notes?: string;
  emergency_contact?: string;
}

export interface CreateVolunteerRequest {
  name: string;
  phone: string;
  address: string;
  vehicle_type: string;
  max_passengers: number;
  availability: string[];
}

export interface CreateOutingRequest {
  senior_id: string;
  destination_type: string;
  destination_name?: string;
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
}

export interface MatchResult {
  groups: {
    senior_ids: string[];
    volunteer_id: string;
    suggested_time: string;
    destination_type: string;
    reasoning: string;
  }[];
  unmatched_seniors: string[];
  unmatched_reason: string;
}

// ====== API Response Wrapper ======

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
```

---

## API 接口详细约定

### `POST /api/seniors`
```
Request:  CreateSeniorRequest (JSON body)
Response: ApiResponse<Senior>

Example:
POST /api/seniors
{
  "name": "Alice Johnson",
  "phone": "615-555-0101",
  "address": "1000 Broadway, Nashville, TN",
  "interests": ["grocery", "church"],
  "mobility_notes": "Uses a walker"
}

→ 200: { "data": { "id": "uuid...", "name": "Alice", "lat": 36.158, "lng": -86.781, ... }, "error": null }
→ 400: { "data": null, "error": "Name and address are required" }
```

### `GET /api/seniors`
```
Response: ApiResponse<Senior[]>

→ 200: { "data": [...], "error": null }
```

### `POST /api/volunteers`
```
Request:  CreateVolunteerRequest (JSON body)
Response: ApiResponse<Volunteer>
```

### `GET /api/volunteers`
```
Response: ApiResponse<Volunteer[]>
```

### `POST /api/requests`
```
Request:  CreateOutingRequest (JSON body)
Response: ApiResponse<OutingRequest>

Example:
POST /api/requests
{
  "senior_id": "uuid...",
  "destination_type": "grocery",
  "destination_name": "Kroger on 21st Ave",
  "preferred_date": "2026-03-30",
  "preferred_time_start": "09:00",
  "preferred_time_end": "12:00"
}
```

### `GET /api/requests?status=pending`
```
Response: ApiResponse<OutingRequest[]>
Query params: status (optional) — filter by status
```

### `POST /api/match`
```
Request:  {} (no body needed, matches all pending requests)
Response: ApiResponse<MatchResult>

This is the core AI endpoint:
1. Fetches all pending requests + available volunteers
2. Sends to Claude API for grouping
3. Creates outing records in DB
4. Returns match results
```

### `GET /api/outings?volunteer_id=xxx`
```
Response: ApiResponse<(Outing & { seniors: Senior[], volunteer: Volunteer })[]>
Query params: volunteer_id (optional) — filter by volunteer
```

### `PATCH /api/outings/[id]`
```
Request:  { "status": "confirmed" | "cancelled" }
Response: ApiResponse<Outing>
```

---

## Git 协作方式

```bash
# 初始化（Person A 做）
git init
git remote add origin <github-repo-url>

# 各自建分支
Person A: git checkout -b feat/frontend
Person B: git checkout -b feat/backend

# 开发完一个功能就 commit + push
git add .
git commit -m "feat: senior registration form"
git push origin feat/frontend

# 合并到 main（谁先完成谁先合）
git checkout main
git merge feat/frontend
git push origin main
```

**文件不会冲突，因为：**
- Person A 只动 `src/app/*/page.tsx` 和 `src/components/*`
- Person B 只动 `src/app/api/*` 和 `src/lib/*`
- 唯一共享的是 `src/lib/types.ts`，Phase 1 定好后基本不变

---

## 时间线 + 联调计划（每 4 小时合并一次）

每完成一个小功能就合并测试，不攒大的。

### Sprint 1 (0-4h) — 项目骨架

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| `npx create-next-app` + Tailwind | Supabase 创建 project + 建表 |
| 基础 layout + Navbar | `src/lib/supabase.ts` client |
| Senior 注册表单页面 | `src/lib/types.ts` 共享类型 |
| | `POST /api/seniors` 接口 |

**联调：** 前端表单提交 → 调 `POST /api/seniors` → 数据库里能查到这条记录

---

### Sprint 2 (4-8h) — Volunteer 注册

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Volunteer 注册表单页面 | `POST /api/volunteers` 接口 |
| Landing page（统计数据 + 入口按钮） | `GET /api/seniors` 接口 |
| | `GET /api/volunteers` 接口 |

**联调：** 注册志愿者 → 数据库有记录 → GET 接口能返回列表

---

### Sprint 3 (8-12h) — 出行请求

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| 出行请求表单页面 | `POST /api/requests` 接口 |
| 地址输入组件 (Google Places) | `GET /api/requests` 接口 |
| | `src/lib/geocode.ts` 地址转经纬度 |

**联调：** 老人提交出行请求 → 数据库有记录 → 能查到 pending 状态的请求

---

### Sprint 4 (12-16h) — 状态查看

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Senior 状态页（我的请求列表） | 完善 `GET /api/requests?senior_id=xxx` |
| 请求卡片组件 (OutingCard) | 完善 `GET /api/seniors/:id` |

**联调：** 老人能看到自己提交过的所有请求和状态

---

### Sprint 5 (16-20h) — AI 匹配 ⭐

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| 匹配触发按钮 + 结果展示页 | ⭐ `POST /api/match` AI 匹配核心 |
| 匹配结果卡片（分组信息） | Claude API prompt 编写 |
| | 写入 outings 表 + 更新 request 状态 |

**联调：** 点击"匹配" → Claude 返回分组 → 页面展示哪些老人被分到一组

---

### Sprint 6 (20-24h) — Volunteer Dashboard

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Volunteer Dashboard 页面 | `GET /api/outings?volunteer_id=xxx` |
| Accept / Decline 按钮 | `PATCH /api/outings/[id]` |

**联调：** 志愿者看到分配给自己的 outing → 点确认 → 状态变成 confirmed

---

### Sprint 7 (24-28h) — 地图可视化

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| MapView 组件 (Google Maps) | 匹配逻辑优化（边界情况） |
| 地图上标注老人 + 志愿者位置 | route_info 字段填充路线数据 |
| 画出接送路线 | |

**联调：** 匹配完成后在地图上看到所有人的位置和接送路线

---

### Sprint 8 (28-32h) — 完整流程打通

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Outing 详情页（地图+乘客+时间） | Seed 脚本：批量插入 demo 数据 |
| 全流程走通检查 | 全流程走通检查 |

**联调：** 用 seed 数据跑完整流程：注册 → 请求 → 匹配 → 地图 → 确认

---

### Sprint 9 (32-36h) — 美化 + 修 bug

| Person A (前端) | Person B (后端) |
|----------------|----------------|
| UI 美化 + responsive | API 错误处理完善 |
| 加载状态、空状态提示 | 边界情况修复 |
| Landing page 最终版 | |

---

### Sprint 10 (36-40h) — 部署 + Demo

| 两个人一起 |
|-----------|
| 部署到 Vercel |
| 环境变量配置 |
| 准备 demo 数据 |
| 练习演示流程 |
