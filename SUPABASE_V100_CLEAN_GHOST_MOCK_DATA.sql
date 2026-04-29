-- Orsomarso Performance App - v100 cleanup for ghost/mock records
-- Run only if mock players p1..p6 appeared in production by mistake.
-- This script removes the demo players and dependent records by legacy_id.

begin;

-- Delete dependent data first to respect foreign keys.
delete from public.competition_players where legacy_id in ('co1','co2','co3','co4') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.competition_matches where legacy_id in ('m1');
delete from public.daily_external_loads where legacy_id in ('e1','e2','e3','e4','e5','e6','e7','e8','e9','e10') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.daily_internal_loads where legacy_id in ('i1','i2','i3','i4','i5','i6') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.daily_wellness where legacy_id in ('w1','w2','w3','w4','w5','w6','w7','w8','w9','w10') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.nutrition_records where legacy_id in ('n1','n2','n3','n4','n5','n6','n7','n8') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.cmj_records where legacy_id in ('c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','c11','c12') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.neuromuscular_records where legacy_id in ('neu1','neu2','neu3','neu4','neu5','neu6','neu7','neu8') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));
delete from public.fms_records where legacy_id in ('f1','f2','f3','f4','f5','f6','f7','f8') or player_id in (select id from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6'));

delete from public.players where legacy_id in ('p1','p2','p3','p4','p5','p6');

commit;
