import json
import urllib.request
from pathlib import Path

video_path = Path(__file__).resolve().parent / "test_sample_face.mp4"
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

with open(video_path, "rb") as f:
    video_bytes = f.read()

header = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="video"; filename="test_sample_face.mp4"\r\n'
    f"Content-Type: video/mp4\r\n\r\n"
).encode("utf-8")
footer = f"\r\n--{boundary}--\r\n".encode("utf-8")
body = header + video_bytes + footer

req = urllib.request.Request(
    "http://127.0.0.1:5000/detect",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST",
)

print("Sending live POST to http://127.0.0.1:5000/detect...")
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode())
print("Live HTTP Response status:", res.status)
print("Response JSON:")
print(json.dumps(data, indent=2))
assert data["status"] == "success"
assert data["prediction"] in ["REAL", "FAKE"]
print("PASS: Live end-to-end video inference succeeded over HTTP!")
