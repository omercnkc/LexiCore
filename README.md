# LexiCore

> **Adaptive flashcard engine** powered by a heuristic term-extraction pipeline and a spaced-repetition scheduler — purpose-built for domain-dense academic content.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Repository Layout](#repository-layout)
5. [Data Flow](#data-flow)
6. [Spaced-Repetition Algorithm](#spaced-repetition-algorithm)
7. [Term Extraction Pipeline](#term-extraction-pipeline)
8. [API Reference](#api-reference)
9. [Local Development](#local-development)
10. [Environment Variables](#environment-variables)
11. [Firebase Setup](#firebase-setup)
12. [TODO / Roadmap](#todo--roadmap)

---

## Overview

LexiCore is a **full-stack flashcard application** designed around two core engineering decisions:

1. **Automated knowledge extraction** — users upload a PDF (lecture notes, textbook chapters, research articles); the backend runs a multi-pass heuristic pipeline to surface the highest-signal academic terms from the document corpus, ranked by frequency × linguistic weight.

2. **Adaptive retention scheduling** — every flashcard carries its own SM-2-inspired ease factor and interval. Each review interaction mutates these scalars via a transactional Firestore write, guaranteeing the scheduler state is never corrupted by concurrent sessions.

The result is a workflow where a student can go from raw PDF source material to a fully scheduled, personalized study deck in under 60 seconds — without manual card authoring.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Client (SPA)                    │
│   React 18 · Vite · react-router-dom · Firebase     │
│                  Auth SDK (client)                  │
└──────────────────────┬──────────────────────────────┘
                       │  HTTPS + Bearer (Firebase ID Token)
                       ▼
┌─────────────────────────────────────────────────────┐
│                FastAPI Application                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐│
│  │  /upload │  │  /decks  │  │ /cards  /analytics ││
│  │  Router  │  │  Router  │  │      Routers        ││
│  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘│
│       │              │                  │           │
│  ┌────▼──────────────▼──────────────────▼─────────┐ │
│  │          Service Layer (Business Logic)         │ │
│  │  UploadService · DeckService · CardService      │ │
│  │  ReviewService · AnalyticsService               │ │
│  └────────────────────┬────────────────────────────┘ │
└───────────────────────┼─────────────────────────────┘
                        │  Firebase Admin SDK
          ┌─────────────┼────────────────────┐
          ▼             ▼                    ▼
   Firebase Auth   Firestore DB       Firebase Storage
   (token verify)  (decks/cards/      (raw PDF blobs)
                    reviews/uploads)
```

**Design Principles:**
- **Stateless API** — every request carries a Firebase ID Token; the dependency layer validates it and injects `user_id` scoped to the authenticated principal. No session state is persisted server-side.
- **Fail-fast startup** — `lifespan` context manager validates Firebase Admin initialization before accepting traffic, surfacing misconfiguration at boot rather than at runtime.
- **Transactional SR writes** — `ReviewService.submit_review` executes both the card state mutation and the review record creation inside a single Firestore transaction, preventing partial updates under concurrent load.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | React 18 (Vite) | Fast HMR, ESM-native, minimal config overhead |
| **Routing** | react-router-dom v6 | Nested route model maps cleanly to protected/public split |
| **Authentication (Client)** | Firebase Auth SDK | OAuth + email/password with zero backend session management |
| **Backend Framework** | FastAPI 0.110+ | Async-first, Pydantic v2 native, auto OpenAPI generation |
| **Runtime** | Python 3.11+ / Uvicorn | ASGI, optimal asyncio performance |
| **Auth Verification** | firebase-admin 6.x | Server-side ID token verification without network round-trips |
| **Primary Database** | Cloud Firestore | Document model suits heterogeneous card payloads; real-time capable |
| **File Storage** | Firebase Storage | Co-located with Firestore, IAM-integrated ACL |
| **PDF Parsing** | pypdf 4.x | Pure-Python, no native binary dependency |
| **Validation** | Pydantic v2 | Field-level constraint enforcement, strip-and-validate pattern |
| **CORS** | FastAPI CORSMiddleware | Configurable per-env origins via settings |

---

## Repository Layout

```
LexiCore/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py            # Central APIRouter aggregator
│   │   │   └── routes/              # Route modules (uploads, decks, cards, reviews, analytics)
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic Settings — env-driven config
│   │   │   └── firebase_admin.py    # Admin SDK singleton (lazy-init)
│   │   ├── dependencies/            # FastAPI Depends() providers (auth token → user_id)
│   │   ├── schemas/                 # Pydantic request/response models
│   │   │   ├── card.py
│   │   │   ├── deck.py
│   │   │   ├── review.py
│   │   │   ├── upload.py
│   │   │   └── analytics.py
│   │   ├── services/                # Business logic layer
│   │   │   ├── upload_service.py    # PDF ingestion + heuristic term extraction
│   │   │   ├── deck_service.py      # Deck CRUD + card-count denormalization
│   │   │   ├── card_service.py      # Card CRUD + SR field initialization
│   │   │   ├── review_service.py    # SM-2 scheduler + transactional review writes
│   │   │   └── analytics_service.py # Dashboard metrics + 7-day progress aggregation
│   │   └── main.py                  # FastAPI app factory + lifespan + CORS
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/                     # Axios wrappers (uploadsApi, decksApi, cardsApi …)
│   │   ├── components/              # Shared UI (AppLayout, ProtectedRoute, PublicOnlyRoute …)
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Firebase Auth observer → React context
│   │   ├── lib/
│   │   │   └── firebase.js          # Firebase app init (client SDK)
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx    # Analytics summary + deck list
│   │   │   ├── UploadPage.jsx       # Multi-phase upload → extract → preview → generate
│   │   │   ├── DeckDetailPage.jsx   # Card list within a deck
│   │   │   ├── CreateDeckPage.jsx   # Manual deck creation form
│   │   │   ├── StudyPage.jsx        # SR study session UI
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── App.jsx                  # Route tree (public / protected split)
│   │   └── index.css                # Global design tokens + component styles
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── firebase/                        # Firebase project config (firestore.rules, indexes …)
├── .gitignore
└── README.md
```

---

## Data Flow

### Upload → Extract → Generate Pipeline

```
User selects PDF
      │
      ▼
POST /api/v1/uploads/upload
  · firebase-admin verifies ID Token
  · PDF streamed → Firebase Storage (uploads/{uid}/{uuid}_{filename})
  · Firestore uploads/{uploadId} created (status: "pending")
  · Returns { id, file_name, status }
      │
      ▼
POST /api/v1/uploads/{uploadId}/extract
  · PDF downloaded from Storage into memory (BytesIO)
  · pypdf extracts raw text across all pages
  · Heuristic pipeline scores & ranks candidate terms
  · Firestore status updated to "completed"
  · Returns { terms: [{ term, context }] }  (max 50 terms)
      │
      ▼
User reviews term checklist → submits deck metadata
      │
      ▼
POST /api/v1/uploads/{uploadId}/generate-cards
  · New Deck document created in Firestore (or existing deck is reused)
  · De-duplication check against existing card terms (normalized lowercase)
  · One CardDocument per accepted term written to Firestore
    (translation initialized as "TBD", SR fields seeded at defaults)
  · Returns { deck_id }
```

### Study Session Flow

```
GET /api/v1/reviews/{deckId}/queue
  · Loads all cards for deck from Firestore
  · Filters by next_review_at <= now (UTC)
  · Sorts ascending by next_review_at (most overdue first)
  · Returns ordered CardResponse list
      │
      ▼
User rates each card: EASY / MEDIUM / HARD / UNKNOWN
      │
      ▼
POST /api/v1/reviews/submit
  · Firestore transaction:
    1. Read current card state (interval, ease_factor, review_count)
    2. Apply SM-2 variant (see algorithm section)
    3. Write updated card state
    4. Write new ReviewRecord document
  · Returns ReviewResponse (new interval, new ease, reviewed_at)
```

---

## Spaced-Repetition Algorithm

LexiCore implements a **simplified SM-2 variant**. Each card carries three mutable scalars:

| Field | Type | Description |
|---|---|---|
| `interval` | `int` (days) | Days until this card is next eligible for review |
| `ease_factor` | `float` | Multiplier controlling interval growth; clamped ≥ 1.3 |
| `review_count` | `int` | Total number of completed reviews |

**Transition rules per rating:**

| Rating | Ease Delta | Interval Resolution |
|---|---|---|
| `EASY` | `+0.15` | `interval = 4` (first) or `⌊prev × new_ease⌋` |
| `MEDIUM` | `0` | `interval = 1` (first) or `⌊prev × 1.5⌋` |
| `HARD` | `−0.15` (clamped ≥ 1.3) | `max(1, ⌊prev / 2⌋)` |
| `UNKNOWN` | `−0.20` (clamped ≥ 1.3) | `0` — card re-enters queue next session |

`next_review_at = UTC_now + timedelta(days=new_interval)`

All mutations occur inside a Firestore transaction — concurrent submissions for the same card are serialized at the database level.

---

## Term Extraction Pipeline

`UploadService._extract_candidate_terms` implements a **multi-stage, lexicon-driven filter + scoring approach**:

**Stage 1 — Tokenization**
- Regex: `\b[A-Za-z][A-Za-z-]{2,29}\b` — captures hyphenated compounds (e.g., `dose-response`)
- Soft-hyphen (`\u00ad`) stripped prior to tokenization to normalize PDF line-break artifacts

**Stage 2 — Filtering** (`_is_likely_term`)
- Length gate: tokens < 4 characters rejected unless in `protected_short_terms`
- Numeric gate: any digit in token → rejected
- Lexicon gates: stopwords, conjunctions, pronouns, common adjectives/verbs/first names
- Frequency gate: tokens appearing < 2 times rejected unless they carry an academic suffix

**Stage 3 — Scoring** (`_score_term`) — additive model:
- `base = frequency × 2`
- Academic suffix match (e.g., `-tion`, `-ology`, `-emia`): `+3.5`
- Length ≥ 8 characters: `+1.0`
- Hyphenated compound: `+0.5`
- Exclusively lowercase in source (not a proper noun): `+1.0`

**Output:** Top 50 terms by descending score, display-formatted to title-case with hyphen preservation.

---

## API Reference

All endpoints are prefixed with `/api/v1`. Authentication is required on all routes except `GET /`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/uploads/upload` | Upload PDF to Firebase Storage |
| `POST` | `/uploads/{id}/extract` | Extract candidate terms from uploaded PDF |
| `POST` | `/uploads/{id}/generate-cards` | Create deck + cards from selected terms |
| `GET` | `/decks` | List all decks for authenticated user |
| `POST` | `/decks` | Create a new deck manually |
| `GET` | `/decks/{deckId}` | Get deck details |
| `DELETE` | `/decks/{deckId}` | Delete deck and all associated cards |
| `GET` | `/decks/{deckId}/cards` | List all cards in a deck |
| `POST` | `/decks/{deckId}/cards` | Create a card manually |
| `PATCH` | `/cards/{cardId}` | Update card fields |
| `DELETE` | `/cards/{cardId}` | Delete a card |
| `GET` | `/reviews/{deckId}/queue` | Get due cards for a study session |
| `POST` | `/reviews/submit` | Submit a review rating for a card |
| `GET` | `/analytics/dashboard` | Dashboard summary metrics |
| `GET` | `/analytics/weekly-progress` | 7-day review history per day |

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Firebase project with Auth, Firestore, and Storage enabled
- Firebase service account JSON (for backend)

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn app.main:app --reload --port 8000
```

API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # fill in Firebase client config
npm run dev
```

SPA will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `APP_NAME` | Application name (appears in OpenAPI title) |
| `API_PREFIX` | Route prefix (e.g., `/api/v1`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Absolute path to service account JSON |
| `FIREBASE_STORAGE_BUCKET` | GCS bucket name (e.g., `your-project.appspot.com`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

---

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Email/Password provider
3. Enable **Firestore Database** → Start in production mode
4. Enable **Storage** → Default bucket
5. Generate a **Service Account** key (Project Settings → Service accounts → Generate new private key) and save as `backend/service-account.json`
6. Deploy Firestore security rules from `firebase/` directory

**Required Firestore Composite Index:**
```
Collection: cards
Fields:     user_id (Ascending), next_review_at (Ascending)
```
This index is required for the optimized due-card count query in `AnalyticsService`. Without it, the service falls back to a full collection scan (functional but unscalable).

---

## TODO / Roadmap

The following items represent known gaps in the current implementation. Each entry documents what is missing, why it matters architecturally, and what it unblocks.

---

### 🔴 Critical — Core Functionality Gaps

#### `[ ]` LLM / Dictionary Translation Pipeline
**What's missing:** Cards generated from PDF extraction are initialized with `translation = "TBD"`. There is no automated mechanism to populate translations.  
**Why it matters:** The central value proposition of a flashcard app is the term-to-definition pairing. Without automated translation, the user must manually edit every single card — negating the productivity gain of the extraction pipeline.  
**Unblocks:** Full end-to-end zero-touch deck creation; enables multi-language support (EN→TR, EN→DE, etc.)  
**Suggested approach:** POST-generation async job that calls a dictionary API (e.g., Merriam-Webster, DeepL, or OpenAI Chat Completions) per term and back-patches `translation` + `example_sentence`.

---

#### `[ ]` Card Edit UI
**What's missing:** `DeckDetailPage` has no inline card editing interface. The PATCH `/cards/{cardId}` endpoint exists at the API layer but the frontend has no form or modal wired to it.  
**Why it matters:** Until the translation pipeline is automated, users have no UI path to correct or populate "TBD" translations. The deck is functionally unusable for study without this.  
**Unblocks:** Usable decks for early adopters; prerequisite for any production beta.

---

#### `[ ]` Card Delete UI
**What's missing:** Similar to above — `DELETE /cards/{cardId}` exists on the API but there is no delete button/confirmation modal in the frontend.  
**Why it matters:** Users cannot prune irrelevant terms extracted from PDFs without this. Poor extraction quality (false positives) permanently pollutes a deck.  
**Unblocks:** Deck quality management; user trust.

---

### 🟡 Important — Quality & Reliability

#### `[ ]` Firestore Composite Index Automation
**What's missing:** The composite index on `cards(user_id, next_review_at)` (required by `AnalyticsService`) must be created manually in the Firebase console. There is no `firestore.indexes.json` in the `firebase/` directory.  
**Why it matters:** Without the index, `AnalyticsService.get_dashboard_summary` silently falls back to a full collection scan. This is a critical performance regression at scale — O(n) reads per dashboard load versus O(log n).  
**Unblocks:** Production-safe analytics; auto-deployed infrastructure via `firebase deploy`.

---

#### `[ ]` Firestore Security Rules
**What's missing:** No `firestore.rules` file exists. The database is either in development-open mode (allows all reads/writes) or production-locked mode (blocks all client access). Neither is correct for a deployed application.  
**Why it matters:** Without rules, Firestore is either a security liability or non-functional. In production, every document must be gated to the owning `user_id`.  
**Unblocks:** Secure deployment; passes Firebase security audit.

---

#### `[ ]` Input Sanitization for Uploaded Filenames
**What's missing:** `upload_service.process_upload` assigns `safe_filename = file.filename` directly without sanitizing path traversal characters (`../`, null bytes, excessively long names).  
**Why it matters:** Malformed filenames could construct adversarial GCS object paths, depending on the storage backend's behavior.  
**Unblocks:** Secure file ingestion; backend hardening milestone.

---

### 🟢 Enhancement — User Experience

#### `[ ]` Async Term Extraction (Background Job)
**What's missing:** `extract_terms` is a synchronous, blocking HTTP call. For large PDFs, this creates long-polling timeouts and a poor UX (spinner with no feedback).  
**Why it matters:** FastAPI's ASGI runtime can handle concurrent requests efficiently, but a blocking service call on the request thread negates this.  
**Unblocks:** Support for large documents (>50 pages); better perceived performance.  
**Suggested approach:** FastAPI `BackgroundTasks` or Celery worker; poll endpoint or WebSocket for extraction status.

---

#### `[ ]` Multi-file / EPUB / DOCX Upload Support
**What's missing:** The upload pipeline is hard-gated to PDF only (`file.filename.lower().endswith(".pdf")`).  
**Why it matters:** Students generate notes in Word, export from EPUBs, or share plain-text files. Single-format restriction is a significant adoption barrier.  
**Unblocks:** Broader user base; richer source material variety.

---

#### `[ ]` Deck Sharing / Export
**What's missing:** Decks are private to the authenticated user. There is no export-to-CSV, export-to-Anki (.apkg), or deck sharing mechanism.  
**Why it matters:** Peer study groups (a primary use case for flashcard tools) are not supported. Anki compatibility would allow power users to migrate freely.  
**Unblocks:** Collaborative study workflows; Anki interoperability.

---

#### `[ ]` Study Session Progress Persistence
**What's missing:** `StudyPage` maintains session progress in local React state only. If a user navigates away mid-session or the browser tab is closed, all progress for that session is lost (reviewed cards are already written, but the session queue state resets).  
**Why it matters:** Long study sessions are interrupted by real-world distractions. Losing session context forces the user to restart the queue, re-reviewing already-rated cards.  
**Unblocks:** Reliable long-form study sessions; mobile usage patterns.

---

#### `[ ]` User Profile & Settings Page
**What's missing:** No account management UI — users cannot change their display name, email, or password from within the application.  
**Why it matters:** Standard UX expectation for any authenticated application.  
**Unblocks:** Production-ready user lifecycle management.

---

*Last updated: April 2026*
