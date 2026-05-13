import asyncio
import io
import os
from pypdf import PdfReader, PdfWriter
from app.core.firebase_admin import get_storage_bucket

def create_dummy_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    # Just a simple pdf with nothing
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()

def test_firebase_storage():
    print("Testing Firebase Storage...")
    bucket = get_storage_bucket()
    
    # Upload
    test_path = "uploads/test_user/test_file.pdf"
    blob = bucket.blob(test_path)
    content = create_dummy_pdf()
    
    try:
        blob.upload_from_string(content, content_type="application/pdf")
        print("Upload SUCCESS")
    except Exception as e:
        print(f"Upload FAILED: {e}")
        return
        
    # Download
    try:
        downloaded = blob.download_as_bytes()
        print(f"Download SUCCESS, size: {len(downloaded)} bytes")
    except Exception as e:
        print(f"Download FAILED: {e}")
        return

    # Extract text (should be empty but shouldn't crash)
    print("Testing pypdf extraction...")
    try:
        reader = PdfReader(io.BytesIO(downloaded))
        for page in reader.pages:
            _ = page.extract_text()
        print("PDF Extraction SUCCESS")
    except Exception as e:
        print(f"PDF Extraction FAILED: {e}")
        
if __name__ == "__main__":
    test_firebase_storage()
