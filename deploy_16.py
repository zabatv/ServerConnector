import os
import time
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


for i in range(6):
    time.sleep(5)
    state = run("systemctl is-active chrome-cdp.service")
    cdp = run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version")
    print(i * 5 + 5, "s:", state, "| cdp:", cdp)
    if cdp == "200":
        break
print("PROC:", run("pgrep -af 'chrome-linux64/chrome' | grep -v type= | head -2"))
t.close()
