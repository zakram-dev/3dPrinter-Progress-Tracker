# 3D Printer Progress Tracker

Watches a Bambu Lab A1 mini over its LAN MQTT feed, shows a progress page, and sends a phone alert via [ntfy](https://ntfy.sh) when a print finishes or fails.

## Run

```bash
cp .env.example .env   # fill in printer IP, serial, access code, ntfy topic
docker compose up -d --build
```

Open `http://<host>:8095`. Install the ntfy app on your phone and subscribe to your `NTFY_TOPIC`.

If logs (`docker compose logs -f`) never show `MQTT connected`, enable **LAN Only** and **Developer Mode** on the printer.

## Test

```bash
pip install paho-mqtt && python test_app.py
```
