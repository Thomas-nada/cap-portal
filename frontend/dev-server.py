#!/usr/bin/env python3
"""Simple dev server for the frontend. Run from the frontend/ directory."""
import http.server, socketserver, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress per-request logs

print(f"Frontend dev server running at http://localhost:{PORT}")
print("Press Ctrl+C to stop.")
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
