# scratch: dropbot storage rules + what rostrum.service runs
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
    'grep -nE "files|mkdir|writeFile|path.join|dirname|PORT" /opt/dropbot/server.js | head -20',
    'cat /opt/dropbot/.env 2>/dev/null | sed "s/=.*/=<hidden>/"',
    'find /opt/dropbot/files -type f | head -10; du -sh /opt/dropbot/files',
    'systemctl show rostrum.service -p WorkingDirectory -p ExecStart 2>/dev/null | head -4',
    'ls /opt/rostrum/src 2>/dev/null; ls /opt/rostrum/public 2>/dev/null | head -12',
    'curl -s -o /dev/null -w "rostrum /p/fre5zy: %{http_code} %{size_download}\\n" http://127.0.0.1:4173/p/fre5zy',
    'curl -sI http://127.0.0.1:3000/ | head -6',
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
