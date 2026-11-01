import subtr_actor, pickle, sys, os, json
"""Pickle subtr-actor stats + frames for every replay in a directory, in match order. Usage: python -I prep_frames.py <replay dir> <prefix>  (writes <prefix><n>_stats.pkl / _frames.pkl)"""
d=sys.argv[1]; prefix=sys.argv[2]
fs=sorted(os.listdir(d))
meta=[]
for f in fs:
    p=os.path.join(d,f)
    m=subtr_actor.get_replay_meta(p)["replay_meta"]
    st=int(next(v for k,v in m["all_headers"] if k=="MatchStartEpoch"))
    meta.append((st,f))
meta.sort()
for i,(st,f) in enumerate(meta):
    p=os.path.join(d,f)
    pickle.dump({'summed':subtr_actor.get_summed_stats(p)}, open(f"{prefix}{i}_stats.pkl","wb"))
    pickle.dump(subtr_actor.get_replay_frames_data(p), open(f"{prefix}{i}_frames.pkl","wb"))
    print("saved",i,f[:8],file=sys.stderr)
