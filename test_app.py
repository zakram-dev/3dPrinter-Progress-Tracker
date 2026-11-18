import app

sent = []
app.handle({"print": {"gcode_state": "RUNNING", "mc_percent": 40}}, sent.append)
app.handle({"print": {"mc_remaining_time": 12}}, sent.append)  # partial update keeps other fields
assert app.status == {"state": "RUNNING", "progress": 40, "remaining": 12}, app.status
app.handle({"info": {}}, sent.append)  # non-print messages are ignored
app.handle({"print": {"gcode_state": "FINISH", "mc_percent": 100}}, sent.append)
app.handle({"print": {"gcode_state": "FINISH"}}, sent.append)  # repeated FINISH: no second alert
assert sent == ["Print finished!"], sent
app.handle({"print": {"gcode_state": "RUNNING"}}, sent.append)
app.handle({"print": {"gcode_state": "FAILED"}}, sent.append)
assert sent == ["Print finished!", "Print FAILED."], sent
print("ok")
