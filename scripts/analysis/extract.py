"""Flatten the stats subtr-actor derives from one replay. Usage: python -I extract.py <dir> <out.json>"""
import json
import os
import sys

import subtr_actor


def pid(p):
    return json.dumps(next(iter(p.items())), sort_keys=True, default=str) if isinstance(p, dict) and p else None


def num(x, d=0.0):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else d


def analyse(path):
    meta = subtr_actor.get_replay_meta(path)["replay_meta"]
    mods = subtr_actor.get_summed_stats(path)["modules"]
    fd = subtr_actor.get_replay_frames_data(path)

    names, teams = {}, {}
    for t, key in ((0, "team_zero"), (1, "team_one")):
        for p in meta[key]:
            rid = pid(p["remote_id"])
            names[rid], teams[rid] = p["name"], t

    def by_player(mod):
        out = {}
        for e in mods[mod].get("player_stats", []) or []:
            out[pid(e["player_id"])] = e["stats"]
        return out

    P = {m: by_player(m) for m in ["core", "boost", "positioning", "movement", "touch", "whiff", "kickoff", "fifty_fifty", "rotation", "demo", "controlled_play"]}

    # replay clock -> seconds remaining on the game clock
    mf = fd["frame_data"]["metadata_frames"]

    def clock(t):
        best = min(mf, key=lambda f: abs(f["time"] - t))
        return best["seconds_remaining"]

    # first live frame: when the clock first starts to run down from 300
    goals = []
    for g in fd["goal_events"]:
        ctx = next((c for c in mods["core"]["goal_context"] if c["frame"] == g["frame"]), {})
        goals.append(
            {
                "time": g["time"],
                "remaining": clock(g["time"]),
                "scorer": names.get(pid(g["player"]), "?"),
                "scorer_team": 0 if g["scoring_team_is_team_0"] else 1,
                "score_after": [g["team_zero_score"], g["team_one_score"]],
                "buildup": ctx.get("goal_buildup"),
                "ball_speed": ctx.get("ball_speed_at_goal"),
                "ball_air_time": ctx.get("ball_air_time_before_goal"),
                "most_back": names.get(pid(ctx.get("defending_team_most_back_player")), None),
                "players": [
                    {
                        "name": names.get(pid(p["player"]), "?"),
                        "team": 0 if p["is_team_0"] else 1,
                        "boost": p["boost_amount"],
                        "avg_boost_leadup": p["average_boost_in_leadup"],
                        "min_boost_leadup": p["min_boost_in_leadup"],
                        "most_back": p["is_most_back"],
                        "x": (p.get("position") or {}).get("x"),
                        "y": (p.get("position") or {}).get("y"),
                    }
                    for p in ctx.get("players", [])
                ],
            }
        )
    touches = [
        {"time": t["time"], "team": 0 if t["team_is_team_0"] else 1, "player": names.get(pid(t["player"]), None)}
        for t in fd["touch_events"]
    ]
    demos = [
        {"time": d["time"], "remaining": d["seconds_remaining"], "attacker": names.get(pid(d["attacker"]), "?"), "victim": names.get(pid(d["victim"]), "?")}
        for d in fd["demolish_infos"]
    ]

    players = {}
    for rid, nm in names.items():
        c, b, po, mv, tc, wf, ko, ff, ro, dm, cp = (P[k].get(rid, {}) for k in ["core", "boost", "positioning", "movement", "touch", "whiff", "kickoff", "fifty_fifty", "rotation", "demo", "controlled_play"])
        active = num(po.get("active_game_time")) or 1.0
        mt = num(mv.get("tracked_time")) or 1.0
        players[nm] = {
            "team": teams[rid],
            "score": c.get("score"), "goals": c.get("goals"), "assists": c.get("assists"), "saves": c.get("saves"), "shots": c.get("shots"),
            "boost_collected": b.get("amount_collected"), "boost_stolen": b.get("amount_stolen"), "boost_used": b.get("amount_used"),
            "bpm": num(b.get("amount_used")) / (active / 60.0),
            "pct_zero_boost": 100 * num(b.get("time_zero_boost")) / (num(b.get("tracked_time")) or active),
            "pct_full_boost": 100 * num(b.get("time_hundred_boost")) / (num(b.get("tracked_time")) or active),
            "big_pads": b.get("big_pads_collected"), "small_pads": b.get("small_pads_collected"),
            "pct_behind_ball": 100 * num(po.get("time_behind_ball")) / active,
            "pct_def_third": 100 * num(po.get("time_defensive_third")) / active,
            "pct_off_third": 100 * num(po.get("time_offensive_third")) / active,
            "pct_most_back": 100 * num(po.get("time_most_back")) / active,
            "pct_most_forward": 100 * num(po.get("time_most_forward")) / active,
            "pct_closest_ball": 100 * num(po.get("time_closest_to_ball_absolute")) / active,
            "pct_supersonic": 100 * num(mv.get("time_supersonic_speed")) / mt,
            "pct_ground": 100 * num(mv.get("time_on_ground")) / mt,
            "pct_air": 100 * (num(mv.get("time_low_air")) + num(mv.get("time_high_air"))) / mt,
            "touches": tc.get("touch_count"), "hard_hits": tc.get("hard_hit_count"), "aerial_touches": tc.get("aerial_touch_count"),
            "whiffs": wf.get("whiff_count"), "beaten": wf.get("beaten_to_ball_count"),
            "ff_wins": ff.get("wins"), "ff_losses": ff.get("losses"),
            "demos_inflicted": dm.get("demos_inflicted"), "demos_taken": dm.get("demos_taken"),
            "first_man_pct": 100 * num(ro.get("time_first_man")) / (num(ro.get("active_game_time")) or active),
            "third_man_pct": 100 * num(ro.get("time_third_man")) / (num(ro.get("active_game_time")) or active),
            "conceded_last_defender": c.get("goals_conceded_while_last_defender"),
            "conceded_most_back": c.get("goals_against_while_most_back"),
            "conceded_ahead_of_play": c.get("caught_ahead_of_play_on_conceded_goals"),
        }

    poss = mods["possession"]["stats"]
    half = mods["ball_half"]["stats"]
    third = mods["ball_third"]["stats"]
    terr = mods["territorial_pressure"]["stats"]
    kick = mods["kickoff"]["stats"]
    ffs = mods["fifty_fifty"]["stats"]
    bz, bo = mods["boost"]["team_zero"], mods["boost"]["team_one"]
    cz, co = mods["core"]["team_zero"], mods["core"]["team_one"]
    ctz, cto = mods["controlled_play"]["team_zero"], mods["controlled_play"]["team_one"]
    rush = mods["rush"]["stats"]
    mvz, mvo = mods["movement"]["team_zero"], mods["movement"]["team_one"]
    team = {
        "score": [cz.get("goals"), co.get("goals")],
        "shots": [cz.get("shots"), co.get("shots")], "saves": [cz.get("saves"), co.get("saves")],
        "possession_pct": [100 * num(poss["team_zero_time"]) / ((num(poss["team_zero_time"]) + num(poss["team_one_time"])) or 1),
                           100 * num(poss["team_one_time"]) / ((num(poss["team_zero_time"]) + num(poss["team_one_time"])) or 1)],
        "ball_in_own_half_pct": [100 * num(half["team_zero_side_time"]) / ((num(half["team_zero_side_time"]) + num(half["team_one_side_time"])) or 1),
                                 100 * num(half["team_one_side_time"]) / ((num(half["team_zero_side_time"]) + num(half["team_one_side_time"])) or 1)],
        "ball_in_own_third_pct": [100 * num(third["team_zero_third_time"]) / (num(third["tracked_time"]) or 1), 100 * num(third["team_one_third_time"]) / (num(third["tracked_time"]) or 1)],
        "pressure_time": [terr.get("team_zero_session_time"), terr.get("team_one_session_time")],
        "pressure_sessions": [terr.get("team_zero_session_count"), terr.get("team_one_session_count")],
        "boost_collected": [bz["amount_collected"], bo["amount_collected"]],
        "boost_stolen": [bz["amount_stolen"], bo["amount_stolen"]],
        "boost_used": [bz["amount_used"], bo["amount_used"]],
        "big_pads": [bz.get("big_pads_collected"), bo.get("big_pads_collected")],
        "time_zero_boost_s": [bz.get("time_zero_boost"), bo.get("time_zero_boost")],
        "demos": [mods["demo"]["team_zero"].get("demos_inflicted"), mods["demo"]["team_one"].get("demos_inflicted")],
        "controlled_play_count": [ctz.get("count"), cto.get("count")], "controlled_play_time": [ctz.get("total_time"), cto.get("total_time")],
        "rushes": [rush.get("team_zero_count"), rush.get("team_one_count")],
        "ff_wins": [ffs.get("team_zero_wins"), ffs.get("team_one_wins")], "ff_count": ffs.get("count"),
        "kickoff_ff_wins": [ffs.get("kickoff_team_zero_wins"), ffs.get("kickoff_team_one_wins")],
        "kickoffs": kick.get("count"),
        "supersonic_s": [mvz.get("time_supersonic_speed"), mvo.get("time_supersonic_speed")],
        "tracked": poss.get("tracked_time"),
    }
    return {"file": os.path.basename(path)[:8], "start": int(next(v for k, v in meta["all_headers"] if k == "MatchStartEpoch")), "goals": goals, "touches": touches, "demos": demos, "team": team, "players": players}


if __name__ == "__main__":
    d = sys.argv[1]
    out = []
    for f in sorted(os.listdir(d)):
        if f.endswith(".replay"):
            out.append(analyse(os.path.join(d, f)))
            print("parsed", f[:8], file=sys.stderr)
    out.sort(key=lambda r: r["start"])
    json.dump(out, open(sys.argv[2], "w"), default=str)
