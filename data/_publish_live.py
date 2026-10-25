# scratch: publish a real profile on the running server and report what the
# collector said (demo off — this goes through the browser provider)
import io, os, re, sys, urllib.request, urllib.parse, http.cookiejar

BASE = 'http://127.0.0.1:4173'
NICK = sys.argv[1] if len(sys.argv) > 1 else 'fre5zy'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in io.open(os.path.join(ROOT, '.env'), encoding='utf-8', errors='replace'):
    m = re.match(r'\s*([A-Z_]+)\s*=\s*(.*?)\s*$', line)
    if m and not m.group(1).startswith('#'):
        env[m.group(1)] = m.group(2)
user, passwd = env.get('ADMIN_USER', 'operator'), env.get('ADMIN_PASS', '')

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def post(path, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(BASE + path, data=data,
                                 headers={'content-type': 'application/x-www-form-urlencoded'})
    with opener.open(req, timeout=180) as r:
        return r.status, r.read().decode('utf-8', 'replace'), r.geturl()


def notice(url):
    q = urllib.parse.urlparse(url).query
    for key in ('error', 'notice'):
        val = urllib.parse.parse_qs(q).get(key)
        if val:
            return key, val[0]
    return None, None


print('login:', post('/admin/login', {'username': user, 'password': passwd})[0])
with opener.open(BASE + '/admin', timeout=30) as r:
    admin = r.read().decode('utf-8', 'replace')
csrf = re.search(r'name="csrf" value="([^"]+)"', admin).group(1)

status, _, url = post('/admin/players/resolve', {'csrf': csrf, 'nickname': NICK})
print('resolve:', status, notice(url))

status, _, url = post('/admin/launch', {
    'csrf': csrf,
    'player_a': NICK,
    'player_b': '',
    'display_override': '',
    'role': 'friend',
    'tournament': 'Cup #1',
    'destination_type': 'external',
    'destination_url': f'https://www.faceit.com/en/players/{urllib.parse.quote(NICK)}',
})
print('launch:', status, notice(url))
