import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

print(f"Testing with key starting with: {api_key[:10]}...")

try:
    client = genai.Client(api_key=api_key)
    print("Listing models...")
    for model in client.models.list():
        print(f" - {model.name}")
    
    print("\nTrying generate_content with PDF bytes...")
    from google.genai import types
    # Dummy PDF header to simulate a PDF file
    dummy_pdf = b"%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=dummy_pdf, mime_type="application/pdf"),
            "This is a test. Just say 'PDF Received' if you can see this part."
        ]
    )
    print("SUCCESS")
    print(response.text)
except Exception as e:
    print(f"FAILED: {type(e).__name__} - {e}")
