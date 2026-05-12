# LexiCore API Documentation

> **Version:** 0.1.0 | **Base URL:** `http://localhost:8000` | **API Prefix:** `/api`

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Status Codes](#status-codes)
4. [Endpoints](#endpoints)

---

## Overview

LexiCore API is a RESTful backend service for an intelligent flashcard learning platform. It is built on the FastAPI framework and secured with Firebase Authentication. All data exchange occurs in JSON format.

### Architectural Flow

```
Client (React Frontend)
    │
    ▼  HTTP Request + Bearer Token
┌─────────────────────────┐
│   FastAPI Application    │
│   (CORS Middleware)      │
├─────────────────────────┤
│   Auth Dependency        │  ← Firebase Token Verification
├─────────────────────────┤
│   API Router (/api)      │
│   ├── /health            │
│   ├── /users             │
│   ├── /decks             │
│   ├── /cards             │
│   ├── /uploads           │
│   └── /dashboard         │
├─────────────────────────┤
│   Service Layer          │  ← Business Logic
├─────────────────────────┤
│   Firestore + Gemini AI  │  ← Data Layer
└─────────────────────────┘
```

---

## Authentication

All protected endpoints require a valid **Firebase ID Token** in the `Authorization` header of the HTTP request.

**Format:**
```
Authorization: Bearer <firebase_id_token>
```

**Authenticated User Model (`AuthenticatedUser`):**

| Field             | Type      | Description                       |
|-------------------|-----------|-----------------------------------|
| `uid`             | `string`  | Firebase user ID                  |
| `email`           | `string`  | User's email address              |
| `name`            | `string`  | User's display name               |
| `picture`         | `string`  | Profile photo URL                 |
| `email_verified`  | `bool`    | Email verification status         |

**Error Responses:**

```bash
# Token missing or invalid format
curl -X GET http://localhost:8000/api/users/me
```
```json
{
  "detail": "Missing or invalid authorization header."
}
```
→ HTTP `401 Unauthorized`

---

## Status Codes

| Code  | Meaning                  | Description                                 |
|-------|--------------------------|---------------------------------------------|
| `200` | OK                       | Request processed successfully              |
| `201` | Created                  | New resource created successfully           |
| `204` | No Content               | Deletion successful, no response body       |
| `400` | Bad Request              | Invalid request parameters                  |
| `401` | Unauthorized             | Authentication failed                       |
| `404` | Not Found                | Requested resource not found                |
| `422` | Unprocessable Entity     | Validation error (Pydantic validation)      |
| `500` | Internal Server Error    | Unexpected server-side error                |

---

## Endpoints

### 1. Health Check

#### `GET /api/health`
Checks if the API is running. Does **not** require authentication.

```bash
curl -X GET http://localhost:8000/api/health
```

**Response — 200 OK:**
```json
{
  "status": "ok"
}
```

#### `GET /`
Root endpoint. Verifies that the API is running.

```bash
curl -X GET http://localhost:8000/
```

**Response — 200 OK:**
```json
{
  "message": "LexiCore API is running."
}
```

---

### 2. Users

#### `GET /api/users/me`
Returns profile information of the authenticated user.

```bash
curl -X GET http://localhost:8000/api/users/me \
  -H "Authorization: Bearer <firebase_id_token>"
```

**Response — 200 OK:**
```json
{
  "uid": "abc123xyz",
  "email": "user@example.com",
  "name": "Fatma Serra",
  "picture": "https://lh3.googleusercontent.com/photo.jpg",
  "email_verified": true
}
```

---

### 3. Decks

A deck is a logical group of flashcards belonging to a specific course and topic.

#### 3.1 `POST /api/decks` — Create New Deck

**Request Body (`DeckCreateRequest`):**

| Field         | Type      | Required | Constraints      | Description        |
|---------------|-----------|----------|------------------|--------------------|
| `title`       | `string`  | ✅       | 1–120 characters | Deck title         |
| `course_name` | `string`  | ✅       | 1–120 characters | Course name        |
| `topic_name`  | `string`  | ✅       | 1–120 characters | Topic name         |

```bash
curl -X POST http://localhost:8000/api/decks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "German A1 Words",
    "course_name": "German",
    "topic_name": "Basic Words"
  }'
```

**Response — 201 Created (`DeckResponse`):**
```json
{
  "id": "deck_7f8a9b2c",
  "user_id": "abc123xyz",
  "title": "German A1 Words",
  "course_name": "German",
  "topic_name": "Basic Words",
  "source_type": "manual",
  "source_file_name": null,
  "created_at": "2026-05-11T20:00:00Z",
  "updated_at": "2026-05-11T20:00:00Z",
  "card_count": 0,
  "progress_percent": 0.0
}
```

#### 3.2 `GET /api/decks` — List All Decks

```bash
curl -X GET http://localhost:8000/api/decks \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK (`DeckListResponse`):**
```json
{
  "items": [
    {
      "id": "deck_7f8a9b2c",
      "user_id": "abc123xyz",
      "title": "German A1 Words",
      "course_name": "German",
      "topic_name": "Basic Words",
      "source_type": "manual",
      "source_file_name": null,
      "created_at": "2026-05-11T20:00:00Z",
      "updated_at": "2026-05-11T20:00:00Z",
      "card_count": 12,
      "progress_percent": 45.5
    }
  ],
  "total": 1
}
```

#### 3.3 `GET /api/decks/{deck_id}` — Get Single Deck

| Parameter | Location | Type      | Description           |
|-----------|----------|-----------|-----------------------|
| `deck_id` | Path     | `string`  | Unique ID for the deck|

```bash
curl -X GET http://localhost:8000/api/decks/deck_7f8a9b2c \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK:** `DeckResponse` (same as above schema)
**Response — 404 Not Found:**
```json
{ "detail": "Deck not found." }
```

#### 3.4 `PATCH /api/decks/{deck_id}` — Update Deck

**Request Body (`DeckUpdateRequest`):**

| Field   | Type      | Required | Constraints      |
|---------|-----------|----------|------------------|
| `title` | `string`  | ✅       | 1–120 characters |

```bash
curl -X PATCH http://localhost:8000/api/decks/deck_7f8a9b2c \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "German A2 Words" }'
```

**Response — 200 OK:** Updated `DeckResponse`

#### 3.5 `DELETE /api/decks/{deck_id}` — Delete Deck

Permanently deletes the deck and all its **cards**.

```bash
curl -X DELETE http://localhost:8000/api/decks/deck_7f8a9b2c \
  -H "Authorization: Bearer <token>"
```

**Response — 204 No Content** (No response body)

---

### 4. Cards

#### 4.1 `POST /api/decks/{deck_id}/cards` — Create New Card

**Request Body (`CardCreateRequest`):**

| Field                 | Type      | Required | Max    | Description              |
|-----------------------|-----------|----------|--------|--------------------------|
| `term`                | `string`  | ✅       | 200    | Term to learn            |
| `translation`         | `string`  | ✅       | 200    | Translation of the term  |
| `pronunciation`       | `string`  | ❌       | 100    | Pronunciation info       |
| `example_sentence`    | `string`  | ❌       | 500    | Example sentence         |
| `example_translation` | `string`  | ❌       | 500    | Example sentence trans   |
| `hint`                | `string`  | ❌       | 300    | Hint                     |
| `source_reference`    | `string`  | ❌       | 200    | Source reference         |

```bash
curl -X POST http://localhost:8000/api/decks/deck_7f8a9b2c/cards \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "term": "Schmetterling",
    "translation": "Butterfly",
    "pronunciation": "shmet-ter-ling",
    "example_sentence": "Der Schmetterling fliegt im Garten.",
    "example_translation": "The butterfly is flying in the garden.",
    "hint": "Schmettern = to strike, to hit"
  }'
```

**Response — 201 Created (`CardResponse`):**
```json
{
  "id": "card_a1b2c3d4",
  "deck_id": "deck_7f8a9b2c",
  "user_id": "abc123xyz",
  "term": "Schmetterling",
  "translation": "Butterfly",
  "pronunciation": "shmet-ter-ling",
  "example_sentence": "Der Schmetterling fliegt im Garten.",
  "example_translation": "The butterfly is flying in the garden.",
  "hint": "Schmettern = to strike, to hit",
  "source_reference": null,
  "created_at": "2026-05-11T20:05:00Z",
  "updated_at": "2026-05-11T20:05:00Z",
  "next_review_at": "2026-05-11T20:05:00Z",
  "interval": 0,
  "ease_factor": 2.5,
  "review_count": 0
}
```

#### 4.2 `GET /api/decks/{deck_id}/cards` — List Cards in Deck

```bash
curl -X GET http://localhost:8000/api/decks/deck_7f8a9b2c/cards \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK (`CardListResponse`):**
```json
{
  "items": [ "...CardResponse array..." ],
  "total": 12
}
```

#### 4.3 `GET /api/cards/{card_id}` — Get Single Card

```bash
curl -X GET http://localhost:8000/api/cards/card_a1b2c3d4 \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK:** `CardResponse`

#### 4.4 `PATCH /api/cards/{card_id}` — Update Card

**Request Body (`CardUpdateRequest`):** Same fields as `CardCreateRequest`, but **all are optional**. Only sent fields will be updated.

```bash
curl -X PATCH http://localhost:8000/api/cards/card_a1b2c3d4 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "translation": "Butterfly (insect)" }'
```

#### 4.5 `DELETE /api/cards/{card_id}` — Delete Card

```bash
curl -X DELETE http://localhost:8000/api/cards/card_a1b2c3d4 \
  -H "Authorization: Bearer <token>"
```

**Response — 204 No Content**

---

### 5. Review System (Spaced Repetition Review)

#### 5.1 `GET /api/decks/{deck_id}/study` — Study Queue

Returns cards due for review.

```bash
curl -X GET http://localhost:8000/api/decks/deck_7f8a9b2c/study \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK (`StudyQueueResponse`):**
```json
{
  "items": [ "...CardResponse array..." ],
  "total_due": 5,
  "deck_id": "deck_7f8a9b2c"
}
```

#### 5.2 `GET /api/decks/courses/{course_name}/study` — Course-Based Study Queue

Retrieves cards due for review from all decks belonging to a course.

| Parameter     | Location | Type      | Description |
|---------------|----------|-----------|-------------|
| `course_name` | Path     | `string`  | Course name |

```bash
curl -X GET http://localhost:8000/api/decks/courses/German/study \
  -H "Authorization: Bearer <token>"
```

#### 5.3 `POST /api/cards/{card_id}/review` — Submit Review

**Request Body (`ReviewRequest`):**

| Field              | Type      | Required | Values                                |
|--------------------|-----------|----------|---------------------------------------|
| `rating`           | `string`  | ✅       | `"easy"`, `"medium"`, `"hard"`, `"unknown"` |
| `is_correct`       | `bool`    | ❌       | AI answer check result                |
| `similarity_score` | `float`   | ❌       | Similarity score between 0–100        |
| `user_answer`      | `string`  | ❌       | Answer given by the user (max 500)    |

```bash
curl -X POST http://localhost:8000/api/cards/card_a1b2c3d4/review \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": "easy",
    "is_correct": true,
    "similarity_score": 95.0,
    "user_answer": "Butterfly"
  }'
```

**Response — 200 OK (`ReviewResponse`):**
```json
{
  "id": "review_x1y2z3",
  "user_id": "abc123xyz",
  "deck_id": "deck_7f8a9b2c",
  "card_id": "card_a1b2c3d4",
  "rating": "easy",
  "reviewed_at": "2026-05-11T20:10:00Z",
  "previous_interval": 1,
  "new_interval": 4,
  "previous_ease_factor": 2.5,
  "new_ease_factor": 2.6,
  "is_correct": true,
  "similarity_score": 95.0,
  "user_answer": "Butterfly"
}
```

#### 5.4 `POST /api/cards/{card_id}/check-answer` — AI Answer Check

Compares the user's answer with the correct answer using Gemini AI.

**Request Body (`AnswerCheckRequest`):**

| Field         | Type      | Required | Max  | Description            |
|---------------|-----------|----------|------|------------------------|
| `user_answer` | `string`  | ✅       | 500  | User's answer          |

```bash
curl -X POST http://localhost:8000/api/cards/card_a1b2c3d4/check-answer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "user_answer": "Butterfly" }'
```

**Response — 200 OK (`AnswerCheckResponse`):**
```json
{
  "is_correct": true,
  "similarity_score": 98.5,
  "correct_answer": "Butterfly",
  "feedback": "Great! Your answer almost perfectly matches the correct answer."
}
```

---

### 6. File Uploads

Provides AI-powered automatic flashcard generation from PDF files.

#### 6.1 `POST /api/uploads` — Upload File

**Request:** File upload in `multipart/form-data` format.

| Field  | Type         | Required | Description       |
|--------|--------------|----------|-------------------|
| `file` | `UploadFile` | ✅       | PDF file          |

```bash
curl -X POST http://localhost:8000/api/uploads \
  -H "Authorization: Bearer <token>" \
  -F "file=@german_notes.pdf"
```

**Response — 201 Created (`UploadResponse`):**
```json
{
  "id": "upload_m3n4o5p6",
  "file_name": "german_notes.pdf",
  "status": "processed"
}
```

#### 6.2 `POST /api/uploads/{upload_id}/extract` — Extract Terms

Extracts candidate terms from the uploaded PDF using AI.

```bash
curl -X POST http://localhost:8000/api/uploads/upload_m3n4o5p6/extract \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK (`ExtractResponse`):**
```json
{
  "upload_id": "upload_m3n4o5p6",
  "terms": [
    {
      "term": "Schmetterling",
      "translation": "Butterfly",
      "example_sentence": "Der Schmetterling fliegt.",
      "hint": "Type of insect",
      "context": "Page 3, paragraph 2"
    }
  ]
}
```

#### 6.3 `POST /api/uploads/{upload_id}/generate-cards` — Generate Cards

Creates flashcards from selected terms and adds them to a deck.

**Request Body (`GenerateCardsRequest`):**

| Field         | Type       | Required | Description                    |
|---------------|------------|----------|--------------------------------|
| `upload_id`   | `string`   | ✅       | Upload ID (must match URL)     |
| `deck_id`     | `string`   | ❌       | Existing deck ID               |
| `deck_title`  | `string`   | ❌       | New deck title                 |
| `course_name` | `string`   | ❌       | Course name                    |
| `topic_name`  | `string`   | ❌       | Topic name                     |
| `terms`       | `string[]` | ✅       | Selected terms list            |

```bash
curl -X POST http://localhost:8000/api/uploads/upload_m3n4o5p6/generate-cards \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "upload_id": "upload_m3n4o5p6",
    "deck_title": "PDF - German Words",
    "course_name": "German",
    "topic_name": "Lecture Note Terms",
    "terms": ["Schmetterling", "Wanderlust", "Zeitgeist"]
  }'
```

**Response — 200 OK:**
```json
{
  "message": "Cards generated successfully",
  "deck_id": "deck_q7r8s9t0"
}
```

---

### 7. Analytics Dashboard

#### 7.1 `GET /api/dashboard/summary` — Summary Statistics

```bash
curl -X GET http://localhost:8000/api/dashboard/summary \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK (`DashboardSummaryResponse`):**
```json
{
  "cards_due_today": 15,
  "total_decks": 4,
  "total_cards": 87,
  "reviews_today": 23,
  "reviews_last_7_days": 142,
  "average_accuracy": 78.5,
  "weakest_deck_name": "German A2 Words",
  "total_correct": 18,
  "total_wrong": 5,
  "answer_accuracy_percent": 78.26,
  "avg_similarity_score": 82.3
}
```

#### 7.2 `GET /api/dashboard/weekly-progress` — Weekly Progress

```bash
curl -X GET http://localhost:8000/api/dashboard/weekly-progress \
  -H "Authorization: Bearer <token>"
```

**Response — 200 OK (`WeeklyProgressResponse`):**
```json
{
  "days": [
    {
      "date": "2026-05-05",
      "review_count": 20,
      "accuracy": 85.0,
      "correct_count": 17,
      "wrong_count": 3
    },
    {
      "date": "2026-05-06",
      "review_count": 15,
      "accuracy": 73.3,
      "correct_count": 11,
      "wrong_count": 4
    }
  ]
}
```

---

## Data Models Summary Schema

### DeckResponse

| Field              | Type       | Description                             |
|--------------------|------------|-----------------------------------------|
| `id`               | `string`   | Unique deck ID                          |
| `user_id`          | `string`   | Owner user ID                           |
| `title`            | `string`   | Deck title                              |
| `course_name`      | `string`   | Course it belongs to                    |
| `topic_name`       | `string`   | Topic it belongs to                     |
| `source_type`      | `enum`     | `"manual"` or `"file"`                  |
| `source_file_name` | `string?`  | Source file name (if file upload)       |
| `created_at`       | `datetime` | Creation time (UTC)                     |
| `updated_at`       | `datetime` | Last update time (UTC)                  |
| `card_count`       | `int`      | Total card count in deck (≥0)           |
| `progress_percent` | `float`    | Progress percentage (0–100)             |

### CardResponse

| Field                 | Type       | Description                          |
|-----------------------|------------|--------------------------------------|
| `id`                  | `string`   | Unique card ID                       |
| `deck_id`             | `string`   | Deck ID it belongs to                |
| `user_id`             | `string`   | Owner user ID                        |
| `term`                | `string`   | Term to learn                        |
| `translation`         | `string`   | Translation of the term              |
| `pronunciation`       | `string?`  | Pronunciation                        |
| `example_sentence`    | `string?`  | Example sentence                     |
| `example_translation` | `string?`  | Example sentence translation         |
| `hint`                | `string?`  | Hint                                 |
| `source_reference`    | `string?`  | Source reference                     |
| `created_at`          | `datetime` | Creation time                        |
| `updated_at`          | `datetime` | Last update time                     |
| `next_review_at`      | `datetime` | Next review time                     |
| `interval`            | `int`      | Review interval (days)               |
| `ease_factor`         | `float`    | Ease factor (SR algorithm)           |
| `review_count`        | `int`      | Total review count                   |

---

## Quick Start

```bash
# 1. Start the Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Perform health check
curl http://localhost:8000/api/health

# 3. Check out Swagger UI
# Open in your browser: http://localhost:8000/docs
```

> **Note:** FastAPI provides automatic interactive API documentation at `/docs` (Swagger UI) and `/redoc` (ReDoc).
