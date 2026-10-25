import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=400):
    ch = t.open_session()
    ch.settimeout(timeout)
    ch.exec_command(cmd)
    out = b""
    while True:
        data = ch.recv(65536)
        if not data:
            break
        out += data
    ch.close()
    return out.decode(errors="replace").strip()


script = r'''
cd /tmp && rm -f ck4.txt
curl -s -c ck4.txt -o /dev/null -d 'username=operator&password=rostrum-dev-2026' http://127.0.0.1:4173/admin/login
CSRF=$(curl -s -b ck4.txt http://127.0.0.1:4173/admin | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
curl -s -b ck4.txt -o /dev/null -w 'launch: %{http_code} -> %{redirect_url}\n' \
  -d "csrf=$CSRF&player_a=fre5zy&player_b=&display_override=&role=&tournament=&destination_type=internal&destination_url=" \
  http://127.0.0.1:4173/admin/launch
curl -s -o /dev/null -w 'page /p/fre5zy: %{http_code}\n' http://127.0.0.1:4173/p/fre5zy
curl -s http://127.0.0.1:4173/p/fre5zy | grep -o 'card-cover" src="[^"]*' | head -1
curl -s http://127.0.0.1:4173/p/fre5zy | grep -o 'data-testid="elo">[^<]*' | head -1
curl -s http://127.0.0.1:4173/p/fre5zy | grep -o 'Skill level [0-9?]*' | head -1
'''
print(run(script, timeout=400))
t.close()
