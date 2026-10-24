import httpx
import os
import subprocess
import sys

PACKAGES = ["fsspec", "cramjam", "fastparquet"]

def get_wheel_url(pkg_name: str) -> str:
    api_url = f"https://pypi.org/pypi/{pkg_name}/json"
    r = httpx.get(api_url, timeout=15.0)
    r.raise_for_status()
    urls = r.json().get("urls", [])
    for u in urls:
        fname = u.get("filename", "")
        if "cp312-cp312-win_amd64" in fname or ("cp312" in fname and "win_amd64" in fname) or "py3-none-any" in fname:
            return u["url"]
    for u in urls:
        if u.get("filename", "").endswith(".whl") and "win_amd64" in u.get("filename", ""):
            return u["url"]
    raise ValueError(f"No suitable wheel found for {pkg_name}")

def install_engine():
    wheels = []
    for pkg in PACKAGES:
        url = get_wheel_url(pkg)
        fname = url.split("/")[-1]
        wheels.append(fname)
        if not os.path.exists(fname):
            print(f"Downloading {fname} from {url}...", flush=True)
            r = httpx.get(url, timeout=60.0)
            r.raise_for_status()
            with open(fname, "wb") as f:
                f.write(r.content)
            print(f"  Saved {fname} ({len(r.content)/1024:.1f} KB)", flush=True)
        else:
            print(f"Using cached {fname}", flush=True)

    print("Installing wheels via pip...", flush=True)
    cmd = [sys.executable, "-m", "pip", "install", "--no-deps"] + wheels
    subprocess.check_call(cmd)

    import pandas as pd
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    df.to_parquet("test.parquet")
    print("SUCCESS: Parquet engine (fastparquet) installed and verified!", flush=True)
    if os.path.exists("test.parquet"):
        os.remove("test.parquet")

if __name__ == "__main__":
    install_engine()
