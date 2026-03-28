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

## Person A — Expo 前端 + 地图

**负责：** 所有屏幕页面、表单、UI 组件、地图可视化

### 文件范围
- `app/` 下所有页面
- `components/` 下所有组件
- `lib/mock-data.ts`（开发用假数据）

### 任务清单

#### Phase 1 (0-8h)
- [ ] `npm install` 安装 Expo 依赖
- [ ] 基础 Tab 导航：`app/_layout.tsx`
- [ ] Home screen：`app/index.tsx`（项目介绍 + 统计数据 + 入口按钮）

#### Phase 2 (8-16h)
- [ ] Senior 注册页：`app/senior/register.tsx`
- [ ] Volunteer 注册页：`app/volunteer/register.tsx`
- [ ] 出行请求页：`app/senior/request.tsx`

#### Phase 3 (16-26h)
- [ ] Volunteer Dashboard：`app/volunteer/dashboard.tsx`
  - 展示分配给自己的 outings
  - Accept / Decline 按钮
- [ ] Senior 状态页：`app/senior/status.tsx`
  - 展示我的请求状态（pending / matched）

#### Phase 4 (26-34h)
- [ ] 地图组件：`components/MapView.tsx`
  - react-native-maps 显示所有匹配的老人 + 志愿者位置
  - 画出接送路线
- [ ] Outing 详情页：`app/match/index.tsx`
  - 地图 + 乘客列表 + 时间 + 目的地

#### Phase 5 (34-40h)
- [ ] Home screen 美化
- [ ] 加载状态、空状态、错误提示

### 开发阶段无后端时怎么办？

在后端没 ready 之前，用 mock 数据开发：

```typescript
import { mockSeniors, mockOutings } from "@/lib/mock-data";
```

等后端 ready 后替换成：

```typescript
import { api } from "@/lib/api";
const { data } = await api<ApiResponse<Senior[]>>("/api/seniors");
```

---

## Person B — Express 后端 + 数据库 + AI 匹配

**负责：** Express server、Supabase 建表、所有 API 接口、Claude 匹配逻辑

### 文件范围
- `server/` 下所有文件
- `lib/types.ts`（共享类型）
- `lib/supabase.ts`（客户端 Supabase）
- `scripts/seed.ts`

### 任务清单

#### Phase 1 (0-8h)
- [ ] Supabase 创建 project + 建表（见下方 SQL）
- [ ] `server/lib/supabase.ts` — Server-side Supabase client
- [ ] `lib/types.ts` — 共享 TypeScript 类型（已完成）
- [ ] `.env.local` 配置
- [ ] `server/index.ts` — Express 启动

#### Phase 2 (8-16h)
- [ ] `server/routes/seniors.ts` — POST 注册 + GET 列表
- [ ] `server/routes/volunteers.ts` — POST 注册 + GET 列表
- [ ] `server/routes/requests.ts` — POST 创建请求 + GET 列表
- [ ] `server/lib/geocode.ts` — 地址转经纬度

#### Phase 3 (16-26h) ⭐ 核心
- [ ] `server/routes/match.ts` — AI 匹配接口
  - 获取所有 pending requests
  - 获取所有 available volunteers
  - 调 Claude API 做分组
  - 将匹配结果写入 outings 表
  - 更新 request status → matched
- [ ] `server/routes/outings.ts` — GET 列表 + PATCH 确认/拒绝
- [ ] `server/lib/claude.ts` — Claude API 调用
- [ ] `server/lib/matching-prompt.ts` — Prompt 模板

#### Phase 4 (26-34h)
- [ ] 匹配逻辑优化（处理边界情况）
- [ ] `scripts/seed.ts` 批量插入 demo 数据

#### Phase 5 (34-40h)
- [ ] API 错误处理完善
- [ ] 部署 server 到 Railway/Render
- [ ] 确认环境变量配置正确

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

### 共享类型文件 `lib/types.ts`（已完成）

### API 调用方式

前端通过 `lib/api.ts` 调用后端：

```typescript
import { api } from "@/lib/api";
import { ApiResponse, Senior } from "@/lib/types";

// 注册老人
const result = await api<ApiResponse<Senior>>("/api/seniors", {
  method: "POST",
  body: JSON.stringify({ name: "Alice", address: "..." }),
});

// 获取列表
const list = await api<ApiResponse<Senior[]>>("/api/seniors");
```

---

## API 接口详细约定

### `POST /api/seniors`
```
Request:  CreateSeniorRequest (JSON body)
Response: ApiResponse<Senior>
```

### `GET /api/seniors`
```
Response: ApiResponse<Senior[]>
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
```

### `GET /api/requests?status=pending`
```
Response: ApiResponse<OutingRequest[]>
Query params: status (optional), senior_id (optional)
```

### `POST /api/match`
```
Request:  {} (no body needed)
Response: ApiResponse<MatchResult>
```

### `GET /api/outings?volunteer_id=xxx`
```
Response: ApiResponse<(Outing & { seniors: Senior[], volunteer: Volunteer })[]>
```

### `PATCH /api/outings/:id`
```
Request:  { "status": "confirmed" | "cancelled" }
Response: ApiResponse<Outing>
```

---

## Git 协作方式

直接在 main 上开发，每次写完一个功能就 commit + push，另一个人 pull。

```bash
git add .
git commit -m "feat: senior registration API"
git push origin main
```

**文件不会冲突，因为：**
- Person A 只动 `app/` 和 `components/`
- Person B 只动 `server/` 和 `scripts/`
- 唯一共享的是 `lib/types.ts`，Phase 1 定好后基本不变

---

## 时间线 + 联调计划

### Sprint 1 (0-4h) — 项目骨架
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| `npm install` + Expo 跑起来 | Supabase 建表 |
| Tab 导航 + Home screen | Express server 启动 |
| Senior 注册表单 UI | `POST /api/seniors` 接口 |

**联调：** 前端表单提交 → 调 Express API → Supabase 能查到

### Sprint 2 (4-8h) — Volunteer 注册
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Volunteer 注册表单 | `POST /api/volunteers` |
| Home screen 内容 | GET 接口 |

### Sprint 3 (8-12h) — 出行请求
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| 出行请求表单 | `POST /api/requests` + geocode |

### Sprint 4 (12-16h) — 状态查看
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Senior 状态页 | 完善 GET filters |

### Sprint 5 (16-20h) — AI 匹配 ⭐
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| 匹配触发 + 结果展示 | ⭐ `POST /api/match` AI 核心 |

### Sprint 6 (20-24h) — Volunteer Dashboard
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| Dashboard 页面 | `GET/PATCH /api/outings` |

### Sprint 7 (24-28h) — 地图
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| react-native-maps | 匹配优化 |

### Sprint 8 (28-32h) — 全流程
| Person A (前端) | Person B (后端) |
|----------------|----------------|
| 详情页 | Seed 脚本 |

### Sprint 9 (32-36h) — 美化 + 修 bug
### Sprint 10 (36-40h) — 部署 + Demo
