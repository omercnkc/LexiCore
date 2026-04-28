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
_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.0-flash", "gemini-flash-latest"]


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


def _call_gemini(contents: Any, *, max_output_tokens: int = 8000, temperature: float = 0.3, response_mime_type: str | None = None) -> str:
    """Call Gemini with automatic model fallback and retry on rate limits."""
    client = _get_client()

    last_error = None
    for model in _MODELS:
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
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
def extract_terms_from_pdf_bytes(pdf_bytes: bytes, max_terms: int = 50) -> list[dict]:
    """Use Gemini to extract important academic terms directly from PDF bytes.
    
    This is much more powerful than text extraction as Gemini can 'see' the slides
    and handle images/OCR natively.
    """
    prompt = f"""You are an expert academic vocabulary analyzer. Analyze the attached PDF document and extract EXACTLY {max_terms} important academic/technical English words or terms.

Rules:
- Return ONLY a JSON array of strings (the terms).
- Do not provide translations or any other info yet.
- Focus on academic and technical vocabulary relevant to the document content.
- Skip common everyday words.
- No explanation, no markdown fences, just the JSON array of strings.
"""

    max_retries = 2
    terms = []
    response_text = ""
    
    contents = [
        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
        prompt
    ]
    
    for attempt in range(max_retries):
        try:
            response_text = _call_gemini(
                contents, 
                max_output_tokens=8000, 
                temperature=0.3,
                response_mime_type="application/json"
            )
            terms = _parse_json_response(response_text)
            
            if not isinstance(terms, list):
                raise ValueError(f"Gemini bir terim listesi döndürmedi.")
            break
        except Exception as exc:
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                raise RuntimeError(f"AI PDF analysis failed: {exc}")

    # Sanitize: ensure it's a list of strings
    validated = [str(t).strip() for t in terms if t]
    return validated[:max_terms]


def enrich_terms_with_details(terms: list[str]) -> list[dict]:
    """Take a list of terms and generate full flashcard data using Gemini.
    
    Returns a list of dicts with: term, translation, example_sentence, hint.
    """
    if not terms:
        return []

    prompt = f"""You are a professional language teacher. For the following English terms, provide:
1. "term": The English term itself
2. "translation": Turkish translation/meaning
3. "example_sentence": A clear English example sentence
4. "example_translation": Turkish translation of the example sentence
5. "hint": A short Turkish hint/mnemonic

Terms to process:
{", ".join(terms)}

Rules:
- Return ONLY a valid JSON array of objects.
- Each object must have exactly these 5 keys.
- No explanation, no markdown fences.
"""

    try:
        response_text = _call_gemini(
            prompt,
            max_output_tokens=8000,
            temperature=0.3,
            response_mime_type="application/json"
        )
        results = _parse_json_response(response_text)
        
        if not isinstance(results, list):
            return []
            
        # Sanitize and ensure mapping
        validated = []
        for item in results:
            if not isinstance(item, dict): continue
            term_val = str(item.get("term", "")).strip()
            if not term_val: continue
            
            validated.append({
                "term": term_val,
                "translation": str(item.get("translation", "")).strip() or "—",
                "example_sentence": str(item.get("example_sentence", "")).strip() or "",
                "example_translation": str(item.get("example_translation", "")).strip() or "",
                "hint": str(item.get("hint", "")).strip() or "",
            })
        return validated
    except Exception as e:
        print(f"Enrichment failed: {e}")
        return []


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
The student is shown an English term and asked to provide the corresponding Turkish meaning.

English term: "{term}"
Correct Turkish translation: "{correct_answer}"
Student's answer (Turkish): "{user_answer}"

Evaluate the student's answer:
1. "similarity_score": a number from 0 to 100 indicating how close the student's answer is to the correct Turkish translation
2. "is_correct": MUST be true if similarity_score is 50 or higher, and MUST be false if similarity_score is less than 50.
3. "feedback": A brief Turkish explanation (max 2 sentences).

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

    score = float(result.get("similarity_score", 0))
    # Enforce the > 50% rule explicitly just in case AI messes up
    is_correct = score >= 50.0

    return {
        "is_correct": is_correct,
        "similarity_score": score,
        "feedback": str(result.get("feedback", "")),
    }
