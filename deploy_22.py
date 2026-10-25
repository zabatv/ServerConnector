import os
import paramiko

HOST, USER, PWD = "2.26.125.147", "root", "Um0VzzWeyokurWM3"
LOCAL = r"D:\Desktop\rostrum"

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, PWD)

sftp = paramiko.SFTPClient.from_transport(t)


def run(cmd, timeout=200):
    ch = t.open_session()
    ch.settimeout(timeout)
    ch.exec_command(cmd)
    out = b""
    err = b""
    while True:
        if ch.recv_ready():
            out += ch.recv(65536)
        if ch.recv_stderr_ready():
            err += ch.recv_stderr(65536)
        if ch.exit_status_ready() and not ch.recv_ready() and not ch.recv_stderr_ready():
            break
    ch.close()
    o = out.decode(errors="replace").strip()
    e = err.decode(errors="replace").strip()
    print("$", cmd[:90])
    if o: print(o[-2000:])
    if e: print("ERR:", e[-600:])
    print()
    return o


def ensure_dir(path):
    try:
        sftp.stat(path)
    except FileNotFoundError:
        sftp.mkdir(path)


def push(local_path, remote_path):
    sftp.put(local_path, remote_path)
    print("up", remote_path)


# --- 1. sync src (incl. new src/shell) + public --------------------------

ensure_dir("/opt/rostrum/src/shell")
for name in os.listdir(os.path.join(LOCAL, "src", "shell")):
    push(os.path.join(LOCAL, "src", "shell", name), f"/opt/rostrum/src/shell/{name}")

for name in os.listdir(os.path.join(LOCAL, "src")):
    p = os.path.join(LOCAL, "src", name)
    if os.path.isfile(p):
        push(p, f"/opt/rostrum/src/{name}")

ensure_dir("/opt/rostrum/public/fonts")
for name in os.listdir(os.path.join(LOCAL, "public")):
    p = os.path.join(LOCAL, "public", name)
    if os.path.isfile(p):
        push(p, f"/opt/rostrum/public/{name}")

for name in os.listdir(os.path.join(LOCAL, "public", "fonts")):
    push(os.path.join(LOCAL, "public", "fonts", name), f"/opt/rostrum/public/fonts/{name}")

# --- 2. .env without the demo line --------------------------------------

env = "\n".join([
    "PORT=4173",
    "BIND=0.0.0.0",
    "ADMIN_USER=operator",
    "ADMIN_PASS=rostrum-dev-2026",
    "DEV_CLAIMS=1",
    "CHROME_CDP=http://127.0.0.1:9222",
    "COLLECT_TTL_MINUTES=360",
    "",
])
run("cat > /opt/rostrum/.env <<'EOF'\n" + env + "EOF\ncat /opt/rostrum/.env")

# --- 3. restart + smoke ---------------------------------------------------

run("systemctl restart rostrum.service; sleep 2; systemctl is-active rostrum.service")
run("curl -s -o /dev/null -w 'admin: %{http_code}\\n' http://127.0.0.1:4173/admin")
run("curl -s -o /dev/null -w 'public /p/fre5zy: %{http_code}\\n' http://127.0.0.1:4173/p/fre5zy")
# new-version markers: shell footer class gone, new css served
run("curl -s http://127.0.0.1:4173/p/fre5zy | grep -c 'Not affiliated with' ; curl -s http://127.0.0.1:4173/public/faceit.shell.css -o /dev/null -w 'shell css: %{http_code}\\n'")
run("curl -s http://127.0.0.1:4173/p/fre5zy | grep -oE '(sh-foot|pfoot|data-slot=\"nav\"|season-title\"|data-testid=\"elo\")' | sort -u")

sftp.close()
t.close()
print("done")
