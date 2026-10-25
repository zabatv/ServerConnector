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


print("UNIT:", run("head -12 /etc/systemd/system/chrome-cdp.service"))
print("RESTART:", run("systemctl stop chrome-cdp.service; sleep 1; systemctl start chrome-cdp.service 2>&1; sleep 4; systemctl is-active chrome-cdp.service"))
print("PROC:", run("pgrep -af 'chrome.*remote-debugging' | head -2"))
print("CDP:", run("curl -s http://127.0.0.1:9222/json/version | head -c 120"))
print("XVFB:", run("pgrep -af Xvfb | head -2"))
t.close()
