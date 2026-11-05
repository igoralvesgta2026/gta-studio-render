# Servidor HTTP local com suporte a Range (necessário para pular no tempo de vídeo/áudio no navegador).
# uso: python servidor_range.py <pasta> <porta>
import os, re, sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class H(SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        size = os.path.getsize(path)
        a = int(m.group(1)) if m and m.group(1) else 0
        b = int(m.group(2)) if m and m.group(2) else size - 1
        if m and not m.group(1) and m.group(2):
            a, b = size - int(m.group(2)), size - 1
        b = min(b, size - 1)
        if a > b:
            self.send_error(416); return None
        f = open(path, "rb"); f.seek(a)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {a}-{b}/{size}")
        self.send_header("Content-Length", str(b - a + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self._resto = b - a + 1
        return f

    def copyfile(self, src, dst):
        n = getattr(self, "_resto", None)
        if n is None:
            return super().copyfile(src, dst)
        while n > 0:
            buf = src.read(min(65536, n))
            if not buf: break
            try: dst.write(buf)
            except (ConnectionResetError, BrokenPipeError): break
            n -= len(buf)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a): pass


class S(ThreadingHTTPServer):
    request_queue_size = 256   # muitos navegadores/agentes ao mesmo tempo
    daemon_threads = True


if __name__ == "__main__":
    pasta, porta = sys.argv[1], int(sys.argv[2])
    S(("0.0.0.0", porta), partial(H, directory=pasta)).serve_forever()
