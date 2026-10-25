import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=120):
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


print(run("systemctl daemon-reload && systemctl restart chrome-cdp.service; sleep 5; systemctl is-active chrome-cdp.service"))
print("PROC:", run("pgrep -af 'chrome-linux64/chrome --remote' | head -1"))
print("XVFB:", run("pgrep -a Xvfb | head -2"))
print("CDP:", run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version"))
t.close()
