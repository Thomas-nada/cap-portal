#!/usr/bin/env python3
"""Simple dev server for the frontend. Run from the frontend/ directory."""
import http.server, socketserver, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress per-request logs

    def end_headers(self):
        # Never cache during dev so edited ES modules are always re-fetched
        # (static imports can't be cache-busted with a query string).
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

print(f"Frontend dev server running at http://localhost:{PORT}")
print("Press Ctrl+C to stop.")
# ThreadingHTTPServer: serve concurrent requests so the browser can load the
# many ES module imports in parallel (single-threaded serving drops requests).
with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
