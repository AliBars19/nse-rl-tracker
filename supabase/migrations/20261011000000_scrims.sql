-- Scrims: practice series outside NSE matchdays.
-- They have no league night (like playoffs) and count only towards player stats; points,
-- standings and team records ignore them (see src/lib/engine/scrims.ts).

alter type stage add value if not exists 'scrim';

-- A series has no night exactly when it is not a league/placement series (playoff or scrim).
-- Written without the 'scrim' literal so the whole file can run in one transaction.
alter table series drop constraint if exists series_check;
alter table series add constraint series_night_matches_stage
  check ((night_id is null) = (stage not in ('placement', 'league')));
