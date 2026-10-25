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


unit = """[Unit]
Description=Chromium with CDP for the FACEIT collector (headful under Xvfb)
After=network.target

[Service]
ExecStart=/usr/bin/xvfb-run -a -s "-screen 0 1280x800x24" /root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=/opt/chrome-faceit --window-size=1280,800 about:blank
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
run("pkill -f 'Xvfb :99' || true")
run("cat > /etc/systemd/system/chrome-cdp.service <<'EOF'\n" + unit + "EOF")
print(run("systemctl daemon-reload; systemctl reset-failed chrome-cdp.service; systemctl restart chrome-cdp.service; sleep 6; systemctl is-active chrome-cdp.service"))
for i in range(4):
    print("cdp:", run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version"))
    if run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version") == "200":
        break
    run("sleep 4")
print(run("pgrep -af 'chrome-linux64/chrome --remote' | head -1"))
t.close()
