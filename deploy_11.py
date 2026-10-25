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


print(run("ufw status 2>/dev/null | head -5 || echo no-ufw"))
print(run("iptables -S INPUT 2>/dev/null | head -10 || echo no-iptables"))
print(run("nft list ruleset 2>/dev/null | head -20 || echo no-nft"))
print(run("ss -ltn | grep 4173"))
t.close()
