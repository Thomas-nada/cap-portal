#!/usr/bin/env python3
"""Simple dev server for the frontend. Serves ../frontend/ (the static-site root).

Lives outside frontend/ so it is not published with the site."""
import http.server, http.client, socket, socketserver, os, re, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
# Local backend that /api/* is forwarded to (see _proxy below).
API_HOST, API_PORT = "127.0.0.1", 8000
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress per-request logs

    def end_headers(self):
        # Never cache during dev so edited ES modules are always re-fetched
        # (static imports can't be cache-busted with a query string).
        self.send_header("Cache-Control", "no-store, must-revalidate")
        # Advertise range support so <video> knows it can seek.
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    # /api/* is forwarded to the local backend. This is what lets a phone on the
    # same Wi-Fi test the portal at http://<this-PC's-IP>:8765 — the page and the
    # API share one origin, so nothing needs to change in the CSP, in CORS, or in
    # how the backend is started (it can stay bound to 127.0.0.1).
    def _proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in ("host", "origin", "connection", "accept-encoding")}
        try:
            conn = http.client.HTTPConnection(API_HOST, API_PORT, timeout=60)
            conn.request(self.command, self.path[len("/api"):] or "/", body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
        except OSError:
            self.send_error(502, f"Backend not reachable on {API_HOST}:{API_PORT}")
            return
        self.send_response(resp.status)
        for k, v in resp.getheaders():
            if k.lower() not in ("transfer-encoding", "connection", "content-length", "server", "date"):
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        conn.close()

    def _is_api(self):
        return self.path == "/api" or self.path.startswith("/api/")

    # Opened through anything other than localhost (a LAN address, or an HTTPS
    # tunnel such as cloudflared whose hostname the frontend can't recognise),
    # the frontend must use the /api proxy above. config.js only detects IP
    # addresses by itself, so serve it with that switch forced on.
    def _serve_config(self):
        with open("js/config.js", encoding="utf-8") as f:
            src = f.read()
        src = re.sub(r"^const _isLan = .*$", "const _isLan = true;", src, count=1, flags=re.M)
        data = src.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _is_remote(self):
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0]
        return host not in ("localhost", "127.0.0.1")

    def do_GET(self):
        if self._is_api():
            return self._proxy()
        if self.path.split("?")[0] == "/js/config.js" and self._is_remote():
            return self._serve_config()
        return super().do_GET()

    def do_HEAD(self):
        return self._proxy() if self._is_api() else super().do_HEAD()

    def _api_only(self):
        return self._proxy() if self._is_api() else self.send_error(405)

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = _api_only

    # http.server has no Range support, so <video> can't seek (the browser's
    # scrub bar relies on byte-range requests to jump to an arbitrary point).
    def send_head(self):
        path = self.translate_path(self.path)
        range_header = self.headers.get("Range")
        if not range_header or not os.path.isfile(path):
            return super().send_head()

        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not match:
            return super().send_head()

        file_size = os.path.getsize(path)
        start_s, end_s = match.groups()
        start = int(start_s) if start_s else 0
        end = int(end_s) if end_s else file_size - 1
        end = min(end, file_size - 1)
        if start >= file_size or start > end:
            self.send_error(416, "Requested Range Not Satisfiable")
            return None

        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        ctype = self.guess_type(path)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range = (start, end)
        return f

    def copyfile(self, source, outputfile):
        if hasattr(self, "_range"):
            start, end = self._range
            remaining = end - start + 1
            bufsize = 64 * 1024
            while remaining > 0:
                chunk = source.read(min(bufsize, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        else:
            super().copyfile(source, outputfile)

def _lan_ips():
    # Addresses other devices on the network can use to reach this machine.
    # A machine can have several (Wi-Fi, Ethernet, a VPN), and the "default"
    # one is often the VPN's, which a phone can't reach — so list them all.
    ips = []
    try:
        ips += socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        pass
    try:
        # No packet is sent; connecting a UDP socket just picks an interface.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("10.255.255.255", 1))
            ips.append(sock.getsockname()[0])
    except OSError:
        pass
    # Drop loopback and self-assigned (169.254.x.x) addresses.
    return sorted({ip for ip in ips if not ip.startswith(("127.", "169.254."))})

print(f"Frontend dev server running at http://localhost:{PORT}")
_ips = _lan_ips()
if _ips:
    print("On a phone on the same network, open one of (type http:// explicitly):")
    for _ip in _ips:
        print(f"    http://{_ip}:{PORT}")
    if len(_ips) > 1:
        print("  Use your Wi-Fi/Ethernet address (usually 192.168.x.x), not a VPN's.")
print("Press Ctrl+C to stop.")
# ThreadingHTTPServer: serve concurrent requests so the browser can load the
# many ES module imports in parallel (single-threaded serving drops requests).
with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
