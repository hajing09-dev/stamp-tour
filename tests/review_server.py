from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit,unquote
import re

ROOT=Path(__file__).resolve().parents[1]
FIXTURE=Path(__file__).with_name('fixture.js')
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        route=unquote(urlsplit(self.path).path)
        if route=='/__fixture.js':
            return self.send_bytes(FIXTURE.read_bytes(),'text/javascript')
        if route.startswith('/review/'):
            relative=route[len('/review/'):] or 'index.html'
            target=(ROOT/relative).resolve()
            if not target.is_relative_to(ROOT.resolve()) or not target.is_file():return self.send_error(404)
            if target.suffix=='.html':
                source=target.read_text()
                source=re.sub(r'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>','',source)
                source=source.replace('<script src="supabase-init.js"></script>','')
                page='student' if target.stem=='index' else target.stem
                source=source.replace(f'<script src="{page}.js"></script>',f'<script src="/__fixture.js"></script><script src="{page}.js"></script>')
                note='<aside style="font:12px/1.6 system-ui;padding:6px 12px;background:#eee4fa;color:#342a42;text-align:center">로컬 UI 검토 · 예시 데이터 · 실제 서버 미연결 / 운영진 검토 비밀번호: review-only<br><a href="index.html">학생 도장판</a> · <a href="booth.html?boothId=club-code">부스 운영진</a> · <a href="admin.html">관리자</a> · <a href="portal.html?role=admin">운영진 로그인</a></aside>'
                source=source.replace('<body>','<body>'+note)
                return self.send_bytes(source.encode(),'text/html; charset=utf-8')
            return self.send_bytes(target.read_bytes(),self.guess_type(str(target)))
        return self.send_error(404)
    def send_bytes(self,data,kind):
        self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('Content-Security-Policy',"connect-src 'self';");self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description='C안 UI 검토: 실제 서버에 연결하지 않는 예시 화면')
    parser.add_argument('--port',type=int,default=8877)
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'UI review: http://127.0.0.1:{args.port}/review/index.html',flush=True)
    server.serve_forever()
