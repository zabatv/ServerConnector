import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=90):
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


print(run("ls -d /opt/rostrum/node_modules/playwright 2>/dev/null || echo no-playwright"))
print(run("pgrep -af 'npm|npx|apt-get' | grep -v pgrep | head -3 || echo no-procs"))
print(run("ls /opt/rostrum/node_modules | wc -l"))
t.close()
