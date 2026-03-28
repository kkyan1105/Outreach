# Collaboration Guide — 双人分工文档

---

## ✅ 已完成

### 后端（Person B）
- Supabase 建表：seniors, volunteers, outing_requests, outings
- Seed 数据（5 seniors, 2 volunteers）
- 所有 API 接口：seniors / volunteers / requests / match / outings / stats

### 前端（Person A）
- `lib/theme.ts` — 全局设计 token
- `app/index.tsx` — Landing / Home page
- `app/senior/register.tsx` — Senior 注册表单
- `app/volunteer/register.tsx` — Volunteer 注册表单
- `app/senior/request.tsx` — 出行请求表单
- `app/volunteer/dashboard.tsx` — Volunteer Dashboard
- `app/senior/status.tsx` — Senior 状态页

---

## 🔄 当前阶段：Auth + 双端分离

### 背景与目标

现在 app 是 Tab 杂糅模式，Senior 和 Volunteer 功能混在一起。需要：
1. 加登录/注册功能，区分身份
2. 登录后完全分开两端的导航结构
3. Home page 只在未登录时展示

### 新的路由结构

```
app/
├── index.tsx              ← Landing（未登录时显示）
├── auth/
│   ├── login.tsx          ← 选择身份 + 输入账号密码
│   └── register.tsx       ← 注册（senior 或 volunteer）
├── (senior)/              ← 登录为 senior 后的 Tab 导航
│   ├── _layout.tsx        ← Senior Tab bar（Home / Request / My Outings）
│   ├── home.tsx           ← Senior 首页
│   ← request.tsx          ← 出行请求（原 senior/request.tsx）
│   └── status.tsx         ← 我的状态（原 senior/status.tsx）
├── (volunteer)/           ← 登录为 volunteer 后的 Tab 导航
│   ├── _layout.tsx        ← Volunteer Tab bar（Dashboard / Profile）
│   └── dashboard.tsx      ← Volunteer Dashboard（原 volunteer/dashboard.tsx）
└── _layout.tsx            ← Root layout：根据登录状态决定显示哪套导航
```

### 数据库变更（Person B 负责）

在 seniors 和 volunteers 表各加两列：
```sql
ALTER TABLE seniors ADD COLUMN email TEXT UNIQUE;
ALTER TABLE seniors ADD COLUMN password_hash TEXT;

ALTER TABLE volunteers ADD COLUMN email TEXT UNIQUE;
ALTER TABLE volunteers ADD COLUMN password_hash TEXT;
```

> 注：Hackathon 阶段用简单 bcrypt hash，不用 Supabase Auth。

---

## 分工

### Person A — 前端路由重构 + Auth 页面

**文件职责：**
- `app/_layout.tsx` — Root layout，读 auth state 决定跳转
- `app/index.tsx` — 不变，保留 Landing page
- `app/auth/login.tsx` — 登录页
- `app/auth/register.tsx` — 注册页（含身份选择）
- `app/(senior)/_layout.tsx` — Senior Tab 导航
- `app/(senior)/home.tsx` — Senior 首页（简单欢迎页 + 快捷入口）
- `app/(volunteer)/_layout.tsx` — Volunteer Tab 导航
- `lib/auth.ts` — 存储登录状态（AsyncStorage）

**不碰的文件：** `app/auth/` 里的 API 调用逻辑由 B 提供接口

#### 具体任务

**Task A1 — auth state 管理**
创建 `lib/auth.ts`：
```typescript
// 存储 / 读取 / 清除登录态
// 用 AsyncStorage 保存 { id, role: 'senior'|'volunteer', name }
export async function saveAuth(user: AuthUser): Promise<void>
export async function getAuth(): Promise<AuthUser | null>
export async function clearAuth(): Promise<void>
```

**Task A2 — Root layout 路由守卫**
`app/_layout.tsx` 改为 Stack 导航：
- 启动时读 AsyncStorage
- 未登录 → 停在 `index`（Landing）
- 已登录为 senior → 跳转 `(senior)/home`
- 已登录为 volunteer → 跳转 `(volunteer)/dashboard`

**Task A3 — Landing page 改造**
`app/index.tsx` 两个按钮改为跳转 `auth/login?role=senior` 和 `auth/login?role=volunteer`，在按钮下方加 "Register" 链接跳 `auth/register?role=senior/volunteer`

