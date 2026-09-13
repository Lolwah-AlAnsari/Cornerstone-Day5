-- SĀLFA: optional coordinates, so a log can appear on the map.
--
-- Nullable by design: `place` stays free text, and a cup logged without a
-- location is still a valid cup. Existing rows are untouched. RLS needs no
-- change — the policies are table-wide, so these columns are covered by the
-- same auth.uid() = user_id rules.

alter table public.gahwa_logs
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

alter table public.gahwa_logs
  drop constraint if exists gahwa_logs_latitude_range;
alter table public.gahwa_logs
  add constraint gahwa_logs_latitude_range
  check (latitude is null or (latitude between -90 and 90));

alter table public.gahwa_logs
  drop constraint if exists gahwa_logs_longitude_range;
alter table public.gahwa_logs
  add constraint gahwa_logs_longitude_range
  check (longitude is null or (longitude between -180 and 180));

-- Either both coordinates or neither; half a point is not a point.
alter table public.gahwa_logs
  drop constraint if exists gahwa_logs_coords_paired;
alter table public.gahwa_logs
  add constraint gahwa_logs_coords_paired
  check ((latitude is null) = (longitude is null));

comment on column public.gahwa_logs.latitude is 'Optional WGS84 latitude for the map view.';
comment on column public.gahwa_logs.longitude is 'Optional WGS84 longitude for the map view.';
