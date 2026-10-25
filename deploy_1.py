import paramiko, sys

HOST, USER, PWD = "2.26.125.147", "root", "Um0VzzWeyokurWM3"


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=20, banner_timeout=20, auth_timeout=20)
    return c


def run(c, cmd, timeout=600):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    print("$", cmd[:140])
    if out: print(out)
    if err: print("ERR:", err[-1200:])
    return out


c = connect()
try:
    # Node 24 static build next to the system node (v20 lacks node:sqlite)
    run(c, "ls /opt/node24/bin/node 2>/dev/null || (curl -fsSL https://nodejs.org/dist/v24.10.0/node-v24.10.0-linux-x64.tar.xz -o /tmp/node24.tar.xz && mkdir -p /opt/node24 && tar -xJf /tmp/node24.tar.xz -C /opt/node24 --strip-components=1 && /opt/node24/bin/node -v)")

    # upload the project
    sftp = c.open_sftp()
    run(c, "mkdir -p /opt/rostrum")
    sftp.put(r"D:\Desktop\rostrum-deploy.tgz", "/tmp/rostrum.tgz")
    sftp.close()
    run(c, "tar -xzf /tmp/rostrum.tgz -C /opt/rostrum && ls /opt/rostrum")
finally:
    c.close()
