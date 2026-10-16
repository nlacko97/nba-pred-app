-- Resolves 2026 NBA All-Star markets and recomputes pick correctness.
-- Winners source: NBA.com All-Star Saturday + All-Star Game/MVP coverage.

with winners (slug, winner_label) as (
  values
    ('2026-shooting-stars-winner', 'Team Knicks'),
    ('2026-3pt-contest-winner', 'Damian Lillard'),
    ('2026-slam-dunk-winner', 'Keshad Johnson'),
    ('2026-asg-winner', 'Team USA Stars'),
    ('2026-asg-mvp', 'Anthony Edwards')
),
resolved as (
  update public.all_star_markets m
  set
    winning_option_id = o.id,
    status = 'resolved',
    updated_at = now()
  from winners w, public.all_star_market_options o
  where m.slug = w.slug
    and o.market_id = m.id
    and o.label = w.winner_label
  returning m.id
)
update public.all_star_picks p
set
  correct = (p.option_id = m.winning_option_id),
  updated_at = now()
from public.all_star_markets m
where p.market_id = m.id
  and m.id in (select id from resolved);
