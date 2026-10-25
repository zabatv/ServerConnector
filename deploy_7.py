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


print(run("ls /root/.cache/ms-playwright/"))
print(run("find /root/.cache/ms-playwright -maxdepth 3 -name 'chrome' -o -maxdepth 3 -name 'headless_shell' 2>/dev/null | head -5"))
print(run("systemctl status chrome-cdp.service --no-pager -l | head -8"))
t.close()
