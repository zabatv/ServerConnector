import paramiko

HOST, USER, PWD = "2.26.125.147", "root", "Um0VzzWeyokurWM3"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=20, banner_timeout=20, auth_timeout=20)


def run(cmd, timeout=900):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    print("$", cmd[:160])
    if out: print(out[-2500:])
    if err: print("ERR:", err[-1500:])
    return out


try:
    # clean scratch files from the upload, keep everything else
    run(c, "cd /opt/rostrum && rm -f cover1.mjs cover-test.mjs deploy_probe.py page-inventory.mjs page-regions.mjs page-regions2.mjs verify.mjs")

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
    run(c, "cat > /opt/rostrum/.env <<'EOF'\n" + env + "EOF\ncat /opt/rostrum/.env")

    # deps: playwright is the only devDependency; the app itself has none
    run(c, "cd /opt/rostrum && /opt/node24/bin/npm install --no-audit --no-fund 2>&1 | tail -5", timeout=900)
finally:
    c.close()
