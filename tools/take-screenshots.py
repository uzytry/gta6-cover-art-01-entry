# Takes the entry's screenshots with headless Chromium: serves app/ locally,
# opens each ?shot= scene from shots.json, waits on virtual time for the scene
# to paint (window.__shotReady), captures a PNG, then encodes it as a JPEG that
# fits the gate (at most 256 KiB, long side at most 1280, short side at least
# 480). Run: python3 tools/take-screenshots.py
import json
import os
import subprocess
import sys
import time
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SHOTS = os.path.join(ROOT, "shots.json")
OUTDIR = os.path.join(ROOT, "screenshots")
CHROME = os.path.expanduser("~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome")
PORT = 8091
MAX_BYTES = 262144
# Headless Chrome's --window-size counts 87 px the viewport never gets (its
# headless shell reservation), so the window is opened taller and the capture
# is cropped back to the shot's height.
WINDOW_CHROME_PX = 87


def wait_for_server(url, timeout=20):
    for _ in range(int(timeout * 2)):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def main():
    with open(SHOTS) as f:
        shots = json.load(f)
    os.makedirs(OUTDIR, exist_ok=True)
    server = subprocess.Popen(
        ["node", "serve.ts", "--port", str(PORT)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        if not wait_for_server(f"http://127.0.0.1:{PORT}/"):
            print("server did not come up")
            return 1
        for shot in shots:
            name = shot["name"]
            png = f"/tmp/shot-{name}.png"
            url = f"http://127.0.0.1:{PORT}/{shot['query']}"
            cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
                   "--disable-dev-shm-usage", "--hide-scrollbars",
                   "--force-device-scale-factor=1",
                   f"--window-size={shot['w']},{shot['h'] + WINDOW_CHROME_PX}",
                   "--virtual-time-budget=15000",
                   f"--screenshot={png}", url]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            err = proc.stderr or ""
            problems = [l for l in err.splitlines()
                        if "Uncaught" in l or "Failed to load" in l or "ERROR:CONSOLE" in l]
            if problems:
                print(f"{name}: console problems:")
                for l in problems[:6]:
                    print("   ", l)
            if not os.path.exists(png):
                print(f"{name}: no screenshot captured")
                return 1
            img = Image.open(png).convert("RGB")
            if img.size[1] > shot["h"]:
                img = img.crop((0, 0, shot["w"], shot["h"]))
            if img.size != (shot["w"], shot["h"]):
                print(f"{name}: captured {img.size}, expected {(shot['w'], shot['h'])}")
            out_path = os.path.join(OUTDIR, name)
            quality = 88
            while quality >= 55:
                img.save(out_path, "JPEG", quality=quality)
                if os.path.getsize(out_path) <= MAX_BYTES:
                    break
                quality -= 6
            size = os.path.getsize(out_path)
            status = "OK" if size <= MAX_BYTES else "TOO BIG"
            print(f"{name}: {img.size} q={quality} {size} bytes {status}")
            if size > MAX_BYTES:
                return 1
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
    return 0


if __name__ == "__main__":
    sys.exit(main())
