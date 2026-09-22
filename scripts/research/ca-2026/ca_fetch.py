"""Submit one query to the California Department of Insurance 2026 Automobile Premium Survey tool
(https://interactive.web.insurance.ca.gov/apex_extprd/f?p=111:11) the way the page does, and return the result page.
"""
import re, json, sys, time, html, urllib.parse, http.cookiejar, urllib.request
BASE = 'https://interactive.web.insurance.ca.gov/apex_extprd/'
UA = 'NotAQuote.FYI research (open-source)'


class S:
    def __init__(s):
        s.cj = http.cookiejar.CookieJar()
        s.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(s.cj))
        s.op.addheaders = [('User-Agent', UA)]

    def get(s, u):
        r = s.op.open(u, timeout=60)
        return r.geturl(), r.read().decode('utf-8', 'ignore')

    def post(s, u, data):
        req = urllib.request.Request(u, data=urllib.parse.urlencode(data).encode())
        r = s.op.open(req, timeout=60)
        return r.geturl(), r.read().decode('utf-8', 'ignore')


def hidden(t, name):
    for pat in (r'name="%s" value="([^"]*)"', r'id="%s"[^>]*value="([^"]*)"', r'value="([^"]*)" id="%s"'):
        m = re.search(pat % name, t)
        if m:
            return html.unescape(m.group(1))
    return None


def run(items, s=None):
    s = s or S()
    u, t = s.get(BASE + 'f?p=111:11')
    inst = hidden(t, 'p_instance')
    sub = hidden(t, 'p_page_submission_id')
    salt = hidden(t, 'pSalt')
    prot = hidden(t, 'pPageItemsProtected')
    its = [{"n": k, "v": v} for k, v in items]
    for m in re.finditer(r'<input type="hidden" name="(P\d+_[A-Z0-9_]+)" id="[^"]*" value="([^"]*)">', t):
        n, v = m.group(1), html.unescape(m.group(2))
        d = {"n": n, "v": v}
        ck = re.search(r'data-for="%s" value="([^"]*)"' % n, t)
        if ck:
            d["ck"] = html.unescape(ck.group(1))
        its.append(d)
    pj = {"pageItems": {"itemsToSubmit": its, "protected": prot,
                        "rowVersion": "", "formRegionChecksums": []}, "salt": salt}
    data = {'p_flow_id': '111', 'p_flow_step_id': '11', 'p_instance': inst, 'p_debug': '',
            'p_request': 'SUBMIT', 'p_reload_on_submit': 'A', 'p_page_submission_id': sub,
            'p_json': json.dumps(pj)}
    u2, r = s.post(BASE + 'wwv_flow.accept?p_context=111:11:' + inst, data)
    return u2, r


if __name__ == '__main__':
    items = json.loads(sys.argv[1])
    out = sys.argv[2]
    u, r = run(items)
    open(out, 'w').write(r)
    print(u, len(r))
