# Architecture & Implementation Plan

## Tech Stack (Final)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Expo (React Native) + Expo Router** | 原生移动 App，Expo Go 直接跑 |
| Styling | **React Native StyleSheet** | 原生组件，不需要 CSS 框架 |
| Backend | **Express.js (独立 server/)** | API 服务器，处理 AI 匹配等需要密钥的逻辑 |
| Database | **Supabase (PostgreSQL)** | 免费、自带 Auth、实时订阅、REST API |
| AI Matching | **Claude API** | 用 structured output 做分组匹配 |
| Maps | **react-native-maps + Google Maps API** | 原生地图组件 + 地理编码 |
| Deployment | **Expo Go (开发) / EAS Build (发布)** | 扫码即可在手机上运行 |
| Server Deployment | **Railway / Render** | Express 服务器一键部署 |

---

## 架构概览

```
┌─────────────────────┐         ┌─────────────────────┐
│   Expo App (客户端)  │  HTTP   │   Express Server    │
│   React Native      │ ◄─────► │   (server/)         │
│   Expo Router       │         │                     │
└─────────┬───────────┘         └──────────┬──────────┘
          │                                │
          │ Supabase Client                │ Supabase Service Role
          │ (读取数据)                      │ (写入 + AI 匹配)
          ▼                                ▼
     ┌─────────────────────────────────────────┐
     │           Supabase (PostgreSQL)          │
     └─────────────────────────────────────────┘
```

- **Expo App** 直接用 Supabase client 读取数据（seniors, outings 列表等）
- **Express Server** 处理需要密钥的操作（Claude API 匹配、地理编码）
- 两者共享同一个 Supabase 数据库

---

## Database Schema

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│    seniors       │     │    outing_requests   │     │    volunteers    │
├─────────────────┤     ├─────────────────────┤     ├──────────────────┤
│ id (uuid, PK)   │     │ id (uuid, PK)        │     │ id (uuid, PK)   │
│ name             │     │ senior_id (FK)       │     │ name             │
│ phone            │     │ destination_type     │     │ phone            │
│ address          │     │ destination_name     │     │ address          │
│ lat/lng          │     │ preferred_date       │     │ lat/lng          │
│ interests[]      │     │ preferred_time_start │     │ vehicle_type     │
│ mobility_notes   │     │ preferred_time_end   │     │ max_passengers   │
│ emergency_contact│     │ status (pending/     │     │ availability[]   │
│ created_at       │     │   matched/completed) │     │ created_at       │
└─────────────────┘     │ created_at           │     └──────────────────┘
                        └─────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────────┐
                        │    outings (matched) │
                        ├─────────────────────┤
                        │ id (uuid, PK)        │
                        │ volunteer_id (FK)    │
                        │ request_ids[] (FK)   │
                        │ scheduled_date       │
                        │ scheduled_time       │
                        │ route_info (json)    │
                        │ status (pending/     │
                        │   confirmed/done)    │
                        │ created_at           │
                        └─────────────────────┘
