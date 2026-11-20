-- Community and private reef passages / anchorages.
create table if not exists passages (
  id           serial primary key,
  user_id      text not null,
  author_name  text not null default 'Skipper',
  title        text not null,
  region       text not null default '',
  notes        text not null default '',
  kind         text not null default 'passage',
  published    boolean not null default false,
  waypoints    jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists passages_published_idx on passages (published, created_at desc);
create index if not exists passages_user_id_idx on passages (user_id);

-- Atlas tracks (visual guides, not official hydrographic charts).
insert into passages (user_id, author_name, title, region, notes, kind, published, waypoints)
values
(
  'reefpilot-atlas',
  'ReefPilot Atlas',
  'Lady Musgrave lagoon entrance',
  'Great Barrier Reef',
  'North-west dog-leg into the lagoon. Hold the dark water in the cut, then turn for the sandy patches south of the cay. Do not anchor in the access channel. Visual guide only — confirm with official marks and a bow lookout.',
  'passage',
  true,
  '[
    {"lat":-23.8918,"lng":152.3842,"label":"Deep approach"},
    {"lat":-23.8964,"lng":152.3878,"label":"Outer cut"},
    {"lat":-23.8998,"lng":152.3906,"label":"Channel"},
    {"lat":-23.9026,"lng":152.3934,"label":"Inner turn"},
    {"lat":-23.9058,"lng":152.3964,"label":"Lagoon sand"}
  ]'::jsonb
),
(
  'reefpilot-atlas',
  'ReefPilot Atlas',
  'Heart Reef inner channel',
  'Hardy Reef, Whitsundays',
  'Thread the deeper blue inside Hardy Reef to look down on Heart Reef. The heart itself is a protected formation — stay in the channel, never over the coral. Visual guide only.',
  'passage',
  true,
  '[
    {"lat":-19.7488,"lng":149.1765,"label":"West approach"},
    {"lat":-19.7452,"lng":149.1818,"label":"Lagoon entry"},
    {"lat":-19.7424,"lng":149.1856,"label":"Inner channel"},
    {"lat":-19.7396,"lng":149.1888,"label":"Heart lookout"}
  ]'::jsonb
),
(
  'reefpilot-atlas',
  'ReefPilot Atlas',
  'Heron Island harbour cut',
  'Capricornia Cays',
  'Dredged south-west harbour approach. Coral gardens start immediately off the channel walls. Keep to the cut until inside the harbour basin.',
  'passage',
  true,
  '[
    {"lat":-23.4518,"lng":151.9052,"label":"SW approach"},
    {"lat":-23.4476,"lng":151.9096,"label":"Outer leads"},
    {"lat":-23.4442,"lng":151.9124,"label":"Cut"},
    {"lat":-23.4426,"lng":151.9142,"label":"Harbour"}
  ]'::jsonb
),
(
  'reefpilot-atlas',
  'ReefPilot Atlas',
  'Cardabia Passage, Ningaloo',
  'Ningaloo Reef',
  'The ocean cut west of Coral Bay / Monck Head. Read the pale reef flats against indigo deep water. Strong tidal stream in the pass. Visual guide only — check WA chart WA 1108.',
  'passage',
  true,
  '[
    {"lat":-23.1555,"lng":113.7620,"label":"Inside reef"},
    {"lat":-23.1540,"lng":113.7420,"label":"Inner pass"},
    {"lat":-23.1525,"lng":113.7220,"label":"Cardabia cut"},
    {"lat":-23.1510,"lng":113.7050,"label":"Ocean"}
  ]'::jsonb
),
(
  'reefpilot-atlas',
  'ReefPilot Atlas',
  'Teavanui Pass, Bora Bora',
  'Society Islands',
  'The only pass into Bora Bora lagoon, west side. Deep, well-used, with coral walls that read clearly on satellite. Once inside, stay in the darker lagoon water.',
  'passage',
  true,
  '[
    {"lat":-16.4948,"lng":-151.7775,"label":"Ocean"},
    {"lat":-16.4944,"lng":-151.7688,"label":"Pass mouth"},
    {"lat":-16.4940,"lng":-151.7612,"label":"Throat"},
    {"lat":-16.4952,"lng":-151.7520,"label":"Lagoon"}
  ]'::jsonb
),
(
  'reefpilot-atlas',
  'ReefPilot Atlas',
  'Lady Musgrave sand anchorage',
  'Great Barrier Reef',
  'Sandy lagoon patches south-east of the cay. Drop on pale sand, not brown coral. Set a tight swing circle — bommies are close. No-anchor zone near the island landing.',
  'anchorage',
  true,
  '[
    {"lat":-23.9068,"lng":152.3968,"label":"Sand patch"}
  ]'::jsonb
);
