from google import genai
from google.genai import types

api_key = "AIzaSyDUcWuuMt1msIEg1Bg9s7TKTBdQGV52HL4"
client = genai.Client(api_key=api_key)

prompt = """Return ONLY a valid JSON array with 3 items. No explanation, no markdown.
Each item should have: "term", "translation"
Example: [{"term": "hello", "translation": "merhaba"}]"""

print("=== Testing gemini-2.5-flash ===")
try:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1000,
        ),
    )
    print(f"response.text type: {type(response.text)}")
    print(f"response.text repr: {repr(response.text[:500])}")
    print(f"---")
    
    # Check if there are thinking parts
    if hasattr(response, 'candidates') and response.candidates:
        for i, candidate in enumerate(response.candidates):
            if hasattr(candidate, 'content') and candidate.content:
                for j, part in enumerate(candidate.content.parts):
                    print(f"Part {j}: thought={getattr(part, 'thought', None)}, text={repr(getattr(part, 'text', '')[:200])}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")

print("\n=== Testing gemini-2.0-flash (for comparison) ===")
try:
    response2 = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1000,
        ),
    )
    print(f"response.text repr: {repr(response2.text[:500])}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
