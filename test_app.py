import app

sent = []
app.handle({"print": {"gcode_state": "RUNNING", "mc_percent": 40, "layer_num": 10,
                      "total_layer_num": 100, "nozzle_temper": 219.8, "subtask_name": "Benchy"}}, sent.append)
app.handle({"print": {"mc_remaining_time": 12}}, sent.append)  # partial update keeps other fields
s = app.status
assert (s["state"], s["progress"], s["remaining"]) == ("RUNNING", 40, 12), s
assert (s["layer"], s["layers"], s["nozzle"], s["name"]) == (10, 100, 219.8, "Benchy"), s
app.handle({"info": {}}, sent.append)  # non-print messages are ignored
app.handle({"print": {"gcode_state": "FINISH", "mc_percent": 100}}, sent.append)
app.handle({"print": {"gcode_state": "FINISH"}}, sent.append)  # repeated FINISH: no second alert
assert sent == ["Print finished!"], sent
app.handle({"print": {"gcode_state": "RUNNING"}}, sent.append)
app.handle({"print": {"gcode_state": "FAILED"}}, sent.append)
assert sent == ["Print finished!", "Print FAILED."], sent
assert app.PAGE.startswith(b"<!doctype html>")
print("ok")
