"""Second-by-second positions/boost before chosen goals. Usage: python -I walk.py <prefix> <replay index> <goal number>...
CITY_IS_TEAM_ZERO: True when City were blue (both Champions nights), False when City were orange (Commanders Week 1). Edit the constant per team."""
import pickle, json, bisect, sys
CITY_IS_TEAM_ZERO = False
prefix=sys.argv[1]; idx=int(sys.argv[2]); only=[int(x) for x in sys.argv[3:]]
fd=pickle.load(open(f"{prefix}{idx}_frames.pkl","rb"))
d=fd['frame_data']; mf=d['metadata_frames']; times=[m['time'] for m in mf]
def data(f): return f.get('Data') if isinstance(f,dict) else None
def rb(f):
    x=data(f); return x.get('rigid_body') if x else None
ball=[(rb(f) or {}).get('location') for f in d['ball_data']['frames']]
bvel=[(rb(f) or {}).get('linear_velocity') for f in d['ball_data']['frames']]
P={}; ids={}
for pid,b in d['players']:
    nm=None; team=None
    for f in b['frames']:
        x=data(f)
        if x and x.get('player_name'): nm=x['player_name']; team=0 if x['is_team_0'] else 1; break
    P[nm]=(team,b['frames']); ids[json.dumps(pid,sort_keys=True)]=nm
touch=fd['touch_events']
pname=lambda p: ids.get(json.dumps(p,sort_keys=True)) if p else None
def row(i):
    bl=ball[i]; bv=bvel[i]
    el=300-mf[i]['seconds_remaining']
    if not bl: return f"{el//60}:{el%60:02d} (no ball)"
    sp=((bv['x']**2+bv['y']**2+bv['z']**2)**.5) if bv else 0
    s=f"{el//60}:{el%60:02d} ball=({bl['x']:6.0f},{bl['y']:6.0f},{bl['z']:4.0f}) v={sp:4.0f} | "
    for nm,(team,fr) in P.items():
        x=data(fr[i]) if i<len(fr) else None
        L=((x or {}).get('rigid_body') or {}).get('location')
        tag=('C' if (team==0)==CITY_IS_TEAM_ZERO else 'o')+nm[:4]
        if x and L: s+=f"{tag}({L['x']:5.0f},{L['y']:5.0f},{x['boost_amount']/2.55:3.0f}%) "
        else: s+=f"{tag}(--) "
    return s
g=fd['goal_events']
for n in only:
    gt=g[n-1]['time']; back=5; print(f"\n=== game idx {idx} goal {n}: scorer team {'CITY' if g[n-1]['scoring_team_is_team_0']==CITY_IS_TEAM_ZERO else 'opp'}; {back}s before ===")
    t=gt-back; last=-1
    while t<=gt+0.01:
        i=bisect.bisect_left(times,t)
        if i!=last and i<len(times): print(row(i)); last=i
        t+=1.0
    ts=[x for x in touch if gt-back<=x['time']<=gt]
    print('touches:', ' '.join(f"+{x['time']-(gt-back):.1f}s {'C' if x['team_is_team_0']==CITY_IS_TEAM_ZERO else 'o'}:{(pname(x['player']) or '?')[:5]}" for x in ts))
