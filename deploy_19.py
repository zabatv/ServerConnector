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
cd /tmp && rm -f ck3.txt
curl -s -c ck3.txt -o /dev/null -d 'username=operator&password=rostrum-dev-2026' http://127.0.0.1:4173/admin/login
CSRF=$(curl -s -b ck3.txt http://127.0.0.1:4173/admin | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
time curl -s -b ck3.txt -o /dev/null -w 'resolve: %{http_code} -> %{redirect_url}\n' -d "csrf=$CSRF&nickname=fre5zy" http://127.0.0.1:4173/admin/players/resolve
'''
print(run(script, timeout=400))
t.close()
