"""
Smart Local Server for NSE Breadth Ledger.
- Serves static dashboard files from public/
- Automatically detects if the trading day has ended and fresh bhavcopy is needed
- Runs the pipeline in the background and reloads data upon browser refresh
"""
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import logging
from pathlib import Path
import subprocess
import sys
import threading
import time as time_mod

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SmartBreadthServer")

UPDATE_LOCK = threading.Lock()
IS_UPDATING = False
LAST_CHECK_TIME = 0

def is_market_closed_today():
    """Returns True if today is a weekday and current IST time is past 18:30 IST."""
    now_utc = datetime.utcnow()
    # IST = UTC + 5h 30m
    ist_hours = now_utc.hour + 5 + (now_utc.minute + 30) // 60
    ist_minutes = (now_utc.minute + 30) % 60
    # 0 = Monday, 4 = Friday
    if now_utc.weekday() >= 5:
        return False
    return (ist_hours > 18) or (ist_hours == 18 and ist_minutes >= 30)

def run_pipeline_update():
    global IS_UPDATING
    with UPDATE_LOCK:
        if IS_UPDATING:
            return
        IS_UPDATING = True
    try:
        logger.info("Auto-update started: executing daily pipeline...")
        cmd = [sys.executable, "-m", "pipeline.cli", "run"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            logger.info("Auto-update finished successfully!")
        else:
            logger.warning(f"Pipeline finished with exit code {res.returncode}")
    except Exception as e:
        logger.error(f"Error during auto-update: {e}")
    finally:
        with UPDATE_LOCK:
            IS_UPDATING = False

class SmartBreadthHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def do_GET(self):
        global LAST_CHECK_TIME

        # API endpoint to check / trigger background update
        if self.path.startswith("/api/check-update"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.end_headers()

            triggered = False
            now = time_mod.time()

            # Throttle checks to once every 30 seconds
            if not IS_UPDATING and (now - LAST_CHECK_TIME > 30):
                LAST_CHECK_TIME = now
                data_file = Path("public/data/data.json")
                needs_update = False
                if data_file.exists():
                    try:
                        with open(data_file) as f:
                            dj = json.load(f)
                        last_d = dj.get("asOf", "")[:10].replace("-", "")
                        today_str = datetime.now().strftime("%Y%m%d")
                        if is_market_closed_today() and last_d != today_str:
                            needs_update = True
                    except Exception:
                        pass

                if needs_update or "force=true" in self.path:
                    triggered = True
                    t = threading.Thread(target=run_pipeline_update, daemon=True)
                    t.start()

            resp = {
                "is_updating": IS_UPDATING,
                "triggered": triggered,
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        return super().do_GET()

def start_server(port=8000):
    server = HTTPServer(("0.0.0.0", port), SmartBreadthHandler)
    logger.info(f"Smart Breadth Server listening on http://localhost:{port}")
    server.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_server(port)
