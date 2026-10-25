import os
import time
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=180):
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


# wait for the dependency install to finish
for i in range(40):
    tail = run("tail -2 /opt/rostrum/setup.log 2>/dev/null; pgrep -f 'npm install|playwright install' >/dev/null && echo RUNNING || echo DONE")
    if "DONE" in tail:
        print(f"install DONE at {(i + 1) * 15}s")
        break
    time.sleep(15)
else:
    print("install still RUNNING after 600s — will check again later")

print("tail:", run("tail -6 /opt/rostrum/setup.log")[-900:])

units = {}
units["chrome-cdp.service"] = """[Unit]
Description=Headless Chromium with CDP for the FACEIT collector
After=network.target

[Service]
ExecStart=/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome --headless=new --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage --user-data-dir=/opt/chrome-faceit about:blank
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
units["rostrum.service"] = """[Unit]
Description=Rostrum tournament companion
After=network.target chrome-cdp.service
Wants=chrome-cdp.service

[Service]
WorkingDirectory=/opt/rostrum
ExecStart=/opt/node24/bin/node --env-file-if-exists=.env src/server.js
Restart=always
RestartSec=3
Environment=PATH=/opt/node24/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin

[Install]
WantedBy=multi-user.target
"""

for name, body in units.items():
    run(c, "cat > /etc/systemd/system/" + name + " <<'EOF'\n" + body + "EOF")
run(c, "systemctl daemon-reload && systemctl enable --now chrome-cdp.service rostrum.service && sleep 2 && systemctl status rostrum.service --no-pager -l | head -12")
run(c, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/admin/login; echo")
t.close()
