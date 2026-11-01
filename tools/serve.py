"""Local dev server: like `python3 -m http.server`, but tells the browser to re-check every file.

Python's built-in server sends no Cache-Control header, so browsers guess how long a file stays fresh
(about 10% of its age). After an edit you could get new JS with an old stylesheet. `no-cache` makes the
browser revalidate each load; unchanged files come back as a cheap 304.

    python3 tools/serve.py [port]        # run from the ebook3d folder, or pass --directory
"""
import argparse
import functools
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('port', nargs='?', type=int, default=5180)
    ap.add_argument('--directory', default='.')
    args = ap.parse_args()
    handler = functools.partial(NoCacheHandler, directory=args.directory)
    with http.server.ThreadingHTTPServer(('', args.port), handler) as httpd:
        print(f'Serving {args.directory} on http://localhost:{args.port} (no-cache)')
        httpd.serve_forever()
