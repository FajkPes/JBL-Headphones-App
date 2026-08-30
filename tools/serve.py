"""Local server for the JBL Headphones App.

Proti `python -m http.server`:
  * vice vlaken — prohlizec otevira nekolik spojeni naraz (moduly, favicon).
    Jednovlaknovy server se na tom zablokuje a stranka se "nacita" donekonecna.
  * HTTP/1.1 s keep-alive
  * hlavicky, ktere vypnou cache, aby se projevily zmeny v .js modulech
  * endpoint /_ping, podle ktereho appka pozna, ze server bezi
"""
import json
import os
import sys
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app')
STARTED = time.time()


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'JBLApp'
    sys_version = ''

    def do_GET(self):
        if self.path.split('?')[0] == '/_ping':
            body = json.dumps({
                'ok': True,
                'uptime': round(time.time() - STARTED, 1),
                'root': ROOT,
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        msg = fmt % args
        if ' 404 ' in msg or ' 500 ' in msg:
            sys.stderr.write(f"  error: {msg}\n")

    def handle_one_request(self):
        # Prohlizec bezne zavira spojeni uprostred; nechceme kvuli tomu
        # vypisovat zasobniky do konzole.
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True


def main():
    if not os.path.isdir(ROOT):
        print(f"  ERROR: the app folder does not exist: {ROOT}")
        return 1
    print()
    print(f"  Server running at  http://localhost:{PORT}/")
    print()
    print(f"    model picker  http://localhost:{PORT}/select.html")
    print(f"    TUNE 780NC    http://localhost:{PORT}/index.html?dev=tune780nc")
    print(f"    TUNE 720BT    http://localhost:{PORT}/index.html?dev=tune720bt")
    print()
    print("  Browser caching is disabled; F5 is enough after a change.")
    print("  Keep this window open. Press Ctrl+C to stop the server.")
    print()
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=ROOT))
    srv.daemon_threads = True
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
    finally:
        srv.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