**Task A4 — 登录页** `app/auth/login.tsx`
- 显示角色（从 URL 参数读 role）
- 输入 email + password
- 调 `POST /api/auth/login`（B 提供）
- 成功 → 保存 auth state → 跳转对应端

**Task A5 — 注册页** `app/auth/register.tsx`
- 显示角色（URL 参数）
- Senior：name / phone / address / interests / mobility_notes / email / password
- Volunteer：name / phone / address / vehicle / availability / email / password
- 调 `POST /api/auth/register`（B 提供）
- 成功 → 自动登录 → 跳转

**Task A6 — Senior Tab 导航**
`app/(senior)/_layout.tsx`：3 个 tab — Home / Request Outing / My Outings
把原来的 `senior/request.tsx` 和 `senior/status.tsx` 移过来

**Task A7 — Volunteer Tab 导航**
`app/(volunteer)/_layout.tsx`：2 个 tab — Dashboard / Profile（简单页面）
把原来的 `volunteer/dashboard.tsx` 移过来

---

### Person B — 后端 Auth 接口 + 数据库变更

**文件职责：**
- Supabase SQL 变更
- `server/routes/auth.ts` — 登录 / 注册接口
- `server/lib/auth.ts` — bcrypt hash 工具
- `server/index.ts` — 挂载 auth 路由

**不碰的文件：** 所有已完成的其他路由文件

#### 具体任务

**Task B1 — 数据库变更**
在 Supabase SQL Editor 执行：
```sql
ALTER TABLE seniors
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

**Task B2 — bcrypt 工具**
`server/lib/auth.ts`：
```typescript
export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, hash: string): Promise<boolean>
```
安装：`npm install bcryptjs && npm install -D @types/bcryptjs`

**Task B3 — 注册接口** `POST /api/auth/register`
```
Request: {
  role: "senior" | "volunteer"
  email: string
  password: string
  name: string
  phone?: string
  address: string
  // senior only:
  interests?: string[]
  mobility_notes?: string
  // volunteer only:
  vehicle_type?: string
  max_passengers?: number
  availability?: string[]
}

Response: {
  data: { id: string, role: string, name: string, email: string } | null
  error: string | null
}
```
逻辑：geocode address → hash password → insert into seniors/volunteers → return user

**Task B4 — 登录接口** `POST /api/auth/login`
```
Request: { role: "senior" | "volunteer", email: string, password: string }

Response: {
  data: { id: string, role: string, name: string, email: string } | null
  error: string | null
}
```
逻辑：query by email in role table → verify bcrypt → return user (no password_hash)

**Task B5 — 挂载路由**
`server/index.ts` 加：
```typescript
import authRouter from "./routes/auth";
app.use("/api/auth", authRouter);
```

---

## 联调顺序

1. B 先完成 B1（数据库变更）+ B3/B4（接口）
2. A 用 curl 测试接口通了再接前端
3. 测试：注册 Senior → 自动跳转 Senior Tab → 只看到 Senior 功能
4. 测试：注册 Volunteer → 自动跳转 Volunteer Dashboard

**B 接口 ready 后，A 可以用这个测试：**
```bash
# 注册
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"senior","email":"test@test.com","password":"123456","name":"Test","address":"1000 Broadway, Nashville, TN"}'

# 登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"senior","email":"test@test.com","password":"123456"}'
```

---

## API 接口速查（完整）

| Method | Path | 用途 |
|--------|------|------|
| POST | `/api/auth/register` | 注册（senior 或 volunteer） |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/seniors` | 老接口（暂时保留） |
| GET | `/api/seniors` | 列出所有 seniors |
| POST | `/api/volunteers` | 老接口（暂时保留） |
| GET | `/api/volunteers` | 列出所有 volunteers |
| POST | `/api/requests` | 创建出行请求 |
| GET | `/api/requests?senior_id=xxx` | 查某 senior 的请求 |
| POST | `/api/match` | 触发 AI 匹配 |
| GET | `/api/outings?volunteer_id=xxx` | 查某志愿者的 outings |
| PATCH | `/api/outings/:id` | 确认/取消 outing |
| GET | `/api/stats` | Dashboard 统计 |

---

## 启动方式

```bash
# 终端 1 — 后端
cd server && npm run dev

# 终端 2 — 前端
npm start -- --clear
```

`.env.local` 中 `EXPO_PUBLIC_SERVER_URL` 填 Mac 的局域网 IP + 端口：
`EXPO_PUBLIC_SERVER_URL=http://10.71.205.172:3001`
