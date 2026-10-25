import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=240):
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


print("services:", run("systemctl is-active rostrum.service chrome-cdp.service | tr '\\n' ' '"))
print("port:", run("ss -ltn | grep -c 4173"))
script = r'''
cd /tmp && rm -f ck2.txt
curl -s -c ck2.txt -o /dev/null -d 'username=operator&password=rostrum-dev-2026' http://127.0.0.1:4173/admin/login
CSRF=$(curl -s -b ck2.txt http://127.0.0.1:4173/admin | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
curl -s -b ck2.txt -o /dev/null -w '%{redirect_url}\n' -d "csrf=$CSRF&nickname=fre5zy" http://127.0.0.1:4173/admin/players/resolve
'''
print("resolve:", run(script, timeout=300)[:200])
print("mappings:", run("ls -la /opt/rostrum/data/ 2>/dev/null | head -3"))
t.close()
