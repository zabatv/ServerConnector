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


for i in range(20):
    time.sleep(15)
    tail = run("tail -3 /opt/rostrum/setup.log 2>/dev/null; pgrep -f 'npm install|playwright install' >/dev/null && echo RUNNING || echo DONE")
    print(f"--- {i * 15 + 15}s ---")
    print(tail[-1200:])
    if tail.endswith("DONE") or "DONE" in tail.splitlines()[-1:]:
        pass
    if "DONE" in tail:
        break
print("FINAL LOG:")
print(run("tail -12 /opt/rostrum/setup.log")[-1500:])
t.close()
