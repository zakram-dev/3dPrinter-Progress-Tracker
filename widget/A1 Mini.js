// Scriptable widget for the A1 mini tracker.
// Home Screen: Small or Medium. Lock Screen: Rectangular, Circular or Inline.
// Works on home Wi-Fi only (the Pi isn't exposed to the internet).
const STATUS_URL = "http://192.168.12.215:8095/status"
const PAGE_URL = "http://192.168.12.215:8095"

const STATES = {
  RUNNING: ["Printing", "#30D158"],
  PREPARE: ["Preparing", "#64D2FF"],
  PAUSE: ["Paused", "#FF9F0A"],
  FINISH: ["Done", "#30D158"],
  FAILED: ["Failed", "#FF453A"],
  IDLE: ["Idle", "#8E8E93"],
}

async function load() {
  try {
    const r = new Request(STATUS_URL)
    r.timeoutInterval = 5
    return await r.loadJSON()
  } catch (e) {
    return null
  }
}

const fmt = (min) => {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function eta(min) {
  const f = new DateFormatter()
  f.useNoDateStyle()
  f.useShortTimeStyle()
  return f.string(new Date(Date.now() + min * 60000))
}

function pill(ctx, rect, color) {
  const p = new Path()
  p.addRoundedRect(rect, rect.height / 2, rect.height / 2)
  ctx.addPath(p)
  ctx.setFillColor(color)
  ctx.fillPath()
}

function bar(w, h, frac, fill, track) {
  const c = new DrawContext()
  c.size = new Size(w, h)
  c.opaque = false
  c.respectScreenScale = true
  pill(c, new Rect(0, 0, w, h), track)
  if (frac > 0) pill(c, new Rect(0, 0, Math.max(h, w * frac), h), fill)
  return c.getImage()
}

function ring(size, frac, label) {
  const c = new DrawContext()
  c.size = new Size(size, size)
  c.opaque = false
  c.respectScreenScale = true
  const lw = size * 0.1, r = (size - lw) / 2, mid = size / 2
  c.setLineWidth(lw)
  c.setStrokeColor(new Color("#FFFFFF", 0.25))
  c.strokeEllipse(new Rect(lw / 2, lw / 2, size - lw, size - lw))
  if (frac > 0) {
    const n = Math.max(2, Math.round(120 * frac)), pts = []
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * frac * (i / n)
      pts.push(new Point(mid + r * Math.cos(a), mid + r * Math.sin(a)))
    }
    const p = new Path()
    p.addLines(pts)
    c.addPath(p)
    c.setStrokeColor(Color.white())
    c.strokePath()
  }
  const fs = size * 0.3
  c.setFont(Font.boldRoundedSystemFont(fs))
  c.setTextColor(Color.white())
  c.setTextAlignedCenter()
  c.drawTextInRect(label, new Rect(0, mid - fs * 0.62, size, fs * 1.4))
  return c.getImage()
}

const s = await load()
const fam = config.widgetFamily || "medium"
const [label, hex] = s ? STATES[s.state] || [s.state, "#8E8E93"] : ["Offline", "#8E8E93"]
const accent = new Color(hex)
const active = !!s && ["RUNNING", "PAUSE", "PREPARE"].includes(s.state)
const done = s?.state === "FINISH"
const pct = s ? Math.max(0, s.progress) : 0
const frac = done ? 1 : active ? pct / 100 : 0
const big = active || done ? `${done ? 100 : pct}%` : label
const sub = active && s.remaining > 0 ? `${fmt(s.remaining)} left · ${eta(s.remaining)}`
  : done ? "Ready to collect"
  : s ? "Printer is idle"
  : "Can't reach the Pi"

