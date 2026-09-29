import { AdminCard, Notice } from "@/components/admin/ui";
import { RosterEditor } from "@/components/admin/RosterEditor";
import { adminDataset } from "@/lib/data/admin";
import { ourTeam } from "@/lib/engine/context";
import { TEAM_KEYS } from "@/lib/view/team";

export default async function RosterAdmin() {
  const { ds } = await adminDataset();
  if (!ds) return <Notice>No current season.</Notice>;
  return (
    <>
      <Notice>
        Platform IDs (e.g. <code>steam:76561198…</code> or <code>epic:…</code>) let replays match players even when
        their in-game name changes. Linking a name on the Replays page fills these in for you.
      </Notice>
      {TEAM_KEYS.map((key) => {
        const o = ourTeam(ds, key);
        if (!o) return null;
        const rows = ds.roster
          .filter((r) => r.teamId === o.team.id)
          .map((r) => {
            const p = ds.players.find((x) => x.id === r.playerId)!;
            return {
              playerId: p.id,
              nickname: p.nickname,
              role: r.role,
              platformIds: Object.entries(p.platformIds ?? {}).map(([k, v]) => `${k}:${v}`).join(", "),
            };
          });
        return (
          <AdminCard key={key} title={`${o.team.name} roster`} id={`r-${key}`}>
            <RosterEditor teamKey={key} rows={rows} />
          </AdminCard>
        );
      })}
    </>
  );
}
