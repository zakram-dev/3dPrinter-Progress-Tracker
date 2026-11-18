# Bambu A1 mini tracker: reads the printer's LAN MQTT feed, serves a progress page,
# and sends a phone alert via ntfy.sh when a print finishes or fails.
import json, os, ssl, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import paho.mqtt.client as mqtt

PRINTER_IP = os.environ.get("PRINTER_IP", "")
SERIAL = os.environ.get("PRINTER_SERIAL", "")
ACCESS_CODE = os.environ.get("ACCESS_CODE", "")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
PORT = int(os.environ.get("PORT", "8080"))

status = {"state": "UNKNOWN", "progress": -1, "remaining": -1}


def notify(msg):
    req = urllib.request.Request(f"https://ntfy.sh/{NTFY_TOPIC}", data=msg.encode(),
                                 headers={"Title": "Bambu A1 mini"})
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print("ntfy failed:", e, flush=True)


def handle(report, notify=notify):
    p = report.get("print")
    if not isinstance(p, dict):
        return
    # The printer sends partial updates, so only overwrite fields that are present.
    if "mc_percent" in p:
        status["progress"] = p["mc_percent"]
    if "mc_remaining_time" in p:
        status["remaining"] = p["mc_remaining_time"]
    s = p.get("gcode_state")
    if s:
        if status["state"] == "RUNNING" and s == "FINISH":
            notify("Print finished!")
        if status["state"] == "RUNNING" and s == "FAILED":
            notify("Print FAILED.")
        status["state"] = s


def on_connect(client, userdata, flags, rc, props):
    print("MQTT connected:", rc, flush=True)
    client.subscribe(f"device/{SERIAL}/report")
    # Ask for a full status dump so we know the state right after (re)start.
    client.publish(f"device/{SERIAL}/request",
                   json.dumps({"pushing": {"sequence_id": "0", "command": "pushall"}}))


def on_message(client, userdata, msg):
    try:
        handle(json.loads(msg.payload))
    except ValueError:
        pass


PAGE = b"""<!doctype html><meta name=viewport content="width=device-width">
<title>A1 mini</title><body style="font-family:sans-serif;max-width:640px;margin:auto;padding:16px">
<h2>A1 mini</h2><p id=st>loading...</p>
<div style="background:#ddd;border-radius:6px"><div id=bar style="height:24px;width:0;background:#2a2;border-radius:6px"></div></div>
<script>
async function tick(){try{const s=await(await fetch('status')).json();
bar.style.width=Math.max(0,s.progress)+'%';
st.textContent=s.state+' - '+s.progress+'% - '+s.remaining+' min left';}catch(e){}}
tick();setInterval(tick,3000);
</script>"""


class Web(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip("/").endswith("status"):
            body, ctype = json.dumps(status).encode(), "application/json"
        else:
            body, ctype = PAGE, "text/html"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    missing = [k for k in ("PRINTER_IP", "PRINTER_SERIAL", "ACCESS_CODE", "NTFY_TOPIC") if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Missing env vars: {', '.join(missing)}")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.username_pw_set("bblp", ACCESS_CODE)
    client.tls_set(cert_reqs=ssl.CERT_NONE)  # the printer uses a self-signed cert
    client.tls_insecure_set(True)
    client.on_connect, client.on_message = on_connect, on_message
    client.connect_async(PRINTER_IP, 8883)  # retries in the background if the printer is off
    client.loop_start()
    print(f"Serving on :{PORT}", flush=True)
    ThreadingHTTPServer(("", PORT), Web).serve_forever()
