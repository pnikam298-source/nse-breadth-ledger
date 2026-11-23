"""
Smart Local Server for NSE Breadth Ledger.
- Serves static dashboard files from public/
- Active Background Daemon: Automatically downloads and processes daily Bhavcopy as soon as market closes (from 18:15 IST onwards)
- Intercepts page requests to auto-trigger pipeline if today's session is missing
- Provides /api/check-update and /api/status for interactive frontend synchronization
"""
from datetime import datetime, timezone, timedelta
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
LAST_UPDATE_STATUS = "idle"
LAST_UPDATE_ERROR = ""
LAST_UPDATE_SUCCESS_DATE = ""

def get_ist_now():
    """Current timestamp in Indian Standard Time (UTC + 5:30)."""
    return datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)

def is_weekday_today():
    """Returns True if today is Monday (0) through Friday (4)."""
    return get_ist_now().weekday() < 5

def is_market_closed_today():
    """Returns True if today is a weekday and current IST time is past 18:00 IST."""
    ist_now = get_ist_now()
    if not is_weekday_today():
        return False
    # Market closes at 15:30 IST; Bhavcopies start appearing between 18:00 and 18:45 IST
    return ist_now.hour >= 18

def get_stored_data_date():
    """Reads the last session date from public/data/data.json."""
    data_file = Path("public/data/data.json")
    if not data_file.exists():
        return ""
    try:
        with open(data_file) as f:
            dj = json.load(f)
        return str(dj.get("lastStored", ""))
    except Exception:
        return ""

def check_needs_update(force=False):
    """Determines whether today's Bhavcopy needs to be downloaded and processed."""
    if force:
        return True
    if not is_market_closed_today():
        return False
    today_str = get_ist_now().strftime("%Y%m%d")
    stored_str = get_stored_data_date()
    return stored_str != today_str

def run_pipeline_update(force=False):
    """Runs the data pipeline to ingest, compute metrics, and regenerate data.json."""
    global IS_UPDATING, LAST_UPDATE_STATUS, LAST_UPDATE_ERROR, LAST_UPDATE_SUCCESS_DATE
    with UPDATE_LOCK:
        if IS_UPDATING:
            return False
        IS_UPDATING = True

    LAST_UPDATE_STATUS = "running"
    LAST_UPDATE_ERROR = ""
    today_str = get_ist_now().strftime("%Y%m%d")

    try:
        logger.info(f"Auto-update pipeline initiated for session {today_str}...")
        cmd = [sys.executable, "-m", "pipeline.cli", "run"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if res.returncode == 0:
            logger.info("Pipeline executed successfully! Today's Bhavcopy processed & published.")
            LAST_UPDATE_STATUS = "success"
            LAST_UPDATE_SUCCESS_DATE = today_str

            # Rebuild frontend bundle & sync to GitHub Pages automatically
            try:
                logger.info("Rebuilding frontend bundle...")
                subprocess.run(["npm", "run", "build"], capture_output=True, text=True, timeout=120)
                logger.info("Pushing latest data to GitHub Pages...")
                subprocess.run(["git", "add", "."], capture_output=True, text=True, timeout=60)
                subprocess.run(["git", "commit", "-m", f"chore(data): auto-sync market breadth for {today_str} [skip ci]"], capture_output=True, text=True, timeout=60)
                subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True, timeout=120)
                logger.info("GitHub Pages deployment triggered successfully!")
            except Exception as pe:
                logger.warning(f"Could not auto-push to GitHub: {pe}")

            return True
        else:
            err = res.stderr.strip() or res.stdout.strip()
            logger.warning(f"Pipeline returned code {res.returncode}: {err[-200:] if err else 'Unknown error'}")
            LAST_UPDATE_STATUS = "bhavcopy_pending"
            LAST_UPDATE_ERROR = "Bhavcopy not yet published by NSE or validation check pending"
            return False
    except Exception as e:
        logger.error(f"Error executing pipeline: {e}")
        LAST_UPDATE_STATUS = "error"
        LAST_UPDATE_ERROR = str(e)
        return False
    finally:
        with UPDATE_LOCK:
            IS_UPDATING = False

def auto_update_daemon():
    """
    Dedicated background thread that continuously checks every 60 seconds.
    If market has closed and today's Bhavcopy has not yet been processed,
    it automatically downloads and updates data without requiring user interaction.
    """
    logger.info("Auto-update daemon started. Polling active for weekday market-close sessions.")
    while True:
        try:
            if check_needs_update():
                logger.info("Daemon detected missing Bhavcopy for today's session. Triggering automatic update...")
                success = run_pipeline_update()
                if success:
                    # Sleep 30 minutes after successful update to prevent repeated runs
                    time_mod.sleep(1800)
                else:
                    # If Bhavcopy not ready yet, wait 3 minutes before retrying
                    time_mod.sleep(180)
            else:
                # Normal check interval: 60 seconds
                time_mod.sleep(60)
        except Exception as e:
            logger.error(f"Error in auto_update_daemon loop: {e}")
            time_mod.sleep(60)

class SmartBreadthHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def end_headers(self):
        # Prevent browser from serving stale cached HTML or JSON data
        clean_path = self.path.split("?")[0]
        if clean_path.endswith(".json") or clean_path in ["", "/", "/index.html"]:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        global LAST_CHECK_TIME

        # API endpoint to check or trigger background update
        if self.path.startswith("/api/check-update") or self.path.startswith("/api/status"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.end_headers()

            force = "force=true" in self.path
            needs_update = check_needs_update(force=force)
            triggered = False

            now = time_mod.time()
            if needs_update and not IS_UPDATING and (now - LAST_CHECK_TIME > 10):
                LAST_CHECK_TIME = now
                triggered = True
                t = threading.Thread(target=run_pipeline_update, args=(force,), daemon=True)
                t.start()

            resp = {
                "is_updating": IS_UPDATING,
                "triggered": triggered,
                "needs_update": needs_update,
                "status": LAST_UPDATE_STATUS,
                "error": LAST_UPDATE_ERROR,
                "last_stored_date": get_stored_data_date(),
                "today_ist": get_ist_now().strftime("%Y%m%d"),
                "is_market_closed": is_market_closed_today(),
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # On direct browser page request, if today is missing, proactively trigger update in background
        if self.path in ["/", "/index.html", "/data/data.json"]:
            now = time_mod.time()
            if check_needs_update() and not IS_UPDATING and (now - LAST_CHECK_TIME > 60):
                LAST_CHECK_TIME = now
                logger.info("Browser request detected stale data. Launching background pipeline update...")
                t = threading.Thread(target=run_pipeline_update, daemon=True)
                t.start()

        return super().do_GET()

def start_server(port=8000):
    # Start auto-update daemon in background
    daemon_thread = threading.Thread(target=auto_update_daemon, daemon=True)
    daemon_thread.start()

    server = HTTPServer(("0.0.0.0", port), SmartBreadthHandler)
    logger.info(f"Smart Breadth Server listening on http://localhost:{port}")
    server.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_server(port)
