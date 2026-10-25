import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=60):
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


print(run("pgrep -f 'npm install|playwright install' >/dev/null && echo RUNNING || echo DONE"))
print(run("tail -4 /opt/rostrum/setup.log")[-800:])
print(run("ls /root/.cache/ms-playwright 2>/dev/null || echo no-browsers"))
t.close()
