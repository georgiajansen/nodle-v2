#!/usr/bin/env python3
"""End-to-end test in headless Chrome. Serves dist/ locally and swaps supabase-js for tests/mock_supabase.js
(a fake that follows the same rules as the real database). Takes the screenshots into shots/.
Run:  SUPABASE_URL=https://dummy.supabase.co SUPABASE_ANON_KEY=dummy node build.js && python3 tests/e2e.py"""
import sys
sys.stdout.reconfigure(line_buffering=True)
import http.server, threading, functools, os, sys, json, re, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist'); SHOTS = os.path.join(ROOT, 'shots')
MOCK = open(os.path.join(ROOT, 'tests', 'mock_supabase.js'), encoding='utf-8').read()
os.makedirs(SHOTS, exist_ok=True)
EMAIL, PW, PASS = 'georgia@example.test', 'test-password-123', 'correct horse battery staple'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=DIST))
PORT = srv.server_address[1]; threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % PORT

fails = []; passes = 0
def check(name, cond, extra=''):
    global passes
    if cond: passes += 1; print('  ok   ' + name)
    else: fails.append(name); print('  FAIL ' + name + ' ' + str(extra))

def new_page(b, **kw):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, **kw)
    pg = ctx.new_page(); pg.logs = []; pg.outside = []
    pg.on('console', lambda m: pg.logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: pg.logs.append('PAGEERR ' + str(e)))
    pg.on('dialog', lambda d: d.accept())
    def route(r):
        u = r.request.url
        if '/vendor/supabase.js' in u:
            r.fulfill(status=200, content_type='application/javascript', body=MOCK)
        elif u.startswith(BASE) or u.startswith('data:') or u.startswith('blob:'):
            r.continue_()
        else:
            pg.outside.append(u); r.abort()
    ctx.route('**/*', route)
    return pg, ctx

def wait_js(pg, expr, timeout=15000):
    # page.wait_for_function() uses eval(), which our strict CSP (rightly) blocks, so poll with evaluate()
    end = time.time() + timeout / 1000.0
    while time.time() < end:
        if pg.evaluate(expr): return True
        pg.wait_for_timeout(100)
    raise TimeoutError('timed out waiting for: ' + expr)

def shot(pg, name): pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
def db(pg): return pg.evaluate('window.__mock.db')
def wait_intro(pg): pg.wait_for_selector('#intro[data-state=done]', timeout=30000)
def stat(pg, k): return pg.inner_text('#stats .st[data-k="%s"] .v' % k)
def saved(pg): wait_js(pg, "document.querySelector('#lockbadge').textContent.indexOf('SAVED')>=0", 15000)
def settings_open(pg, sec):
    pg.click('[data-tab=settings]')
    if not pg.evaluate("!!document.querySelector('#%s[open]')" % sec): pg.click('#%s summary' % sec)

def login(pg, stay=True):
    pg.fill('#aemail', EMAIL); pg.fill('#apass', PW)
    if not stay: pg.uncheck('#astay')
    pg.click('#alogin')

