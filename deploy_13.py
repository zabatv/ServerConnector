import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_password(USER, k)


def run(cmd, timeout=300):
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


print(run("DEBIAN_FRONTEND=noninteractive apt-get install -y xvfb 2>&1 | tail -3", timeout=300))
unit = """[Unit]
Description=Chromium with CDP for the FACEIT collector (headful under Xvfb)
After=network.target

[Service]
Environment=DISPLAY=:99
ExecStartPre=/usr/bin/Xvfb :99 -screen 0 1280x800x24 -nolisten tcp
ExecStart=/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=/opt/chrome-faceit --window-size=1280,800 about:blank
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
run("cat > /etc/systemd/system/chrome-cdp.service <<'EOF'\n" + unit + "EOF")
run("pkill -f Xvfb; systemctl daemon-reload; systemctl restart chrome-cdp.service; sleep 4; systemctl is-active chrome-cdp.service")
print("cdp:", run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version"))
print(run("systemctl --no-pager --lines=3 status chrome-cdp.service | head -12"))
t.close()
