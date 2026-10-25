import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=150):
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


sftp = paramiko.SFTPClient.from_transport(t)
sftp.put(r"D:\Desktop\rostrum\src\server.js", "/opt/rostrum/src/server.js")
sftp.close()
print(run("systemctl restart rostrum.service; sleep 2; systemctl is-active rostrum.service"))
print("headers:", run("curl -sI http://127.0.0.1:4173/admin | grep -i referrer"))
t.close()
