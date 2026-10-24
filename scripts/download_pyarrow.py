import httpx
import time
import sys

URL = "https://files.pythonhosted.org/packages/54/3c/1783aab1dac28e175dcf26dfc7123725efc474caecaed91e8a34cb89cad0/pyarrow-26.0.0-cp312-cp312-win_amd64.whl"
OUT_FILE = "pyarrow-26.0.0-cp312-cp312-win_amd64.whl"

def download():
    print("Downloading pyarrow wheel directly via httpx...", flush=True)
    with httpx.stream("GET", URL, timeout=120.0, follow_redirects=True) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))
        downloaded = 0
        start = time.time()
        last_log = start
        with open(OUT_FILE, "wb") as f:
            for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                now = time.time()
                if now - last_log > 3.0:
                    pct = (downloaded / total * 100) if total else 0
                    speed = downloaded / (now - start) / 1024
                    print(f"  {downloaded / 1024 / 1024:.1f}/{total / 1024 / 1024:.1f} MB ({pct:.1f}%) - {speed:.0f} KB/s", flush=True)
                    last_log = now
        print(f"Download complete! Saved {downloaded / 1024 / 1024:.1f} MB in {time.time() - start:.1f}s", flush=True)

if __name__ == "__main__":
    download()
