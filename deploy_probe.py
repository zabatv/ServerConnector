import paramiko, sys

host, user, pwd = "2.26.125.147", "root", "Um0VzzWeyokurWM3"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pwd, timeout=20, banner_timeout=20, auth_timeout=20)

def run(cmd, timeout=60):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    return out + (("\nERR: " + err) if err else "")

print(run("uname -a; echo ---; cat /etc/os-release | head -3; echo ---; node -v 2>/dev/null || echo no-node; npm -v 2>/dev/null || echo no-npm; echo ---; python3 -V; echo ---; free -m | head -2; df -h / | tail -1; echo ---; ss -ltnp | head -8"))
c.close()
