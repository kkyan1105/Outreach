# Architecture & Implementation Plan

## Tech Stack (Final)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js 14 (App Router)** | React + SSR + API Routes all in one，不用分开部署 |
| Styling | **Tailwind CSS** | 快速出 UI，hackathon 首选 |
| Database | **Supabase (PostgreSQL)** | 免费、自带 Auth、实时订阅、REST API |
| AI Matching | **Claude API** | 用 structured output 做分组匹配 |
| Maps | **Google Maps API** | 地理编码 + 路线规划 + 地图展示 |
| Deployment | **Vercel** | Next.js 原生支持，一键部署 |

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
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout (nav, footer)
│   │   ├── page.tsx             # Landing page
│   │   ├── senior/
│   │   │   ├── register/page.tsx    # Senior registration form
│   │   │   ├── request/page.tsx     # Request an outing
│   │   │   └── status/page.tsx      # View my matched outings
│   │   ├── volunteer/
│   │   │   ├── register/page.tsx    # Volunteer registration
│   │   │   └── dashboard/page.tsx   # View & accept outing requests
│   │   ├── match/
│   │   │   └── page.tsx             # Map view of matched group + route
│   │   └── api/
│   │       ├── seniors/route.ts         # CRUD seniors
│   │       ├── volunteers/route.ts      # CRUD volunteers
│   │       ├── requests/route.ts        # Create/list outing requests
│   │       ├── match/route.ts           # Trigger AI matching
│   │       └── outings/route.ts         # Matched outings CRUD
│   ├── components/
│   │   ├── MapView.tsx          # Google Maps component
│   │   ├── SeniorForm.tsx       # Registration form
│   │   ├── VolunteerForm.tsx    # Registration form
│   │   ├── OutingCard.tsx       # Outing info card
│   │   └── Navbar.tsx
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   ├── claude.ts            # Claude API matching logic
│   │   ├── geocode.ts           # Address → lat/lng
│   │   └── types.ts             # TypeScript types
│   └── prompts/
│       └── matching.ts          # Claude matching prompt template
├── public/
├── .env.local                   # API keys (not committed)
├── package.json
├── tailwind.config.ts
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
- [ ] `npx create-next-app` + Tailwind + Supabase setup
- [ ] Create Supabase tables (seniors, volunteers, outing_requests, outings)
- [ ] `.env.local` with all API keys
- [ ] Basic layout + Navbar + Landing page
- [ ] Supabase client helper (`lib/supabase.ts`)

### Phase 2: Registration (Hours 8-16)
- [ ] Senior registration form (name, address, interests, mobility)
- [ ] Volunteer registration form (name, address, vehicle, availability)
- [ ] Address → geocode (Google Maps Geocoding API)
- [ ] Save to Supabase
- [ ] Outing request form (destination type, date, time window)

### Phase 3: AI Matching (Hours 16-26) ⭐ Core Feature
- [ ] `POST /api/match` — fetch pending requests + available volunteers
- [ ] Build Claude prompt with structured output
- [ ] Parse Claude response → create `outings` records
- [ ] Update request statuses to "matched"
- [ ] Volunteer dashboard: see assigned outings, accept/decline

### Phase 4: Map & Visualization (Hours 26-34)
- [ ] Map view: show all seniors in a group + volunteer on map
- [ ] Draw optimized pickup route
- [ ] Outing detail page (who's going, pickup order, ETA)
- [ ] Senior status page (view my upcoming outings)

### Phase 5: Polish & Demo (Hours 34-40)
- [ ] Landing page with stats & value proposition
- [ ] Seed demo data (5-10 seniors, 2-3 volunteers)
- [ ] Run matching → show results on map
- [ ] Mobile responsive
- [ ] Deploy to Vercel
- [ ] Prepare demo script

---

## API Endpoints Summary

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

## Environment Variables Needed

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

---

## Demo Script (for judges)

1. **Show the problem** — stats on senior loneliness, Village Movement limitations
2. **Register 2 seniors** — different addresses, both want "grocery" on same day
3. **Register 1 volunteer** — nearby, available that day
4. **Run matching** — Claude groups the 2 seniors + assigns volunteer
5. **Show map** — pickup route visualization
6. **Volunteer confirms** — one tap to accept the outing
7. **Impact pitch** — "1 volunteer, 1 trip, 2 seniors no longer alone"
