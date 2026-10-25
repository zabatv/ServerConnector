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


unit = """/[Unit]
Description=Headless Chromium with CDP for the FACEIT collector
After=network.target

[Service]
ExecStart=/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome --headless=new --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage --user-data-dir=/opt/chrome-faceit about:blank
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
""".lstrip("/")

run("systemctl reset-failed chrome-cdp.service; cat > /etc/systemd/system/chrome-cdp.service <<'EOF'\n" + unit + "EOF")
run("systemctl daemon-reload; systemctl restart chrome-cdp.service; sleep 3; systemctl is-active chrome-cdp.service")
print("cdp:", run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version"))
print(run("systemctl --no-pager --lines=4 status chrome-cdp.service | head -8"))
t.close()
