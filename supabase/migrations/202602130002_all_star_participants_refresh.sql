with desired_options (slug, label, subtitle, option_order) as (
  values
    ('2026-shooting-stars-winner', 'Team All-Star', 'Shooting Stars: Team Chris Paul, Team Catherine Clark, Team Tim Hardaway Jr.', 1),
    ('2026-shooting-stars-winner', 'Team Cameron', 'Shooting Stars: Team Dylan Harper, Team Sabrina Ionescu, Team Karl-Anthony Towns', 2),
    ('2026-shooting-stars-winner', 'Team Harper', 'Shooting Stars: Team Chet Holmgren, Team Arike Ogunbowale, Team Tim Hardaway Sr.', 3),
    ('2026-shooting-stars-winner', 'Team Knicks', 'Shooting Stars: Team Mikal Bridges, Team Natasha Cloud, Team Allan Houston', 4),

    ('2026-3pt-contest-winner', 'Devin Booker', 'Phoenix Suns - Starry 3-Point Contest', 1),
    ('2026-3pt-contest-winner', 'Kon Knueppel', 'Charlotte Hornets - Starry 3-Point Contest', 2),
    ('2026-3pt-contest-winner', 'Damian Lillard', 'Milwaukee Bucks - Starry 3-Point Contest', 3),
    ('2026-3pt-contest-winner', 'Tyrese Maxey', 'Philadelphia 76ers - Starry 3-Point Contest', 4),
    ('2026-3pt-contest-winner', 'Donovan Mitchell', 'Cleveland Cavaliers - Starry 3-Point Contest', 5),
    ('2026-3pt-contest-winner', 'Jamal Murray', 'Denver Nuggets - Starry 3-Point Contest', 6),
    ('2026-3pt-contest-winner', 'Bobby Portis Jr.', 'Milwaukee Bucks - Starry 3-Point Contest', 7),
    ('2026-3pt-contest-winner', 'Norman Powell', 'Miami Heat - Starry 3-Point Contest', 8),

    ('2026-slam-dunk-winner', 'Carter Bryant', 'San Antonio Spurs - AT&T Slam Dunk', 1),
    ('2026-slam-dunk-winner', 'Jaxson Hayes', 'Los Angeles Lakers - AT&T Slam Dunk', 2),
    ('2026-slam-dunk-winner', 'Keshad Johnson', 'Miami Heat - AT&T Slam Dunk', 3),
    ('2026-slam-dunk-winner', 'Jase Richardson', 'Orlando Magic - AT&T Slam Dunk', 4),

    ('2026-asg-winner', 'Team World', 'NBA All-Star Game team', 1),
    ('2026-asg-winner', 'Team USA Stars', 'NBA All-Star Game team', 2),
    ('2026-asg-winner', 'Team USA Stripes', 'NBA All-Star Game team', 3),

    ('2026-asg-mvp', 'Deni Avdija', 'Team World', 1),
    ('2026-asg-mvp', 'Luka Doncic', 'Team World', 2),
    ('2026-asg-mvp', 'Nikola Jokic', 'Team World', 3),
    ('2026-asg-mvp', 'Jamal Murray', 'Team World', 4),
    ('2026-asg-mvp', 'Norman Powell', 'Team World', 5),
    ('2026-asg-mvp', 'Alperen Sengun', 'Team World', 6),
    ('2026-asg-mvp', 'Pascal Siakam', 'Team World', 7),
    ('2026-asg-mvp', 'Karl-Anthony Towns', 'Team World', 8),
    ('2026-asg-mvp', 'Victor Wembanyama', 'Team World', 9),

    ('2026-asg-mvp', 'Scottie Barnes', 'Team USA Stars', 10),
    ('2026-asg-mvp', 'Devin Booker', 'Team USA Stars', 11),
    ('2026-asg-mvp', 'Cade Cunningham', 'Team USA Stars', 12),
    ('2026-asg-mvp', 'Jalen Duren', 'Team USA Stars', 13),
    ('2026-asg-mvp', 'Anthony Edwards', 'Team USA Stars', 14),
    ('2026-asg-mvp', 'Chet Holmgren', 'Team USA Stars', 15),
    ('2026-asg-mvp', 'Jalen Johnson', 'Team USA Stars', 16),
    ('2026-asg-mvp', 'Tyrese Maxey', 'Team USA Stars', 17),

    ('2026-asg-mvp', 'Jaylen Brown', 'Team USA Stripes', 18),
    ('2026-asg-mvp', 'Jalen Brunson', 'Team USA Stripes', 19),
    ('2026-asg-mvp', 'Kevin Durant', 'Team USA Stripes', 20),
    ('2026-asg-mvp', 'De''Aaron Fox', 'Team USA Stripes', 21),
    ('2026-asg-mvp', 'Brandon Ingram', 'Team USA Stripes', 22),
    ('2026-asg-mvp', 'LeBron James', 'Team USA Stripes', 23),
    ('2026-asg-mvp', 'Kawhi Leonard', 'Team USA Stripes', 24),
    ('2026-asg-mvp', 'Donovan Mitchell', 'Team USA Stripes', 25)
),
market_scope as (
  select id, slug
  from public.all_star_markets
  where slug in (
    '2026-shooting-stars-winner',
    '2026-3pt-contest-winner',
    '2026-slam-dunk-winner',
    '2026-asg-winner',
    '2026-asg-mvp'
  )
),
upserted as (
  insert into public.all_star_market_options (market_id, label, subtitle, option_order)
  select
    m.id,
    d.label,
    d.subtitle,
    d.option_order
  from desired_options d
  join market_scope m on m.slug = d.slug
  on conflict (market_id, label) do update
  set
    subtitle = excluded.subtitle,
    option_order = excluded.option_order,
    updated_at = now()
  returning market_id
)
delete from public.all_star_market_options o
using market_scope m
where o.market_id = m.id
  and not exists (
    select 1
    from desired_options d
    where d.slug = m.slug
      and d.label = o.label
  );
