from google import genai

api_key = "AIzaSyDUcWuuMt1msIEg1Bg9s7TKTBdQGV52HL4"
client = genai.Client(api_key=api_key)

# List available models
print("=== Available Generative Models ===")
try:
    for model in client.models.list():
        if "generateContent" in (model.supported_actions or []):
            print(f"  {model.name}")
except Exception as e:
    print(f"  List error: {e}")

# Test specific models
models_to_test = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite", 
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-pro-preview-05-06",
]

print("\n=== Testing Models ===")
for model_name in models_to_test:
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Say hello in one word."
        )
        print(f"  {model_name}: OK - {response.text.strip()[:50]}")
    except Exception as e:
        print(f"  {model_name}: FAILED - {str(e)[:100]}")
