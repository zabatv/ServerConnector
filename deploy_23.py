import paramiko

HOST, USER, PWD = "2.26.125.147", "root", "Um0VzzWeyokurWM3"
LOCAL = r"D:\Desktop\rostrum"
FILES = [
    (LOCAL + r"\src\render.js", "/opt/rostrum/src/render.js"),
    (LOCAL + r"\public\admin.js", "/opt/rostrum/public/admin.js"),
    (LOCAL + r"\public\style.css", "/opt/rostrum/public/style.css"),
]

t = paramiko.SSHClient()
t.set_missing_host_key_policy(paramiko.AutoAddPolicy())
t.connect(HOST, username=USER, password=PWD, timeout=20)
sftp = t.open_sftp()

for local, remote in FILES:
    sftp.put(local, remote)
    print("up", remote)

def run(cmd, timeout=90):
    stdin, stdout, stderr = t.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    print("$", cmd[:84])
    if out: print(out[-1200:])
    if err: print("ERR:", err[-400:])
    print()

try:
    run("systemctl restart rostrum.service; sleep 2; systemctl is-active rostrum.service")
    run("curl -s -o /dev/null -w 'admin: %{http_code}\\n' http://127.0.0.1:4173/admin")
    run("curl -s http://127.0.0.1:4173/admin.js | grep -c 'launch-progress'")
    run("curl -s http://127.0.0.1:4173/style.css | grep -c 'lp-track'")
    run("curl -s -b /dev/null 'http://127.0.0.1:4173/p/fre5zy' -o /dev/null -w 'public: %{http_code}\\n'")
finally:
    pass
    t.close()
print("done")
