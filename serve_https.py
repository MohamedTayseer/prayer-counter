"""Serve the prayer counter over https on the home network, so a phone can use the camera.

Run:  python serve_https.py
Then open https://<this PC's address>:8443 on the phone (same Wi-Fi) and accept the warning once.
"""
import functools
import http.server
import pathlib
import socket
import ssl

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE / "docs"
CERT = HERE / "https" / "cert.pem"
KEY = HERE / "https" / "key.pem"
PORT = 8443


def local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.168.1.1", 80))  # no packet is sent; this only picks the network card
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT, KEY)
server.socket = ctx.wrap_socket(server.socket, server_side=True)
print(f"Open on the phone:  https://{local_ip()}:{PORT}")
print("Press Ctrl+C to stop.")
server.serve_forever()
