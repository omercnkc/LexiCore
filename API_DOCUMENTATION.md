# LexiCore API Dokümantasyonu

> **Sürüm:** 0.1.0 | **Temel URL:** `http://localhost:8000` | **API Ön Eki:** `/api`

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Kimlik Doğrulama](#kimlik-doğrulama)
3. [Durum Kodları](#durum-kodları)
4. [Uç Noktalar (Endpoints)](#uç-noktalar)

---

## Genel Bakış

LexiCore API, akıllı bir flashcard öğrenme platformu için RESTful bir arka uç servisidir. FastAPI framework'ü üzerine inşa edilmiştir ve Firebase Authentication ile korunmaktadır. Tüm veri alışverişi JSON formatında gerçekleşir.

### Mimari Akış

```
İstemci (React Frontend)
    │
    ▼  HTTP İsteği + Bearer Token
┌─────────────────────────┐
│   FastAPI Uygulama       │
│   (CORS Middleware)      │
├─────────────────────────┤
│   Auth Dependency        │  ← Firebase Token Doğrulama
├─────────────────────────┤
│   API Router (/api)      │
│   ├── /health            │
│   ├── /users             │
│   ├── /decks             │
│   ├── /cards             │
│   ├── /uploads           │
│   └── /dashboard         │
├─────────────────────────┤
│   Service Katmanı        │  ← İş Mantığı
├─────────────────────────┤
│   Firestore + Gemini AI  │  ← Veri Katmanı
└─────────────────────────┘
```

---

## Kimlik Doğrulama

Tüm korumalı uç noktalar, HTTP isteğinin `Authorization` başlığında geçerli bir **Firebase ID Token** gerektirir.

**Format:**
```
Authorization: Bearer <firebase_id_token>
```

**Doğrulanmış Kullanıcı Modeli (`AuthenticatedUser`):**

| Alan             | Tip      | Açıklama                          |
|------------------|----------|-----------------------------------|
| `uid`            | `string` | Firebase kullanıcı kimliği        |
| `email`          | `string` | Kullanıcının e-posta adresi       |
| `name`           | `string` | Kullanıcının görünen adı          |
| `picture`        | `string` | Profil fotoğrafı URL'si           |
| `email_verified` | `bool`   | E-posta doğrulama durumu          |

**Hata Yanıtları:**

```bash
# Token eksik veya geçersiz format
curl -X GET http://localhost:8000/api/users/me
```
```json
{
  "detail": "Missing or invalid authorization header."
}
```
→ HTTP `401 Unauthorized`

---

## Durum Kodları

| Kod   | Anlam                    | Açıklama                                    |
|-------|--------------------------|---------------------------------------------|
| `200` | OK                       | İstek başarıyla işlendi                     |
| `201` | Created                  | Yeni kaynak başarıyla oluşturuldu           |
| `204` | No Content               | Silme işlemi başarılı, yanıt gövdesi yok    |
| `400` | Bad Request              | Geçersiz istek parametreleri                |
| `401` | Unauthorized             | Kimlik doğrulama başarısız                  |
| `404` | Not Found                | İstenen kaynak bulunamadı                   |
| `422` | Unprocessable Entity     | Doğrulama hatası (Pydantic validation)      |
| `500` | Internal Server Error    | Sunucu tarafında beklenmeyen hata           |

---

## Uç Noktalar

### 1. Sağlık Kontrolü (Health)

#### `GET /api/health`
API'nin çalışır durumda olup olmadığını kontrol eder. Kimlik doğrulama **gerektirmez**.

```bash
curl -X GET http://localhost:8000/api/health
```

**Yanıt — 200 OK:**
```json
{
  "status": "ok"
}
```

#### `GET /`
Kök uç nokta. API'nin çalıştığını doğrular.

```bash
curl -X GET http://localhost:8000/
```

**Yanıt — 200 OK:**
```json
{
  "message": "LexiCore API is running."
}
```

---

### 2. Kullanıcılar (Users)

#### `GET /api/users/me`
Kimliği doğrulanmış kullanıcının profil bilgilerini döndürür.

```bash
curl -X GET http://localhost:8000/api/users/me \
  -H "Authorization: Bearer <firebase_id_token>"
```

**Yanıt — 200 OK:**
```json
{
  "uid": "abc123xyz",
  "email": "kullanici@example.com",
  "name": "Fatma Serra",
  "picture": "https://lh3.googleusercontent.com/photo.jpg",
  "email_verified": true
}
```

---

### 3. Desteler (Decks)

Deste, belirli bir kurs ve konuya ait flashcard'ların mantıksal grubudur.

#### 3.1 `POST /api/decks` — Yeni Deste Oluştur

**İstek Gövdesi (`DeckCreateRequest`):**

| Alan          | Tip      | Zorunlu | Kısıtlamalar     | Açıklama          |
|---------------|----------|---------|------------------|--------------------|
| `title`       | `string` | ✅      | 1–120 karakter   | Deste başlığı      |
| `course_name` | `string` | ✅      | 1–120 karakter   | Kurs adı            |
| `topic_name`  | `string` | ✅      | 1–120 karakter   | Konu adı            |

```bash
curl -X POST http://localhost:8000/api/decks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Almanca A1 Kelimeler",
    "course_name": "Almanca",
    "topic_name": "Temel Kelimeler"
  }'
```

**Yanıt — 201 Created (`DeckResponse`):**
```json
{
  "id": "deck_7f8a9b2c",
  "user_id": "abc123xyz",
  "title": "Almanca A1 Kelimeler",
  "course_name": "Almanca",
  "topic_name": "Temel Kelimeler",
  "source_type": "manual",
  "source_file_name": null,
  "created_at": "2026-05-11T20:00:00Z",
  "updated_at": "2026-05-11T20:00:00Z",
  "card_count": 0,
  "progress_percent": 0.0
}
```

#### 3.2 `GET /api/decks` — Tüm Desteleri Listele

```bash
curl -X GET http://localhost:8000/api/decks \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK (`DeckListResponse`):**
```json
{
  "items": [
    {
      "id": "deck_7f8a9b2c",
      "user_id": "abc123xyz",
      "title": "Almanca A1 Kelimeler",
      "course_name": "Almanca",
      "topic_name": "Temel Kelimeler",
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

#### 3.3 `GET /api/decks/{deck_id}` — Tek Deste Getir

| Parametre | Konum | Tip      | Açıklama              |
|-----------|-------|----------|-----------------------|
| `deck_id` | Yol   | `string` | Desteye ait benzersiz ID |

```bash
curl -X GET http://localhost:8000/api/decks/deck_7f8a9b2c \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK:** `DeckResponse` (yukarıdaki şema ile aynı)
**Yanıt — 404 Not Found:**
```json
{ "detail": "Deck not found." }
```

#### 3.4 `PATCH /api/decks/{deck_id}` — Deste Güncelle

**İstek Gövdesi (`DeckUpdateRequest`):**

| Alan    | Tip      | Zorunlu | Kısıtlamalar   |
|---------|----------|---------|----------------|
| `title` | `string` | ✅      | 1–120 karakter |

```bash
curl -X PATCH http://localhost:8000/api/decks/deck_7f8a9b2c \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Almanca A2 Kelimeler" }'
```

**Yanıt — 200 OK:** Güncellenmiş `DeckResponse`

#### 3.5 `DELETE /api/decks/{deck_id}` — Deste Sil

Desteyi ve ona ait **tüm kartları** kalıcı olarak siler.

```bash
curl -X DELETE http://localhost:8000/api/decks/deck_7f8a9b2c \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 204 No Content** (Yanıt gövdesi yoktur)

---

### 4. Kartlar (Cards)

#### 4.1 `POST /api/decks/{deck_id}/cards` — Yeni Kart Oluştur

**İstek Gövdesi (`CardCreateRequest`):**

| Alan                  | Tip      | Zorunlu | Maks   | Açıklama                 |
|-----------------------|----------|---------|--------|--------------------------|
| `term`                | `string` | ✅      | 200    | Öğrenilecek terim        |
| `translation`         | `string` | ✅      | 200    | Terimin çevirisi         |
| `pronunciation`       | `string` | ❌      | 100    | Telaffuz bilgisi         |
| `example_sentence`    | `string` | ❌      | 500    | Örnek cümle              |
| `example_translation` | `string` | ❌      | 500    | Örnek cümle çevirisi     |
| `hint`                | `string` | ❌      | 300    | İpucu                    |
| `source_reference`    | `string` | ❌      | 200    | Kaynak referansı         |

```bash
curl -X POST http://localhost:8000/api/decks/deck_7f8a9b2c/cards \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "term": "Schmetterling",
    "translation": "Kelebek",
    "pronunciation": "şmet-ter-ling",
    "example_sentence": "Der Schmetterling fliegt im Garten.",
    "example_translation": "Kelebek bahçede uçuyor.",
    "hint": "Schmettern = çarpmak, vurmak"
  }'
```

**Yanıt — 201 Created (`CardResponse`):**
```json
{
  "id": "card_a1b2c3d4",
  "deck_id": "deck_7f8a9b2c",
  "user_id": "abc123xyz",
  "term": "Schmetterling",
  "translation": "Kelebek",
  "pronunciation": "şmet-ter-ling",
  "example_sentence": "Der Schmetterling fliegt im Garten.",
  "example_translation": "Kelebek bahçede uçuyor.",
  "hint": "Schmettern = çarpmak, vurmak",
  "source_reference": null,
  "created_at": "2026-05-11T20:05:00Z",
  "updated_at": "2026-05-11T20:05:00Z",
  "next_review_at": "2026-05-11T20:05:00Z",
  "interval": 0,
  "ease_factor": 2.5,
  "review_count": 0
}
```

#### 4.2 `GET /api/decks/{deck_id}/cards` — Destedeki Kartları Listele

```bash
curl -X GET http://localhost:8000/api/decks/deck_7f8a9b2c/cards \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK (`CardListResponse`):**
```json
{
  "items": [ "...CardResponse dizisi..." ],
  "total": 12
}
```

#### 4.3 `GET /api/cards/{card_id}` — Tek Kart Getir

```bash
curl -X GET http://localhost:8000/api/cards/card_a1b2c3d4 \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK:** `CardResponse`

#### 4.4 `PATCH /api/cards/{card_id}` — Kart Güncelle

**İstek Gövdesi (`CardUpdateRequest`):** `CardCreateRequest` ile aynı alanlar, ancak **tümü opsiyoneldir**. Yalnızca gönderilen alanlar güncellenir.

```bash
curl -X PATCH http://localhost:8000/api/cards/card_a1b2c3d4 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "translation": "Kelebek (böcek)" }'
```

#### 4.5 `DELETE /api/cards/{card_id}` — Kart Sil

```bash
curl -X DELETE http://localhost:8000/api/cards/card_a1b2c3d4 \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 204 No Content**

---

### 5. Tekrar Sistemi (Spaced Repetition Review)

#### 5.1 `GET /api/decks/{deck_id}/study` — Çalışma Kuyruğu

Tekrarı gelen kartları döndürür.

```bash
curl -X GET http://localhost:8000/api/decks/deck_7f8a9b2c/study \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK (`StudyQueueResponse`):**
```json
{
  "items": [ "...CardResponse dizisi..." ],
  "total_due": 5,
  "deck_id": "deck_7f8a9b2c"
}
```

#### 5.2 `GET /api/decks/courses/{course_name}/study` — Kurs Bazlı Çalışma Kuyruğu

Bir kursa ait tüm destelerden tekrarı gelen kartları getirir.

| Parametre     | Konum | Tip      | Açıklama |
|---------------|-------|----------|----------|
| `course_name` | Yol   | `string` | Kurs adı |

```bash
curl -X GET http://localhost:8000/api/decks/courses/Almanca/study \
  -H "Authorization: Bearer <token>"
```

#### 5.3 `POST /api/cards/{card_id}/review` — Tekrar Gönder

**İstek Gövdesi (`ReviewRequest`):**

| Alan               | Tip      | Zorunlu | Değerler                              |
|--------------------|----------|---------|---------------------------------------|
| `rating`           | `string` | ✅      | `"easy"`, `"medium"`, `"hard"`, `"unknown"` |
| `is_correct`       | `bool`   | ❌      | AI cevap kontrolü sonucu              |
| `similarity_score` | `float`  | ❌      | 0–100 arası benzerlik puanı           |
| `user_answer`      | `string` | ❌      | Kullanıcının verdiği cevap (maks 500) |

```bash
curl -X POST http://localhost:8000/api/cards/card_a1b2c3d4/review \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": "easy",
    "is_correct": true,
    "similarity_score": 95.0,
    "user_answer": "Kelebek"
  }'
```

**Yanıt — 200 OK (`ReviewResponse`):**
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
  "user_answer": "Kelebek"
}
```

#### 5.4 `POST /api/cards/{card_id}/check-answer` — AI Cevap Kontrolü

Gemini AI kullanarak kullanıcının cevabını doğru cevapla karşılaştırır.

**İstek Gövdesi (`AnswerCheckRequest`):**

| Alan          | Tip      | Zorunlu | Maks | Açıklama                |
|---------------|----------|---------|------|-------------------------|
| `user_answer` | `string` | ✅      | 500  | Kullanıcının cevabı     |

```bash
curl -X POST http://localhost:8000/api/cards/card_a1b2c3d4/check-answer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "user_answer": "Kelebek" }'
```

**Yanıt — 200 OK (`AnswerCheckResponse`):**
```json
{
  "is_correct": true,
  "similarity_score": 98.5,
  "correct_answer": "Kelebek",
  "feedback": "Harika! Cevabınız doğru cevapla neredeyse birebir eşleşiyor."
}
```

---

### 6. Dosya Yükleme (Uploads)

PDF dosyalarından AI destekli otomatik flashcard üretimi sağlar.

#### 6.1 `POST /api/uploads` — Dosya Yükle

**İstek:** `multipart/form-data` formatında dosya yükleme.

| Alan   | Tip          | Zorunlu | Açıklama          |
|--------|--------------|---------|--------------------|
| `file` | `UploadFile` | ✅      | PDF dosyası        |

```bash
curl -X POST http://localhost:8000/api/uploads \
  -H "Authorization: Bearer <token>" \
  -F "file=@almanca_ders_notu.pdf"
```

**Yanıt — 201 Created (`UploadResponse`):**
```json
{
  "id": "upload_m3n4o5p6",
  "file_name": "almanca_ders_notu.pdf",
  "status": "processed"
}
```

#### 6.2 `POST /api/uploads/{upload_id}/extract` — Terimleri Çıkart

Yüklenen PDF'den AI ile aday terimleri çıkartır.

```bash
curl -X POST http://localhost:8000/api/uploads/upload_m3n4o5p6/extract \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK (`ExtractResponse`):**
```json
{
  "upload_id": "upload_m3n4o5p6",
  "terms": [
    {
      "term": "Schmetterling",
      "translation": "Kelebek",
      "example_sentence": "Der Schmetterling fliegt.",
      "hint": "Böcek türü",
      "context": "Sayfa 3, paragraf 2"
    }
  ]
}
```

#### 6.3 `POST /api/uploads/{upload_id}/generate-cards` — Kart Üret

Seçilen terimlerden flashcard'lar oluşturur ve bir desteye ekler.

**İstek Gövdesi (`GenerateCardsRequest`):**

| Alan          | Tip        | Zorunlu | Açıklama                       |
|---------------|------------|---------|--------------------------------|
| `upload_id`   | `string`   | ✅      | Yükleme ID (URL ile eşleşmeli)|
| `deck_id`     | `string`   | ❌      | Mevcut deste ID'si             |
| `deck_title`  | `string`   | ❌      | Yeni deste başlığı             |
| `course_name` | `string`   | ❌      | Kurs adı                       |
| `topic_name`  | `string`   | ❌      | Konu adı                       |
| `terms`       | `string[]` | ✅      | Seçilen terim listesi          |

```bash
curl -X POST http://localhost:8000/api/uploads/upload_m3n4o5p6/generate-cards \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "upload_id": "upload_m3n4o5p6",
    "deck_title": "PDF - Almanca Kelimeler",
    "course_name": "Almanca",
    "topic_name": "Ders Notu Terimleri",
    "terms": ["Schmetterling", "Wanderlust", "Zeitgeist"]
  }'
```

**Yanıt — 200 OK:**
```json
{
  "message": "Cards generated successfully",
  "deck_id": "deck_q7r8s9t0"
}
```

---

### 7. Analitik Panosu (Dashboard Analytics)

#### 7.1 `GET /api/dashboard/summary` — Özet İstatistikler

```bash
curl -X GET http://localhost:8000/api/dashboard/summary \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK (`DashboardSummaryResponse`):**
```json
{
  "cards_due_today": 15,
  "total_decks": 4,
  "total_cards": 87,
  "reviews_today": 23,
  "reviews_last_7_days": 142,
  "average_accuracy": 78.5,
  "weakest_deck_name": "Almanca A2 Kelimeler",
  "total_correct": 18,
  "total_wrong": 5,
  "answer_accuracy_percent": 78.26,
  "avg_similarity_score": 82.3
}
```

#### 7.2 `GET /api/dashboard/weekly-progress` — Haftalık İlerleme

```bash
curl -X GET http://localhost:8000/api/dashboard/weekly-progress \
  -H "Authorization: Bearer <token>"
```

**Yanıt — 200 OK (`WeeklyProgressResponse`):**
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

## Veri Modelleri Özet Şeması

### DeckResponse

| Alan               | Tip        | Açıklama                                |
|--------------------|------------|-----------------------------------------|
| `id`               | `string`   | Benzersiz deste kimliği                 |
| `user_id`          | `string`   | Sahip kullanıcı ID'si                   |
| `title`            | `string`   | Deste başlığı                           |
| `course_name`      | `string`   | Ait olduğu kurs                         |
| `topic_name`       | `string`   | Ait olduğu konu                         |
| `source_type`      | `enum`     | `"manual"` veya `"file"`                |
| `source_file_name` | `string?`  | Kaynak dosya adı (dosya yüklemesiyse)   |
| `created_at`       | `datetime` | Oluşturulma zamanı (UTC)                |
| `updated_at`       | `datetime` | Son güncellenme zamanı (UTC)            |
| `card_count`       | `int`      | Destedeki toplam kart sayısı (≥0)       |
| `progress_percent` | `float`    | İlerleme yüzdesi (0–100)               |

### CardResponse

| Alan                  | Tip        | Açıklama                             |
|-----------------------|------------|--------------------------------------|
| `id`                  | `string`   | Benzersiz kart kimliği               |
| `deck_id`             | `string`   | Ait olduğu deste ID'si              |
| `user_id`             | `string`   | Sahip kullanıcı ID'si               |
| `term`                | `string`   | Öğrenilecek terim                    |
| `translation`         | `string`   | Terimin çevirisi                     |
| `pronunciation`       | `string?`  | Telaffuz                             |
| `example_sentence`    | `string?`  | Örnek cümle                          |
| `example_translation` | `string?`  | Örnek cümle çevirisi                 |
| `hint`                | `string?`  | İpucu                                |
| `source_reference`    | `string?`  | Kaynak referansı                     |
| `created_at`          | `datetime` | Oluşturulma zamanı                   |
| `updated_at`          | `datetime` | Son güncellenme zamanı               |
| `next_review_at`      | `datetime` | Bir sonraki tekrar zamanı            |
| `interval`            | `int`      | Tekrar aralığı (gün)                |
| `ease_factor`         | `float`    | Kolaylık faktörü (SR algoritması)    |
| `review_count`        | `int`      | Toplam tekrar sayısı                 |

---

## Hızlı Başlangıç

```bash
# 1. Backend'i başlatın
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Sağlık kontrolü yapın
curl http://localhost:8000/api/health

# 3. Swagger UI'a göz atın
# Tarayıcınızda açın: http://localhost:8000/docs
```

> **Not:** FastAPI, `/docs` (Swagger UI) ve `/redoc` (ReDoc) adreslerinde otomatik interaktif API dokümantasyonu sunar.
