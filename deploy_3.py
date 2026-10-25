import os
import paramiko

HOST, USER = "2.26.125.147", "root"
k = os.environ["SSH_CRED"]

t = paramiko.Transport((HOST, 22))
t.start_client(timeout=20)
t.auth_publickey = None
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
    print("$", cmd[:120])
    print(out.decode(errors="replace").strip()[-2000:])


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
run("cd /opt/rostrum && rm -f cover1.mjs cover-test.mjs deploy_probe.py page-inventory.mjs page-regions.mjs page-regions2.mjs verify.mjs && nohup bash -c '/opt/node24/bin/npm install --no-audit --no-fund && /opt/node24/bin/npx playwright install chromium --with-deps' > /opt/rostrum/setup.log 2>&1 & echo started")
t.close()
