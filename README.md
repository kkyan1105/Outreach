# Senior Outing

> AI-powered app that groups nearby seniors into social outings with volunteer drivers — fighting senior loneliness at scale.

🏆 **Grand Prize Winner** — Vanderbilt University Global Good Hackathon (NSBE & WIC, March 2026)

![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)

---

## The Problem

**1 in 3 older Americans feel lonely.** The #1 trigger: losing their driver's license.

- **6 million seniors** are stranded at home because they can't drive
- **3/4** of older Americans live in areas with little or no public transit
- Existing solutions (Uber, GoGoGrandparent) are expensive and designed for individuals, not social connection
- The **Village Movement** — 300+ nonprofit senior communities across the US — already runs volunteer transportation, but operates entirely manually. **83% report volunteer shortages** and turn down ride requests daily

> *The U.S. Surgeon General declared loneliness a national health crisis in 2023. Loneliness is equivalent to smoking 15 cigarettes a day.*

---

## Our Solution

Instead of **1 senior + 1 volunteer = 1 ride**, we do:

```
3–4 seniors with similar destinations + 1 volunteer = 1 group outing
```

This solves two problems simultaneously:

1. **Seniors get social connection**, not just transportation
2. **Volunteer capacity is multiplied** — one volunteer serves 3–4 seniors instead of 1

---

## How It Works

### For Seniors

```
1. Create profile    →    location, interests, mobility notes
2. Request outing    →    pick destination type + time window
3. Get matched       →    AI groups you with nearby seniors
4. Get a driver      →    volunteer automatically assigned
5. Show up & ride    →    together
```

Seniors can also use **Talk & Ride**, a voice-guided booking flow for those who prefer speaking over tapping.

### For Volunteers

```
1. Sign up     →    location, vehicle info, weekly availability
2. Browse      →    see outing requests that fit your schedule
3. Accept      →    one tap to confirm
4. Drive       →    get an optimized route with pickup times for each senior
```

### AI Matching Logic

The backend uses an LLM to cluster seniors into groups based on:

- **Geographic proximity** — same neighborhood or community
- **Destination similarity** — grocery, church, park, pharmacy
- **Time window overlap** — compatible schedules
- **Volunteer availability** — matched to a driver who can make it work

No human coordinator needed.

---

## Key Features

| Feature | Description |
|---|---|
| Outing request | Simple destination + time picker, accessibility-first UI |
| Voice booking | Talk & Ride — voice-guided flow for seniors who prefer speaking |
| AI group matching | LLM clusters seniors automatically, no coordinator required |
| Volunteer dashboard | Accept/decline outings, see full passenger list and schedule |
| Route planning | Optimized multi-stop pickup order with per-stop ETAs |
| Interactive map | Live map with group locations and volunteer route overlay |
| Explore rides | Volunteers browse nearby requests by destination, date, distance |

---

## Why This Is Different

| Solution | Problem |
|---|---|
| GoGoGrandparent | Expensive, individual rides, not social |
| Uber / Lyft | Hard for many seniors to use, not social |
| Helpful Village | No AI, no matching — just a digital spreadsheet |
| Village Movement nonprofits | Manual coordination, volunteer shortage, membership fees |
| Medical transport apps | Medical only, not social |

**Our position: Free + Social + AI-powered group matching — nothing else does all three.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo (React Native) + Expo Router |
| Backend API | Express.js (Node.js / TypeScript) |
| Database | Supabase (PostgreSQL + real-time subscriptions) |
| AI Matching | OpenAI GPT-4o with structured output |
| Maps & Routing | Google Maps API + react-native-maps |
| Voice Input | OpenAI Whisper |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI — `npm install -g expo`
- A Supabase project
- Google Maps API key
- OpenAI API key

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/senior-outing.git
cd senior-outing

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Fill in your keys in .env.local

# 4. Start the backend
npm run server

# 5. Start the Expo app
npm start
# Scan the QR code with Expo Go on your phone
```

### Environment Variables

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

## Project Structure

```
senior-outing/
├── app/                  # Expo Router screens
│   ├── (senior)/         # Senior-facing screens
│   ├── (volunteer)/      # Volunteer-facing screens
│   └── auth/             # Login & registration
├── server/               # Express.js backend
│   └── routes/           # API route handlers (seniors, volunteers, outings, matching, route)
├── lib/                  # Shared utilities & Supabase client
└── docs/                 # Architecture & planning docs
```

---

## Impact Potential

| Stat | Source |
|---|---|
| 1 in 3 seniors (50–80) feel lonely | JAMA 2024 |
| 6 million seniors stranded without a car | America's Volunteer Driver Center |
| Loneliness increases dementia risk by 50% | CDC |
| 4.2 million Americans turned 65 in 2025 ("Peak 65") | UF Medical |
| U.S. Surgeon General declared loneliness a national health crisis | 2023 |

---

## Built At

**Vanderbilt University Global Good Hackathon** — presented by NSBE & WIC
March 28–29, 2026 · Social Impact Track · Built in 40 hours by a team of 2

🏆 **Grand Prize Winner** 

---

## Future Roadmap

- Phone call interface for seniors without a smartphone
- Expand beyond Village networks to any community
- Partner with Area Agencies on Aging (government-funded senior services)
- Multilingual support for underserved minority communities
- Healthcare system partnerships — reduced isolation means fewer hospitalizations