// Bottom line. While printing, iOS ticks the countdown every second on its own, between refreshes.
// shortcut: printer reports whole minutes, so the countdown can be up to ~1 min off until the next refresh.
// Layout: countdown on the left edge, finish time on the right edge, same width as the bar.
// (A timer's text always takes all free width, so anything placed right after it leaves a gap.)
function addSub(parent, size, color, width) {
  const row = parent.addStack()
  if (width) row.size = new Size(width, 0)
  row.centerAlignContent()
  const font = Font.mediumRoundedSystemFont(size)
  if (s?.state === "RUNNING" && s.remaining > 0) {
    const d = row.addDate(new Date(Date.now() + s.remaining * 60000))
    d.applyTimerStyle()
    d.leftAlignText()
    d.font = font
    d.textColor = color
    d.lineLimit = 1
    if (size < 12) return // small widget: countdown only
    const t = row.addText(`ends ${eta(s.remaining)}`)
    t.font = font
    t.textColor = color
    t.lineLimit = 1
    t.minimumScaleFactor = 0.8
  } else {
    const t = row.addText(sub)
    row.addSpacer()
    t.font = font
    t.textColor = color
    t.lineLimit = 1
    t.minimumScaleFactor = 0.8
  }
}

const w = new ListWidget()
w.url = PAGE_URL
// iOS throttles refreshes anyway; this just asks for "soon" while printing.
w.refreshAfterDate = new Date(Date.now() + (active ? 60 : 900) * 1000)

if (fam === "accessoryInline") {
  w.addText(active && s.remaining > 0 ? `${pct}% · ${fmt(s.remaining)} left` : active ? `${pct}% · ${label}` : `A1 mini · ${label}`)
} else if (fam === "accessoryCircular") {
  w.addAccessoryWidgetBackground = true
  const img = w.addImage(ring(64, frac, active ? `${pct}` : done ? "✓" : "–"))
  img.imageSize = new Size(64, 64)
  img.centerAlignImage()
} else if (fam === "accessoryRectangular") {
  const top = w.addStack()
  top.centerAlignContent()
  const name = top.addText(active || done ? label : "A1 mini")
  name.font = Font.semiboldRoundedSystemFont(14)
  top.addSpacer()
  const p = top.addText(active || done ? big : label)
  p.font = Font.boldRoundedSystemFont(14)
  w.addSpacer(5)
  const img = w.addImage(bar(150, 6, frac, Color.white(), new Color("#FFFFFF", 0.25)))
  img.imageSize = new Size(150, 6)
  w.addSpacer(5)
  addSub(w, 12, new Color("#FFFFFF", 0.75), 150)
} else {
  const small = fam === "small"
  const g = new LinearGradient()
  g.colors = [new Color("#1C1C1E"), new Color("#0A0A0B")]
  g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(16, 16, 16, 16)

  const top = w.addStack()
  top.centerAlignContent()
  const dot = top.addText("●")
  dot.font = Font.systemFont(8)
  dot.textColor = accent
  top.addSpacer(6)
  const st = top.addText(label.toUpperCase())
  st.font = Font.semiboldRoundedSystemFont(11)
  st.textColor = new Color("#FFFFFF", 0.55)
  top.addSpacer()
  if (!small) {
    const n = top.addText("A1 mini")
    n.font = Font.semiboldRoundedSystemFont(11)
    n.textColor = new Color("#FFFFFF", 0.35)
  }

  w.addSpacer()
  const b = w.addText(big)
  b.font = Font.boldRoundedSystemFont(small ? 38 : 44)
  b.textColor = Color.white()
  b.minimumScaleFactor = 0.5
  b.lineLimit = 1

  w.addSpacer(10)
  // No fixed size: the bar scales to the widget's full width on any iPhone (width:height ratio kept).
  w.addImage(bar(small ? 130 : 350, 8, frac, accent, new Color("#FFFFFF", 0.12)))

  w.addSpacer(8)
  addSub(w, small ? 11 : 12, new Color("#FFFFFF", 0.55))
}

if (config.runsInWidget) Script.setWidget(w)
else await w.presentMedium()
Script.complete()
