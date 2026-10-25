# scratch: pull the newest files DropBot received
import os
import sys

import paramiko

HOST = os.environ.get('SSH_HOST', '')
PASS = os.environ.get('SSH_PASS', '')
if not HOST or not PASS:
    sys.exit('SSH_HOST / SSH_PASS are not set')

DEST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'incoming')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PASS, timeout=25, banner_timeout=25, auth_timeout=25)

stdin, stdout, stderr = c.exec_command(
    "find /opt/dropbot/files -type f -printf '%T@ %s %p\\n' | sort -n | tail -10", timeout=40)
listing = stdout.read().decode('utf-8', 'replace').strip()
print(listing)

os.makedirs(DEST, exist_ok=True)
sftp = c.open_sftp()
for line in listing.splitlines():
    parts = line.split(' ', 2)
    if len(parts) < 3:
        continue
    size, remote = parts[1], parts[2]
    if not remote.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')):
        continue
    local = os.path.join(DEST, os.path.basename(remote))
    sftp.get(remote, local)
    print('got', remote, '->', local, size, 'bytes')

sftp.close()
c.close()
