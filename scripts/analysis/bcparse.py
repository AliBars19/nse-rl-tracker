"""Parse team/player stats out of a saved ballchasing replay page. Usage: python -I bcparse.py <html> ..."""
import html, json, re, sys

def txt(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()

def parse(path):
    t = open(path).read()
    out = {"splits": {}, "tables": []}
    for blk in re.findall(r'<div class="team-splits">(.*?)(?=<div class="vspacer">|<h3|<hr)', t, flags=re.S):
        pass
    # team-split rows: blue-val / orange-val / name
    for m in re.finditer(r'<div class="blue-val">(.*?)</div>\s*<div class="orange" [^>]*></div>\s*<div class="orange-val">(.*?)</div>\s*<div class="split"></div>\s*<div class="name">(.*?)</div>', t, flags=re.S):
        out["splits"][txt(m.group(3))] = [txt(m.group(1)), txt(m.group(2))]
    for tb in re.findall(r"<table.*?</table>", t, flags=re.S):
        rows = []
        for r in re.findall(r"<tr.*?</tr>", tb, flags=re.S):
            cells = [txt(c) for c in re.findall(r"<t[hd].*?</t[hd]>", r, flags=re.S)]
            if len(cells) > 2:
                rows.append(cells)
        if rows:
            out["tables"].append(rows)
    return out

if __name__ == "__main__":
    res = {p.split("/")[-1][:-5]: parse(p) for p in sys.argv[1:]}
    json.dump(res, open("/dev/stdout", "w"))
