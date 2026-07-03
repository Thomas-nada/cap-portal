#!/usr/bin/env python3
"""Simple dev server for the frontend. Run from the frontend/ directory."""
import http.server, socketserver, os, re, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

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

print(f"Frontend dev server running at http://localhost:{PORT}")
print("Press Ctrl+C to stop.")
# ThreadingHTTPServer: serve concurrent requests so the browser can load the
# many ES module imports in parallel (single-threaded serving drops requests).
with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
