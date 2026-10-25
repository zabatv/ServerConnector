# scratch: the deployed bot and the :3000 listener on the VPS
import os
import sys

import paramiko

HOST = os.environ.get('SSH_HOST', '')
PASS = os.environ.get('SSH_PASS', '')
if not HOST or not PASS:
    sys.exit('SSH_HOST / SSH_PASS are not set')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PASS, timeout=25, banner_timeout=25, auth_timeout=25)

COMMANDS = [
    'systemctl cat dropbot.service 2>/dev/null',
    'systemctl show dropbot.service -p WorkingDirectory -p ExecStart -p User -p Environment 2>/dev/null',
    'ls -la /opt/dropbot 2>/dev/null | head -30',
    'du -sh /opt/dropbot/* 2>/dev/null | sort -h | tail -12',
    'journalctl -u dropbot.service -n 12 --no-pager 2>/dev/null | tail -12',
    'ps -o pid,args -p 496658 2>/dev/null; readlink -f /proc/496658/cwd 2>/dev/null',
    'ss -tlnp | grep -E ":(3000|4173)" ',
    'curl -s -o /dev/null -w "%{http_code} %{size_download}\\n" http://127.0.0.1:3000/ 2>/dev/null; '
    'curl -s -o /dev/null -w "%{http_code} %{size_download}\\n" http://127.0.0.1:4173/ 2>/dev/null',
    'ls -la /opt/rostrum 2>/dev/null | head -15; systemctl show rostrum.service -p WorkingDirectory -p ExecStart 2>/dev/null',
]

for cmd in COMMANDS:
    stdin, stdout, stderr = c.exec_command(cmd, timeout=40)
    out = stdout.read().decode('utf-8', 'replace').strip()
    err = stderr.read().decode('utf-8', 'replace').strip()
    print('\n$ ' + cmd)
    if out:
        print(out)
    if err:
        print('ERR:', err[-300:])

c.close()
