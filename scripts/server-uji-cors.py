"""HTTP server uji kecil dengan header CORS * (untuk fetch sampel dari halaman produksi)."""
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

os.chdir('/tmp/uji-foto')


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


HTTPServer(('127.0.0.1', 3334), Handler).serve_forever()
