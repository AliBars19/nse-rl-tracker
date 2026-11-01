"""Per-game City-vs-opponent summary from parsed ballchasing pages. Usage: python -I bcsummary.py <all.json> <city names comma-separated> <key:label ...>"""
import collections, json, re, sys

def f(x):
    m = re.match(r"-?[0-9.]+", x.replace(",", "").split("s (")[0])
    return float(m.group()) if m else 0.0

data = json.load(open(sys.argv[1]))
CITY = set(sys.argv[2].split(","))
games = [a.split(":") for a in sys.argv[3:]]
tot = [collections.Counter(), collections.Counter()]
pl = collections.defaultdict(lambda: collections.defaultdict(float)); N = collections.Counter()
for key, label in games:
    t = data[key]["tables"]; sp = data[key]["splits"]
    core = {r[0]: [f(c) for c in r[1:]] for r in t[2][1:]}
    boost = {r[0]: [f(c) for c in r[1:]] for r in t[5][1:]}
    pos = {r[0]: [f(c) for c in r[1:]] for r in t[6][1:]}
    mov = {r[0]: [f(c) for c in r[1:] if "/" not in c] for r in t[8][1:]}
    out = [{}, {}]
    for s in (0, 1):
        ps = [p for p in core if (p in CITY) == (s == 0)]
        g = lambda tb, i: sum(tb[p][i] for p in ps if p in tb)
        out[s] = dict(shots=g(core, 1), goals=g(core, 2), saves=g(core, 5), dfor=g(core, 6), coll=g(boost, 4), stol=g(boost, 5), big=g(boost, 6),
                      zero=g(boost, 2), bpm=g(boost, 0) / max(len(ps), 1), deft=g(pos, 0), spd=g(mov, 0) / max(len(ps), 1), ss=g(mov, 5))
        for k, v in out[s].items(): tot[s][k] += v
    for p in CITY:
        if p in core:
            N[p] += 1
            for k, i in (("score", 0), ("shots", 1), ("goals", 2), ("ast", 4), ("saves", 5), ("dfor", 6), ("dag", 7)): pl[p][k] += core[p][i]
            for k, i in (("bpm", 0), ("zero", 2), ("coll", 4), ("stol", 5), ("big", 6)): pl[p][k] += boost[p][i]
            for k, i in (("def3", 0), ("off3", 2)): pl[p][k] += pos[p][i]
            for k, i in (("spd", 0), ("ss", 5)): pl[p][k] += mov[p][i]
    c, o = out
    poss = sp.get("Possession", ["0", "0"]); pc, po = f(poss[0]), f(poss[1])
    print(f"{label:12s} shots {c['shots']:.0f}-{o['shots']:.0f} saves {c['saves']:.0f}-{o['saves']:.0f} boost {c['coll']:.0f}/{o['coll']:.0f} stolen {c['stol']:.0f}/{o['stol']:.0f} big {c['big']:.0f}-{o['big']:.0f} "
          f"bpm {c['bpm']:.0f}/{o['bpm']:.0f} zero {c['zero']:.0f}/{o['zero']:.0f}s demos {c['dfor']:.0f}-{o['dfor']:.0f} ownthird {c['deft']:.0f}/{o['deft']:.0f}s poss {pc:.0f}/{po:.0f} supersonic {c['ss']:.0f}/{o['ss']:.0f}s")
n = len(games)
print("AVG per game City/opp:", {k: (round(tot[0][k] / n, 1), round(tot[1][k] / n, 1)) for k in tot[0]})
for p, a in pl.items():
    g = N[p]
    print(f"{p:10s} g={g} score/g {a['score']/g:5.0f} G{a['goals']:.0f} A{a['ast']:.0f} Sv{a['saves']:.0f} Sh{a['shots']:.0f} demos {a['dfor']:.0f}/{a['dag']:.0f} bpm {a['bpm']/g:4.0f} zero {a['zero']/g:3.0f}s coll {a['coll']/g:5.0f} stolen {a['stol']/g:4.0f} big {a['big']/g:4.1f} def3 {a['def3']/g:4.0f}s off3 {a['off3']/g:4.0f}s spd {a['spd']/g:5.0f} ss {a['ss']/g:3.0f}s")