```

**destination_type 枚举:** grocery, church, park, museum, library, social_club, restaurant, other

---

## Project Structure

```
/
├── app/                         # Expo Router (file-based routing)
│   ├── _layout.tsx              # Root layout (Tab navigation)
│   ├── index.tsx                # Home / Landing screen
│   ├── senior/
│   │   ├── _layout.tsx          # Senior stack navigator
│   │   ├── register.tsx         # Senior registration form
│   │   ├── request.tsx          # Request an outing
│   │   └── status.tsx           # View my matched outings
│   ├── volunteer/
│   │   ├── _layout.tsx          # Volunteer stack navigator
│   │   ├── register.tsx         # Volunteer registration
│   │   └── dashboard.tsx        # View & accept outing requests
│   └── match/
│       └── index.tsx            # Map view of matched group + route
├── components/
│   ├── MapView.tsx              # react-native-maps component
│   ├── OutingCard.tsx           # Outing info card
│   └── ...
├── lib/
│   ├── types.ts                 # Shared TypeScript types
│   ├── supabase.ts              # Supabase client (client-side)
│   ├── api.ts                   # Helper to call Express server
│   └── mock-data.ts             # Mock data for frontend dev
├── server/                      # Express backend (独立运行)
│   ├── package.json             # Server dependencies
│   ├── index.ts                 # Express entry point
│   ├── routes/
│   │   ├── seniors.ts           # CRUD seniors
│   │   ├── volunteers.ts        # CRUD volunteers
│   │   ├── requests.ts          # Create/list outing requests
│   │   ├── match.ts             # Trigger AI matching
│   │   └── outings.ts           # Matched outings CRUD
│   └── lib/
│       ├── supabase.ts          # Supabase client (server-side, SERVICE_ROLE)
│       ├── claude.ts            # Claude API matching logic
│       ├── geocode.ts           # Address → lat/lng
│       └── matching-prompt.ts   # Claude prompt template
├── scripts/
│   └── seed.ts                  # Seed demo data
├── assets/                      # App icons, images
├── docs/                        # Documentation
├── app.json                     # Expo config
├── package.json                 # Expo dependencies
└── tsconfig.json
```

---

## AI Matching Logic (Core)

Claude API 的输入：
```json
{
  "pending_requests": [
    { "senior_id": "...", "name": "Alice", "lat": 36.14, "lng": -86.80, "destination_type": "grocery", "preferred_date": "2026-03-30", "time_window": "9:00-12:00" },
    { "senior_id": "...", "name": "Bob", "lat": 36.15, "lng": -86.81, "destination_type": "grocery", "preferred_date": "2026-03-30", "time_window": "10:00-13:00" }
  ],
  "available_volunteers": [
    { "volunteer_id": "...", "name": "Carol", "lat": 36.13, "lng": -86.79, "max_passengers": 4, "availability": ["2026-03-30 morning"] }
  ]
}
```

Claude 输出 (structured/tool_use):
```json
{
  "groups": [
    {
      "senior_ids": ["...", "..."],
      "volunteer_id": "...",
      "suggested_time": "10:00",
      "destination_type": "grocery",
      "reasoning": "Both seniors are within 1 mile, both want grocery shopping on the same morning"
    }
  ],
  "unmatched_seniors": ["..."],
  "unmatched_reason": "No volunteer available in that area on requested date"
}
```

---

## Implementation Phases (40 hours)

### Phase 1: Foundation (Hours 0-8)
- [ ] Expo project setup + install dependencies
- [ ] Create Supabase tables (seniors, volunteers, outing_requests, outings)
- [ ] `.env.local` with all API keys
- [ ] Tab navigation + Home screen
- [ ] Supabase client + Express server skeleton

### Phase 2: Registration (Hours 8-16)
- [ ] Senior registration form (name, address, interests, mobility)
- [ ] Volunteer registration form (name, address, vehicle, availability)
- [ ] Address → geocode (Google Maps Geocoding API)
- [ ] Save to Supabase via Express API
- [ ] Outing request form (destination type, date, time window)

### Phase 3: AI Matching (Hours 16-26) ⭐ Core Feature
- [ ] `POST /api/match` — fetch pending requests + available volunteers
- [ ] Build Claude prompt with structured output
- [ ] Parse Claude response → create `outings` records
- [ ] Update request statuses to "matched"
- [ ] Volunteer dashboard: see assigned outings, accept/decline

### Phase 4: Map & Visualization (Hours 26-34)
- [ ] react-native-maps: show all seniors in a group + volunteer on map
- [ ] Draw optimized pickup route
- [ ] Outing detail screen (who's going, pickup order, ETA)
- [ ] Senior status screen (view my upcoming outings)

### Phase 5: Polish & Demo (Hours 34-40)
- [ ] Home screen with stats & value proposition
- [ ] Seed demo data (5-10 seniors, 2-3 volunteers)
- [ ] Run matching → show results on map
- [ ] Deploy server to Railway/Render
- [ ] Prepare demo script

---

## API Endpoints Summary (Express Server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/seniors` | Register a senior |
| GET | `/api/seniors` | List all seniors |
| POST | `/api/volunteers` | Register a volunteer |
| GET | `/api/volunteers` | List all volunteers |
| POST | `/api/requests` | Senior submits outing request |
| GET | `/api/requests` | List pending requests |
| POST | `/api/match` | Run AI matching algorithm |
| GET | `/api/outings` | List matched outings |
| PATCH | `/api/outings/:id` | Volunteer confirms/declines |

---

## Environment Variables

```env
# === Expo App (.env.local) ===
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SERVER_URL=http://localhost:3001

# === Server (server/.env) ===
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_MAPS_API_KEY=
PORT=3001
```

---

## How to Run

```bash
# 1. Install Expo app dependencies
npm install

# 2. Install server dependencies
cd server && npm install && cd ..

# 3. Start Expo dev server (Person A 用)
npm start
# → 扫 QR code 用 Expo Go 打开

# 4. Start Express server (Person B 用)
cd server && npm run dev
```

---

## Demo Script (for judges)

1. **Show the problem** — stats on senior loneliness, Village Movement limitations
2. **Register 2 seniors** — different addresses, both want "grocery" on same day
3. **Register 1 volunteer** — nearby, available that day
4. **Run matching** — Claude groups the 2 seniors + assigns volunteer
5. **Show map** — pickup route visualization on phone
6. **Volunteer confirms** — one tap to accept the outing
7. **Impact pitch** — "1 volunteer, 1 trip, 2 seniors no longer alone"
