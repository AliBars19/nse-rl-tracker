"""Kickoffs and shot distances per game. Usage: python -I report.py <prefix> <label> <label> ...  (one label per pickled replay, in order)
CITY_IS_TEAM_ZERO as in walk.py (edit the constant per team)."""
import pickle, json, bisect, math, collections, sys
CITY_IS_TEAM_ZERO = False
prefix=sys.argv[1]; labs=sys.argv[2:]
tot=collections.Counter()
for i,lab in enumerate(labs):
    st=pickle.load(open(f"{prefix}{i}_stats.pkl","rb"))["summed"]["modules"]; fd=pickle.load(open(f"{prefix}{i}_frames.pkl","rb"))
    d=fd["frame_data"]; mf=d["metadata_frames"]; times=[m["time"] for m in mf]
    print("=====",lab)
    # kickoffs
    ks=st["kickoff"]["events"]
    rows=[]
    for e in ks:
        t=e["live_action_start_time"]; j=min(bisect.bisect_left(times,t),len(times)-1); c=mf[j]["seconds_remaining"]
        ft_city=e["first_touch_team_is_team_0"]==CITY_IS_TEAM_ZERO
        poss=e.get("kickoff_possession_outcome")
        pc= None if poss in (None,"none","neutral","contested") else ((poss=="team_zero_possession")==CITY_IS_TEAM_ZERO)
        rows.append((300-c,e["kickoff_type"],ft_city,pc,e.get("kickoff_goal"),poss))
    ft=sum(1 for r in rows if r[2]); pcs=sum(1 for r in rows if r[3] is True); pop=sum(1 for r in rows if r[3] is False)
    print(f"  kickoffs {len(rows)}: City first touch {ft}/{len(rows)}; possession after: City {pcs}, opp {pop}, other {len(rows)-pcs-pop}")
    tot["ko"]+=len(rows); tot["ko_ft"]+=ft; tot["ko_pc"]+=pcs; tot["ko_po"]+=pop
    print("   ", [(f"{r[0]//60}:{r[0]%60:02d}", r[1][:4], "C" if r[2] else "O", {True:"C",False:"O",None:"-"}[r[3]]) for r in rows])
    # shots
    ids={}
    for pid,b in d["players"]:
        for f in b["frames"]:
            x=f.get("Data") if isinstance(f,dict) else None
            if x and x.get("player_name"): ids[json.dumps(pid,sort_keys=True)]=x["player_name"]; break
    pn=lambda p: ids.get(json.dumps(p,sort_keys=True),"?") if p else "?"
    sh=[]
    for e in fd["player_stat_events"]:
        if e["kind"]=="Shot":
            s=e["shot"]; bp=s["ball_position"]; gy=5120 if e["is_team_0"] else -5120
            dist=math.hypot(bp["x"],gy-bp["y"])
            j=min(bisect.bisect_left(times,e["time"]),len(times)-1)
            sh.append((300-mf[j]["seconds_remaining"],"C" if e["is_team_0"]==CITY_IS_TEAM_ZERO else "O",pn(e["player"]),dist,s["ball_goal_alignment"],s["ball_speed"]))
    for side in ("C","O"):
        ss=[s for s in sh if s[1]==side]
        if ss:
            avgd=sum(s[3] for s in ss)/len(ss); close=sum(1 for s in ss if s[3]<2500)
            print(f"  shots {side}: {len(ss)}  avg dist {avgd:.0f}uu  <2500uu: {close}  avg speed {sum(s[5] for s in ss)/len(ss):.0f}")
            tot[f"sh_{side}"]+=len(ss); tot[f"shd_{side}"]+=sum(s[3] for s in ss); tot[f"shc_{side}"]+=close
    # goal scorers' shot distance
    for g in fd["goal_events"]:
        pass
    # overtime check
    ot=[m for m in mf if m.get("is_overtime")] if mf and "is_overtime" in mf[0] else []
    print("  overtime frames:", len(ot) if mf and "is_overtime" in mf[0] else "n/a", "keys:", list(mf[0].keys()) if i==0 else "")
print(dict(tot))
