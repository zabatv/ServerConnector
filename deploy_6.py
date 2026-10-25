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


chrome = run("ls /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome | head -1")
print("chrome:", chrome)

chrome_unit = f"""[Unit]
Description=Headless Chromium with CDP for the FACEIT collector
After=network.target

[Service]
ExecStart={chrome} --headless=new --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage --user-data-dir=/opt/chrome-faceit about:blank
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

rostrum_unit = """[Unit]
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

run("cat > /etc/systemd/system/chrome-cdp.service <<'EOF'\n" + chrome_unit + "EOF")
run("cat > /etc/systemd/system/rostrum.service <<'EOF'\n" + rostrum_unit + "EOF")
print(run("systemctl daemon-reload; systemctl enable --now chrome-cdp.service; systemctl enable --now rostrum.service; sleep 3; systemctl --no-pager --lines=8 status rostrum.service"))
print("http:", run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/admin/login"))
print("cdp:", run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version"))
t.close()
