import os
import sys
from google import genai

api_key = "AIzaSyDUcWuuMt1msIEg1Bg9s7TKTBdQGV52HL4"

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-1.5-flash",
        contents="Hello, testing API key."
    )
    print("SUCCESS")
    print(response.text)
except Exception as e:
    print(f"FAILED: {type(e).__name__} - {e}")