def unlock_pass(pg, p=PASS):
    pg.fill('#apass', p); pg.click('#aunlock')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    print('== intro, login, first run, demo data, risk')
    pg, ctx = new_page(b)
    pg.goto(BASE)
    pg.wait_for_selector('#intro')
    check('login is hidden while the intro plays', not pg.evaluate("document.querySelector('#auth').classList.contains('on')"))
    wait_intro(pg); pg.wait_for_selector('#loginform')
    txt = pg.inner_text('#intro')
    check('intro says cloud + encrypted', 'CLOUD' in txt and 'ENCRYPT' in txt, txt[:200])
    check('intro never says local/offline', not re.search(r'local|offline', txt, re.I), txt)
    check('login screen never says local/offline', not re.search(r'local|offline', pg.inner_text('#abox'), re.I))
    shot(pg, '01_intro_end'); shot(pg, '02_login')
    check('stay-logged-in checkbox is there', pg.is_visible('#astay'))
    pg.fill('#aemail', EMAIL); pg.fill('#apass', 'wrong-password'); pg.click('#alogin')
    wait_js(pg, "document.querySelector('#aerr').textContent.length>0")
    check('wrong account password is refused', 'Wrong email' in pg.inner_text('#aerr'))
    login(pg); pg.wait_for_selector('#createform')
    check('first run asks for a passphrase with an unrecoverable warning', 'cannot be recovered' in pg.inner_text('#awarn'))
    shot(pg, '03_create_passphrase')
    pg.fill('#apass1', 'short'); pg.fill('#apass2', 'short'); pg.check('#aack'); pg.click('#acreate')
    check('short passphrase is refused', 'at least' in pg.inner_text('#aerr'))
    pg.fill('#apass1', PASS); pg.fill('#apass2', PASS + 'x'); pg.click('#acreate')
    check('mismatch is refused', 'do not match' in pg.inner_text('#aerr'))
    pg.fill('#apass2', PASS); pg.uncheck('#aack'); pg.click('#acreate')
    check('must tick the acknowledge box', 'tick' in pg.inner_text('#aerr'))
    pg.check('#aack'); pg.click('#acreate')
    pg.wait_for_selector('#bkfirst'); check('app opens and offers an encrypted backup', True)
    check('auth overlay closed and intro removed', not pg.evaluate("document.querySelector('#auth').classList.contains('on')") and pg.query_selector('#intro') is None)
    pg.click('#later')
    check('vault row exists in the cloud (mock) and is version 1', len(db(pg)['rows']) == 1 and db(pg)['rows'][0]['version'] == 1)
    check('nobody can open the passphrase wrong: row has kdf_iter 600000', db(pg)['rows'][0]['kdf_iter'] == 600000)

    settings_open(pg, 'sec-data'); pg.click('#btnExample'); pg.wait_for_timeout(1500)
    pg.click('[data-tab=people]'); pg.wait_for_timeout(500)
    check('demo data: 19 people', stat(pg, 'People') == '19', stat(pg, 'People'))
    check('demo data: Drifting 5', stat(pg, 'Drifting') == '5', stat(pg, 'Drifting'))
    saved(pg); pg.wait_for_timeout(300)
    shot(pg, '05_main_map_demo')
    d = db(pg); row = d['rows'][0]
    check('saved version went up', row['version'] >= 2, row['version'])
    # ciphertext/iv/salt are random base64: a word like 'nodle' can show up in them by pure chance,
    # so check the readable parts as text and the ciphertext as decoded bytes (where chance is ~1 in 10^12)
    import base64
    B64 = ('ciphertext', 'iv', 'salt')
    def strip_b64(o): return {k: ('<b64>' if k in B64 else v) for k, v in o.items()}
    def raw_bytes(o):
        out = b''
        for k in B64:
            try: out += base64.b64decode(str(o.get(k, '')) + '===')
            except Exception: out += str(o.get(k, '')).encode()
        return out
    items = [(l['payload'] or {}) for l in d['log']] + [row]
    blob = json.dumps([strip_b64(i) for i in items] + [{'op': l['op'], 'table': l['table']} for l in d['log']])
    rawblob = b' '.join(raw_bytes(i) for i in items)
    names = ['Marcus', 'Raj', 'Kenji', 'Priya', 'Helen', 'Nina', 'nodle', 'metHow', 'gossips', 'rating']
    check('NO plaintext contact data ever sent or stored', not any(n.lower() in blob.lower() or n.lower().encode() in rawblob.lower() for n in names), [n for n in names if n.lower() in blob.lower() or n.lower().encode() in rawblob.lower()])
    check('only ciphertext/iv/salt/version columns are written', all(set((l['payload'] or {}).keys()) <= {'user_id','ciphertext','iv','salt','kdf_iter','version'} for l in d['log']))
    check('risk rings drawn on the map', pg.evaluate("document.querySelectorAll('.node .rk').length") >= 15)

    pg.click('[data-tab=risk]'); pg.wait_for_selector('#risktbl')
    sc = {}
    for tr in pg.query_selector_all('#risktbl tr[data-pid]'):
        nm = tr.query_selector('td').inner_text().strip(); v = tr.query_selector('td[data-score]').get_attribute('data-score')
        sc[nm.split()[0]] = v
    exp = {'Marcus': '53', 'Raj': '83', 'Kenji': '42', 'Ben': '24', 'Helen': '12', 'Priya': '5', 'Mum': '0', 'Nina': ''}
    for k, v in exp.items(): check('risk score %s = %s' % (k, v or 'not enough info'), sc.get(k) == v, sc)
    shot(pg, '06_risk_table')
    rows = pg.query_selector_all('#risktbl tr[data-pid]')
    for tr in rows:
        if tr.query_selector('td').inner_text().strip().startswith('Marcus'): tr.click(); break
    pg.wait_for_selector('#traits'); pg.wait_for_timeout(300)
    check('character panel shows risk box + how-it-works', pg.is_visible('.riskbox') and pg.query_selector('#howcalc') is not None)
    pg.click('#howcalc summary')
    shot(pg, '07_character_risk_panel')
    pg.fill('#ovreason', 'x') if pg.query_selector('#ovreason') else None
    pg.keyboard.press('Escape')

    print('== lock, unlock, PIN, auto-lock setting')
    pg.click('#btnLock'); pg.wait_for_selector('#unlockform')
    check('lock wipes the map from the page', pg.evaluate("document.querySelectorAll('#nodes *').length") == 0 and 'Marcus' not in pg.inner_text('body'))
    shot(pg, '04_unlock')
    unlock_pass(pg, 'not the passphrase'); wait_js(pg, "document.querySelector('#aerr').textContent.indexOf('Wrong')>=0")
    check('wrong vault passphrase is refused', True)
    unlock_pass(pg); pg.wait_for_selector('#stats .st'); pg.wait_for_timeout(400)
    check('unlock restores all 19 people from the cloud', stat(pg, 'People') == '19')
    settings_open(pg, 'sec-security')
    pg.click('#setPin'); pg.fill('#pin1', '2468'); pg.fill('#pin2', '2468'); pg.click('#pinsave'); pg.wait_for_timeout(1500)
    check('PIN record stored on this device', any(k.startswith('pm.pin.') for k in pg.evaluate('Object.keys(localStorage)')))
    pinrec = pg.evaluate("Object.entries(localStorage).filter(e=>e[0].startsWith('pm.pin.'))[0][1]")
    check('PIN record holds no key in plain', 'ct' in pinrec and 'AAAA' not in pinrec[:5])
    pg.click('#setLockNow'); pg.wait_for_selector('#pinform')
    check('PIN screen is shown by default after a PIN is set', True)
    shot(pg, '04b_unlock_pin')
    pg.fill('#apin', '1111'); pg.click('#apingo'); wait_js(pg, "document.querySelector('#aerr').textContent.indexOf('4 tries')>=0")
    check('wrong PIN counts down', True)
    pg.fill('#apin', '2468'); pg.click('#apingo'); pg.wait_for_selector('#stats .st'); pg.wait_for_timeout(300)
    check('right PIN unlocks', stat(pg, 'People') == '19')
    check('PIN counter reset after success', json.loads(pinrec)['fails'] == 0 and json.loads(pg.evaluate("Object.entries(localStorage).filter(e=>e[0].startsWith('pm.pin.'))[0][1]"))['fails'] == 0)
    pg.keyboard.press('l'); pg.wait_for_selector('#pinform')
    for i in range(5):
        pg.fill('#apin', '000%d' % i); pg.click('#apingo'); pg.wait_for_timeout(1500 if i < 4 else 2500)
    pg.wait_for_selector('#unlockform')
    check('5 wrong PINs wipe the PIN and fall back to the passphrase', not any(k.startswith('pm.pin.') for k in pg.evaluate('Object.keys(localStorage)')) and 'erased' in pg.inner_text('#aerr'))
    unlock_pass(pg); pg.wait_for_selector('#stats .st')

    print('== conflict between two devices')
    pg.evaluate("window.__mock.db.rows[0].version += 1; window.__mock.save()")  # "another device" saved
    pg.click('[data-tab=risk]'); pg.click('#risktbl tr[data-pid] >> nth=2'); pg.click('[data-st=basics]')
    pg.fill('#pname', 'Zed Fake'); pg.wait_for_timeout(1500)
    pg.wait_for_selector('#cfmine', timeout=15000)
    check('a newer version from another device shows the conflict choice', pg.is_visible('#cfdl') and pg.is_visible('#cftheirs'))
    shot(pg, '08_conflict')
    pg.click('#cfmine'); wait_js(pg, "document.querySelector('#cfmine')===null", 10000)
    check('keep mine resolves it', True)

    print('== two-step sign-in (TOTP)')
    settings_open(pg, 'sec-security'); pg.wait_for_selector('#mfaon'); pg.click('#mfaon'); pg.wait_for_selector('#mfaverify')
    check('QR code image is a data: URI', (pg.get_attribute('#mfaqr', 'src') or '').startswith('data:'))
    pg.fill('#mfacode', '123456'); pg.click('#mfaverify'); pg.wait_for_selector('#mfaoff')
    check('two-step shows as ON', True)

    print('== log out this device, back in with the code')
    pg.click('#logoutHere'); pg.wait_for_selector('#loginform')
    check('log out this device -> login screen, local scope', db(pg)['signedOutLocal'] == 1 and not any(k.startswith('pm.auth') for k in pg.evaluate('Object.keys(localStorage)')))
    login(pg); pg.wait_for_selector('#mfaform')
    shot(pg, '09_two_step_code')
    pg.fill('#amfa', '000000'); pg.click('#amfago')
    pg.fill('#amfa', '123456'); pg.click('#amfago'); pg.wait_for_selector('#unlockform')
    unlock_pass(pg); pg.wait_for_selector('#stats .st'); pg.wait_for_timeout(300)
    check('after sign-in + code + passphrase the data is back', stat(pg, 'People') in ('19', '20'), stat(pg, 'People'))

    print('== reload keeps you signed in (stay logged in) but locked')
    pg.reload(); wait_intro(pg)
    pg.wait_for_selector('#unlockform')
    check('reload -> unlock screen (not login, not data)', pg.query_selector('#loginform') is None and 'Marcus' not in pg.inner_text('body'))
    check('session token is in localStorage (stay logged in)', any(k.startswith('pm.auth') for k in pg.evaluate('Object.keys(localStorage)')))
    # skip the intro with a key on the next reload
    pg.reload(); pg.wait_for_selector('#intro'); pg.keyboard.press('Space')
    pg.wait_for_selector('#unlockform', timeout=5000); check('intro is skippable by key', True)
    unlock_pass(pg); pg.wait_for_selector('#stats .st')

    print('== auto-lock after idle')
    settings_open(pg, 'sec-security'); pg.select_option('#setIdle', '1')
    check('auto-lock setting is stored', pg.evaluate("localStorage.getItem('pm.idle')") == '1')
    pg.wait_for_timeout(72000)
    check('map locked itself after 1 idle minute', pg.evaluate("document.querySelector('#auth').classList.contains('on')") and 'Locked after 1 minute' in pg.inner_text('#abox'))
    unlock_pass(pg); pg.wait_for_selector('#stats .st')

    print('== log out ALL devices')
    settings_open(pg, 'sec-security'); pg.click('#logoutAll'); pg.wait_for_selector('#loginform')
    check('global sign-out was requested', db(pg)['signedOutGlobal'] == 1)
    check('no leftover data or PIN on the page after logout', 'Marcus' not in pg.inner_text('body'))
    errs = [l for l in pg.logs]
    check('no outside network requests', not pg.outside, pg.outside)
    check('no console errors or warnings (main flow)', not errs, errs)
    ctx.close()

    print('== stay-logged-in OFF keeps the session out of localStorage')
    pg, ctx = new_page(b)
    pg.goto(BASE); wait_intro(pg); pg.wait_for_selector('#loginform'); login(pg, stay=False)
    pg.wait_for_selector('#createform')
    ls = pg.evaluate('Object.keys(localStorage)'); ss = pg.evaluate('Object.keys(sessionStorage)')
    check('session token only in sessionStorage', not any(k.startswith('pm.auth') for k in ls) and any(k.startswith('pm.auth') for k in ss), (ls, ss))
    ctx.close()

    print('== reduced motion skips the intro')
    pg, ctx = new_page(b, reduced_motion='reduce')
    pg.goto(BASE); pg.wait_for_selector('#loginform', timeout=3000)
    check('reduced motion: login shows straight away', True)
    check('no console errors (reduced motion)', not pg.logs, pg.logs)
    ctx.close()

    print('== small screen')
    pg, ctx = new_page(b)
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.goto(BASE); wait_intro(pg); pg.wait_for_selector('#loginform')
    shot(pg, '10_login_phone'); ctx.close()
    b.close()

print('\n%d checks passed, %d failed' % (passes, len(fails)))
if fails: print('FAILED:', fails); sys.exit(1)
