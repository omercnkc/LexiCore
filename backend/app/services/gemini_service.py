"""Gemini AI service for intelligent flashcard generation and answer checking."""

import json
import re
import time
from typing import Any

from google import genai
from google.genai import types

from app.core.config import get_settings

_client = None

# Models to try in order (fallback chain)
_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY ayarlanmamış. "
            "backend/.env dosyasına GEMINI_API_KEY ekleyin."
        )

    _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _friendly_error(exc: Exception) -> str:
    """Convert raw Gemini API errors into user-friendly Turkish messages."""
    msg = str(exc).lower()

    if "api key expired" in msg or "api_key_invalid" in msg:
        return (
            "Gemini API anahtarınızın süresi dolmuş veya geçersiz. "
            "Lütfen https://aistudio.google.com/app/apikey adresinden yeni bir key oluşturun "
            "ve backend/.env dosyasındaki GEMINI_API_KEY değerini güncelleyin."
        )

    if "resource_exhausted" in msg or "quota" in msg or "429" in msg:
        return (
            "Gemini API günlük kullanım kotanız doldu. "
            "Lütfen birkaç dakika bekleyin veya https://aistudio.google.com/app/apikey "
            "adresinden yeni bir API key oluşturun."
        )

    if "permission_denied" in msg or "403" in msg:
        return (
            "Gemini API erişim izni reddedildi. "
            "API key'inizin Generative Language API için etkin olduğundan emin olun."
        )

    return f"AI servisi hatası: {exc}"


def _call_gemini(prompt: str, *, max_output_tokens: int = 8000, temperature: float = 0.3, response_mime_type: str | None = None) -> str:
    """Call Gemini with automatic model fallback and retry on rate limits."""
    client = _get_client()

    last_error = None
    for model in _MODELS:
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                        response_mime_type=response_mime_type,
                    ),
                )
                return response.text
            except Exception as exc:
                last_error = exc
                err_msg = str(exc).lower()

                # API key invalid/expired — no point retrying
                if "api_key_invalid" in err_msg or "api key expired" in err_msg:
                    raise RuntimeError(_friendly_error(exc)) from exc

                # Rate limit — wait and retry
                if "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
                    wait_secs = (attempt + 1) * 5  # 5s, 10s, 15s
                    time.sleep(wait_secs)
                    continue

                # Other errors — try next model
                break

    raise RuntimeError(_friendly_error(last_error))


def _parse_json_response(text: str) -> Any:
    """Extract JSON from Gemini response, handling markdown fences."""
    cleaned = text.strip()

    # Strip markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    else:
        # Fallback to extract the array directly if markdown is missing/malformed
        start_idx = cleaned.find('[')
        end_idx = cleaned.rfind(']')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx:end_idx+1]

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON Parse Error. Raw text was:\n{text}") from exc


def extract_terms_with_ai(text: str, max_terms: int = 50) -> list[dict]:
    """Use Gemini to extract important academic terms from PDF text.

    Returns a list of dicts, each containing:
        - term: the English word/phrase
        - translation: Turkish meaning
        - example_sentence: English example sentence using the term
        - hint: a short hint to help remember the meaning
    """
    # Truncate very long texts to stay within token limits (Max 4000 characters)
    truncated_text = text[:4000]

    prompt = f"""You are an expert academic vocabulary analyzer. Analyze the following text and extract EXACTLY {max_terms} important academic/technical English words or terms.

For each term, provide:
1. "term": The English word or short phrase (max 3 words)
2. "translation": The Turkish translation/meaning
3. "example_sentence": A clear English example sentence using the term
4. "hint": A short Turkish hint to help remember the meaning (e.g., word origin, similar Turkish word, mnemonic)

Rules:
- You MUST return EXACTLY {max_terms} terms.
- Focus on academic, technical, and domain-specific vocabulary
- Skip common everyday words (the, is, and, but, etc.)
- Skip proper nouns (names of people, specific places)
- Order terms by importance/relevance to the text
- Return EXACTLY a JSON array, nothing else
- Each element must have exactly these 4 keys: term, translation, example_sentence, hint

Text to analyze:
---
{truncated_text}
---

Return ONLY a valid JSON array with EXACTLY {max_terms} terms. No explanation, no markdown."""

    max_retries = 2
    terms = []
    response_text = ""
    
    for attempt in range(max_retries):
        try:
            response_text = _call_gemini(
                prompt, 
                max_output_tokens=8000, 
                temperature=0.3,
                response_mime_type="application/json"
            )
            terms = _parse_json_response(response_text)
            
            if not isinstance(terms, list):
                raise ValueError(f"Gemini bir terim listesi döndürmedi. Gelen tip: {type(terms)}")
            break  # Success
        except Exception as exc:
            try:
                print(f"Gemini API attempt failed ({attempt+1}/{max_retries}). Error: {exc}")
            except Exception:
                pass
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                raise RuntimeError(
                    f"Gemini returned an invalid response. Detail: {str(exc)}\n\nRaw Response: {response_text}"
                ) from exc

    # Validate and sanitize each term
    validated: list[dict] = []
    for item in terms[:max_terms]:
        if not isinstance(item, dict):
            continue

        term_val = str(item.get("term", "")).strip()
        if not term_val:
            continue

        validated.append({
            "term": term_val,
            "translation": str(item.get("translation", "")).strip() or "—",
            "example_sentence": str(item.get("example_sentence", "")).strip() or "",
            "hint": str(item.get("hint", "")).strip() or "",
        })

    return validated


def check_answer_similarity(
    term: str,
    correct_answer: str,
    user_answer: str,
) -> dict:
    """Use Gemini to evaluate user's answer against the correct translation.

    Returns a dict containing:
        - is_correct: bool
        - similarity_score: float (0-100)
        - feedback: short explanation in Turkish
    """
    prompt = f"""You are a language learning assistant evaluating a student's answer.
The student is shown a Turkish meaning and asked to provide the corresponding English term.

The correct English term: "{term}"
The Turkish meaning shown to the student: "{correct_answer}"
The student's answer (English): "{user_answer}"

Evaluate the student's answer:
1. "is_correct": true if the answer is essentially correct (synonyms or close meanings count), false otherwise
2. "similarity_score": a number from 0 to 100 indicating how close the student's answer is to the correct English term
   - 90-100: Perfect match or very close synonym
   - 70-89: Correct meaning, maybe a different form (e.g., noun vs verb) or a good synonym
   - 40-69: Partially correct or related concept
   - 0-39: Wrong or irrelevant
3. "feedback": A brief Turkish explanation (max 2 sentences). If wrong, mention the correct word. If correct, give encouragement.

Return ONLY a valid JSON object with these 3 keys. No explanation, no markdown."""

    try:
        response_text = _call_gemini(
            prompt, 
            max_output_tokens=500, 
            temperature=0.2,
            response_mime_type="application/json"
        )
        result = _parse_json_response(response_text)
    except Exception:
        # Fallback: simple string comparison when AI is unavailable
        user_clean = user_answer.strip().lower()
        correct_clean = correct_answer.strip().lower()
        is_match = user_clean == correct_clean

        return {
            "is_correct": is_match,
            "similarity_score": 100.0 if is_match else 0.0,
            "feedback": "Doğru!" if is_match else f"Doğru cevap: {term}",
        }

    return {
        "is_correct": bool(result.get("is_correct", False)),
        "similarity_score": float(result.get("similarity_score", 0)),
        "feedback": str(result.get("feedback", "")),
    }
