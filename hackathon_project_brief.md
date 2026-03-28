# Hackathon Project Brief
**Event:** Global Good Hackathon (Social Impact Focus)
**Duration:** 40 hours
**Team Size:** 2 people

---

## Problem

**1 in 3 older Americans feel lonely.** The #1 trigger: losing their driver's license.

- 6 million seniors are stranded at home because they can't drive
- 3/4 of older Americans live in areas with little or no public transit
- Existing solutions (Uber, GoGoGrandparent) are expensive and designed for individuals, not social connection
- The "Village Movement" — a grassroots network of 300+ nonprofit senior communities across the US — already does volunteer-based transportation and social outings, but operates entirely manually. 83% of these programs report volunteer shortages and are forced to turn down ride requests daily.

**The gap:** No one is doing AI-powered group social outings for seniors. All existing volunteer transportation is:
- Manual coordination (phone calls, spreadsheets)
- Medical-focused, not social
- One-on-one, not group-based
- Often expensive or inaccessible to low-income/minority seniors

---

## Solution

**An app that uses AI to match nearby seniors into group social outings, paired with a volunteer driver.**

Instead of one senior + one volunteer = one ride, our system does:
**3-4 seniors with similar destinations + 1 volunteer = 1 group outing**

This solves two problems simultaneously:
1. **Seniors get social connection**, not just transportation
2. **Volunteer capacity is multiplied** — one volunteer serves 3-4 seniors instead of 1

---

## Key Differentiators

- **Free** — existing Village memberships cost $10–$900/year; ours is free
- **Social-first** — focused on outings (grocery, church, park, museum), not medical appointments
- **AI-powered group matching** — no human coordinator needed
- **Scalable** — current village coordinators can only manage ~140 members manually; our system removes that ceiling

---

## How It Works (Core User Flow)

### For Seniors (or their family members):
1. Enter profile: location, availability, interests, preferred destinations
2. Request an outing: destination type + preferred time window
3. Get matched with nearby seniors going to similar places
4. Get assigned a volunteer driver
5. Receive confirmation (eventually: phone call confirmation for non-app users)

### For Volunteers:
1. Sign up with location, availability, vehicle info
2. Receive outing requests that match their schedule
3. Accept/decline
4. Get directions and passenger list

### AI Matching Logic:
- Geographic proximity (same neighborhood/community)
- Destination similarity (all going to grocery store, church, etc.)
- Time window overlap
- Volunteer availability

---

## MVP Scope (40 hours)

**Goal:** A working web app that demonstrates the core matching flow end-to-end.

### Must Have:
- Senior profile creation (location, destination preference, time)
- Volunteer profile creation (location, availability)
- AI matching: group seniors by proximity + destination, assign volunteer
- Map view showing matched group + route
- Confirmation screen for volunteer

### Nice to Have (if time allows):
- Simple dashboard for a "coordinator" to view all outings
- Basic notification system

### Out of Scope (post-hackathon):
- Phone call interface for seniors who can't use apps
- Payment/monetization
- Full authentication system

---

## Tech Stack (Suggested)

- **Frontend:** React (or Next.js)
- **Backend:** Node.js or Python (FastAPI)
- **AI Matching:** Claude API (Anthropic) for grouping logic
- **Maps:** Google Maps API or Mapbox
- **Database:** Supabase or Firebase (fast setup)

---

## Data & Stats for Pitch

| Stat | Source |
|------|--------|
| 1 in 3 seniors (50–80) feel lonely | JAMA 2024 |
| 6 million seniors stranded without a car | America's Volunteer Driver Center |
| Loneliness increases dementia risk by 50% | CDC |
| Loneliness = smoking 15 cigarettes/day | CDC |
| 83% of volunteer transport programs have driver shortages | Rural MN Transit Study |
| Village Movement: 300+ nonprofits, avg 140 members, 1.2 paid staff | AARP 2022 |
| Only 11% of Village members are non-white | AARP 2022 |
| US Surgeon General declared loneliness a national health crisis | 2023 |
| 4.2 million Americans turned 65 in 2025 ("Peak 65") | UF Medical |

---

## Monetization (Post-Hackathon)

- **Government/public health grants** — loneliness is a declared public health crisis, federal and state funding available
- **Healthcare partnerships** — reduced isolation = fewer hospitalizations; hospitals and insurers have financial incentive to fund this
- **SaaS to Village organizations** — charge village nonprofits a subscription to use the platform (similar to Helpful Village's model)

---

## Competitive Landscape

| Solution | Problem |
|----------|---------|
| GoGoGrandparent | Expensive, individual rides, not social |
| Uber/Lyft | Too hard for seniors to use, not social |
| Helpful Village (software) | No AI, no matching, just digital spreadsheet |
| Village Movement (nonprofits) | Manual coordination, volunteer shortage, membership fees, no group matching |
| Medical transport apps | Medical only, not social |

**Our position:** Free + Social + AI-powered group matching — nothing else does all three.

---

## Future Vision

- Phone call interface for seniors with no smartphone
- Expand beyond Village networks to any community
- Partner with Area Agencies on Aging (government-funded senior services)
- Multilingual support for minority communities
