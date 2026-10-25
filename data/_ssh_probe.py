# scratch: read-only look at the VPS the project deploys to
import os
import sys

try:
    import paramiko
except ImportError:
    sys.exit('paramiko is not installed')

HOST = os.environ.get('SSH_HOST', '')
USER = os.environ.get('SSH_USER', 'root')
PASS = os.environ.get('SSH_PASS', '')
if not HOST or not PASS:
    sys.exit('SSH_HOST / SSH_PASS are not set')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=25, banner_timeout=25, auth_timeout=25)

COMMANDS = [
    'hostname; . /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"; uptime',
    'ss -tlnp 2>/dev/null | head -25',
    'systemctl list-units --type=service --state=running --no-pager --no-legend | head -30',
    'ls -la /opt 2>/dev/null',
    'ls -la /opt/maxbot 2>/dev/null | head -30',
    'du -sh /opt/maxbot/* 2>/dev/null | sort -h | tail -15',
    'ls -la /opt/maxbot/uploads /opt/maxbot/reports /opt/maxbot/logs_archive 2>/dev/null | head -40',
    'tail -n 15 /opt/maxbot/app.log 2>/dev/null',
    'df -h / | tail -2; free -m | head -2',
]

for cmd in COMMANDS:
    stdin, stdout, stderr = c.exec_command(cmd, timeout=40)
    out = stdout.read().decode('utf-8', 'replace').strip()
    err = stderr.read().decode('utf-8', 'replace').strip()
    print('\n$ ' + cmd)
    if out:
        print(out)
    if err:
        print('ERR:', err[-400:])

c.close()
