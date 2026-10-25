# scratch: publish fre5zy on the running dev server and print the public url
import io, os, re, urllib.request, urllib.parse, http.cookiejar

BASE = 'http://127.0.0.1:4173'

# operator credentials come from .env — never typed here
env = {}
for line in io.open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'),
                    encoding='utf-8', errors='replace'):
    m = re.match(r'\s*([A-Z_]+)\s*=\s*(.*)\s*$', line)
    if m and not m.group(1).startswith('#'):
        env[m.group(1)] = m.group(2)
user, passwd = env.get('ADMIN_USER', 'operator'), env.get('ADMIN_PASS', '')

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), urllib.request.HTTPRedirectHandler())


def post(path, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(BASE + path, data=data,
                                 headers={'content-type': 'application/x-www-form-urlencoded'})
    with opener.open(req, timeout=20) as r:
        return r.status, r.read().decode('utf-8', 'replace'), r.geturl()


status, _, _ = post('/admin/login', {'username': user, 'password': passwd})
print('login:', status)

with opener.open(BASE + '/admin', timeout=20) as r:
    admin = r.read().decode('utf-8', 'replace')
csrf = re.search(r'name="csrf" value="([^"]+)"', admin).group(1)

post('/admin/players/resolve', {'csrf': csrf, 'nickname': 'fre5zy'})
status, body, url = post('/admin/launch', {
    'csrf': csrf,
    'player_a': 'fre5zy',
    'player_b': '',
    'display_override': '',
    'role': 'friend',
    'tournament': 'Cup #1',
    'destination_type': 'external',
    'destination_url': 'https://www.faceit.com/en/players/fre5zy',
})
print('launch:', status, url)
slug = re.search(r'/p/[a-z0-9_-]{2,32}', url)
print('PUBLIC:', BASE + (slug.group(0) if slug else '/p/fre5zy'))
