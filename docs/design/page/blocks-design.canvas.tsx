import { Page, Section, Text, Callout, Table, TableOfContents, Metrics, NumberedList, BulletList, Segmented, Diagram, LinkCards, Grid, Properties, ProsCons, Button, Toggle, useGrokTheme, useState, type ReactNode, type PointerEvent, type KeyboardEvent } from "grok/canvas";

type Prim = readonly (string | number)[];
interface Screen { id: string; title: string; w: number; h: number; p: Prim[]; a: string[]; dark?: boolean }

const NS = { page: "#F4F5F7", bezel: "#05060A", bg: "#0D0F13", panel: "#14171C", ctlA: "#20252C", ctlB: "#181B21", ctlS: "#2A3038", acc: "#FF6A3D", accHi: "#FF8A63", accLo: "#E2512A", onAcc: "#120C0A", txt: "#ECEEF2", mut: "#9AA3AF", grid: "#20242B", gridS: "#363D47", note: "#C9D1DC", ghost: "#6B7480", sel: "#FFFFFF", warnF: "#2A2312", warnS: "#E0A43A", dangF: "#2C1617", dangS: "#E5484D", mark: "#0E7C86" };

function WireDark({ s }: { s: Screen }) {
  const t = useGrokTheme();
  const fam = t.font.family;
  const gid = `g-${s.id}`;
  const items = s.p.map((q, i) => {
    const k = String(q[0]);
    if (k === "r") {
      const x = Number(q[1]), y = Number(q[2]), w = Number(q[3]), h = Number(q[4]);
      const role = String(q[5]); const label = String(q[6] ?? ""); const fs = Number(q[7] ?? 13);
      const rx = role === "n" || role === "ng" ? 3 : h >= 40 ? 12 : 6;
      let fill = `url(#${gid}-ctl)`, stroke = NS.ctlS, sw = 1, dash: string | undefined = undefined, tc = NS.txt, fw = 500;
      if (role === "p") { fill = NS.panel; stroke = "none"; sw = 0; }
      if (role === "a") { fill = `url(#${gid}-cap)`; stroke = "none"; sw = 0; tc = NS.onAcc; fw = 700; }
      if (role === "s") { const small = h < 40 && w < 200 && !label; fill = small ? NS.acc : "#262B33"; stroke = NS.sel; sw = 2; fw = 650; }
      if (role === "n") { fill = NS.note; stroke = "none"; sw = 0; }
      if (role === "ng") { fill = "none"; stroke = NS.ghost; sw = 1.2; dash = "3 2"; }
      if (role === "ld") { fill = "none"; stroke = NS.mut; sw = 1.2; dash = "5 4"; }
      if (role === "h") { fill = NS.panel; stroke = NS.ghost; sw = 1.5; dash = "6 4"; }
      if (role === "w") { fill = NS.warnF; stroke = NS.warnS; sw = 1.5; }
      if (role === "d") { fill = NS.dangF; stroke = NS.dangS; sw = 1.5; }
      const hi = (role === "c" || role === "a") && h >= 40;
      return (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
          {hi ? <line x1={x + rx} y1={y + 1} x2={x + w - rx} y2={y + 1} stroke="#FFFFFF" strokeOpacity={role === "a" ? 0.35 : 0.06} /> : null}
          {label ? <text x={x + w / 2} y={y + h / 2 + fs * 0.35} fontSize={fs} textAnchor="middle" fill={tc} fontWeight={fw} fontFamily={fam}>{label}</text> : null}
        </g>
      );
    }
    if (k === "t") {
      const role = String(q[5] ?? "t"); const an = String(q[6] ?? "s"); const fs = Number(q[4]);
      const fill = role === "tm" ? NS.mut : role === "to" || role === "tob" ? NS.onAcc : NS.txt;
      const fw = role === "tob" ? 750 : role === "tb" ? 650 : 400;
      return <text key={i} x={Number(q[1])} y={Number(q[2])} fontSize={fs} fill={fill} fontWeight={fw} letterSpacing={fs >= 24 ? -0.4 : 0} textAnchor={an === "m" ? "middle" : an === "e" ? "end" : "start"} fontFamily={fam}>{String(q[3])}</text>;
    }
    if (k === "l") {
      const role = String(q[5]);
      const stroke = role === "la" ? NS.acc : role === "ls" ? NS.gridS : role === "ld" ? NS.mut : NS.grid;
      return <line key={i} x1={Number(q[1])} y1={Number(q[2])} x2={Number(q[3])} y2={Number(q[4])} stroke={stroke} strokeWidth={role === "la" ? 2 : role === "ls" ? 1.5 : 1} strokeDasharray={role === "ld" ? "5 4" : undefined} />;
    }
    if (k === "k") {
      const x = Number(q[1]), y = Number(q[2]);
      return (
        <g key={i}>
          <circle cx={x} cy={y} r={9} fill={NS.mark} stroke="#FFFFFF" strokeWidth={1.5} />
          <text x={x} y={y + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="#FFFFFF" fontFamily={fam}>{String(q[3])}</text>
        </g>
      );
    }
    return null;
  });
  const maxW = s.w > 700 ? "100%" : Math.min(s.w, 380);
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} role="img" aria-label={`PROPOSED wireframe, visual north star style: ${s.title}`} style={{ width: maxW, maxWidth: "100%", height: "auto" }}>
      <defs>
        <linearGradient id={`${gid}-cap`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={NS.accHi} /><stop offset="1" stopColor={NS.accLo} /></linearGradient>
        <linearGradient id={`${gid}-ctl`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={NS.ctlA} /><stop offset="1" stopColor={NS.ctlB} /></linearGradient>
      </defs>
      <rect x={3} y={3} width={s.w - 6} height={s.h - 6} rx={28} fill={NS.bg} stroke={NS.bezel} strokeWidth={6} />
      {items}
      <text x={s.w - 14} y={s.h - 10} fontSize={9} textAnchor="end" fill={NS.mut} fontFamily={fam}>PROPOSED · not implemented · sizes are proposals pending measurement</text>
    </svg>
  );
}

function Wire({ s }: { s: Screen }) {
  return s.dark ? <WireDark s={s} /> : <WireLight s={s} />;
}

function WireLight({ s }: { s: Screen }) {
  const t = useGrokTheme();
  const cat = t.dataviz.categorical;
  const accent = cat[0];
  const sel = cat[1] ?? accent;
  const mark = cat[2] ?? accent;
  const items = s.p.map((q, i) => {
    const k = String(q[0]);
    if (k === "r") {
      const x = Number(q[1]), y = Number(q[2]), w = Number(q[3]), h = Number(q[4]);
      const role = String(q[5]); const label = String(q[6] ?? ""); const fs = Number(q[7] ?? 13);
      let fill = t.bg.elevated, stroke = t.border.default, sw = 1, dash: string | undefined = undefined, op = 1, tc = t.text.primary, fw = 400;
      if (role === "p") { fill = t.bg.subtle; stroke = t.border.weak; }
      if (role === "a") { fill = accent; stroke = accent; tc = t.text.onColor; fw = 600; }
      if (role === "s") { fill = t.fill.warningSubtle; stroke = t.text.primary; sw = 3; fw = 600; }
      if (role === "n") { fill = accent; stroke = accent; op = 0.6; }
      if (role === "ng") { fill = t.dataviz.other; stroke = t.text.tertiary; dash = "3 2"; op = 0.6; }
      if (role === "ld") { fill = "none"; stroke = t.text.secondary; dash = "5 4"; sw = 1.5; }
      if (role === "h") { fill = t.bg.subtle; stroke = t.text.tertiary; dash = "6 4"; }
      if (role === "w") { fill = t.fill.warningSubtle; stroke = t.border.default; }
      if (role === "d") { fill = t.fill.dangerSubtle; stroke = t.border.default; }
      const r = role === "n" || role === "ng" ? 2 : Math.min(10, h / 4);
      return (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} opacity={op} />
          {label ? <text x={x + w / 2} y={y + h / 2 + fs * 0.35} fontSize={fs} textAnchor="middle" fill={tc} fontWeight={fw} fontFamily={t.font.family}>{label}</text> : null}
        </g>
      );
    }
    if (k === "t") {
      const role = String(q[5] ?? "t"); const an = String(q[6] ?? "s");
      const fill = role === "tm" ? t.text.secondary : role === "to" || role === "tob" ? t.text.onColor : t.text.primary;
      const fw = role === "tb" || role === "tob" ? 600 : 400;
      return <text key={i} x={Number(q[1])} y={Number(q[2])} fontSize={Number(q[4])} fill={fill} fontWeight={fw} textAnchor={an === "m" ? "middle" : an === "e" ? "end" : "start"} fontFamily={t.font.family}>{String(q[3])}</text>;
    }
    if (k === "l") {
      const role = String(q[5]);
      const stroke = role === "la" ? accent : role === "ls" ? t.border.strong : role === "ld" ? t.text.secondary : t.border.subtle;
      return <line key={i} x1={Number(q[1])} y1={Number(q[2])} x2={Number(q[3])} y2={Number(q[4])} stroke={stroke} strokeWidth={role === "la" ? 2.5 : role === "ls" ? 1.5 : 1} strokeDasharray={role === "ld" ? "5 4" : undefined} />;
    }
    if (k === "k") {
      const x = Number(q[1]), y = Number(q[2]);
      return (
        <g key={i}>
          <circle cx={x} cy={y} r={9} fill={mark} />
          <text x={x} y={y + 4} fontSize={11} fontWeight={600} textAnchor="middle" fill={t.text.onColor} fontFamily={t.font.family}>{String(q[3])}</text>
        </g>
      );
    }
    return null;
  });
  const maxW = s.w > 700 ? "100%" : Math.min(s.w, 380);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <svg viewBox={`0 0 ${s.w} ${s.h}`} role="img" aria-label={`PROPOSED wireframe: ${s.title}`} style={{ width: maxW, maxWidth: "100%", height: "auto" }}>
        <rect x={1} y={1} width={s.w - 2} height={s.h - 2} rx={14} fill={t.bg.base} stroke={t.border.strong} strokeWidth={2} />
        {items}
        <text x={s.w - 8} y={s.h - 8} fontSize={9} textAnchor="end" fill={t.text.tertiary} fontFamily={t.font.family}>PROPOSED · not implemented · sizes are proposals pending measurement</text>
      </svg>
    </div>
  );
}

function Figure({ s }: { s: Screen }) {
  return (
    <Grid columns={2} plain>
      <Wire s={s} />
      <div>
        <Text><b>{s.title}</b></Text>
        <NumberedList items={s.a} />
      </div>
    </Grid>
  );
}

const ribbon = (x0: number, xs: number[][], h = 6): Prim[] => xs.map(([x, y, w]) => ["r", x0 + x, y, w, h, "n", "", 13]);

const PLAY: Screen = {
  id: "play", dark: true, title: "00 · Play & Capture — phone portrait (compact)", w: 360, h: 780,
  p: [
    ["r",8,8,148,48,"c","Sketch 14 ▾",14],["r",164,8,92,48,"c","92 · 4/4",13],["t",210,52,"grid inferred",8,"tm","m"],["r",260,8,44,48,"c","↶",18],["r",308,8,44,48,"c","⋮",18],
    ["k",16,12,1],["k",170,12,2],["k",266,12,3],
    ["r",8,64,176,40,"p","● Keystation 61 · receiving",11],["r",190,64,80,40,"p","🔊 Sound on",11],["r",276,64,76,40,"p","⏺ 1:58 kept",11],["k",12,66,4],["k",194,66,5],["k",280,66,6],
    ["r",8,112,48,56,"c","◀",16],["r",60,112,240,56,"c","Layer 2 · Warm EP",14],["r",304,112,48,56,"c","▶",16],["k",64,116,7],
    ["r",8,176,344,236,"p","",13],["t",16,194,"Recent playing · last 30 s",11,"tm","s"],
    ...[16,56,96,136,176,216,256,296,336].map((x): Prim => ["l",x,200,x,404,"lg"]),
    ...ribbon(0, [[24,370,24],[52,338,16],[72,354,36],[120,322,20],[140,386,16],[156,346,48],[212,330,16],[228,362,28],[264,314,20],[288,378,32],[324,338,16]]),
    ["r",92,204,248,200,"ld","",13],["t",216,400,"likely phrase (preview)",9,"tm","m"],["l",342,200,342,404,"la"],["t",338,214,"now",9,"tm","e"],["k",20,214,8],
    ["r",8,420,82,56,"c","1 Bass ▶",12],["r",95,420,82,56,"s","2 ◎ next",12],["r",182,420,82,56,"c","3 empty",12],["r",269,420,82,56,"c","4 empty",12],["k",96,424,9],
    ["r",8,484,64,56,"c","▶ Play",12],["r",78,484,100,56,"c","Click: off",12],["r",184,484,168,56,"c","Layers ▦",12],["k",12,488,10],
    ["r",8,552,344,112,"a","",14],["t",180,600,"Capture",26,"tob","m"],["t",180,628,"last phrase → Layer 2",12,"to","m"],["t",180,648,"optional mapping: CC 67",10,"to","m"],["k",20,560,11],
    ["r",8,676,344,56,"c","Touch keys (on screen) ▴",13],["k",20,680,12],
    ["t",180,756,"Live region: 'Captured 8 bars at 92 BPM into layer 2. Looping.'",9,"tm","m"]
  ],
  a: [
    "Sketch menu: library, rename, save state, export. One sketch = one shared tempo/meter + its parts (first slice: one part; four is a milestone, not a max).",
    "Grid chip shows the inferred grid (tempo · meter). Tap = re-open grid review. Never changes playback speed.",
    "Undo always visible (48dp). Read aloud with its label, e.g. 'Undo Capture layer 2'.",
    "Input chip says 'receiving' only after a real message arrived. Shape: filled dot = live, ring = connected-silent, ✕ = none.",
    "Sound chip: 'Sound on' / 'Tap to start sound' / 'Interrupted – tap to resume'. Text + icon, not colour alone.",
    "History chip: how much recent playing Capture can reach (proposed 120 s rolling + hard event/byte cap). Shows 'gap' if events were dropped under overload. No arming.",
    "Sound pill targets the Target layer. ◀ ▶ step sounds while you keep playing; centre opens the Sound browser sheet.",
    "Ribbon = the buffer made visible. Dashed bracket previews the likely phrase so Capture's result is predictable.",
    "Layer strip: ◎ + 'next' + thick outline mark the capture target. Tap to retarget; long-press → layer actions.",
    "Transport is secondary: Capture never needs Play first. Click (metronome) is opt-in.",
    "Capture: 112dp (proposed) tall, full width, bottom-centre. Optionally mapped to any spare CC/button/pad (no spare pedal required); sustain and playing keys are never taken by default.",
    "Touch keys open as a drawer, always labelled 'on screen', never listed as a MIDI device."
  ]
};

const LAND: Screen = {
  id: "land", title: "01 · Phone landscape (compact height < 480dp)", w: 780, h: 360,
  p: [
    ["r",8,8,140,44,"c","Sketch 14 ▾",13],["r",152,8,90,44,"c","92 · 4/4",12],["r",248,8,170,44,"p","● Keystation · receiving",11],["r",424,8,100,44,"p","🔊 Sound on",11],["r",528,8,44,44,"c","↶",16],
    ["r",8,60,48,48,"c","◀",14],["r",60,60,400,48,"c","Layer 2 · Warm EP",13],["r",464,60,48,48,"c","▶",14],
    ["r",8,116,560,180,"p","",13],["t",16,132,"Recent playing · last 30 s",10,"tm","s"],
    ...[16,56,96,136,176,216,256,296,336,376,416,456,496,536].map((x): Prim => ["l",x,138,x,288,"lg"]),
    ...ribbon(0, [[36,226,24],[72,210,20],[104,242,36],[160,194,20],[192,234,44],[256,202,20],[300,250,32],[360,218,24],[424,186,36],[480,226,24],[520,210,20]]),
    ["r",180,140,380,152,"ld","",13],
    ["r",8,304,136,48,"c","1 Bass",12],["r",150,304,136,48,"s","2 ◎ next",12],["r",292,304,136,48,"c","3 empty",12],["r",434,304,136,48,"c","4 empty",12],
    ["r",580,8,192,236,"a","",13],["t",676,120,"Capture",26,"tob","m"],["t",676,148,"→ Layer 2",12,"to","m"],
    ["r",580,252,94,100,"c","▶ Play",12],["r",678,252,94,100,"c","Touch keys",12],["k",586,14,1],["k",14,122,2],["k",14,308,3]
  ],
  a: [
    "Capture becomes a tall right-hand rail (192×236dp) under the thumb; the ribbon keeps the width.",
    "Compact height: status collapses into one row; no sheet taller than 60% of the height.",
    "Layer strip moves bottom-left so hands on the controller never reach across the screen."
  ]
};

const NARROW: Screen = {
  id: "narrow", title: "02 · Fold folded / cover screen (< 360dp wide)", w: 320, h: 780,
  p: [
    ["r",8,8,200,48,"c","Sketch 14 ▾",13],["r",212,8,48,48,"c","↶",16],["r",264,8,48,48,"c","⋮",16],["r",8,64,304,40,"p","● Keystation · receiving · 🔊 on",11],
    ["r",8,112,48,56,"c","◀",14],["r",60,112,200,56,"c","L2 · Warm EP",13],["r",264,112,48,56,"c","▶",14],
    ["r",8,176,304,236,"p","",13],["t",16,194,"Recent playing",11,"tm","s"],
    ...ribbon(0, [[23,370,22],[52,338,18],[81,354,32],[124,322,18],[146,386,14],[174,346,43],[225,330,14],[254,362,25],[282,314,14]]),
    ["r",8,420,304,56,"s","Target: Layer 2 of 4 ▾",13],["r",8,484,148,56,"c","▶ Play",12],["r",164,484,148,56,"c","Layers ▦",12],
    ["r",8,552,304,112,"a","",13],["t",160,604,"Capture",26,"tob","m"],["t",160,630,"→ Layer 2",12,"to","m"],["r",8,676,304,56,"c","Touch keys (on screen) ▴",13],
    ["k",14,424,1],["k",14,68,2],["k",14,556,3]
  ],
  a: [
    "Below 360dp the 4-slot layer strip collapses into one 'Target' chip (opens a 4-row picker). Capture keeps full height.",
    "Status chips merge into one row; tapping it opens the full readiness panel.",
    "Folding/unfolding must not stop sound, close the review, or drop the selection (size classes change at runtime)."
  ]
};

const lrow = (y: number, title: string, role: string, notes: boolean): Prim[] => [
  ["r",428,y,276,112,role,"",13],["t",440,y+22,title,13,"tb","s"],
  ...(notes ? ribbon(0, [[445,y+42,19],[474,y+62,14],[502,y+52,26],[541,y+72,14],[574,y+42,22],[608,y+62,17],[646,y+52,14]], 8) : []),
  ["r",600,y+56,48,48,"c","M",12],["r",652,y+56,48,48,"c","S",12]
];

const FOLD: Screen = {
  id: "fold", dark: true, title: "03 · Fold open (medium width, flat) — Play + Layers", w: 720, h: 812,
  p: [
    ["r",8,8,180,48,"c","Sketch 14 ▾",14],["r",196,8,100,48,"c","92 · 4/4",13],["r",304,8,220,48,"p","● Keystation 61 · receiving",11],["r",532,8,110,48,"p","🔊 Sound on",11],["r",648,8,64,48,"c","↶",16],
    ["r",8,64,404,728,"p","",13],["t",16,84,"PLAY",11,"tm","s"],["r",16,92,48,56,"c","◀",14],["r",68,92,288,56,"c","Layer 2 · Warm EP",13],["r",360,92,44,56,"c","▶",14],
    ["r",16,156,388,300,"c","",13],["t",24,174,"Recent playing · last 60 s",10,"tm","s"],
    ...ribbon(0, [[31,346,22],[60,314,18],[89,378,32],[132,298,18],[154,410,14],[182,322,43],[233,386,14],[262,338,25],[290,290,14],[334,362,32],[370,330,18]]),
    ["r",16,464,388,120,"a","",13],["t",210,520,"Capture",28,"tob","m"],["t",210,548,"last phrase → Layer 2",12,"to","m"],
    ["r",16,592,190,56,"c","▶ Play",12],["r",214,592,190,56,"c","Click: off",12],["r",16,656,388,128,"c","Touch keys (on screen)",13],
    ["r",420,64,292,728,"p","",13],["t",428,84,"LAYERS",11,"tm","s"],
    ...lrow(96,"1 · Bass · 4 bars","c",true),...lrow(216,"2 · Warm EP · ◎ next","s",true),...lrow(336,"3 · empty","c",false),...lrow(456,"4 · empty","c",false),
    ["k",22,96,1],["k",426,98,2],["k",22,468,3]
  ],
  a: [
    "Medium width (600–840dp): two panes. Layers always visible, so retargeting Capture is one tap with no navigation.",
    "Each layer row 112dp: name, sound, length, thumbnail, Mute/Solo as letters (not colour) with pressed state.",
    "Capture stays bottom of the Play pane. No interactive element within 24dp of a separating hinge."
  ]
};

const DESK: Screen = {
  id: "desk", dark: true, title: "05 · Desktop browser (expanded / large) — three regions", w: 1280, h: 760,
  p: [
    ["r",8,8,1264,48,"p","",13],["t",20,38,"Blocks · Sketch 14 ▾",14,"tb","s"],["r",260,12,120,40,"c","92 · 4/4 grid",12],["r",388,12,260,40,"p","● Keystation 61 (Web MIDI) · receiving",11],["r",656,12,150,40,"p","🔊 Sound on",11],["r",1120,12,72,40,"c","↶ ⌘Z",12],["r",1196,12,72,40,"c","Export",12],
    ["r",8,64,280,688,"p","",13],["t",16,84,"LAYERS",11,"tm","s"],["r",16,96,264,84,"c","1 · Bass · 4 bars",13],["r",16,188,264,84,"s","2 · Warm EP ◎ next",13],["r",16,280,264,84,"c","3 · empty",13],["r",16,372,264,84,"c","4 · empty",13],
    ["r",296,64,680,688,"p","",13],["t",304,84,"PLAY / EDIT (centre)",11,"tm","s"],["r",304,96,664,260,"c","",13],["t",312,114,"Recent playing · last 60 s",10,"tm","s"],
    ...ribbon(0, [[320,284,24],[352,252,20],[384,316,36],[432,236,20],[456,332,16],[488,260,48],[544,324,16],[576,276,28],[608,228,16],[656,300,36],[696,268,20],[752,244,40],[812,292,28],[872,252,36]]),
    ["r",304,364,664,100,"a","",13],["t",636,410,"Capture   (C or mapped control)",24,"tob","m"],["t",636,438,"last phrase → Layer 2",12,"to","m"],
    ["r",304,472,664,272,"c","Touch keys (on screen) — or computer keys A–K when enabled",13],
    ["r",984,64,288,688,"p","",13],["t",992,84,"INSPECTOR",11,"tm","s"],["r",992,96,272,180,"c","Sound: Warm EP (browse ⌘K)",12],["r",992,284,272,220,"c","Last capture review",12],["r",992,512,272,232,"c","Controller map",12],
    ["k",24,100,1],["k",312,370,2],["k",400,16,3]
  ],
  a: [
    "Expanded/large: layers left, play/edit centre, inspector right (sound, review, controller). Nothing hidden behind sheets.",
    "Every touch action has a key: C capture, Space play, ⌘Z undo, 1–4 target layer, E/D/R tools, ⌘K sounds. Shown in tooltips.",
    "Web: chip names the transport ('Web MIDI'). Unsupported/denied browsers show the reason here, never a fake 'connected'."
  ]
};

const FIRST: Screen = {
  id: "first", title: "06 · First run — sound + keyboard readiness", w: 360, h: 780,
  p: [
    ["t",20,48,"Let's make sound",24,"tb","s"],["t",20,74,"Two things, then just play.",13,"tm","s"],
    ["r",8,96,344,172,"c","",13],["t",24,124,"1  Sound",16,"tb","s"],["t",24,148,"Status: Not started",13,"t","s"],["t",24,168,"One tap starts audio, then asks for MIDI.",11,"tm","s"],["r",24,184,312,64,"a","Start (sound, then MIDI)",15],
    ["r",8,280,344,212,"c","",13],["t",24,308,"2  MIDI keyboard",16,"tb","s"],["t",24,332,"✓ Keystation 61 connected (USB)",13,"t","s"],["t",24,352,"Not yet heard — play any key to test",12,"tm","s"],["r",24,368,312,56,"p","Waiting for a note…  ◌",13],["r",24,432,152,48,"c","Choose device ▾",12],["r",184,432,152,48,"c","Help connecting",12],
    ["r",8,504,344,132,"c","",13],["t",24,532,"No keyboard?",16,"tb","s"],["t",24,556,"Play the on-screen touch keys instead.",12,"tm","s"],["t",24,574,"They are a touch instrument, not a MIDI device.",11,"tm","s"],["r",24,584,312,44,"c","Use touch keys",13],
    ["r",8,660,344,72,"c","Start playing →",18],["t",180,752,"Start playing enables once Sound is on (keyboard optional).",10,"tm","m"],
    ["k",14,100,1],["k",14,284,2],["k",14,508,3],["k",14,664,4]
  ],
  a: [
    "Web: one explicit enable gesture resumes audio, then requests MIDI. The browser's own prompt varies, so the touch count is not fixed. Native: auto-starts.",
    "Connected ≠ receiving. Only says 'Receiving ✓ C4 vel 72' after a real Note On arrives (proves cable, channel, permission).",
    "Touch keys are an equal path, labelled on-screen; choosing them never marks the MIDI card ready.",
    "One primary action per card. Sound first, so the first key press is heard."
  ]
};

const REVIEW: Screen = {
  id: "review", dark: true, title: "08 · Capture review & grid corrections (non-modal sheet; loop keeps playing)", w: 360, h: 780,
  p: [
    ["r",8,8,344,160,"p","(Play screen dimmed but live — keys still play)",11],["r",0,176,360,604,"c","",13],["r",156,184,48,6,"p","",13],
    ["t",16,214,"Captured → Layer 1",16,"tb","s"],["t",16,236,"8 bars · 92 BPM · 4/4 · looping ▶",12,"tm","s"],["r",240,196,112,48,"c","Discard",13],
    ["r",16,252,328,120,"p","",13],
    ...[24,63,102,141,180,219,258,297,336].map((x): Prim => ["l",x,260,x,364,"lg"]),
    ["r",8,286,19.5,7,"ng","",13],["r",19.7,322,15.6,7,"ng","",13],
    ...ribbon(0, [[39.6,304,23.4],[66.9,277,19.5],[94.2,313,35.1],[141,286,19.5],[164.4,331,15.6],[195.6,295,46.8],[250.2,268,15.6],[281.4,322,27.3],[312.6,286,15.6]], 7),
    ["l",40,256,40,368,"la"],["t",44,270,"1",12,"tb","s"],["r",30,348,22,22,"s","◆",10],["t",24,384,"Your timing is unchanged — only the grid moves.",11,"tm","s"],
    ["t",16,412,"Loop length",12,"tb","s"],["r",16,420,62,48,"c","½",12],["r",82,420,62,48,"c","4 bars",12],["r",148,420,62,48,"s","8 bars ✓",12],["r",214,420,62,48,"c","16",12],["r",280,420,62,48,"c","×2",12],
    ["t",16,494,"Beat one",12,"tb","s"],["r",16,502,64,48,"c","◀ beat",11],["r",84,502,176,48,"c","Tap a note to set '1'",11],["r",264,502,80,48,"c","beat ▶",11],
    ["t",16,576,"Count it as",12,"tb","s"],["r",16,584,78,48,"s","92 ✓",12],["r",98,584,78,48,"c","×2 (184)",12],["r",180,584,78,48,"c","½ (46)",12],["r",262,584,78,48,"c","Set BPM…",12],
    ["t",16,652,"Hear",12,"tb","s"],["r",16,660,160,48,"s","Loop ✓",12],["r",184,660,160,48,"c","Original take",12],
    ["r",16,720,160,48,"c","Fine shift ±",12],["r",184,720,160,48,"a","Keep ✓",14],
    ["k",340,222,1],["k",60,262,2],["k",340,420,3],["k",340,502,4],["k",340,584,5],["k",340,660,6],["k",340,712,7]
  ],
  a: [
    "Sheet is non-blocking (adopted): the loop keeps playing and the controller keeps sounding. Undo reverts the capture. For later layers the tempo is locked to the sketch.",
    "Notes played before the loop start stay in the take (dashed ghosts). Moving the loop brings them back — nothing is cropped.",
    "Loop length chips re-map bars; they never stretch audio or notes. Selected chip has ✓ + thick outline.",
    "Beat one: step by beat, or tap any note in the mini-timeline to make it '1'. Moves bar lines, not notes.",
    "'Count it as': the inferred tempo plus ½ / ×2 / Set BPM, always shown. Extra alternatives only when inference justifies them; no confidence %. Meter 4/4 at first. Re-maps bars; never speeds playback.",
    "Original take = the raw, unlooped performance exactly as played. One tap away here and later from the layer menu.",
    "Keep is the default: dismissing, playing on, or capturing again keeps it. Discard is explicit and undoable."
  ]
};

const keys = ["B3","A#","A3","G#","G3","F#","F3","E3","D#","D3","C#","C3","B2","A#"];
const blackKeys = new Set([1,3,5,8,10,13]);
const ROLL: Screen = {
  id: "roll", dark: true, title: "11 · Touch piano roll — phone (Edit tool, chord selected, dragging with loupe)", w: 360, h: 820,
  p: [
    ["r",8,8,48,48,"c","←",16],["t",64,30,"Layer 2 · Warm EP",14,"tb","s"],["t",64,48,"Edit · drag notes · 2 fingers navigate",10,"tm","s"],["r",256,8,48,48,"c","↶",16],["r",304,8,48,48,"c","↷",16],
    ["r",8,64,80,48,"s","Edit ✓",12],["r",92,64,80,48,"c","Draw",12],["r",176,64,80,48,"c","Range",12],["r",260,64,92,48,"c","▶ Loop",12],
    ["r",8,120,344,24,"p","",13],["r",60,122,140,20,"c","",9],["t",130,136,"view",9,"tm","m"],
    ["r",56,150,296,32,"p","",13],["t",64,170,"1",11,"tb","s"],["t",138,170,"2",11,"t","s"],["t",212,170,"3",11,"t","s"],["t",286,170,"4",11,"t","s"],["r",58,150,24,32,"s","[",13],["r",326,150,24,32,"s","]",13],
    ...keys.flatMap((k, i): Prim[] => [["r",8,188+i*32,44,30,blackKeys.has(i) ? "p" : "c",k,9],["l",56,188+i*32,352,188+i*32,"lg"]]),
    ...Array.from({ length: 17 }, (_, i): Prim => ["l",56+i*18.5,188,56+i*18.5,636,i % 4 === 0 ? "ls" : "lg"]),
    ["r",56,318,37,28,"s","",13],["r",56,414,37,28,"s","",13],["r",56,542,37,28,"s","",13],
    ["r",102,318,18.5,28,"n","",13],["r",130,254,55.5,28,"n","",13],["r",204,414,37,28,"n","",13],["r",204,318,37,28,"n","",13],["r",250,478,18.5,28,"n","",13],["r",278,382,55.5,28,"n","",13],
    ["r",56,414,8,28,"s","",13],["r",92,414,8,28,"s","",13],
    ["r",148,236,180,120,"c","",13],["t",156,252,"loupe ×2.5",9,"tm","s"],...[160,200,240,280,320].map((x): Prim => ["l",x,258,x,348,"lg"]),["r",176,286,80,40,"s","",13],["t",238,344,"G3 · 1.1.1 · ⅛",11,"tb","m"],
    ["r",96,470,64,64,"ld","",13],["t",128,506,"finger",9,"tm","m"],
    ["r",8,640,344,40,"p","",13],["t",16,656,"Vel",10,"tm","s"],
    ...[[60,660],[60,649],[60,644],[106,664],[134,655],[208,652],[208,657],[254,646],[282,662]].map(([x, y]): Prim => ["l",x,678,x,y,"ls"]),
    ["r",8,688,344,112,"c","",13],
    ["r",14,694,80,48,"c","Delete",11],["r",98,694,80,48,"c","Duplicate",11],["r",182,694,80,48,"c","Len −",11],["r",266,694,80,48,"c","Len +",11],
    ["r",14,746,108,48,"c","Vel 84 ±",11],["r",126,746,108,48,"c","Quantise…",11],["r",238,746,108,48,"c","Chord",11],
    ["k",12,68,1],["k",62,124,2],["k",60,154,3],["k",150,240,4],["k",60,418,5],["k",12,644,6],["k",18,750,7]
  ],
  a: [
    "Explicit tools with text labels. Current tool shown 3 ways: pressed chip, subtitle text, grid hint. Delete/duplicate are actions, not modes.",
    "Overview strip: 1-finger drag pans; the box is the visible window. Drag time ruler = pan time; drag keys = pan pitch; tap a key = select that pitch.",
    "Loop brace handles [ ] have 48dp hit areas on the time ruler; they snap to beats and edit the loop, never notes.",
    "Loupe appears 96dp above the finger during any drag (flips below near the top edge): ×2.5 view + pitch · position · length readout.",
    "Selected notes: thick outline + handle tabs outside short notes (48dp hit) + count in the action bar.",
    "Velocity lane: stem height (not colour) shows velocity; selected stems bold. Use the 'Vel ±' stepper (lane drag is P1).",
    "Action bar acts on the selection (48dp buttons). Every drag has a tap alternative: Len ±, Vel ±, nudge in overflow."
  ]
};

const EDGE: Screen = {
  id: "edge", dark: true, title: "16 · Capture edge states — no pulse, capture while playing, overload gap, all layers full", w: 1080, h: 640,
  p: [
    ["r",8,8,260,600,"c","",13],["t",22,34,"A · No steady pulse",14,"tb","s"],["r",276,8,260,600,"c","",13],["t",290,34,"B · Capture while playing",14,"tb","s"],["r",544,8,260,600,"c","",13],["t",558,34,"C · History gap (overload)",14,"tb","s"],["r",812,8,260,600,"c","",13],["t",826,34,"D · All layers full",14,"tb","s"],
    ["t",22,58,"Captured → Layer 1 · free time",11,"tm","s"],["r",22,70,232,100,"p","",13],
    ...ribbon(0, [[28,92,16],[52,128,10],[86,104,26],[128,152,8],[156,116,22],[200,140,12]], 10),
    ["t",22,190,"No steady pulse found.",12,"tb","s"],["t",22,208,"Looping the whole phrase (12.4 s).",11,"t","s"],["r",22,222,232,48,"s","Keep as free-time take ✓",12],["r",22,278,232,48,"c","Set BPM…",12],["r",22,334,112,48,"c","½",12],["r",142,334,112,48,"c","×2",12],
    ["t",22,400,"½ / ×2 apply once a tempo is set.",10,"tm","s"],["r",22,412,232,48,"c","Original take",12],["r",22,540,232,56,"a","Keep ✓",14],["k",258,196,1],
    ["t",290,58,"Layer 2 · tempo locked to sketch (92)",11,"tm","s"],["r",290,70,232,140,"p","",13],
    ...[296,352,408,464,520].map((x): Prim => ["l",x,74,x,206,"lg"]),
    ...ribbon(0, [[303,98,21],[357.6,126,16.8],[409.4,112,28],[464,140,52]], 12),
    ["r",504,136,14,20,"ld","",13],["t",512,168,"held",9,"tm","m"],["l",520,70,520,210,"la"],["t",516,224,"now",9,"tm","e"],
    ["t",290,248,"Takes the last 4 bars you have played,",11,"t","s"],["t",290,264,"ending at the last bar line already passed.",11,"t","s"],["t",290,288,"Held note: released at loop end for",11,"t","s"],["t",290,304,"playback only (marked); raw take unchanged.",11,"t","s"],
    ["r",290,322,232,48,"c","Joins at next loop start · 2.1 s",12],["r",290,378,112,48,"c","◀ bar",12],["r",410,378,112,48,"c","bar ▶",12],["r",290,540,232,56,"a","Keep ✓",14],["k",526,250,2],["k",526,330,3],
    ["r",558,52,232,44,"w","⚠ Some notes dropped at 0:41",12],["r",558,104,232,120,"p","",13],
    ...ribbon(0, [[567,138,10],[586,162,8],[606,126,14],[705,150,10],[724,174,13],[759,138,8]], 10),
    ["r",624,108,56,112,"d","",13],["t",652,168,"gap",10,"tb","m"],
    ["t",558,248,"Input overload: Blocks could not keep",11,"t","s"],["t",558,264,"every event between 0:41 and 0:43.",11,"t","s"],["t",558,288,"Older playing beyond 2:00 leaves",11,"tm","s"],["t",558,304,"history normally (not an error).",11,"tm","s"],
    ["r",558,322,232,48,"c","Capture anyway (gap marked)",12],["r",558,378,232,48,"c","Hear original take",12],["k",794,60,4],
    ["t",826,58,"Layers 1–4 all have parts.",11,"t","s"],["t",826,76,"Where should this capture go?",12,"tb","s"],
    ["r",826,92,232,56,"a","New layer (when supported)",12],["r",826,156,232,56,"c","Replace layer… (choose, undoable)",12],["r",826,220,232,56,"c","Keep as take only",12],["r",826,284,232,56,"c","Cancel",12],
    ["t",826,370,"Nothing is merged or replaced silently.",11,"tm","s"],["k",1062,100,5]
  ],
  a: [
    "'No pulse' is a valid result: keep a free-time loop of the phrase, or set a tempo manually. No fabricated alternatives or confidence numbers (A4).",
    "While playing: selects only bounded history already played on the existing transport — never future notes or a bar line not yet reached.",
    "Queued join at the next loop boundary. Held/active notes get synthetic releases for playback only, stored apart from raw events.",
    "Overload is a different state from normal age eviction: gaps/drops are flagged in the ribbon, review and take. Capture may be partial; the UI never promises otherwise (A1).",
    "All slots full → explicit choice. Default target is always an empty/new layer; never a silent replace or merge (A6)."
  ]
};

const LAYOUTS: Screen[] = [PLAY, LAND, NARROW, FOLD, DESK];

function LayoutSwitcher() {
  const [v, setV] = useState<string>("play");
  const s = LAYOUTS.find((x) => x.id === v) ?? PLAY;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Segmented options={[{ value: "play", label: "Phone portrait" }, { value: "land", label: "Phone landscape" }, { value: "narrow", label: "Fold folded" }, { value: "fold", label: "Fold open" }, { value: "desk", label: "Desktop browser" }]} value={v} onChange={setV} />
      <Figure s={s} />
    </div>
  );
}

const S = (n: number) => `S${n}`;
const SOURCES: { title: string; site: string; href: string }[] = [
  { title: "S1 Live 12 Manual — Recording New Clips (§19.10 Capturing MIDI)", site: "ableton.com", href: "https://www.ableton.com/en/manual/recording-new-clips/" },
  { title: "S2 Live 12 Manual — Editing MIDI", site: "ableton.com", href: "https://www.ableton.com/en/manual/editing-midi/" },
  { title: "S3 Live 12 Manual — Session View", site: "ableton.com", href: "https://www.ableton.com/en/manual/session-view/" },
  { title: "S4 Live 12 Manual — MIDI Fact Sheet", site: "ableton.com", href: "https://www.ableton.com/en/manual/midi-fact-sheet/" },
  { title: "S5 Push 3 Manual", site: "ableton.com", href: "https://www.ableton.com/en/push/manual/" },
  { title: "S6 Ableton Note", site: "ableton.com", href: "https://www.ableton.com/en/note/" },
  { title: "S7 Logic Pro (Mac) — Flashback Capture", site: "support.apple.com", href: "https://support.apple.com/guide/logicpro/capture-your-most-recent-midi-performance-lgcpdc0bf889/mac" },
  { title: "S8 Logic Pro for iPad — Flashback Capture intro", site: "support.apple.com", href: "https://support.apple.com/guide/logicpro-ipad/lpip64c413e6/ipados" },
  { title: "S9 Logic Pro for iPad — Piano Roll Editor overview", site: "support.apple.com", href: "https://support.apple.com/guide/logicpro-ipad/piano-roll-editor-overview-lpip2bd3cd79/ipados" },
  { title: "S10 Logic Pro for iPad — Move notes", site: "support.apple.com", href: "https://support.apple.com/guide/logicpro-ipad/move-notes-lpipb2cc590e/ipados" },
  { title: "S11 Logic Pro for iPad — VoiceOver note editing", site: "support.apple.com", href: "https://support.apple.com/guide/logicpro-ipad/voiceover-edit-notes-piano-roll-editor-lpip4c9fd172/ipados" },
  { title: "S12 FL Studio Manual — Tools menu (Score logger)", site: "image-line.com", href: "https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/menu_tools.htm" },
  { title: "S13 FL Studio Mobile Manual — Editors", site: "image-line.com", href: "https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_Editors.htm" },
  { title: "S14 GarageBand for iPhone — Play the Keyboard", site: "support.apple.com", href: "https://support.apple.com/guide/garageband-iphone/play-the-keyboard-chs39282dbe/ios" },
  { title: "S15 Android Accessibility Help — Touch target size", site: "support.google.com", href: "https://support.google.com/accessibility/android/answer/7101858?hl=en" },
  { title: "S16 Apple HIG — Accessibility", site: "developer.apple.com", href: "https://developer.apple.com/design/human-interface-guidelines/accessibility" },
  { title: "S17 WCAG 2.2 — 2.5.8 Target Size (Minimum)", site: "w3.org", href: "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html" },
  { title: "S18 WCAG 2.2 — 1.4.1 Use of Color", site: "w3.org", href: "https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html" },
  { title: "S19 WCAG 2.2 — 2.5.7 Dragging Movements", site: "w3.org", href: "https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html" },
  { title: "S20 WCAG 2.2 — 2.5.1 Pointer Gestures", site: "w3.org", href: "https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html" },
  { title: "S21 NN/g — Touch Targets on Touchscreens", site: "nngroup.com", href: "https://www.nngroup.com/articles/touch-target-size/" },
  { title: "S22 NN/g — Modes in User Interfaces", site: "nngroup.com", href: "https://www.nngroup.com/articles/modes/" },
  { title: "S23 Hoober — How Do Users Really Hold Mobile Devices? (2013)", site: "uxmatters.com", href: "https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php" },
  { title: "S24 Hoober — Design for Fingers, Touch, and People, Part 1 (2017)", site: "uxmatters.com", href: "https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php" },
  { title: "S25 Android — Use window size classes", site: "developer.android.com", href: "https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes" },
  { title: "S26 Android — Make your app fold aware", site: "developer.android.com", href: "https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware" },
  { title: "S27 Android API — android.media.midi", site: "developer.android.com", href: "https://developer.android.com/reference/android/media/midi/package-summary" },
  { title: "S28 Chrome — Autoplay policy", site: "developer.chrome.com", href: "https://developer.chrome.com/blog/autoplay" },
  { title: "S29 Chrome — Web MIDI permission prompt", site: "developer.chrome.com", href: "https://developer.chrome.com/blog/web-midi-permission-prompt" },
  { title: "S30 Can I use — Web MIDI API", site: "caniuse.com", href: "https://caniuse.com/midi" },
  { title: "S31 MDN — Navigator.requestMIDIAccess()", site: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess" },
  { title: "S32 MDN — MIDIAccess statechange event", site: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess/statechange_event" },
  { title: "S33 MDN — MIDIMessageEvent", site: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/API/MIDIMessageEvent" },
  { title: "S34 MDN — AudioContext.getOutputTimestamp()", site: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp" },
  { title: "S35 MDN — BaseAudioContext.state", site: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state" },
  { title: "S36 React Native — Accessibility", site: "reactnative.dev", href: "https://reactnative.dev/docs/accessibility" }
];

/* ===== Rev 3 high-fidelity mock renderer (PROPOSED design; design/example data; simulation only) ===== */
type Nt = [number, number, number, number];
const HA = { bg: "#0A0C0F", surf: "#14171C", surf2: "#1B1F26", line: "#272C35", text: "#EEF0F3", mute: "#A0A8B3", dim: "#848C97", acc: "#FF7442", accT: "#1A0D07", well: "#0E1014", ok: "#58D68D", hit: "#262B33", keyW: "#2E333B", keyB: "#20242B", wash: "#FFFFFF", lay: ["#E8E1D1", "#8FB3EA", "#A8C8A0", "#C9AEE6"] };
const HQ = HA;
const HL: typeof HA = { bg: "#F3EEE4", surf: "#FBF8F2", surf2: "#ECE6DA", line: "#D9D1C1", text: "#17150F", mute: "#625D52", dim: "#6A6458", acc: "#B8321C", accT: "#FFFFFF", well: "#FFFDF8", ok: "#2E7D4F", hit: "#E3DCCD", keyW: "#FFFDF8", keyB: "#D8D0BF", wash: "#000000", lay: ["#2A2621", "#2D4FB5", "#4E7A3A", "#7A3F8F"] };
const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";
const HB = { bg: "#F3EEE4", surf: "#FBF8F2", line: "#D9D1C1", text: "#17150F", mute: "#625D52", dim: "#6A6458", acc: "#B8321C", lay: ["#17150F", "#2D4FB5"] };
const CHD = ["Dm9", "G13", "Cmaj9", "A7♭9"];
const VOI: number[][] = [[53, 57, 60, 64], [53, 59, 64, 69], [52, 55, 59, 62], [55, 58, 61, 67]];
const MELO: number[][][] = [[[1.5, 69, 1], [2.5, 67, 0.5], [3, 65, 1]], [[1.5, 71, 0.5], [2, 69, 0.5], [2.5, 67, 1.5]], [[1, 64, 0.5], [1.5, 67, 0.5], [2, 71, 1], [3, 72, 1]], [[1.5, 73, 0.5], [2, 70, 0.5], [2.5, 69, 1.5]]];
const PIANO: Nt[] = VOI.flatMap((v: number[], b: number) => [
  ...v.map((p: number): Nt => [b * 4, 1.4, p, 84]),
  ...v.slice(1).map((p: number): Nt => [b * 4 + 2.5, 0.9, p, 70]),
  ...MELO[b].map((m: number[]): Nt => [b * 4 + m[0], m[2], m[1], 92])
]);
const BASSL = [[38, 41, 45, 48], [43, 47, 50, 41], [36, 40, 43, 47], [45, 49, 52, 43]];
const BASS: Nt[] = BASSL.flatMap((bar: number[], b: number) => bar.map((p: number, i: number): Nt => [b * 4 + i + (i % 2 ? 0.04 : 0), 0.85, p, i === 0 ? 96 : 80]));
const DRUMS: number[][] = [0, 1, 2, 3].flatMap((bar: number) => [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((e: number) => [bar * 4 + e * 0.5 + (e % 2 ? 0.17 : 0), 0, e % 2 ? 0.6 : 0.9]),
  [bar * 4 + 1, 1, 0.8], [bar * 4 + 3, 1, 0.9], [bar * 4, 2, 1], [bar * 4 + 2.5, 2, 0.7]
]);
const RUBP = [62, 65, 69, 72, 74, 72, 69, 67, 65, 64, 62, 60, 57, 60, 62];
const RUB: Nt[] = (() => { let t = 0; return RUBP.map((p: number, i: number): Nt => { const d = 0.35 + 0.5 * Math.abs(Math.sin(i * 1.7)); const n: Nt = [t, d * 0.9, p, 70 + (i % 3) * 8]; t += d; return n; }); })();
const RUBT = 9.865;
const OFF = [0, 0.11, -0.08, 0.14, 0.02, -0.12, 0.09, 0.13, -0.05, 0.1, 0.07, -0.13, 0.03, 0.12, -0.09, 0.15];
const PLAYED: Nt[] = BASS.map((n: Nt, i: number): Nt => [n[0] + OFF[i] - (i % 2 ? 0.04 : 0), n[1], n[2], n[3]]);
const NN = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const nn = (p: number) => `${NN[p % 12]}${Math.floor(p / 12) - 1}`;

function noteRects(k: string, n: Nt[], x: number, y: number, w: number, h: number, beats: number, lo: number, hi: number, col: string, op = 1, maxh = 7, minh = 2) {
  const rng = hi - lo + 1; const nh = Math.min(maxh, Math.max(minh, (h / rng) * 0.9));
  return n.filter((q: Nt) => q[0] < beats).map((q: Nt, i: number) => (
    <rect key={`${k}${i}`} x={x + (q[0] / beats) * w} y={y + ((hi - q[2]) / rng) * h} width={Math.max(2.5, (q[1] / beats) * w - 1.2)} height={nh} rx={2} fill={col} opacity={op * (0.55 + (0.45 * q[3]) / 127)} />
  ));
}
function drumMarks(k: string, x: number, y: number, w: number, h: number, col: string, s = 4.5) {
  const rh = h / 3;
  return DRUMS.map((d: number[], i: number) => {
    const cx = x + (d[0] / 16) * w; const cy = y + d[1] * rh + rh / 2; const o = 0.45 + 0.55 * d[2];
    if (d[1] === 0) return <circle key={`${k}${i}`} cx={cx} cy={cy} r={s / 2} fill={col} opacity={o} />;
    if (d[1] === 1) return <rect key={`${k}${i}`} x={cx - s / 2} y={cy - s / 2} width={s} height={s} fill={col} opacity={o} transform={`rotate(45 ${cx} ${cy})`} />;
    return <rect key={`${k}${i}`} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={1} fill={col} opacity={o} />;
  });
}
function barLines(k: string, x: number, y: number, w: number, h: number, bars: number, col: string) {
  return Array.from({ length: bars + 1 }, (_: unknown, b: number) => <rect key={`${k}${b}`} x={x + (b / bars) * w} y={y} width={1} height={h} fill={col} />);
}
function capGlyph(x: number, y: number, s: number, ring: string, dot: string) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 52})`}>
      <path d="M35.9,43.1 A19.8,19.8 0 1 0 10.9,38.7" fill="none" stroke={ring} strokeWidth={3} strokeLinecap="round" />
      <polygon points="15.2,43.9 6.1,42.7 15.6,34.7" fill={ring} />
      <rect x={18.2} y={22.4} width={15.6} height={7.3} rx={2.6} fill={dot} />
    </g>
  );
}

interface RLayer { n: Nt[]; beats: number; lo: number; hi: number; col: string; op?: number; maxh?: number }
interface Lane { k?: "piano" | "bass" | "drums"; name: string; sound: string; st: "loop" | "target" | "queued" | "empty"; tag?: string; rub?: boolean }
interface Step { id: string; short: string; title: string; body: string; touch: string; sk: string; tempo?: string; tnote?: string; hist: string; pos?: string; rib: { kind: "free" | "grid" | "loopfree" | "pads"; title: string; right: string; layers: RLayer[]; ph?: number; br?: [number, number, string] }; lanes: Lane[]; ph?: number; sound: string; tgt: string; cap: string; tp: string; card?: "prop" | "pulse" | "sync"; edit?: boolean }
const CARD_H: Record<string, number> = { prop: 206, pulse: 206, sync: 124 };
const LP: Lane = { k: "piano", name: "Piano", sound: "Warm EP", st: "loop", tag: "4 bars" };
const LB: Lane = { k: "bass", name: "Bass", sound: "Bass (placeholder)", st: "loop", tag: "4 bars" };
const E3: Lane = { name: "", sound: "", st: "empty" };
const pianoL = (op = 1): RLayer => ({ n: PIANO, beats: 16, lo: op < 1 ? 34 : 50, hi: op < 1 ? 76 : 74, col: HQ.lay[0], op });
const STEPS: Step[] = [
  { id: "01", short: "Play", title: "Play freely", body: "Nothing to arm. A ii–V–I in C on Warm EP; Blocks keeps a rolling history (proposed 120 s target) and brackets the last phrase.", touch: "0 touches", sk: "Sketch 14", tnote: "free play", hist: "1:12", rib: { kind: "free", title: "NOW PLAYING · LAYER 1", right: "always listening", layers: [{ n: PIANO, beats: 16.6, lo: 50, hi: 74, col: HQ.lay[0], maxh: 9 }], br: [0, 0.98, "last phrase · 10.4 s"] }, lanes: [{ name: "Layer 1 · next capture", sound: "Warm EP", st: "target" }, E3, E3, E3], sound: "Warm EP", tgt: "Layer 1", cap: "keep the last phrase → Layer 1", tp: "▷" },
  { id: "02", short: "Capture", title: "Capture → loop at once", body: "One tap on Capture (or an optional mapped CC/button). The phrase loops immediately and is already kept; the tempo/loop proposal is nonblocking, with ½ · ×2 · Set always present.", touch: "1 touch", sk: "Sketch 14", tempo: "92", hist: "1:12", pos: "▶ 1.3 / 4", rib: { kind: "grid", title: "LAYER 1 · PIANO · LOOPING", right: "grid-aligned", layers: [pianoL()], ph: 0.08 }, lanes: [LP, { name: "Layer 2 · next capture", sound: "Warm EP", st: "target" }, E3, E3], ph: 0.08, sound: "Warm EP", tgt: "Layer 2", cap: "keep playing — next capture → Layer 2", tp: "■", card: "prop" },
  { id: "03", short: "No pulse", title: "Honest “no steady pulse”", body: "A rubato phrase gets no fake tempo or confidence score: it loops in free time exactly as played. Tap or type a tempo only if wanted; ½ and ×2 act on it.", touch: "0–1 touches", sk: "Sketch 15", tnote: "free time", hist: "0:41", rib: { kind: "loopfree", title: "LAYER 1 · PIANO · FREE-TIME LOOP", right: "9.9 s · no grid", layers: [{ n: RUB, beats: RUBT, lo: 55, hi: 76, col: HQ.lay[0] }], ph: 0.42 }, lanes: [{ ...LP, tag: "9.9 s", rub: true }, { name: "Layer 2 · next capture", sound: "Warm EP", st: "target" }, E3, E3], ph: 0.42, sound: "Warm EP", tgt: "Layer 2", cap: "next capture → Layer 2 (free time)", tp: "■", card: "pulse" },
  { id: "04", short: "Bass", title: "Bass over the looping piano", body: "Switch the next layer's sound to Bass (placeholder) and play along. Sketch tempo stays locked at 92; the bracket shows exactly what a capture would keep.", touch: "1 touch (sound)", sk: "Sketch 14", tempo: "92", hist: "1:12", pos: "▶ 4.2 / 4", rib: { kind: "grid", title: "NOW PLAYING · BASS OVER LOOP", right: "tempo locked · 92", layers: [pianoL(0.28), { n: BASS.filter((q: Nt) => q[0] < 15.2), beats: 16, lo: 34, hi: 76, col: HQ.lay[1] }], ph: 0.8, br: [0, 0.8, "last 4 bars · lands on bar 1"] }, lanes: [LP, { name: "Layer 2 · next capture", sound: "Bass (placeholder)", st: "target" }, E3, E3], ph: 0.8, sound: "Bass (placeholder)", tgt: "Layer 2", cap: "last 4 bars → Layer 2 · in sync", tp: "■" },
  { id: "05", short: "Sync + Undo", title: "Capture bass, in sync", body: "The second Capture lands on the locked grid: phase accepted, joins at the next bar 1 (queued join). Beat nudges and Undo sit in the thumb zone.", touch: "1 touch (+1 nudge/undo)", sk: "Sketch 14", tempo: "92", hist: "1:12", pos: "▶ 4.4 / 4", rib: { kind: "grid", title: "LAYER 2 · BASS · QUEUED", right: "original timing kept", layers: [pianoL(0.28), { n: BASS, beats: 16, lo: 34, hi: 76, col: HQ.lay[1] }], ph: 0.86 }, lanes: [LP, { ...LB, st: "queued", tag: "bar 1" }, { name: "Layer 3 · next capture", sound: "Bass (placeholder)", st: "target" }, E3], ph: 0.86, sound: "Bass (placeholder)", tgt: "Layer 3", cap: "next capture → Layer 3", tp: "■", card: "sync" },
  { id: "06", short: "Drums", title: "Drums", body: "On-screen pads (touch events tagged “screen”, same capture pipeline) or a MIDI pad controller. Captured to Layer 3; every layer stays visible.", touch: "pads + 1 touch", sk: "Sketch 14", tempo: "92", hist: "1:12", pos: "▶ 2.1 / 4", rib: { kind: "pads", title: "DRUM PADS · THIS SCREEN", right: "touch · tagged “screen”", layers: [] }, lanes: [LP, LB, { k: "drums", name: "Drums", sound: "Kit (placeholder)", st: "loop", tag: "New ✓" }, { name: "Layer 4 · next capture", sound: "Kit (placeholder)", st: "target" }], ph: 0.28, sound: "Kit (placeholder)", tgt: "Layer 4", cap: "next capture → Layer 4", tp: "■" },
  { id: "07", short: "Edit", title: "Optional: edit & quantise", body: "Select 4 notes, 1/8 at 50%. Dashed = where you played, solid = result. The original take is kept; Revert any time.", touch: "≈4 touches", sk: "Sketch 14", hist: "", rib: { kind: "grid", title: "", right: "", layers: [] }, lanes: [], sound: "", tgt: "", cap: "", tp: "", edit: true }
];

function Bezel({ children, r = 44 }: { children: ReactNode; r?: number }) {
  return <div style={{ width: "100%", maxWidth: 390, margin: "0 auto", padding: 4, borderRadius: r + 4, background: "#22262D" }}><div style={{ borderRadius: r, overflow: "hidden", lineHeight: 0 }}>{children}</div></div>;
}
function segRow(k: string, x: number, y: number, w: number, h: number, opts: string[][], sel: number, F: string, P: typeof HA = HA) {
  const n = opts.length; const cw = (w - 6 * (n - 1)) / n;
  return opts.map((o: string[], i: number) => {
    const on = i === sel; const cx = x + i * (cw + 6);
    return (
      <g key={`${k}${i}`}>
        <rect x={cx} y={y} width={cw} height={h} rx={12} fill={on ? P.text : P.surf2} stroke={on ? P.text : P.line} />
        <text x={cx + cw / 2} y={o[1] ? y + h / 2 - 1 : y + h / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={600} fontFamily={F} fill={on ? P.bg : P.text}>{o[0]}</text>
        {o[1] ? <text x={cx + cw / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={10} fontFamily={F} fill={on ? P.bg : P.mute}>{o[1]}</text> : null}
      </g>
    );
  });
}
function laneRows(s: Step) {
  const compact = !!s.card; const out: { L: Lane | null; i: number; h: number; empties: number }[] = []; let e = 0;
  s.lanes.forEach((L: Lane, i: number) => { if (L.st === "empty") { e += 1; return; } out.push({ L, i, h: L.k ? (compact ? 52 : 62) : 56, empties: 0 }); });
  if (e) out.push({ L: null, i: -1, h: 48, empties: e });
  return out;
}

function MockPhone({ s, light = false }: { s: Step; light?: boolean }) {
  const t = useGrokTheme(); const F = t.font.family; const M = t.font.mono;
  const P = light ? HL : HA; const cm = (c: string) => { const i = HA.lay.indexOf(c); return i >= 0 ? P.lay[i] : c; };
  if (s.edit) return <MockEdit light={light} />;
  const ch = s.card ? CARD_H[s.card] : 0; const bottom = ch ? 712 - ch - 10 : 648;
  const rows = laneRows(s); const tot = rows.reduce((a: number, r: { h: number }) => a + r.h, 0) + 8 * (rows.length - 1);
  const ly = bottom - tot; const rh = ly - 12 - 152; const r = s.rib;
  const ix = 14, iy = 40, iw = 330, ih = rh - 72;
  let y = ly;
  const lanes = rows.map((row: { L: Lane | null; i: number; h: number; empties: number }, k: number) => {
    const yy = y; y += row.h + 8;
    if (!row.L) return (
      <g key={`ln${k}`}><rect x={16} y={yy} width={358} height={row.h} rx={14} fill="none" stroke={P.line} strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={34} y={yy + 29} fontSize={12.5} fontFamily={F} fill={P.mute}>{`+   ${row.empties} empty slot${row.empties > 1 ? "s" : ""} · each capture fills the next`}</text></g>
    );
    const L = row.L; const st = L.st; const bs = row.h - 22; const col = L.k ? P.lay[row.i] : P.acc;
    const stroke = st === "target" || st === "queued" ? P.acc : P.line;
    const cx = 176, cy = yy + 10, cw = 128, chh = row.h - 23;
    return (
      <g key={`ln${k}`}>
        <rect x={16} y={yy} width={358} height={row.h} rx={16} fill={st === "target" ? "none" : P.surf} stroke={stroke} strokeWidth={1.5} strokeDasharray={st === "queued" ? "5 4" : undefined} />
        <rect x={26} y={yy + (row.h - bs) / 2} width={bs} height={bs} rx={11} fill={P.surf2} />
        <text x={26 + bs / 2} y={yy + row.h / 2 - 1} textAnchor="middle" fontSize={12} fontWeight={600} fontFamily={M} fill={P.text}>{row.i + 1}</text>
        <text x={26 + bs / 2} y={yy + row.h / 2 + 11} textAnchor="middle" fontSize={9} fill={col}>{L.k === "piano" ? "◆" : L.k === "bass" ? "▬" : L.k === "drums" ? "●" : "+"}</text>
        <text x={26 + bs + 12} y={yy + row.h / 2 - 3} fontSize={14} fontWeight={600} fontFamily={F} fill={P.text}>{L.name}</text>
        <text x={26 + bs + 12} y={yy + row.h / 2 + 13} fontSize={L.k ? 13 : 11.5} fontStyle={L.k ? "italic" : "normal"} fontFamily={L.k ? SERIF : F} fill={P.mute}>{L.sound}</text>
        {L.k ? [0, 1, 2, 3, 4].map((j: number) => <rect key={`st${k}${j}`} x={cx} y={cy + (chh * j) / 4} width={cw} height={0.8} fill={P.line} />) : null}
        {L.k === "piano" && !L.rub ? noteRects(`lp${k}`, PIANO, cx, cy, cw, chh, 16, 50, 74, col, 1, 3, 2) : null}
        {L.rub ? noteRects(`lr${k}`, RUB, cx, cy, cw, chh, RUBT, 55, 76, col, 1, 3, 2) : null}
        {L.k === "bass" ? noteRects(`lb${k}`, BASS, cx, cy, cw, chh, 16, 34, 54, col, 1, 3, 2) : null}
        {L.k === "drums" ? drumMarks(`ld${k}`, cx, cy, cw, chh, col) : null}
        {L.k && !L.rub ? barLines(`lg${k}`, cx, cy - 2, cw, chh + 4, 4, P.line) : null}
        {L.k && st !== "queued" && s.ph !== undefined ? <rect x={cx + s.ph * cw} y={cy - 4} width={2} height={chh + 8} fill={P.acc} /> : null}
        <text x={348} y={yy + row.h / 2 - 2} textAnchor="middle" fontSize={13} fill={st === "loop" ? P.mute : P.acc}>{st === "loop" ? "▶" : st === "queued" ? "◔" : "◎"}</text>
        <text x={348} y={yy + row.h / 2 + 13} textAnchor="middle" fontSize={10} fontWeight={600} fontFamily={F} fill={st === "loop" ? P.mute : P.acc}>{st === "target" ? "Next" : L.tag ?? ""}</text>
      </g>
    );
  });
  const pads = [["Kick", "C1"], ["Snare", "D1"], ["Closed hat", "F♯1"], ["Open hat", "A♯1"], ["Rim", "C♯1"], ["Clap", "D♯1"], ["Low tom", "A1"], ["Ride", "D♯2"]];
  const padH = (rh - 52) / 2;
  const cy0 = 712 - ch;
  return (
    <svg viewBox="0 0 390 844" width="100%" role="img" aria-label={`PROPOSED hi-fi mock, step ${s.id}: ${s.title}. Design/example data.`} style={{ display: "block" }}>
      <rect width={390} height={844} fill={P.bg} />
      <text x={28} y={30} fontSize={14} fontWeight={600} fontFamily={M} fill={P.text}>9:41</text>
      <text x={20} y={70} fontSize={11} fontWeight={600} letterSpacing={1.5} fontFamily={F} fill={P.mute}>BLOCKS</text>
      <text x={20} y={102} fontSize={30} fontWeight={400} letterSpacing={-0.4} fontFamily={SERIF} fill={P.text}>{s.sk}</text>
      {s.tempo ? <text x={370} y={84} textAnchor="end" fontSize={26} fontWeight={500} fontFamily={M} fill={P.text}>{s.tempo}</text> : <text x={370} y={80} textAnchor="end" fontSize={18} fontFamily={M} fill={P.mute}>— —</text>}
      <text x={370} y={100} textAnchor="end" fontSize={11} fontFamily={M} fill={P.mute}>{s.tempo ? "BPM · 4/4" : s.tnote}</text>
      <rect x={20} y={112} width={178} height={28} rx={14} fill={P.surf} stroke={P.line} /><circle cx={35} cy={126} r={3.5} fill={P.ok} />
      <text x={45} y={130} fontSize={12} fontFamily={F} fill={P.mute}>Keystation 61 · receiving</text>
      <rect x={206} y={112} width={96} height={28} rx={14} fill={P.surf} stroke={P.line} /><text x={254} y={130} textAnchor="middle" fontSize={12} fontFamily={M} fill={P.mute}>{`◷ ${s.hist} kept`}</text>
      {s.pos ? <g><rect x={310} y={112} width={64} height={28} rx={14} fill={P.surf} stroke={P.line} /><text x={342} y={130} textAnchor="middle" fontSize={12} fontFamily={F} fill={P.text}>{s.pos}</text></g> : null}
      <g transform="translate(16 152)">
        <rect width={358} height={rh} rx={20} fill={P.well} stroke={P.line} />
        <text x={14} y={25} fontSize={11} fontWeight={600} letterSpacing={0.9} fontFamily={F} fill={P.mute}>{r.title}</text>
        <text x={344} y={25} textAnchor="end" fontSize={11} fontFamily={M} fill={P.mute}>{r.right}</text>
        {r.kind === "pads" ? pads.map((p: string[], i: number) => {
          const px = 14 + (i % 4) * 84, py = 40 + Math.floor(i / 4) * (padH + 6), hit = i === 0 || i === 2;
          return <g key={`pd${i}`}><rect x={px} y={py} width={78} height={padH} rx={14} fill={hit ? P.hit : P.surf2} stroke={hit ? P.lay[2] : P.line} /><text x={px + 10} y={py + 21} fontSize={12.5} fontWeight={600} fontFamily={F} fill={P.text}>{p[0]}</text><text x={px + 10} y={py + 36} fontSize={10} fontFamily={M} fill={P.dim}>{p[1]}</text>{hit ? <circle cx={px + 66} cy={py + padH - 12} r={4} fill={P.lay[2]} /> : null}</g>;
        }) : null}
        {r.kind === "grid" ? barLines("rg", ix, iy - 4, iw, ih + 8, 4, P.line) : null}
        {r.kind === "grid" ? CHD.map((c: string, b: number) => <text key={`rc${b}`} x={ix + (b / 4) * iw + 5} y={iy + 9} fontSize={16} fontStyle="italic" fontFamily={SERIF} fill={P.text}><tspan fontSize={10} fontStyle="normal" fontFamily={M} fill={P.dim}>{`${b + 1} `}</tspan>{c}</text>) : null}
        {r.kind === "free" ? [[0.02, "Dm9"], [0.26, "G13"], [0.5, "Cmaj9"], [0.74, "A7♭9"]].map((c: (string | number)[], b: number) => <text key={`fc${b}`} x={ix + Number(c[0]) * iw} y={iy + 9} fontSize={16} fontStyle="italic" fontFamily={SERIF} fill={P.text}>{String(c[1])}</text>) : null}
        {r.kind === "loopfree" ? [0, 2, 4, 6, 8].map((sec: number) => <text key={`fs${sec}`} x={ix + (sec / RUBT) * iw + 3} y={iy + ih + 20} fontSize={10} fontFamily={M} fill={P.dim}>{`${sec}s`}</text>) : null}
        {r.layers.map((L: RLayer, k: number) => <g key={`rl${k}`}>{noteRects(`rn${k}`, L.n, ix, iy + 18, iw, ih - 20, L.beats, L.lo, L.hi, cm(L.col), L.op ?? 1, L.maxh ?? 7, 4)}</g>)}
        {r.kind === "free" ? <g><rect x={ix + iw - 1} y={iy - 6} width={2} height={ih + 12} fill={P.acc} /><text x={344} y={iy + ih + 20} textAnchor="end" fontSize={10} fontFamily={M} fill={P.acc}>now</text></g> : null}
        {r.ph !== undefined ? <rect x={ix + r.ph * iw} y={iy + 14} width={2} height={ih - 8} fill={P.acc} /> : null}
        {r.br ? <g><path d={`M${ix + r.br[0] * iw} ${iy + ih + 2} v5 H${ix + r.br[1] * iw} v-5`} fill="none" stroke={P.acc} strokeWidth={1.5} /><text x={ix + ((r.br[0] + r.br[1]) / 2) * iw} y={iy + ih + 21} textAnchor="middle" fontSize={10.5} fontFamily={M} fill={P.acc}>{r.br[2]}</text></g> : null}
      </g>
      {lanes}
      {!s.card || s.card !== "sync" ? (
        <g>
          <rect x={16} y={660} width={56} height={48} rx={14} fill={P.surf2} stroke={P.line} /><text x={44} y={690} textAnchor="middle" fontSize={18} fill={P.text}>↶</text>
          <rect x={80} y={660} width={230} height={48} rx={14} fill={P.surf} stroke={P.line} />
          <text x={100} y={689} fontSize={16} fill={P.mute}>‹</text><text x={290} y={689} textAnchor="end" fontSize={16} fill={P.mute}>›</text>
          <text x={195} y={681} textAnchor="middle" fontSize={14} fontWeight={600} fontFamily={F} fill={P.text}>{s.sound}</text>
          <text x={195} y={697} textAnchor="middle" fontSize={10.5} fontFamily={F} fill={P.mute}>{`sound for ${s.tgt}`}</text>
          <rect x={318} y={660} width={56} height={48} rx={14} fill={P.surf2} stroke={P.line} /><text x={346} y={689} textAnchor="middle" fontSize={15} fill={P.text}>{s.tp}</text>
        </g>
      ) : null}
      {s.card === "prop" ? (
        <g>
          <rect x={12} y={cy0} width={366} height={ch} rx={24} fill={P.surf2} stroke={P.line} />
          <text x={28} y={cy0 + 36} fontSize={23} fontWeight={400} fontFamily={SERIF} fill={P.text}>Four bars, at ninety-two.</text>
          <text x={28} y={cy0 + 50} fontSize={12} fontFamily={F} fill={P.mute}>92 BPM · 4/4 inferred · your timing unchanged</text>
          <rect x={290} y={cy0 + 16} width={74} height={40} rx={14} fill="none" stroke={P.line} /><text x={327} y={cy0 + 40} textAnchor="middle" fontSize={12.5} fontWeight={600} fontFamily={F} fill={P.text}>Discard</text>
          <text x={28} y={cy0 + 78} fontSize={11} fontWeight={600} letterSpacing={0.9} fontFamily={F} fill={P.mute}>TEMPO</text>
          {segRow("pt", 28, cy0 + 86, 334, 44, [["92 ✓", "as played"], ["½", "46"], ["×2", "184"], ["Set…", "BPM / tap"]], 0, F, P)}
          <text x={28} y={cy0 + 150} fontSize={11} fontWeight={600} letterSpacing={0.9} fontFamily={F} fill={P.mute}>LOOP LENGTH · BEAT ONE</text>
          {segRow("pl", 28, cy0 + 158, 226, 44, [["2 bars"], ["4 bars ✓"], ["8 bars"]], 1, F, P)}
          {segRow("pn", 260, cy0 + 158, 102, 44, [["‹"], ["›"]], -1, F, P)}
        </g>
      ) : null}
      {s.card === "pulse" ? (
        <g>
          <rect x={12} y={cy0} width={366} height={ch} rx={24} fill={P.surf2} stroke={P.line} />
          <rect x={28} y={cy0 + 16} width={40} height={40} rx={12} fill={P.surf} stroke={P.line} /><text x={48} y={cy0 + 42} textAnchor="middle" fontSize={18} fill={P.text}>∿</text>
          <text x={80} y={cy0 + 34} fontSize={23} fontWeight={400} fontFamily={SERIF} fill={P.text}>No steady pulse.</text>
          <text x={80} y={cy0 + 50} fontSize={12} fontFamily={F} fill={P.mute}>Rubato: it loops exactly as played — 9.9 s,</text>
          <text x={80} y={cy0 + 66} fontSize={12} fontFamily={F} fill={P.mute}>no bar grid.</text>
          <text x={28} y={cy0 + 92} fontSize={11} fontWeight={600} letterSpacing={0.9} fontFamily={F} fill={P.mute}>KEEP IT AS</text>
          {segRow("pp", 28, cy0 + 100, 334, 44, [["Free ✓", "as played"], ["Tap", "tempo"], ["Set…", "BPM"], ["½", "of set"], ["×2", "of set"]], 0, F, P)}
          <text x={28} y={cy0 + 166} fontSize={11.5} fontFamily={F} fill={P.mute}>No guessed tempo, no confidence score. ½ and ×2 act</text>
          <text x={28} y={cy0 + 182} fontSize={11.5} fontFamily={F} fill={P.mute}>on any tempo you tap or set. Later layers follow this loop.</text>
        </g>
      ) : null}
      {s.card === "sync" ? (
        <g>
          <rect x={12} y={cy0} width={366} height={ch} rx={24} fill={P.surf2} stroke={P.line} />
          <text x={28} y={cy0 + 34} fontSize={22} fontWeight={400} fontFamily={SERIF} fill={P.text}>Bass, in time.</text>
          <text x={28} y={cy0 + 50} fontSize={12} fontFamily={F} fill={P.mute}>4 bars on the locked 92 grid · joins at bar 1</text>
          <text x={362} y={cy0 + 42} textAnchor="end" fontSize={22} fontFamily={M} fill={P.acc}>1.3s</text>
          {segRow("ps", 28, cy0 + 62, 334, 48, [["‹ beat"], ["✓ Phase OK"], ["beat ›"], ["↶ Undo"]], -1, F, P)}
        </g>
      ) : null}
      <rect x={16} y={720} width={358} height={84} rx={42} fill={P.surf2} stroke={P.acc} strokeWidth={1.5} />
      {capGlyph(34, 736, 52, P.acc, P.acc)}
      <text x={104} y={758} fontSize={21} fontWeight={650} fontFamily={F} fill={P.text}>Capture</text>
      <text x={104} y={779} fontSize={12.5} fontFamily={F} fill={P.mute}>{s.cap}</text>
      <rect x={130} y={824} width={130} height={5} rx={2.5} fill={P.text} opacity={0.5} />
    </svg>
  );
}

function MockEdit({ light = false }: { light?: boolean }) {
  const t = useGrokTheme(); const F = t.font.family; const M = t.font.mono;
  const P = light ? HL : HA;
  const gx = 62, gy = 198, gw = 312, gh = 342, lo = 34, hi = 52, row = gh / (hi - lo + 1), start = 8, beats = 8;
  const sel = [8, 9, 10, 11];
  const keys = Array.from({ length: hi - lo + 1 }, (_: unknown, k: number) => hi - k);
  return (
    <svg viewBox="0 0 390 844" width="100%" role="img" aria-label="PROPOSED hi-fi mock, step 07: edit and quantise the bass. Design/example data." style={{ display: "block" }}>
      <rect width={390} height={844} fill={P.bg} />
      <text x={28} y={30} fontSize={14} fontWeight={600} fontFamily={M} fill={P.text}>9:41</text>
      <rect x={16} y={52} width={92} height={48} rx={14} fill="none" stroke={P.line} /><text x={62} y={81} textAnchor="middle" fontSize={14} fontWeight={600} fontFamily={F} fill={P.text}>‹ Done</text>
      <text x={195} y={72} textAnchor="middle" fontSize={16} fontWeight={650} fontFamily={F} fill={P.text}>Edit · Bass</text>
      <text x={195} y={89} textAnchor="middle" fontSize={11} fontFamily={M} fill={P.mute}>bars 3–4 of 4 · 92 BPM</text>
      <rect x={282} y={52} width={92} height={48} rx={14} fill="none" stroke={P.line} /><text x={328} y={81} textAnchor="middle" fontSize={12.5} fontWeight={600} fontFamily={F} fill={P.text}>⊙ Played</text>
      {[["◆ Piano", 0], ["▬ Bass", 1], ["● Drums", 2], ["+ Empty", 3]].map((tb: (string | number)[], i: number) => <g key={`tb${i}`}><rect x={16 + i * 91} y={112} width={85} height={48} rx={14} fill={i === 1 ? P.surf2 : "none"} stroke={i === 1 ? P.text : P.line} strokeWidth={1.5} /><text x={58 + i * 91} y={141} textAnchor="middle" fontSize={12.5} fontWeight={600} fontFamily={F} fill={i < 3 ? P.text : P.mute}>{String(tb[0])}</text></g>)}
      <rect x={16} y={172} width={358} height={368} rx={18} fill={P.well} stroke={P.line} />
      {keys.map((p: number, k: number) => { const bl = [1, 3, 6, 8, 10].includes(p % 12); return <g key={`k${p}`}><rect x={17} y={gy + k * row} width={45} height={row - 1} fill={bl ? P.keyB : P.keyW} />{bl ? <rect x={gx} y={gy + k * row} width={gw - 1} height={row} fill={P.wash} opacity={0.03} /> : null}{p % 12 === 0 ? <text x={22} y={gy + k * row + row / 2 + 4} fontSize={10} fontFamily={M} fill={P.mute}>{nn(p)}</text> : null}</g>; })}
      {Array.from({ length: 9 }, (_: unknown, i: number) => <g key={`gl${i}`}><rect x={gx + (i / 8) * gw} y={gy} width={1} height={gh - 2} fill={P.line} opacity={i % 4 === 0 ? 1 : 0.5} /><text x={gx + (i / 8) * gw + 4} y={190} fontSize={i % 4 === 0 ? 10.5 : 9} fontFamily={M} fill={i % 4 === 0 ? P.mute : P.dim}>{i === 8 ? "" : i % 4 === 0 ? String(3 + i / 4) : `.${(i % 4) + 1}`}</text></g>)}
      {PLAYED.map((n: Nt, i: number) => {
        if (n[0] < start - 0.3 || n[0] >= start + beats) return null;
        const isSel = sel.includes(i); const q = isSel ? n[0] + (Math.round(n[0] / 0.5) * 0.5 - n[0]) * 0.5 : n[0];
        const x = gx + ((q - start) / beats) * gw; const yy = gy + (hi - n[2]) * row; const w = (n[1] / beats) * gw - 2;
        return (
          <g key={`bn${i}`}>
            {isSel ? <rect x={gx + ((n[0] - start) / beats) * gw} y={yy + 1} width={w} height={row - 2} rx={5} fill="none" stroke={P.lay[1]} strokeDasharray="3 2" opacity={0.7} /> : null}
            <rect x={x} y={yy + 1} width={w} height={row - 2} rx={5} fill={P.lay[1]} opacity={isSel ? 1 : 0.85} stroke={isSel ? P.text : "none"} strokeWidth={2} />
            <text x={x + 6} y={yy + row / 2 + 3.5} fontSize={10} fontWeight={600} fontFamily={M} fill={P.bg}>{nn(n[2])}</text>
            {isSel ? <rect x={x + w - 5} y={yy + row / 2 - 8} width={5} height={16} rx={2.5} fill={P.text} /> : null}
          </g>
        );
      })}
      <rect x={16} y={548} width={358} height={20} rx={6} fill={P.surf} stroke={P.line} />
      {noteRects("ov", BASS, 20, 551, 350, 14, 16, 34, 54, P.lay[1], 1, 3, 2)}
      <rect x={194} y={549} width={178} height={18} rx={5} fill="none" stroke={P.text} strokeWidth={1.5} />
      <rect x={12} y={578} width={366} height={136} rx={24} fill={P.surf2} stroke={P.line} />
      <text x={28} y={604} fontSize={15} fontWeight={650} fontFamily={F} fill={P.text}>Quantise · 4 notes selected</text>
      <text x={362} y={604} textAnchor="end" fontSize={13} fontFamily={M} fill={P.acc}>50%</text>
      {segRow("qg", 28, 616, 334, 40, [["1/4"], ["1/8 ✓"], ["1/16"], ["1/8T"]], 1, F, P)}
      <rect x={28} y={680} width={334} height={4} rx={2} fill={P.line} /><rect x={28} y={680} width={167} height={4} rx={2} fill={P.acc} /><circle cx={195} cy={682} r={14} fill={P.text} />
      <text x={28} y={705} fontSize={10} fontFamily={F} fill={P.mute}>played</text><text x={362} y={705} textAnchor="end" fontSize={10} fontFamily={F} fill={P.mute}>on grid</text>
      <rect x={16} y={724} width={64} height={80} rx={24} fill={P.surf2} stroke={P.line} /><text x={48} y={770} textAnchor="middle" fontSize={18} fill={P.text}>↶</text>
      <rect x={88} y={724} width={64} height={80} rx={24} fill={P.surf2} stroke={P.line} /><text x={120} y={770} textAnchor="middle" fontSize={18} fill={P.mute}>↷</text>
      <rect x={160} y={724} width={102} height={80} rx={40} fill={P.surf2} stroke={P.acc} strokeWidth={1.5} />{capGlyph(166, 749, 30, P.acc, P.acc)}<text x={200} y={769} fontSize={14} fontWeight={600} fontFamily={F} fill={P.text}>Capture</text>
      <rect x={270} y={724} width={104} height={80} rx={24} fill={P.acc} /><text x={322} y={769} textAnchor="middle" fontSize={15} fontWeight={600} fontFamily={F} fill={P.accT}>Apply</text>
      <rect x={130} y={824} width={130} height={5} rx={2.5} fill={P.text} opacity={0.5} />
    </svg>
  );
}

function MockPaper() {
  const t = useGrokTheme(); const F = t.font.family; const M = t.font.mono;
  const live = BASS.filter((q: Nt) => q[0] < 12.9);
  const stave = (k: string, y: number, h: number, i: number, label: string, st: string, content: ReactNode) => (
    <g key={k} transform={`translate(16 ${y})`}>
      <text x={20} y={h / 2 + 9} textAnchor="middle" fontSize={26} fontStyle="italic" fontFamily={F} fill={st === "target" ? HB.acc : st === "empty" ? HB.dim : HB.text}>{["I", "II", "III", "IV"][i]}</text>
      {[1, 2, 3, 4, 5].map((l: number) => <rect key={`${k}l${l}`} x={52} y={(h * l) / 6} width={306} height={1} fill={HB.line} />)}
      {[0, 1, 2, 3, 4].map((b: number) => <rect key={`${k}b${b}`} x={52 + (306 * b) / 4} y={h / 6} width={1} height={(h * 4) / 6} fill={HB.dim} opacity={0.6} />)}
      {content}
      <rect x={56} y={-12} width={200} height={14} fill={HB.bg} />
      <text x={58} y={0} fontSize={10.5} fontWeight={600} letterSpacing={1} fontFamily={F} fill={st === "target" ? HB.acc : st === "empty" ? HB.dim : HB.text}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 390 844" width="100%" role="img" aria-label="PROPOSED Direction B Paper Score mock: bass over the looping piano. Design/example data." style={{ display: "block" }}>
      <rect width={390} height={844} fill={HB.bg} />
      <text x={28} y={30} fontSize={14} fontWeight={600} fontFamily={M} fill={HB.text}>9:41</text>
      <text x={22} y={92} fontSize={40} fontFamily={F} fill={HB.text} letterSpacing={-0.5}>Sketch 14</text>
      <text x={22} y={118} fontSize={16} fontStyle="italic" fontFamily={SERIF} fill={HB.mute}>92 bpm · 4/4 · Keystation 61 receiving</text>
      <text x={368} y={74} textAnchor="end" fontSize={10} fontFamily={M} fill={HB.mute}>BAR</text><text x={368} y={110} textAnchor="end" fontSize={34} fontFamily={F} fill={HB.text}>3.4</text>
      <rect x={22} y={132} width={346} height={1} fill={HB.text} />
      <text x={22} y={160} fontSize={11} fontFamily={F} fill={HB.mute}>◷ 1:12 kept · always listening · design / example data</text>
      {CHD.map((c: string, i: number) => <text key={`bc${i}`} x={72 + 76 * i} y={194} fontSize={19} fontStyle="italic" fontFamily={F} fill={HB.text}>{c}</text>)}
      {stave("s1", 214, 96, 0, "PIANO · Warm EP", "loop", <g>{noteRects("bp", PIANO, 56, 12, 300, 72, 16, 50, 74, HB.lay[0], 1, 4, 2.5)}<rect x={56 + 300 * 0.8} y={0} width={2} height={96} fill={HB.acc} /></g>)}
      {stave("s2", 334, 96, 1, "● BASS · next capture", "target", <g>{noteRects("bb", live, 56, 14, 300, 70, 16, 34, 54, HB.lay[1], 1, 5, 4)}<rect x={56 + 300 * 0.8} y={0} width={2} height={96} fill={HB.acc} /></g>)}
      {stave("s3", 454, 60, 2, "EMPTY · capture fills next", "empty", null)}
      {stave("s4", 534, 60, 3, "EMPTY · after III", "empty", null)}
      <rect x={22} y={614} width={346} height={1} fill={HB.text} />
      <text x={195} y={643} textAnchor="middle" fontSize={12.5} fontFamily={F} fill={HB.text}>‹     Bass (placeholder) — sound for II     ›</text>
      <text x={195} y={676} textAnchor="middle" fontSize={15} fontStyle="italic" fontFamily={F} fill={HB.mute}>the last four bars, in time, to II</text>
      <circle cx={56} cy={746} r={32} fill="none" stroke={HB.text} /><text x={56} y={753} textAnchor="middle" fontSize={20} fill={HB.text}>↶</text>
      <circle cx={195} cy={744} r={48} fill={HB.text} />{capGlyph(165, 714, 60, HB.bg, HB.acc)}
      <circle cx={334} cy={746} r={32} fill="none" stroke={HB.text} /><text x={334} y={752} textAnchor="middle" fontSize={16} fill={HB.text}>■</text>
      <text x={195} y={812} textAnchor="middle" fontSize={11} fontWeight={600} letterSpacing={2} fontFamily={F} fill={HB.text}>CAPTURE</text>
      <rect x={130} y={830} width={130} height={4} rx={2} fill={HB.text} opacity={0.6} />
    </svg>
  );
}

function StoryPlayer() {
  const [v, setV] = useState<string>("01");
  const [tone, setTone] = useState<string>("dark");
  const k = Math.max(0, STEPS.findIndex((x: Step) => x.id === v)); const s = STEPS[k];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Segmented options={STEPS.map((x: Step) => ({ value: x.id, label: `${x.id} ${x.short}` }))} value={v} onChange={setV} />
      <Segmented options={[{ value: "dark", label: "Hybrid · dark" }, { value: "light", label: "Hybrid · light" }]} value={tone} onChange={setTone} />
      <Grid columns={2} plain>
        <Bezel><MockPhone s={s} light={tone === "light"} /></Bezel>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Text>{`${s.id} · ${s.title}`}</Text>
          <Text>{s.body}</Text>
          <Properties items={[{ label: "Touches (estimate)", value: s.touch }, { label: "Form factor", value: s.id === "05" ? "Phone 390×844 dp; Fold expanded version in fold-05-bass-captured.png" : s.id === "07" ? "Phone 390×844 dp; desktop browser version in desktop-07-edit-quantise.png" : "Phone 390×844 dp" }, { label: "Status", value: "PROPOSED · simulation, not working MIDI/audio · design/example data" }]} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label="← Previous" onClick={() => setV(STEPS[Math.max(0, k - 1)].id)} disabled={k === 0} />
            <Button label="Next →" variant="primary" onClick={() => setV(STEPS[Math.min(STEPS.length - 1, k + 1)].id)} disabled={k === STEPS.length - 1} />
          </div>
        </div>
      </Grid>
    </div>
  );
}

const RPRE: Nt[] = [[-1.5, 0.45, 67, 70], [-1, 0.45, 69, 74], [-0.45, 0.4, 72, 84]];
const RHIST: Nt[] = [...RPRE, ...PIANO];
const RHELD: Nt = [15, 1.9, 76, 82];
const RLAB = ["Dm9", "G13(♭9)", "Cmaj9/E", "A7alt"];
interface RSt { id: string; short: string; title: string; body: string; op: string; rs: number; re: number; follow: boolean; free?: boolean; loop?: boolean; slide?: boolean; pickup?: boolean; edge?: boolean; b0?: number; b1?: number; chip: string; cap: string; hint?: string; toast?: boolean; snaps?: boolean }
const RSTATES: RSt[] = [
  { id: "09", short: "Success", title: "One Capture, all four chords", body: "The engine picks the whole phrase: four chords plus the pickup into bar 1. One action, no handles.", op: "None needed", rs: 0, re: 16, follow: true, pickup: true, chip: "auto ✓ 4 bars", cap: "4 bars + pickup: Dm9 → A7alt → Layer 1" },
  { id: "10", short: "Too short", title: "When it guesses short", body: "Failure case: the auto-selection covers only the last chord (A7alt). A quiet hint points to the start handle. Drag ⟦ back to bar 1.", op: "(a) boundary adjustment, non-destructive", rs: 12, re: 16, follow: true, chip: "auto: 1 bar", cap: "auto: 1 bar (A7alt only) → Layer 1", hint: "Only the last chord? Drag ⟦ back." },
  { id: "11", short: "Drag ⟦", title: "Drag the start handle back", body: "Start moves, end stays fixed, so the loop length changes. A magnifier names the snap target. Following pauses; Back to live returns.", op: "(a) boundary adjustment, non-destructive", rs: 6, re: 16, follow: false, chip: "2.5 bars · end fixed", cap: "2.5 bars → Layer 1" },
  { id: "12", short: "Fixed + Undo", title: "Fixed, with Undo", body: "Range is 4 bars (was 1). Notes and timing untouched; one tap undoes the range edit.", op: "(a) boundary adjustment, undoable", rs: 0, re: 16, follow: false, pickup: true, toast: true, chip: "4 bars · end fixed", cap: "4 bars + pickup → Layer 1" },
  { id: "13a", short: "Boundaries", title: "Boundaries: length changes", body: "On a captured loop, dragging ⟦ moves the start with the end fixed, so 4 bars become 5. Non-destructive.", op: "(a) boundary adjustment, non-destructive", rs: -4, re: 16, follow: false, loop: true, b0: -5.2, b1: 17.2, chip: "5 bars · end fixed", cap: "next capture → Layer 2" },
  { id: "13b", short: "Slide", title: "Slide: phase, same length", body: "The dedicated Slide control locks the length at 4 bars and shifts beat one (here −1 beat). Both handles move together.", op: "(c) phase nudge, length kept", rs: -1, re: 15, follow: false, loop: true, slide: true, b0: -5.2, b1: 17.2, chip: "4 bars · beat one −1", cap: "next capture → Layer 2" },
  { id: "14", short: "Edges", title: "Pickups and held notes", body: "The pickup before bar 1 is kept and wraps to the beat before each repeat. A note held across the end is clipped for playback only; the raw note stays full length.", op: "Playback rule, raw take untouched", rs: 0, re: 16, follow: false, loop: true, pickup: true, edge: true, chip: "4 bars", cap: "next capture → Layer 2" },
  { id: "15", short: "Free time", title: "Free time: no bars invented", body: "No steady pulse: a seconds ruler, and handles snap to note onsets only.", op: "(a) boundary adjustment, non-destructive", rs: 0, re: RUBT, follow: false, free: true, chip: "9.9 s", cap: "9.9 s, free time → Layer 1" },
  { id: "16", short: "Zoom, snap", title: "Zoom, pan, snap", body: "Pinch to zoom, one finger to pan; panning pauses follow and shows Back to live. Snap: onsets, beats, bars or off; slide up while dragging to override.", op: "View only", rs: 0, re: 16, follow: false, b0: -1.4, b1: 6.6, snaps: true, chip: "4 bars", cap: "4 bars: Dm9 → A7alt → Layer 1" }
];

function RangeLab() {
  const t = useGrokTheme(); const F = t.font.family; const M = t.font.mono;
  const [sid, setSid] = useState<string>("09");
  const [tone, setTone] = useState<string>("dark");
  const [labels, setLabels] = useState<boolean>(true);
  const [snap, setSnap] = useState<boolean>(true);
  const [rng, setRng] = useState<number[]>([0, 16]);
  const [drag, setDrag] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);
  const [fol, setFol] = useState<boolean>(true);
  const [undone, setUndone] = useState<boolean>(false);
  const k = Math.max(0, RSTATES.findIndex((x: RSt) => x.id === sid)); const st = RSTATES[k];
  const pick = (id: string) => { const s = RSTATES.find((x: RSt) => x.id === id) ?? RSTATES[0]; setSid(s.id); setRng([s.rs, s.re]); setTouched(false); setDrag(""); setFol(s.follow); setUndone(false); };
  const P = tone === "light" ? HL : HA; const dk = tone !== "light";
  const free = !!st.free; const notes: Nt[] = free ? RUB : RHIST;
  const b0 = st.b0 ?? (free ? -1.2 : -1.6); const b1 = st.b1 ?? (free ? RUBT + 1.4 : 17.4);
  const lo = free ? 52 : 48; const hi = free ? 79 : 77;
  const RX = 12, RY = 72, RW = 366, RH = 330; const nx = RX + 34, nw = RW - 48, ny = RY + 72, nh = 176;
  const X = (b: number) => nx + ((b - b0) / (b1 - b0)) * nw;
  const B = (x: number) => b0 + ((x - nx) / nw) * (b1 - b0);
  const row = nh / (hi - lo + 1);
  const snapsList: number[] = free ? [0, ...RUB.map((n: Nt) => n[0])] : [0, 4, 8, 12, 16, ...RHIST.map((n: Nt) => n[0])];
  const doSnap = (b: number) => { if (!snap) return b; let best = b; let d = free ? 0.5 : 0.75; snapsList.forEach((q: number) => { if (Math.abs(q - b) < d) { d = Math.abs(q - b); best = q; } }); return best; };
  const rs = rng[0], re = rng[1];
  const minLen = free ? 0.3 : 1;
  const setHandle = (h: string, b: number) => {
    if (st.slide) { const len = re - rs; const ns = Math.round(h === "hs" ? b : b - len); setRng([ns, ns + len]); }
    else if (h === "hs") setRng([Math.min(Math.max(b, b0), re - minLen), re]);
    else setRng([rs, Math.max(Math.min(b, b1), rs + minLen)]);
    setTouched(true); setFol(false);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => { if (!drag) return; const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) * 390) / r.width; setHandle(drag, doSnap(B(x))); };
  const onKey = (h: string) => (e: KeyboardEvent<SVGGElement>) => {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0; if (!dir) return; e.preventDefault();
    const cur = h === "hs" ? rs : re; let nb = cur;
    if (free || st.slide) nb = cur + dir * (free ? 0.25 : 1);
    else if (e.shiftKey) nb = cur + dir * 4; else if (e.altKey) nb = cur + dir;
    else { const c = snapsList.filter((q: number) => (dir > 0 ? q > cur + 0.01 : q < cur - 0.01)); nb = c.length ? (dir > 0 ? Math.min(...c) : Math.max(...c)) : cur; }
    setHandle(h, nb);
  };
  const len = re - rs; const bars = Math.round((len / 4) * 100) / 100;
  const chip = !touched ? (undone ? "1 bar · undone" : st.chip) : free ? `${len.toFixed(1)} s` : st.slide ? `${bars} bars · beat one ${rs >= 0 ? "+" : "−"}${Math.abs(rs)}` : `${bars} bar${bars === 1 ? "" : "s"} · ${drag === "he" ? "start" : "end"} fixed`;
  const cap = !touched ? st.cap : st.loop ? st.cap : free ? `${len.toFixed(1)} s, free time → Layer 1` : `${bars} bar${bars === 1 ? "" : "s"} → Layer 1`;
  const title = st.loop ? "LAYER 1 · LOOP" : "TAKE HISTORY";
  const now = free ? RUBT + 0.5 : st.loop ? 8.2 : 16.6;
  const hv = drag === "he" ? re : rs;
  const desc = free ? `${hv.toFixed(1)} s · onset` : `bar ${Math.floor(hv / 4) + 1}.${(((Math.floor(hv) % 4) + 4) % 4) + 1}${snapsList.indexOf(hv) >= 0 ? " · snapped" : ""}`;
  const els: ReactNode[] = [];
  for (let p = hi; p >= lo; p--) { const y = ny + (hi - p) * row; const blk = [1, 3, 6, 8, 10].indexOf(p % 12) >= 0; els.push(<rect key={`k${p}`} x={RX + 2} y={y} width={30} height={row} fill={blk ? P.surf2 : P.surf} />); if (p % 12 === 0) els.push(<text key={`kl${p}`} x={RX + 5} y={y + row - 1} fontSize={7.5} fontFamily={M} fill={P.mute}>{`C${p / 12 - 1}`}</text>); }
  if (free) { [0, 2, 4, 6, 8, 10].forEach((s: number) => { els.push(<line key={`s${s}`} x1={X(s)} x2={X(s)} y1={ny} y2={ny + nh} stroke={P.line} />); els.push(<text key={`st${s}`} x={X(s) + 3} y={RY + RH - 18} fontSize={9} fontFamily={M} fill={P.mute}>{`${s}s`}</text>); }); }
  else { for (let bt = Math.ceil(b0); bt <= Math.floor(b1); bt++) { const bar = bt % 4 === 0; els.push(<line key={`b${bt}`} x1={X(bt)} x2={X(bt)} y1={ny} y2={ny + nh} stroke={bar ? (st.loop ? P.line : P.mute) : P.line} strokeOpacity={bar ? (st.loop ? 1 : 0.55) : 0.4} strokeDasharray={bar && !st.loop ? "3 3" : undefined} />); if (bar && bt >= 0 && bt < 16) { els.push(<text key={`bn${bt}`} x={X(bt) + 3} y={RY + RH - 18} fontSize={9.5} fontFamily={M} fill={P.mute}>{`${bt / 4 + 1}`}</text>); if (labels) { els.push(<text key={`ch${bt}`} x={X(bt) + 3} y={ny - 16} fontSize={13} fontStyle="italic" fontFamily={SERIF} fill={P.text}>{RLAB[bt / 4]}</text>); if (bt === 4) els.push(<text key="alt" x={X(bt) + 3} y={ny - 5} fontSize={9.5} fontStyle="italic" fontFamily={SERIF} fill={P.mute}>or Dm9/G</text>); } } } }
  els.push(<rect key="wash" x={X(rs)} y={ny - 4} width={Math.max(0, X(re) - X(rs))} height={nh + 8} rx={5} fill={P.acc} fillOpacity={dk ? 0.13 : 0.1} />);
  els.push(<rect key="band" x={X(rs)} y={ny - 8} width={Math.max(0, X(re) - X(rs))} height={3} rx={1.5} fill={P.acc} />);
  if (st.pickup && Math.abs(rs) < 0.01 && X(-0.45) > nx) { els.push(<rect key="pk" x={X(-0.45)} y={ny - 4} width={X(0) - X(-0.45)} height={nh + 8} fill="none" stroke={P.acc} strokeDasharray="3 2" />); els.push(<text key="pkt" x={X(-0.45) + 2} y={ny + nh - 4} fontSize={8} fontFamily={M} fill={P.acc}>{st.loop ? "pickup kept · wraps" : "pickup kept"}</text>); }
  notes.forEach((n: Nt, i: number) => { if (n[0] + n[1] < b0 || n[0] > b1) return; const inr = (n[0] >= rs - 0.01 && n[0] < re) || (!!st.pickup && Math.abs(rs) < 0.01 && n[0] >= -0.5 && n[0] < 0); const x0 = X(Math.max(n[0], b0)); const x1 = X(Math.min(n[0] + n[1], b1)); els.push(<rect key={`n${i}`} x={x0} y={ny + (hi - n[2]) * row + 0.5} width={Math.max(2, x1 - x0 - 0.8)} height={Math.max(2.5, row - 1.2)} rx={1.2} fill={P.lay[0]} fillOpacity={inr ? 0.6 + (0.4 * n[3]) / 127 : 0.3} />); });
  if (st.edge) { const y = ny + (hi - RHELD[2]) * row + 0.5; const xe = X(re); els.push(<rect key="hd" x={X(RHELD[0])} y={y} width={xe - X(RHELD[0])} height={Math.max(2.5, row - 1.2)} fill={P.lay[0]} />); els.push(<rect key="hd2" x={xe} y={y} width={X(RHELD[0] + RHELD[1]) - xe} height={Math.max(2.5, row - 1.2)} fill="none" stroke={P.lay[0]} strokeDasharray="2 2" />); els.push(<text key="hdt" x={xe - 4} y={y - 6} textAnchor="end" fontSize={8} fontFamily={M} fill={P.acc}>clipped for playback · raw kept</text>); }
  if (labels && !free && b0 <= 0.15) { [[70, "MELODY"], [55, "CHORD"]].forEach((q: (string | number)[], i: number) => { const y = ny + (hi - Number(q[0])) * row - 12; els.push(<rect key={`rt${i}`} x={X(0.15)} y={y} width={40} height={11} rx={3} fill={P.well} stroke={P.line} />); els.push(<text key={`rtt${i}`} x={X(0.15) + 20} y={y + 8} textAnchor="middle" fontSize={7} fontFamily={M} fill={P.mute}>{String(q[1])}</text>); }); }
  if (now >= b0 && now <= b1) els.push(<rect key="now" x={X(now) - 1} y={ny - 6} width={2} height={nh + 12} fill={P.acc} />);
  ([["hs", rs, "⟦", "START"], ["he", re, "⟧", "END"]] as [string, number, string, string][]).forEach(([h, v, g, lab]: [string, number, string, string]) => {
    const xx = X(v); if (xx < nx - 2 || xx > nx + nw + 2) return; const on = drag === h || !!st.slide;
    els.push(<g key={h} tabIndex={0} role="slider" aria-label={`${h === "hs" ? "Loop start" : "Loop end"} handle (simulated). Arrow keys move by note; Alt by beat; Shift by bar.`} aria-valuenow={v} onPointerDown={() => setDrag(h)} onKeyDown={onKey(h)} style={{ cursor: "ew-resize", outline: "none" }}>
      <rect x={xx - 22} y={ny - 8} width={44} height={nh + 64} fill="transparent" />
      <rect x={xx - 1} y={ny - 8} width={2} height={nh + 14} fill={P.acc} />
      <rect x={xx - 20} y={ny + nh + 8} width={40} height={40} rx={12} fill={on ? P.acc : P.surf2} stroke={P.acc} strokeWidth={2} />
      <text x={xx} y={ny + nh + 27} textAnchor="middle" fontSize={14} fill={on ? P.accT : P.text}>{g}</text>
      <text x={xx} y={ny + nh + 40} textAnchor="middle" fontSize={7} fontWeight={700} fontFamily={F} fill={on ? P.accT : P.text}>{lab}</text>
    </g>);
  });
  if (st.slide) els.push(<text key="lk" x={(X(rs) + X(re)) / 2} y={ny + nh + 30} textAnchor="middle" fontSize={9} fontFamily={M} fill={P.acc}>⟷ slide · length locked</text>);
  if (drag) { const mx = Math.min(Math.max(X(hv) - 66, nx), nx + nw - 132); els.push(<g key="mag"><rect x={mx} y={ny + 8} width={132} height={40} rx={10} fill={P.surf2} stroke={P.text} /><text x={mx + 10} y={ny + 24} fontSize={10} fontWeight={700} fontFamily={F} fill={P.text}>{`Snap · ${desc}`}</text><text x={mx + 10} y={ny + 38} fontSize={9} fontFamily={F} fill={P.mute}>{snap ? "slide up = no snap" : "snap off"}</text></g>); }
  if (st.hint && !touched) els.push(<g key="hint"><rect x={nx + 4} y={ny + nh - 26} width={186} height={20} rx={6} fill={P.surf2} stroke={P.line} /><text x={nx + 12} y={ny + nh - 12} fontSize={10} fontWeight={600} fontFamily={F} fill={P.text}>{st.hint}</text></g>);
  if (st.snaps) els.push(<g key="snp"><rect x={RX + RW - 150} y={ny + 4} width={140} height={112} rx={12} fill={P.surf2} stroke={P.text} />{["SNAP HANDLES TO", "● Note onsets", "○ Beats", "● Bars", "○ Off (free)", "Override: slide finger up"].map((s: string, i: number) => <text key={`sn${i}`} x={RX + RW - 140} y={ny + 20 + i * 17} fontSize={i === 0 ? 8 : i === 5 ? 8.5 : 10.5} fontWeight={i === 0 ? 700 : 500} fontFamily={F} fill={i === 0 || i === 5 ? P.mute : P.text}>{s}</text>)}</g>, <g key="zm"><rect x={nx + 4} y={ny + nh - 24} width={120} height={18} rx={5} fill={P.surf2} stroke={P.line} /><text x={nx + 10} y={ny + nh - 11} fontSize={9} fontFamily={M} fill={P.mute}>pinch · 2 bars visible</text></g>);
  const chipW = chip.length * 6 + 18; const tx = RX + 14 + title.length * 6.4 + 6;
  return (
    <Grid columns={2} plain>
      <Bezel>
        <svg viewBox="0 0 390 580" width="100%" style={{ display: "block", touchAction: "none", background: P.bg }} onPointerMove={onMove} onPointerUp={() => setDrag("")} onPointerLeave={() => setDrag("")} aria-label="Simulated take-history piano roll with draggable loop handles">
          <rect width={390} height={580} fill={P.bg} />
          <text x={20} y={26} fontSize={9.5} fontWeight={600} letterSpacing={1.4} fontFamily={F} fill={P.mute}>BLOCKS ⌄</text>
          <text x={20} y={54} fontSize={26} fontFamily={SERIF} fill={P.text}>{free ? "Sketch 15" : "Sketch 14"}</text>
          <text x={370} y={50} textAnchor="end" fontSize={st.loop ? 20 : 10} fontFamily={M} fill={st.loop ? P.text : P.mute}>{st.loop ? "92" : free ? "free time" : "free play"}</text>
          <rect x={RX} y={RY} width={RW} height={RH} rx={18} fill={P.well} stroke={P.line} />
          <text x={RX + 14} y={RY + 22} fontSize={9.5} fontWeight={600} letterSpacing={1} fontFamily={F} fill={P.mute}>{title}</text>
          <rect x={tx} y={RY + 9} width={chipW} height={20} rx={10} fill="none" stroke={P.acc} strokeWidth={1.4} />
          <text x={tx + 9} y={RY + 23} fontSize={9.5} fontWeight={600} fontFamily={M} fill={P.acc}>{chip}</text>
          {st.loop ? null : fol ? <text x={RX + RW - 12} y={RY + 23} textAnchor="end" fontSize={10} fontWeight={600} fontFamily={F} fill={P.mute}>● Following live</text> : <g onClick={() => pick("09")} style={{ cursor: "pointer" }}><rect x={RX + RW - 100} y={RY + 6} width={92} height={26} rx={13} fill={P.text} /><text x={RX + RW - 54} y={RY + 23} textAnchor="middle" fontSize={10.5} fontWeight={650} fontFamily={F} fill={P.bg}>Back to live ›</text></g>}
          <rect x={RX + 44} y={RY + 38} width={RW - 150} height={12} rx={4} fill={P.surf} stroke={P.line} />
          <rect x={RX + 44 + (RW - 156) * (st.snaps ? 0.3 : 0.73)} y={RY + 38} width={(RW - 150) * (st.snaps ? 0.12 : 0.26)} height={12} rx={4} fill="none" stroke={P.text} strokeWidth={1.4} />
          <text x={RX + 10} y={RY + 47} fontSize={8} fontFamily={M} fill={P.dim}>−1:12</text>
          {free ? null : <g onClick={() => setLabels(!labels)} style={{ cursor: "pointer" }}><rect x={RX + RW - 90} y={RY + 35} width={80} height={18} rx={9} fill={P.well} stroke={P.line} /><text x={RX + RW - 50} y={RY + 47.5} textAnchor="middle" fontSize={9} fontWeight={600} fontFamily={F} fill={P.mute}>{labels ? "Aa labels ✓" : "Aa labels off"}</text></g>}
          {free ? <text x={nx} y={ny - 10} fontSize={9} fontFamily={M} fill={P.mute}>free time · no steady pulse · no bars invented</text> : null}
          {els}
          <text x={nx} y={RY + RH - 5} fontSize={7.5} fontFamily={M} fill={P.dim}>{free ? "seconds ruler · snaps to note onsets only" : `${st.loop ? "grid set · 92 BPM · 4/4" : "bars est. 92 BPM · tentative"}${labels ? " · chord names: mock data" : ""}`}</text>
          <rect x={12} y={414} width={366} height={52} rx={14} fill={P.surf} stroke={st.loop ? P.line : P.acc} strokeWidth={st.loop ? 1 : 1.6} />
          <rect x={24} y={424} width={32} height={32} rx={9} fill={P.surf2} />
          <text x={40} y={444} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily={F} fill={P.text}>1</text>
          <text x={68} y={437} fontSize={13.5} fontWeight={650} fontFamily={F} fill={P.text}>{st.loop ? "Piano" : "Layer 1 · next capture"}</text>
          <text x={68} y={454} fontSize={11} fontStyle="italic" fontFamily={SERIF} fill={P.mute}>{st.loop ? "Warm EP · chord + melody · 4 bars" : "Warm EP"}</text>
          {st.loop ? <text x={364} y={445} textAnchor="end" fontSize={11} fontFamily={M} fill={P.mute}>▶ looping</text> : <text x={364} y={445} textAnchor="end" fontSize={11} fontWeight={600} fontFamily={F} fill={P.acc}>◎ Next</text>}
          {st.toast && !undone ? <g><rect x={12} y={474} width={366} height={34} rx={12} fill={P.surf2} stroke={P.line} /><text x={24} y={495} fontSize={13} fontFamily={SERIF} fill={P.text}>All four chords.</text><text x={124} y={495} fontSize={10} fontFamily={F} fill={P.mute}>Range 4 bars (was 1).</text><g onClick={() => { setRng([12, 16]); setUndone(true); setTouched(false); }} style={{ cursor: "pointer" }}><rect x={296} y={478} width={76} height={26} rx={9} fill={P.surf} stroke={P.line} /><text x={334} y={495} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily={F} fill={P.text}>↶ Undo</text></g></g>
            : st.loop && !st.edge ? <g>{[["13a", "⟦ Boundaries"], ["13b", "⟷ Slide (phase)"]].map((o: string[], i: number) => <g key={o[0]} onClick={() => pick(o[0])} style={{ cursor: "pointer" }}><rect x={12 + i * 186} y={474} width={180} height={34} rx={11} fill={o[0] === st.id ? P.text : P.surf2} stroke={P.line} /><text x={102 + i * 186} y={495} textAnchor="middle" fontSize={12} fontWeight={600} fontFamily={F} fill={o[0] === st.id ? P.bg : P.text}>{o[1]}</text></g>)}</g>
            : <g><rect x={12} y={474} width={366} height={34} rx={12} fill="none" stroke={P.line} strokeDasharray="4 3" /><text x={28} y={495} fontSize={11} fontFamily={F} fill={P.mute}>{st.loop ? "+ Layer 2 · next capture" : "+ 3 empty slots · each capture fills the next"}</text></g>}
          <rect x={12} y={518} width={366} height={54} rx={27} fill={P.surf2} stroke={P.acc} strokeWidth={1.6} />
          <circle cx={46} cy={545} r={14} fill="none" stroke={P.acc} strokeWidth={2.4} />
          <rect x={39} y={542} width={14} height={6} rx={3} fill={P.acc} />
          <text x={72} y={541} fontSize={16} fontWeight={650} fontFamily={F} fill={P.text}>Capture</text>
          <text x={72} y={558} fontSize={10.5} fontFamily={F} fill={P.mute}>{cap}</text>
        </svg>
      </Bezel>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Segmented options={RSTATES.map((x: RSt) => ({ value: x.id, label: `${x.id} ${x.short}` }))} value={sid} onChange={pick} />
        <Segmented options={[{ value: "dark", label: "Hybrid · dark" }, { value: "light", label: "Hybrid · light" }]} value={tone} onChange={setTone} />
        <Text>{`${st.id} · ${st.title}`}</Text>
        <Text>{st.body}</Text>
        <Properties items={[{ label: "Operation", value: st.op }, { label: "Range now", value: chip }, { label: "Try it", value: st.free || !st.loop || st.slide || st.id === "13a" ? "Drag ⟦ or ⟧ in the mock (or focus one and use the arrow keys)." : "Read-only state." }, { label: "Status", value: "PROPOSED · simulation · notes are example data · chord names and role tags are mock data, recognition under research" }]} />
        <Toggle label="Harmony labels and role tags (optional)" value={labels} onChange={setLabels} />
        <Toggle label="Snap to onsets and bars" value={snap} onChange={setSnap} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button label="← Previous" onClick={() => pick(RSTATES[Math.max(0, k - 1)].id)} disabled={k === 0} />
          <Button label="Next →" variant="primary" onClick={() => pick(RSTATES[Math.min(RSTATES.length - 1, k + 1)].id)} disabled={k === RSTATES.length - 1} />
        </div>
      </div>
    </Grid>
  );
}

function SettingsMock() {
  const t = useGrokTheme(); const F = t.font.family;
  const [ap, setAp] = useState<string>("system");
  const eff = ap === "system" ? (t.kind === "light" ? "light" : "dark") : ap; const P = eff === "light" ? HL : HA;
  const opts: string[][] = [["system", "System", `Default · follows the device · now ${eff === "light" ? "Light" : "Dark"}`], ["light", "Light", "Paper finish, for daylight and review"], ["dark", "Dark", "Graphite, for dim rooms and stage"]];
  return (
    <Bezel>
      <svg viewBox="0 0 390 560" width="100%" style={{ display: "block", background: P.bg }} aria-label="Simulated Settings screen with appearance options">
        <rect width={390} height={560} fill={P.bg} />
        <text x={22} y={40} fontSize={12} fontWeight={600} fontFamily={F} fill={P.text}>‹ Sketch 14</text>
        <text x={22} y={92} fontSize={36} fontFamily={SERIF} fill={P.text}>Settings</text>
        <text x={22} y={114} fontSize={10.5} fontFamily={F} fill={P.mute}>From the Blocks ⌄ menu (top-left on Play). Never on the play surface.</text>
        <text x={22} y={144} fontSize={9.5} fontWeight={600} letterSpacing={1} fontFamily={F} fill={P.mute}>APPEARANCE</text>
        <rect x={16} y={154} width={358} height={300} rx={18} fill={P.surf} stroke={P.line} />
        {[HA, HL].map((Q: typeof HA, i: number) => <g key={`sw${i}`}><rect x={28 + i * 170} y={166} width={160} height={70} rx={10} fill={Q.bg} stroke={(eff === "light") === (i === 1) ? P.text : P.line} strokeWidth={(eff === "light") === (i === 1) ? 2 : 1} /><text x={38 + i * 170} y={186} fontSize={12} fontFamily={SERIF} fill={Q.text}>Sketch 14</text><rect x={38 + i * 170} y={194} width={140} height={12} rx={4} fill={Q.surf} stroke={Q.line} /><rect x={38 + i * 170} y={214} width={140} height={12} rx={6} fill="none" stroke={Q.acc} strokeWidth={1.5} /></g>)}
        {opts.map((o: string[], i: number) => { const on = ap === o[0]; const y = 248 + i * 66; return (
          <g key={o[0]} onClick={() => setAp(o[0])} style={{ cursor: "pointer" }}>
            <rect x={16} y={y} width={358} height={66} fill="transparent" />
            <line x1={16} x2={374} y1={y} y2={y} stroke={P.line} />
            <circle cx={42} cy={y + 33} r={10} fill="none" stroke={on ? P.text : P.mute} strokeWidth={2} />
            {on ? <circle cx={42} cy={y + 33} r={5} fill={P.text} /> : null}
            <text x={64} y={y + 29} fontSize={14} fontWeight={on ? 650 : 500} fontFamily={F} fill={P.text}>{o[1]}</text>
            <text x={64} y={y + 46} fontSize={10.5} fontFamily={F} fill={P.mute}>{o[2]}</text>
            {on ? <text x={360} y={y + 37} textAnchor="end" fontSize={11} fontWeight={600} fontFamily={F} fill={P.text}>✓ Selected</text> : null}
          </g>); })}
        <text x={22} y={478} fontSize={10.5} fontFamily={F} fill={P.mute}>Switching applies instantly. Audio, playback and MIDI keep running.</text>
        <text x={22} y={494} fontSize={10.5} fontFamily={F} fill={P.mute}>The choice is saved on this device.</text>
        <rect x={16} y={508} width={358} height={42} rx={21} fill={P.surf2} stroke={P.line} />
        <circle cx={36} cy={529} r={4} fill={P.acc} />
        <text x={48} y={533} fontSize={11.5} fontWeight={600} fontFamily={F} fill={P.text}>Sketch 14 still looping · Layer 1 · 4 bars</text>
      </svg>
    </Bezel>
  );
}

export default function BlocksDesign() {
  return (
    <Page title="Blocks — UI/UX & Interaction Design" width="wide" summary="PROPOSED design for the Blocks musical sketchbook (Android phone, Galaxy Fold, web). Not implemented, not user-tested. 8 Nov 2026." sources={SOURCES.map((s) => s.href)}>
      <Callout tone="warning" lead="Status: PROPOSED · rev 3.2.1.">Rev 3.2 adds Settings → Appearance (System default) and the take-history piano roll with capture-range handles, harmony labels as a proposed capability (mock data), and the boundary / slide / edit separation; nothing claims the current build supports any of it. Rev 3 adds two high-fidelity visual directions, a recommendation, and a seven-frame interactive storyboard (simulation, not working MIDI/audio; all musical content is design/example data). Lead decisions A1–A12 are applied and marked RESOLVED (see Changelog). All numeric limits and UI dimensions are proposals pending measurement. Sound names such as “Warm EP” are placeholders. Every screen and number here is a proposal for the Blocks team. Nothing is implemented or user-tested; interaction counts are walkthrough estimates. Engineer assets (spec, acceptance criteria, gestures, tokens, 16 SVG wireframes) live under /workspace/blocks-design/ on the shared box.</Callout>
      <TableOfContents items={[
        { label: "Hi-fi directions: A vs B", id: "hifi" }, { label: "Storyboard (interactive)", id: "story" }, { label: "Take history & capture range (3.2)", id: "range" }, { label: "Settings · Appearance (3.2)", id: "settings" },
        { label: "Visual north star: sexy, sleek", id: "north" }, { label: "Principle & vocabulary", id: "vocab" }, { label: "Research → decisions", id: "research" }, { label: "Navigation", id: "nav" },
        { label: "Layouts (5 form factors)", id: "layouts" }, { label: "Play / Capture", id: "play" }, { label: "First run & readiness", id: "ready" },
        { label: "Capture review & auto-play", id: "review" }, { label: "Sounds & layers", id: "layers" }, { label: "Touch piano roll & gestures", id: "roll" },
        { label: "Controller learn, save, export", id: "ctl" }, { label: "Edge states", id: "edge" }, { label: "Walkthrough (estimates)", id: "walk" },
        { label: "State machines", id: "states" }, { label: "Equivalents & accessibility", id: "a11y" }, { label: "Components & tokens", id: "comp" },
        { label: "P0/P1 handoff", id: "handoff" }, { label: "QA & usability test", id: "qa" }, { label: "Contract decisions (resolved)", id: "amb" }, { label: "Changelog", id: "changes" }, { label: "Assets, checks, sources", id: "assets" }
      ]} />

      <Section heading="Hi-fi directions: A vs B" id="hifi" caption="PROPOSED, not implemented. Design/example data. Phone 390×844 dp. Fonts on this Page fall back to the system face; the PNGs and HTML sources use Inter Tight, Geist Mono and Instrument Serif/Sans.">
        <Callout tone="info" lead="Adopted (rev 3.1, Haris via lead): the hybrid.">Graphite Studio's main UI is the structural base, and it takes precedence. Its information architecture, its separate instrument/layer cards, its controls and the discoverability of its features all stay. From Paper Score the hybrid borrows only its character: editorial serif headings, italic chord names, and stave hairlines inside layer cards and capture headlines. The structure is never replaced by a score sheet, and instruments are never hidden. The same hybrid comes in dark (the default for playing) and light.</Callout>
        <Grid columns={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text>Hybrid · dark</Text>
            <Bezel><MockPhone s={STEPS[1]} /></Bezel>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text>Hybrid · light</Text>
            <Bezel><MockPhone s={STEPS[1]} light /></Bezel>
          </div>
        </Grid>
        <Text>The inputs to the hybrid are below: A as it was first proposed, and B, from which only the character is borrowed.</Text>
        <Grid columns={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text>A · Graphite Studio (recommended)</Text>
            <Bezel><MockPhone s={STEPS[3]} /></Bezel>
            <BulletList items={["A dark instrument: graphite stage with a warm ember accent used only for Capture, the playhead and the next slot", "Layers stay on screen as lanes with live mini piano rolls, each with a hue, a glyph and a number", "The thumb zone holds the actions: a Capture capsule, Undo, the sound, and an optional Stop", "Chord names in italic give the sketch a voice"]} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text>B · Paper Score (alternative)</Text>
            <Bezel r={44}><MockPaper /></Bezel>
            <BulletList items={["A light, editorial look: warm paper, ink staves numbered I–IV, and one vermilion mark", "It reads like a lead sheet: calm and literate, good in daylight, and it prints well", "Capture is a single ink disc with Undo and an optional Stop beside it", "Trade-off: the page is bright at night, faint layers have lower contrast, and it feels less like an instrument"]} />
          </div>
        </Grid>
        <Callout lead="Original recommendation (now folded into the hybrid): A, Graphite Studio.">Haris plays in dim rooms and on stage, and graphite keeps four layers legible at arm’s length. It feels like hardware, the accent keeps its meaning (Capture, time, next slot), and the dark stage suits OLED phones and a Fold on a stand. From B, A keeps the serif chord names and the calmer copy. Keep B for a later light theme and for the review, export and share sheet. Both directions keep 48 dp targets, WCAG AA text (computed in hifi/contrast.tsv), cues that never rely on colour alone, and the same layout logic.</Callout>
      </Section>

      <Section heading="Storyboard: from noodling to three layers" id="story" caption="Simulation, not working MIDI/audio. Interaction counts are estimates, not test results. No step needs arm, record or stop.">
        <StoryPlayer />
        <Grid columns={4}>
          {STEPS.map((s: Step) => (
            <div key={`th${s.id}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Bezel r={30}><MockPhone s={s} /></Bezel>
              <Text>{`${s.id} · ${s.title} · est. ${s.touch}`}</Text>
            </div>
          ))}
        </Grid>
        <Table columns={["Hi-fi asset (shared box)", "What it is"]} rows={[
          ["/workspace/blocks-design/hifi/hybrid/hybrid-dark-vs-light.png · hybrid/{dark,light}/01…07-*.png · storyboard-overview.png", "Rev 3.1 adopted hybrid: the full storyboard plus Fold and desktop frames, in dark and in light (2x PNG)"],
          ["/workspace/blocks-design/hifi/directions/direction-A-graphite-studio.png · direction-B-paper-score.png · A-vs-B-recommendation.png", "Direction boards (2x PNG) with palette, type, layer key and rationale"],
          ["/workspace/blocks-design/hifi/storyboard/01…07-*.png · storyboard-overview.png", "Seven phone frames with captions, plus an overview sheet that includes the Fold and desktop frames"],
          ["/workspace/blocks-design/hifi/storyboard/fold-05-bass-captured.png · desktop-07-edit-quantise.png", "Fold expanded (about 840×1000 dp, proposed) and desktop browser (1440×900)"],
          ["/workspace/blocks-design/hifi/prototype/index.html", "Self-contained clickable prototype of the hybrid, with embedded font subsets, a Dark / Light toggle, hotspots (Capture, Undo, Done), arrow keys and Phone / Fold / Desktop views"],
          ["/workspace/blocks-design/hifi/storyboard/src/*.html · directions/*.html · hifi/src/*.py", "Editable HTML/CSS vector sources and the Python generator (build.py) that renders them in headless Chrome at 2x"]
        ]} />
      </Section>

      <Section heading="Take history & capture range (rev 3.2)" id="range" caption="PROPOSED capability, not implemented; no claim that the current build supports it. Notes are design/example data. Chord names and role tags are mock data; recognition is under research.">
        <Callout lead="The engine picks the phrase; handles are effortless correction.">The sequence shows one-action success first (09: one Capture takes all four chords and the pickup, no handles), then the failure where only the last chord is chosen (10) and its correction (11 drag ⟦, 12 fixed with Undo). The take history is the main Play view, not a separate editor, and the layer cards stay visible.</Callout>
        <RangeLab />
        <Table columns={["Operation", "What it changes", "Where", "Destructive?"]} rows={[
          ["(a) Loop-boundary adjustment", "Which part of the take loops. Dragging ⟦ moves the start with the end fixed, so the length changes; ⟧ moves the end with the start fixed.", "Take history on Play (09–13a)", "No. Raw events untouched; one undo step per drag"],
          ["(c) Phase nudge / Slide", "Where beat one falls. The dedicated Slide control keeps the length and shifts beat one; ‹ › step a beat.", "Loop sheet, Slide (phase) (13b)", "No. Grid/phase only; tempo stays locked (A2)"],
          ["(b) Cutting and note edits", "The notes: cut, delete, move, trim.", "Edit tool only (07)", "Yes: needs explicit intent and is undoable; never reachable from a range handle"]
        ]} />
        <BulletList items={["Free time vs grid: estimated bars are dashed until Capture, a set grid is solid, and free time uses a seconds ruler with no bars invented (15).", "Snap: onsets, beats, bars or off; override for one drag by sliding the finger up, or Ctrl/Cmd on desktop (11, 16).", "Pan, zoom, follow: one finger pans, pinch zooms, either pauses following and shows Back to live; handle drags near an edge auto-scroll (16).", "Loop edges: a pickup before bar 1 is kept and wraps; a note held across the end is clipped for playback only, with the raw note kept (14).", "Undo: every range edit, slide and label toggle is one undo step, with a toast and the persistent ↶ (12).", "Harmony labels: small italic jazz labels with extensions, alterations and inversions, honest alternatives such as “or Dm9/G” at lower emphasis (never percentages), and chord, melody, arpeggio and bass role tags. Optional, toggleable, hidden while dragging.", "Accessibility: handles are sliders; move by note, beat or bar; [ ] focus, arrows (+Alt beat, +Shift bar), S slide, L back to live."]} />
        <Table columns={["Rev 3.2 asset (shared box)", "What it is"]} rows={[
          ["/workspace/blocks-design/hifi/hybrid/{dark,light}/09-range-auto-success.png … 16-range-zoom-snap.png (incl. 13a, 13b)", "Range storyboard frames with captions (2x PNG); bare 2x screens in src/*@2x.png, editable src/*.html"],
          ["/workspace/blocks-design/hifi/hybrid/{dark,light}/fold-11-range-drag.png · desktop-11-range-drag.png", "Fold expanded (stepper panel) and desktop browser (keyboard map) variants"],
          ["/workspace/blocks-design/hifi/hybrid/{dark,light}/range-overview.png", "One-board overview of 08–16"],
          ["/workspace/blocks-design/hifi/prototype/index.html", "Prototype now covers 08–16: draggable handles with snapping and keyboard, Boundaries ↔ Slide, Back to live, Undo, Blocks ⌄ → Settings"]
        ]} />
      </Section>

      <Section heading="Settings · Appearance (rev 3.2)" id="settings" caption="PROPOSED. Reached from the Blocks ⌄ wordmark menu at the top-left of Play; never on the play surface.">
        <Grid columns={2} plain>
          <SettingsMock />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Properties items={[{ label: "Options", value: "System (default) · Light · Dark" }, { label: "Entry", value: "Blocks ⌄ menu on Play (desktop: same menu in the top bar)" }, { label: "Switching", value: "Applies instantly; never interrupts audio, playback, loop phase or MIDI input" }, { label: "Persistence", value: "Saved on this device; System follows OS/browser changes live" }, { label: "Acceptance", value: "AC-SET-01 to AC-SET-03 in acceptance-criteria.md" }]} />
            <Table columns={["Asset", "Path"]} rows={[["Dark", "/workspace/blocks-design/hifi/hybrid/dark/08-settings-appearance.png"], ["Light", "/workspace/blocks-design/hifi/hybrid/light/08-settings-appearance.png"], ["Editable", "hifi/hybrid/{dark,light}/src/08-settings-appearance.html"]]} />
          </div>
        </Grid>
      </Section>

      <Section heading="Visual north star: sexy, sleek" id="north" caption="Owner direction from Haris. Sexy never overrides usability or accessibility: 48dp targets, WCAG contrast, non-colour cues and reduced motion always win.">
        <Grid columns={2}>
          <Wire s={PLAY} />
          <div>
            <Text>Blocks looks like a <b>premium, dark-first instrument</b>, not a form. The surfaces are quiet graphite. Your playing is shown in crisp neutral light. One confident accent, <b>Signal</b>, marks only what matters now: Capture, the playhead and beat one, the selection, and one primary action per region.</Text>
            <Properties items={[
              { label: "Palette", value: "Graphite #0D0F13 / #14171C / #1B1F25, text #ECEEF2, muted #9AA3AF, notes #C9D1DC, one accent Signal #FF6A3D (on-accent text #120C0A)" },
              { label: "Typography", value: "One family (Inter or platform UI). Tight tracking at ≥ 24sp, small uppercase labels with +0.8 tracking, tabular numerals for tempo and bars. Scale 12/14/16/20/24/32sp" },
              { label: "Space & chrome", value: "Generous negative space; panels separated by tone, not lines; secondary controls hidden until needed; music gets the most room" },
              { label: "Finish", value: "Hardware-like: a 2–3% top-down gradient, a 1px machined top highlight, 12dp control radius, 3dp notes, 28dp device frame; no skeuomorph textures or blur over music" },
              { label: "Motion", value: "Tactile but subtle: Capture press 120 ms (scale 0.98, glow, haptic); sheets 220 ms; new layer fades in at the boundary; ≤ 250 ms. Reduced motion: no scale or glow, instant transitions" },
              { label: "Identity", value: "Signal accent + history ribbon with phrase bracket + full-width Capture slab + graphite surfaces. Original to Blocks; no clones of DAW or app skins" }
            ]} />
          </div>
        </Grid>
        <ProsCons prosHeading="Do" consHeading="Don't" pros={["Make Capture the single brightest object on Play", "Show the music in high-contrast neutral light", "Group by tone steps, not boxes", "Pair every use of the accent with a shape or text cue", "Keep labels short and confident; use tabular numerals", "Test in a dim room and in sunlight"]} cons={["A second accent hue, or rainbow layers as the only identity", "Thin grey text below 4.5:1", "An outline as the only boundary of a control", "Decorative animation while playing", "Tiny icon-only buttons or targets under 48dp", "Brand look-alikes; hiding PROPOSED or placeholder status for style"]} />
        <Table columns={["Contrast pair (computed, WCAG formula)", "Ratio"]} rows={[
          ["Text #ECEEF2 on graphite #0D0F13", "16.5:1"], ["Muted #9AA3AF on graphite / on control", "7.5:1 / 6.5:1"], ["On-accent #120C0A on Signal #FF6A3D (gradient low end #E2512A)", "6.8:1 (5.0:1)"],
          ["Signal on graphite (playhead, beat one)", "6.7:1"], ["Selection outline #FFFFFF on graphite", "19.2:1"], ["Ghost outline #6B7480 on graphite", "4.1:1"],
          ["Selected vs unselected notes", "Differ by a 2dp white outline and handles, not by accent alone (accent vs note is only 1.85:1)"]
        ]} />
        <Text>Rev 3: the hi-fi Direction A above is the evolved form of this north star. Its accent is #FF7442, it uses a reach-back Capture glyph instead of a record dot, it adds serif chord names, and empty slots fold into one row. This section is kept for history.</Text>
        <Text>Restyled in this style: Play portrait, Fold open, desktop, Capture review, piano roll and capture edge states. The other wireframes stay light schematics for structure only. Values are in tokens.json under visualNorthStar, and every one is a proposal pending on-device review.</Text>
      </Section>

      <Section heading="Principle & vocabulary" id="vocab">
        <Metrics metrics={[
          { value: "≤ 1", label: "touch from good idea to looping layer", detail: "0 with optional CC/button mapping" },
          { value: "≈ 14–16", label: "touches, full walkthrough", detail: "estimate, native; web adds 1 gesture + browser prompt" },
          { value: "48dp", label: "minimum hit target (proposed)", detail: "8dp gaps; Capture 112dp; pending measurement" },
          { value: "0", label: "arming / tempo setup steps", detail: "always listening" }
        ]} />
        <Text>More time playing, less screen-touching. Blocks keeps four ideas strictly apart in copy, controls and data. Every grid control carries the line “Your timing is unchanged — only the grid moves.”</Text>
        <Table columns={["Term", "Meaning", "User can change?", "Never does"]} rows={[
          ["Take", "Raw events exactly as played (notes, velocity, pedal, original timestamps)", "No — immutable", "Never re-timed"],
          ["Grid", "Interpretation: tempo, meter, beat one, loop start/length", "Yes — Capture review", "Never moves notes"],
          ["Playback tempo", "Deliberate speed change for the whole sketch", "Yes — transport", "Never offered as a fix for a wrong grid"],
          ["Quantise", "Explicit edit moving selected notes toward grid by a strength", "Yes — piano roll, undoable", "Never automatic; default off"],
          ["Original take", "Raw take played unlooped, unedited", "Toggle (review, layer menu)", "Never lost"]
        ]} />
      </Section>

      <Section heading="Research → mechanisms → decisions" id="research" caption="Findings cite sources opened 8 Nov 2026 (S-numbers, list at the end). Hypotheses are marked. Full table in research.md.">
        <Table columns={["Finding (sourced)", "Mechanism", "Blocks decision"]} rows={[
          [`Live is always listening on armed/monitored tracks; on an empty stopped Set, Capture detects tempo (80–160 BPM), sets the loop and starts playing it; earlier notes are kept before the clip start (${S(1)})`, "Retrospective capture + immediate audible check; interpretation separate from data", "No arm/record on Play. Auto-loop after first Capture. Take immutable; grid editable; Original take always recoverable"],
          [`With transport running or clips present, Live uses the existing tempo and can overdub (${S(1)})`, "First capture defines the grid", "Grid belongs to the sketch; later captures conform and join at the next loop boundary"],
          [`Logic Flashback works playing or stopped; stopped mode discards before a 20 s pause and hides notes before a 1.5-bar pause, recoverable by dragging (${S(7)}, ${S(8)})`, "Silence segments phrases — and can be wrong", "Ribbon previews the likely phrase before pressing; review can extend the loop back into earlier notes"],
          [`FL Studio Score logger keeps the last 30 min, dump by 2–30 min, cleared on restart (${S(12)})`, "Long rolling safety net", "History chip (“1:58 kept”): proposed 120 s + hard cap; overload gaps flagged (A1)"],
          [`Push 3 has a dedicated Capture button with immediate playback (${S(5)}); Ableton Note's Capture MIDI auto-detects tempo/length on iPhone/iPad only (${S(6)})`, "One-press capture on hardware and phone", "Capture optionally mappable to any spare CC/button/pad (no spare pedal needed, no default takeover); Android gap is the opportunity"],
          [`Live's snap preserves a note's offset from the grid; quantise has an Amount (${S(2)}); Live records at the time you hear (with monitoring latency) (${S(4)})`, "Feel-preserving editing; time-basis is a product choice", "Snap with offset preserved; quantise strength default 50%; input-event time preserved, no unmeasured latency shift (A3)"],
          [`Logic iPad: explicit tool buttons change gestures; Select can be momentary by touch-and-hold (${S(9)}); holding a note zooms horizontally (${S(10)}); VoiceOver changes velocity in steps of 10 (${S(11)})`, "Explicit tools + quasimodes + precision aid + non-visual path", "Edit/Draw/Range chips; hold-to-add-selection; loupe instead of canvas auto-zoom (hypothesis); SR velocity ±10/±1"],
          [`FL Studio Mobile: tap empty adds; tap-and-hold note → delete pop-up; wait-for-rectangle selection (${S(13)})`, "Waits disambiguate intent but cost time", "No waits on the main path: Edit-drag on empty = marquee; navigation is two-finger only"],
          [`Android: ≥ 48×48dp targets, ≥ 8dp spacing (${S(15)}); HIG 44pt default (${S(16)}); WCAG 2.5.8 24px minimum (${S(17)}); NN/g ≥ 1 cm (${S(21)})`, "Physical finger size", "48dp hit everywhere, note hit areas expanded; editing disabled below 24dp lanes"],
          [`Centre targets ~7 mm vs ~12 mm in corners (${S(24)}); grips shift often and fingers obscure content (${S(23)})`, "Reach and occlusion", "Capture bottom-centre / right rail; edge controls ≥ 56dp; loupe above finger"],
          [`Mode slips: use ≥ 2 indicators; spring-loaded modes avoid slips (${S(22)}); colour can't be the only cue (${S(18)}); drags need single-pointer alternatives (${S(19)}, ${S(20)})`, "Mode and accessibility safety", "No erase mode; tool shown 3 ways; outline/dash/text for every state; Len ±/Vel ±/nudge buttons"],
          [`Size classes compact < 600 / medium 600–840 / expanded 840+; compact height < 480 (${S(25)}); FoldingFeature posture + keep controls off the fold (${S(26)})`, "Layout by window, not device", "Responsive rules keyed to classes; 24dp hinge keep-out; tabletop split (P1)"],
          [`AudioContext starts suspended before a gesture (${S(28)}); states incl. interrupted (${S(35)}); Web MIDI is permission-gated (${S(29)}), secure-context, NotAllowed/NotSupported errors (${S(31)}); no Safari/iOS/Firefox Android support (${S(30)})`, "Web readiness is multi-step and fallible", "One explicit enable gesture (audio, then MIDI request; browser prompt varies); specific error cards; touch keys always available"]
        ]} />
        <Callout tone="info" lead="Evidence limits.">Vendor manuals describe capabilities, not success rates; no source quantifies capture-inference accuracy. Hardware coverage is Push 3 only (Elektron and Teenage Engineering pages opened had no usable detail; not cited). Korg Gadget and Koala were not researched. Touch research is general, not musician- or piano-roll-specific; Hoober 2013 is older observational data. No Fold dp measurements were sourced. Nothing is user-tested.</Callout>
      </Section>

      <Section heading="Navigation & hierarchy" id="nav" caption="Play is home. Sheets keep the loop and keyboard live; only the piano roll is full-screen. Max depth 2.">
        <Diagram direction="horizontal" nodes={[
          { id: "play", label: "Play (home)", detail: "ribbon · layers · Capture", kind: "terminal" },
          { id: "ready", label: "Readiness sheet" }, { id: "sound", label: "Sound browser sheet" }, { id: "rev", label: "Capture review sheet" },
          { id: "layers", label: "Layers view / pane" }, { id: "menu", label: "Sketch menu" },
          { id: "roll", label: "Piano roll (full)" }, { id: "exp", label: "Export sheet" }, { id: "learn", label: "Controller learn" }
        ]} edges={[
          { from: "play", to: "ready" }, { from: "play", to: "sound" }, { from: "play", to: "rev", label: "Capture" }, { from: "play", to: "layers" }, { from: "play", to: "menu" },
          { from: "layers", to: "roll", label: "Edit" }, { from: "menu", to: "exp" }, { from: "menu", to: "learn" }
        ]} />
        <Text>Visual priority: 1 Capture (largest, highest contrast, bottom-centre) → 2 take ribbon (what you just played) → 3 layer strip (where it goes) → 4 transport → 5 readiness (compact; loud only when broken) → 6 sound and menu. No navigation stops audio, cancels a review, or clears a selection.</Text>
      </Section>

      <Section heading="Layouts across five form factors" id="layouts" caption="Original wireframes, PROPOSED. Switch form factor; numbered markers match the notes.">
        <LayoutSwitcher />
        <Table columns={["Window", "Rule"]} rows={[
          ["Compact width < 600dp", "Single column; Capture bottom-centre, full width, 112dp"],
          ["Compact height < 480dp", "Capture → right rail ≥ 192dp wide; sheets ≤ 60% height"],
          ["Width < 360dp", "Layer strip → single Target chip; action-bar overflow after 4 actions"],
          ["Medium 600–840dp (Fold open)", "Two panes: Play + Layers (or editor)"],
          ["Expanded ≥ 840dp and height ≥ 600", "Three regions: Layers · Play/Edit · Inspector"],
          ["Separating hinge / half-opened", "Nothing interactive within 24dp of the hinge; horizontal hinge = tabletop (content top, controls bottom; P1)"],
          ["Any class change", "Keeps audio, review, selection; cancels an in-progress gesture cleanly"],
          ["Font scale up to 200%", "Reflow; ribbon shrinks before Capture does"]
        ]} />
      </Section>

      <Section heading="Play / Capture — the main screen" id="play">
        <Figure s={PLAY} />
        <Table columns={["Sketch state", "What Capture does", "Playback after"]} rows={[
          ["Empty sketch, stopped", "Infer tempo, beat one, length from the likely phrase (meter 4/4 initially); create the first part; set the sketch tempo/meter", "Loops at once (adopted default; persistent “Stay silent” option); non-blocking review"],
          ["Layers playing", "Select bounded history already played on the existing transport, ending at the last bar line already passed — never future input. Held notes get playback-only synthetic releases; raw take unchanged. Tempo locked (A2)", "Queued join at the next loop boundary; review offers bar shift / length"],
          ["Tempo exists, stopped", "Tempo stays locked (A2); only beat-one phase and selection correction", "Plays all layers from loop start"],
          ["History empty", "Nothing changes; “Nothing to capture yet — play something” + announcement", "—"],
          ["No steady pulse", "Still captures: “No steady pulse found” — keep a free-time loop, or Set BPM (A4)", "Loops the whole phrase"],
          ["One or zero sensible candidates", "Inferred tempo (if any) plus ½ / ×2 / Set BPM, always shown; extra alternatives only when justified; no confidence %", "Loops the inferred result"],
          ["History gap (overload)", "Capture may be partial; the gap is flagged in the ribbon, review and take (A1)", "As above, gap marked"],
          ["All slots full", "Explicit choice: new layer (when supported) / replace… / keep as take only / cancel (A6)", "Per choice"]
        ]} />
      </Section>

      <Section heading="First run & readiness" id="ready">
        <Figure s={FIRST} />
        <Table columns={["State", "Detected from (requirement)", "Title — fix"]} rows={[
          ["Web MIDI unsupported", `No requestMIDIAccess / NotSupportedError (${S(30)}, ${S(31)})`, "This browser can't use MIDI keyboards — use a browser with Web MIDI (caniuse lists desktop Chrome/Edge/Firefox and Chrome for Android), or touch keys. Other browsers are not recommended until checked."],
          ["MIDI blocked", `NotAllowedError (${S(31)})`, "MIDI is blocked for this site — numbered steps, then Try again"],
          ["Not secure", `Non-secure context (${S(31)})`, "MIDI needs a secure (https) page — link"],
          ["Sound paused", `AudioContext suspended / interrupted (${S(35)})`, "Sound is paused — Tap to resume (capture continues only if MIDI delivery continues, A1)"],
          ["Sound stopped", "closed / native engine error", "Sound stopped working — Restart sound; in-memory history kept"],
          ["No keyboard", `Granted, 0 inputs; live via statechange (${S(32)}) / device callback (${S(27)})`, "No MIDI keyboard found — plug in, pair, or use touch keys"],
          ["Connected, silent", "Port present, no message 10 s after prompt", "Connected, but no notes yet — check channel/cable"],
          ["Disconnected", "Port removed mid-session", "Banner: held notes released, playing kept; clears on reconnect"]
        ]} />
        <Text>The on-screen touch keyboard is a real instrument labelled “Touch keys (on screen)”. It never appears in the input list and never turns the MIDI card to ready. See wireframe 07-readiness-errors.svg for all eight cards.</Text>
      </Section>

      <Section heading="Capture review, corrections & auto-play" id="review">
        <Figure s={REVIEW} />
        <Wire s={EDGE} />
        <NumberedList items={EDGE.a} />
        <Table columns={["After-Capture option", "For", "Against", "Verdict"]} rows={[
          ["A · Loop immediately", `Instant ear check; 0 touches; matches Live/Push/Note (${S(1)}, ${S(5)}, ${S(6)})`, "Can blare a wrong loop; needs running audio on web", { text: "Adopted default (lead)", tone: "success" }],
          ["B · Stay silent, show review", "Calm", "Needs a Play touch; judge by eye; breaks flow", "Setting option"],
          ["C · Play once, stop", "Confirms take", "Never hears the loop point being judged", { text: "Rejected", tone: "danger" }],
          ["D · Count-in, then loop", "Ready to overdub", "Delays feedback; wrong tempo → wrong count-in", "P1 option (stopped + grid)"],
          ["E · Quiet preview (−12 dB)", "Less startling", "Misleading level", { text: "Rejected", tone: "danger" }]
        ]} />
        <Callout tone="success" lead="Adopted by the lead (reversible):">Loop immediately from the inferred loop start. Reverse with Stop or Discard in the sheet, one Undo, or the persistent setting “After Capture: Loop / Stay silent” (offered once after the first Discard). On web with suspended audio, the capture still happens and the sheet shows “Tap to hear”.</Callout>
      </Section>

      <Section heading="Sound browser & four-layer overview" id="layers">
        <Grid columns={2}>
          <div><Text><b>Sound browser (sheet, 09)</b></Text><BulletList items={["Search plus category chips; 60dp rows with a 48dp favourite star (proposed sizes)", "Sound names are placeholders (e.g. “Warm EP”) until the sound set is chosen; no asset is promised", "Tapping a row auditions it and assigns it to the Target layer at once, so you can keep playing while you browse", "“Back to previous” at the top; every change can be undone; Next/Prev sound can be mapped to a controller"]} /></div>
          <div><Text><b>Layers overview (10)</b></Text><BulletList items={["Four parts is a milestone, not a maximum (A11); the first slice ships one part, and the overview follows", "Shared sketch tempo/meter and a common loop at first; later per-layer lengths must never silently retime notes (A5)", "Rows: number, sound, note thumbnail, state as text, M / S / Edit / Sound / ⋯", "Target = ◎ + “next”; Muted = dashed + “MUTED”; first layer labelled “Sets the grid”", "⋯ menu: Original take, Loop & timing, Duplicate to empty layer, Clear (undoable), Export layer"]} /></div>
        </Grid>
      </Section>

      <Section heading="Touch piano roll & gestures" id="roll">
        <Figure s={ROLL} />
        <Table columns={["Gesture", "Edit tool", "Draw tool", "Range tool"]} rows={[
          ["Tap empty", "Deselect all", "Add note (last length) + audition", "Clear range"],
          ["Tap note", "Select only it", "Select only it — never deletes", "Select its time span"],
          ["Long-press note / hold ＋Add", "Toggle in selection", "Toggle in selection", "—"],
          ["Drag note body", "Move selection (snap, offset kept)", "Move selection", "Extend range"],
          ["Drag handle", "Resize all selected", "Resize", "—"],
          ["Drag empty", "Marquee select", "Add note; drag sets length", "Select time range"],
          ["Double-tap note", "Select chord (same start ±1/32)", "Same", "—"],
          ["2 candidates within 8dp", "Picker", "Picker", "—"],
          ["Two fingers", "Pinch zoom / pan", "Pinch zoom / pan", "Pinch zoom / pan"],
          ["2nd finger mid-edit", "Cancel + revert edit, then navigate", "Same", "Same"]
        ]} />
        <Table columns={["Ownership rule", "Owner"]} rows={[
          ["1 finger in note grid", "Current tool — never scrolls"],
          ["1 finger on time/key ruler", "Pan that axis; double-tap = zoom to fit; tap key = select pitch"],
          ["Loop brace handles (48dp hit)", "Loop start/end — beats ruler pan inside hit area"],
          ["2 fingers anywhere", "Navigation; axis from initial angle (< 30° time, > 60° pitch, else both)"],
          ["Thresholds", "Slop 8dp · long-press 500 ms · double-tap 300 ms · edge auto-scroll 32dp"]
        ]} />
        <Grid columns={2}>
          <div><Text><b>Selection & resize states (non-colour)</b></Text><BulletList items={["Idle: filled with a 1dp outline", "Selected: 3dp outline, handle tabs and a “3 selected” badge", "Dragging: the note lifts, a dashed ghost stays at the origin, and the loupe shows a readout", "Resizing: highlighted handle, a ghost of the old length and “len ¼ → ½”", "Marquee: a dashed box; notes inside it are outlined", "Invalid drop: the ghost shows ✕ and “out of range”"]} /></div>
          <div><Text><b>Editing tools</b></Text><BulletList items={["Quantise: grid value, strength 25/50/75/100 plus a slider (default 50), starts only or starts and ends, live preview with ghosts, Apply/Cancel; swing is P1", "Velocity: “Vel 84” stepper, ±1, or ±10 by long-press; with several notes selected it changes them relatively and shows “+6” or “mixed”", "Audition (“Hear edits ♪”) is on by default, capped at 150 ms", "Undo/Redo are always visible, one step per gesture, with labels such as “Undo move 3 notes”", "Key lanes are 32dp by default (zoom 16–64); editing switches off below 24dp"]} /></div>
        </Grid>
      </Section>

      <Section heading="Controller learn, save, recovery & export" id="ctl">
        <Grid columns={3}>
          <div><Text><b>Controller learn (13)</b></Text><BulletList items={["Short action list: Capture, Keep/Discard, Play/Stop, Undo/Redo, Next/Prev sound, Target / new layer", "A listening panel shows live incoming messages and times out (proposed 10 s)", "No spare pedal required: Capture can be mapped to any spare CC, button or pad", "No takeover by default of sustain (CC 64) or playable keys; an optional command zone only when explicitly enabled; warns before either", "Staged, not dropped: Capture first; Play/Stop, Undo/Redo, sounds and target/new layer grow with later gates"]} /></div>
          <div><Text><b>Save & recovery (14)</b></Text><BulletList items={["Autosaves each committed edit (proposed 2 s debounce) and when the app goes to the background; shows “Saved” / “Saving…” as text", "Session undo at first, plus durable takes, edits and snapshots; undo across relaunch comes later (A10)", "If a save fails, a banner stays up with Retry and Export now; your edits are kept", "After a crash: Open recovered or Open last saved; both are kept until you choose", "A version snapshot is taken at every capture"]} /></div>
          <div><Text><b>Export (14)</b></Text><BulletList items={["MIDI with all layers or one layer; tempo, meter, and beat one placed at bar 1", "Aligned WAV stems: a required later milestone. Stems share one start and a common duration plus tail; the tail follows the preset's real release and the user's choice (no universal 2 s, A9)", "Timing: As edited or Original take", "Length is visible and changeable (proposed default Loop ×4)", "Raw CC64, pitch bend and pressure kept; controller lanes read-only; synthetic note-offs/panic not exported (A8)"]} /></div>
        </Grid>
      </Section>

      <Section heading="Edge states" id="edge">
        <Table columns={["Case", "UI behaviour"]} rows={[
          ["Capture during playback", "Bounded history already played on the existing transport, never future input; held notes get playback-only synthetic releases; queued join at the next boundary"],
          ["Capture while stopped", "First capture: infer. Tempo exists: locked; phase/selection correction only (A2)"],
          ["Bad inference / no pulse", "½ / ×2 / Set BPM always offered; extra alternatives only when justified; “No steady pulse” free-time loop; Original take always there (A4)"],
          ["No MIDI / unsupported / denied", "Specific card; source-tagged touch keys stay available and never fake readiness (A7); no repeated prompting"],
          ["Audio suspended / interrupted", "Banner “Sound is paused — Tap to resume”; capture continues only if MIDI delivery continues (A1)"],
          ["Hidden tab / backgrounded", "No guaranteed delivery; native foreground-only at first; in-memory history kept; gaps flagged on return"],
          ["Device disconnected", "Held notes stopped with synthetic releases stored apart from raw events; history kept; banner"],
          ["Ordinary age eviction", "Proposed 120 s rolling + hard event/byte cap (integrator tunes); not an error"],
          ["Overload / dense input", "A distinct state: gaps/drops flagged in ribbon, review and take; Capture may be partial — never promised to be complete"],
          ["Relaunch with uncaptured history", "Recovery pending a separate implementation; no promise in UI"],
          ["All slots full", "Explicit choice; never a silent replace or merge (A6)"],
          ["Save failure / storage full", "Persistent banner, Retry / Export now; stems export offers MIDI-only fallback with the size needed"],
          ["Fold / rotate mid-task", "Audio, review, selection kept; in-progress gesture reverted"],
        ]} />
      </Section>

      <Section heading="End-to-end walkthrough" id="walk" caption="Interaction counts are ESTIMATES from walking through the proposed design, not measurements.">
        <Table columns={["#", "Step", "Touches (native)", "Web extra"]} rows={[
          ["1", "Open, first-run “Start playing”", "1", "+1 enable gesture, plus any browser prompt (varies)"],
          ["2", "Play freely 1–2 min", "0", ""],
          ["3", "Capture", "1 (0 with optional CC/button mapping)", ""],
          ["4", "Hear loop, judge by ear", "0", ""],
          ["5", "Fix beat one if wrong", "1–2", ""],
          ["6", "Keep (implicit by playing on)", "0", ""],
          ["7", "Change sound for layer 2", "2", ""],
          ["8", "Play over loop, Capture (multi-part builds; queued join)", "1 (0 with optional mapping)", ""],
          ["9", "Repair a wrong note (Edit, tap, drag, Back)", "4", ""],
          ["10", "Export MIDI + stems", "4–5", ""],
          ["", "Total", { text: "≈ 14–16 (≈ 12–14 with optional mapping)", tone: "success" }, "+1 plus browser prompt(s)"]
        ]} emphasis={10} />
      </Section>

      <Section heading="State machines" id="states" caption="Mermaid versions of these and transport, pointer and save machines are in state-machines.md.">
        <Text><b>Capture lifecycle</b></Text>
        <Diagram direction="horizontal" nodes={[
          { id: "l", label: "Listening", detail: "~120 s + cap", kind: "terminal" }, { id: "g", label: "Gap flagged", detail: "overload / hidden" }, { id: "e", label: "Nothing to capture" }, { id: "f", label: "Slots full", detail: "explicit choice", kind: "decision" },
          { id: "i", label: "Inferring", detail: "no sketch tempo yet" }, { id: "np", label: "No pulse", detail: "free-time / Set BPM" }, { id: "c", label: "Selecting", detail: "tempo locked; played history only" },
          { id: "q", label: "Queued join", detail: "next loop boundary" }, { id: "r", label: "Reviewing", detail: "looping, non-blocking" }, { id: "k", label: "Kept" }, { id: "d", label: "Discarded", detail: "Undo" }
        ]} edges={[
          { from: "l", to: "g", dashed: true }, { from: "g", to: "l", dashed: true }, { from: "l", to: "e", label: "empty" }, { from: "l", to: "f", label: "Capture, all full" }, { from: "f", to: "c", label: "choose" },
          { from: "l", to: "i", label: "Capture" }, { from: "l", to: "c", label: "Capture" }, { from: "i", to: "r", label: "pulse" }, { from: "i", to: "np" }, { from: "np", to: "r" },
          { from: "c", to: "q" }, { from: "q", to: "r" }, { from: "r", to: "k", label: "Keep / dismiss / play on" },
          { from: "r", to: "d", label: "Discard" }, { from: "d", to: "k", label: "Undo", dashed: true }
        ]} />
        <Text><b>Readiness (web)</b></Text>
        <Diagram direction="horizontal" nodes={[
          { id: "s", label: "Check support", kind: "decision" }, { id: "u", label: "Unsupported / insecure" }, { id: "a", label: "Audio locked" }, { id: "r", label: "Audio running" },
          { id: "p", label: "MIDI prompt" }, { id: "x", label: "Denied" }, { id: "n", label: "No device" }, { id: "q", label: "Connected, silent" }, { id: "ok", label: "Receiving", kind: "terminal" }, { id: "t", label: "Touch keys only" }
        ]} edges={[
          { from: "s", to: "u" }, { from: "s", to: "a" }, { from: "a", to: "r", label: "one enable gesture" }, { from: "r", to: "p", label: "then MIDI request (prompt varies)" },
          { from: "p", to: "x" }, { from: "p", to: "n", label: "granted" }, { from: "n", to: "q", label: "port added" }, { from: "q", to: "ok", label: "first message" },
          { from: "ok", to: "q", label: "disconnect → reconnect", dashed: true }, { from: "u", to: "t" }, { from: "n", to: "t" }
        ]} />
      </Section>

      <Section heading="Touch, keyboard, controller & screen-reader equivalents" id="a11y">
        <Table columns={["Action", "Touch", "Keyboard", "Controller", "Screen reader"]} rows={[
          ["Capture", "Capture button", "C", "Any spare CC/button/pad (optional; first gate)", "“Capture, last 8 bars to layer 2”"],
          ["Keep / Discard", "Keep, dismiss, play on / Discard", "Enter / Backspace", "Learnable (later gate)", "Buttons; Undo announced"],
          ["Play / Stop", "Transport", "Space", "Learnable (later gate)", "Toggle “Playing”"],
          ["Undo / Redo", "Buttons", "Ctrl/⌘+Z, Shift+Ctrl/⌘+Z", "Learnable (later gate)", "“Undo move 3 notes”"],
          ["Target / new layer", "Tap slot", "1–4", "Learnable (later gate)", "Radio group “Target layer”"],
          ["Change sound", "Sound pill / sheet", "Ctrl/⌘+K", "Next/Prev learnable (later gate)", "List"],
          ["Loop length / beat one", "Chips, steppers, brace drag", "[ ] / , .", "—", "Adjustable controls"],
          ["Tool", "Chips", "E / D / R", "—", "Radio group"],
          ["Move / resize note", "Drag; Len ±; nudge", "Arrows; Shift+arrows; Alt+←/→", "—", "Custom actions earlier/later/up/down/longer/shorter"],
          ["Velocity", "Vel ± (lane drag P1)", "V then ↑↓ (Shift ±10)", "—", `Adjustable, steps of 10 (cf. ${S(11)})`],
          ["Duplicate / Delete / Quantise", "Action bar", "Ctrl/⌘+D / Delete / Q", "—", "Actions"],
          ["Zoom / pan", "Pinch, 2-finger, rulers, overview", "Ctrl/⌘ ± / wheel", "—", "Buttons “Zoom in time”, “Scroll later”"]
        ]} />
        <BulletList items={[
          `Notes are exposed as a list in time order: “Note D4, bar 3 beat 2, eighth, velocity 84, selected”, with custom actions (React Native accessibilityActions, ${S(36)}).`,
          "A polite live region announces captures and device changes; save failures are announced assertively.",
          `No state relies on colour alone (${S(18)}): selection uses outline weight and handles, mute uses a dash and text, readiness uses an icon and text.`,
          `Every drag has a single-tap alternative (${S(19)}); pinch has buttons (${S(20)}).`
        ]} />
      </Section>

      <Section heading="Components & tokens" id="comp" caption="Full inventory in components.md; values in tokens.json.">
        <Table columns={["Element", "Size (dp, proposed — pending measurement)", "Rationale"]} rows={[
          ["Minimum hit target", "48×48, 8 gap", `Android (${S(15)}); ≥ 1 cm (${S(21)})`],
          ["Edge/corner controls", "≥ 56", `Corners need ~12 mm (${S(24)})`],
          ["Capture", "112 tall full width; 192×236 rail", "Primary, eyes-off, centre reach"],
          ["Key lane", "32 (16–64), edit ≥ 24", `24px floor (${S(17)}); hit expanded to 48`],
          ["Note handle", "24 visible / 48 hit, outside short notes", "Short notes stay movable"],
          ["Loupe", "120×80, ×2.5, 96 above finger", `Finger occlusion (${S(23)})`],
          ["Touch white key", "≥ 44 wide, 160–200 tall", `HIG 44pt (${S(16)})`],
          ["Type", "14 / 16 / 20 / 24 / 32 sp", "16 body, 32 Capture label"]
        ]} />
        <Properties items={[
          { label: "Core components", value: "ReadinessChip/Card, TakeRibbon, BufferMeter, CaptureButton, LayerSlot/Row, TargetChip, Transport, UndoRedo, Sheet, ReviewTimeline, ChipGroup, Stepper, Snackbar, Banner" },
          { label: "Editor components", value: "PianoRollCanvas, NoteView, NoteHandle, Loupe, ToolChips, ActionBar, QuantisePanel, AmbiguityPicker, Rulers + Overview, VelocityLane" },
          { label: "Other", value: "OnScreenKeys, ControllerLearnRow/ListeningPanel, SaveStatus, RecoveryDialog, ExportSheet, HingeAwareLayout" }
        ]} />
      </Section>

      <Section heading="Staged handoff — P0 / P1" id="handoff" caption="Excerpt; the full list of testable criteria (AC-*) is in acceptance-criteria.md.">
        <Grid columns={2}>
          <div><Text><b>P0 — play, capture, hear, correct, fix, export MIDI (first slice = one part)</b></Text><BulletList items={["Readiness (web and native)", "Play/Capture with auto-loop", "Review: length, beat one, alternates, Original take, discard", "Basic sound browser (placeholder names); four-layer overview follows the one-part slice", "Piano-roll core: Edit/Draw, select/move/resize/delete/duplicate, Vel stepper, undo/redo, pinch/pan, loupe, picker", "Quantise with strength chips", "Autosave and recovery", "MIDI export", "Accessibility labels", "Capture mapping to any spare CC/button (no spare pedal needed)", "Visual north star: dark-first theme meeting AC-VIS-01…04"]} /></div>
          <div><Text><b>P1 — later gates; stems and full touch selection are required milestones</b></Text><BulletList items={["Aligned stems (required milestone)", "Controller mapping grows: Play/Stop, Undo/Redo, sounds, target/new layer", "Multi-part (≥ 4) overview", "Range tool, chord and pitch select, velocity-lane drag (full touch selection — required milestone)", "Swing and “Tap the beat”", "Tabletop posture", "Desktop three-region layout", "Full screen-reader custom actions", "Count-in option"]} /></div>
        </Grid>
        <Table columns={["ID", "Acceptance criterion (sample)"]} rows={[
          ["AC-RDY-02", "Input chip says “receiving” only after ≥ 1 MIDI message from that port; a silent port shows “connected · no notes yet”."],
          ["AC-RDY-03", "On-screen keys never appear in the Input list; header reads “On-screen keys (this device)”."],
          ["AC-CAP-02", "On an empty sketch, one Capture press creates Layer 1, shows bars/BPM/meter, and loops from loop start."],
          ["AC-CAP-03", "With layers playing, Capture takes only history already played (never future notes); the new layer is queued to the next loop boundary; tempo unchanged."],
          ["AC-REV-03", "First capture always shows inferred tempo plus ½ / ×2 / Set BPM; extra alternatives only when supplied; no confidence %."],
          ["AC-DEC-04", "A no-pulse phrase yields “No steady pulse found” with free-time loop and Set BPM; no invented tempo."],
          ["AC-DEC-06", "All slots full → explicit choice; never silent replace or merge."],
          ["AC-DEC-10", "Injected overload shows a gap with its time span; ordinary age eviction never shows an error."],
          ["AC-VIS-01", "Dark theme: text ≥ 4.5:1, state indicators ≥ 3:1, measured on device screenshots."],
          ["AC-REV-01", "Review is non-modal: loop and MIDI keep sounding."],
          ["AC-REV-02", "After any grid correction, exported Original-take MIDI is event-identical to before."],
          ["AC-PR-02", "In Draw, tapping an existing note selects it and never deletes it."],
          ["AC-PR-04", "A second finger mid-move reverts the move and creates no undo step."],
          ["AC-PR-07", "Every drag has a tap alternative (Len ±, Vel ±, nudge, loop steppers, zoom ±)."],
          ["AC-SAV-02", "Simulated write failure shows a persistent banner with Retry / Export now; edits continue."],
          ["AC-A11Y-02", "Grayscale screenshots still distinguish selection, mute, target, errors."],
          ["AC-LYT-01", "Fold/unfold/rotate during playback keeps audio, review and selection."]
        ]} />
      </Section>

      <Section heading="Independent QA & usability test" id="qa" caption="Full checklists in qa-review.md and usability-test-script.md. Neither has been run yet.">
        <Grid columns={2}>
          <div><Text><b>QA review points</b></Text><NumberedList items={["Grid vs timing integrity: diff Original-take exports before and after corrections", "Honest readiness: silent port, denied, Safari/Firefox Android, plain http", "Mode slips: tap 20 existing notes in Draw; none deleted", "Gesture conflicts: a pinch that starts on a note moves nothing", "Target audit at widths 320/360/412 and at 200% font", "Grayscale review of every state", "Full walkthrough with TalkBack and NVDA", "Fold and rotate during review, drag and export", "Failure injection: save, storage, kill, disconnect, interruption", "Copy audit: grid controls never mention speed"]} /></div>
          <div><Text><b>Usability script (45 min, 4–5 keyboard players + Haris)</b></Text><NumberedList items={["Get ready to play (first web visit)", "Noodle; keep something you like (is Capture found without naming it?)", "Fix where the bar starts", "Fix double-time without changing speed", "Hear exactly what you played", "Add a bass layer with another sound", "Fix one wrong note (first-try select rate)", "Shorten and soften 3 notes", "Tighten timing but keep the feel", "Undo editor changes", "(Optional) map a spare button or pad to Capture", "Export MIDI and audio parts", "Unfold and continue", "Moderator unplugs the keyboard mid-phrase"]} /></div>
        </Grid>
      </Section>

      <Section heading="Contract decisions — RESOLVED (lead decision)" id="amb" caption="All twelve open questions were resolved by Daw Bot (lead) on 8 Nov 2026. The original questions are kept below for traceability.">
        <Table columns={["ID", "Status", "Lead decision"]} rows={[
          ["A1", { text: "RESOLVED (lead decision)", tone: "success" }, "Proposed target of 120 s rolling history plus a hard event/byte cap; the integrator may tune it from the measured footprint. Ordinary age eviction and overload are different states. Never promise that Capture cannot fail or that every dense event is kept; flag gaps/drops in the UI. Synthetic releases are kept separate from raw events. Capture can continue while audio is suspended IF MIDI delivery continues. Hidden/background has no guaranteed delivery; the native policy is foreground-only at first. In-memory history is kept through interruptions. Recovery of uncaptured history after a restart is pending a separate implementation."],
          ["A2", { text: "RESOLVED (lead decision)", tone: "success" }, "The existing sketch tempo stays locked whether stopped or playing; only phase/selection correction. A deliberate playback-tempo change is separate."],
          ["A3", { text: "RESOLVED (lead decision)", tone: "success" }, "Preserve input-event time. No automatic heard-time compensation without a measured delay/model, and no unmeasured latency shift."],
          ["A4", { text: "RESOLVED (lead decision)", tone: "success" }, "Alternatives only when justified; no fabricated 3 candidates or confidence percentages. Always offer explicit half/double/manual controls, even with one or zero sensible candidates. “No pulse” is a valid result with its own designed state. 4/4 initial inference; manual meter change later unless the engine supports more."],
          ["A5", { text: "RESOLVED (lead decision)", tone: "success" }, "Shared sketch tempo/meter and a common loop at first. Per-layer loop lengths later, without silently retiming notes."],
          ["A6", { text: "RESOLVED (lead decision)", tone: "success" }, "Capture into an empty/new layer by default; no silent destructive replacement or merge. When all slots are full: an explicit choice, or a new layer when supported."],
          ["A7", { text: "RESOLVED (lead decision)", tone: "success" }, "Yes: source-tagged touch events in the same capture pipeline; never counterfeit device readiness."],
          ["A8", { text: "RESOLVED (lead decision)", tone: "success" }, "Preserve and export supported raw CC64, pitch bend and pressure/expression. Controller lanes are read-only at first. Don't promise unimplemented renderer support. Synthetic panic/note-offs are not part of the musical export unless there is an explicit boundary-render policy."],
          ["A9", { text: "RESOLVED (lead decision)", tone: "success" }, "Stems share a start and a common duration plus tail. The tail follows the actual preset's envelope/decay and the user's choice; 2 s is not a universal guarantee. The looped-performance default export length is visible and configurable. Rendering implementation and tests are pending."],
          ["A10", { text: "RESOLVED (lead decision)", tone: "success" }, "Session undo at first, plus durable takes/edits/version snapshots. Undo across relaunch later."],
          ["A11", { text: "RESOLVED (lead decision)", tone: "success" }, "At least four independent parts is a milestone, not a hard maximum. The first slice is one part; the four-layer overview comes after."],
          ["A12", { text: "RESOLVED (lead decision)", tone: "success" }, "Yes: stable event/note IDs across derived edits and re-inference."]
        ]} />
        <Text><b>Original questions (superseded):</b></Text>
        <Table columns={["ID", "Question", "UI impact", "Rev 1 proposal (superseded)"]} rows={[
          ["A1", "Buffer length; retention across audio suspension, background, hidden tab, restart", "Buffer meter, paused copy", "10 min; keep across suspension; drop on restart"],
          ["A2", "Stopped capture with an existing grid: phase only, or tempo too?", "Review controls", "Phase only"],
          ["A3", `Align to played time or heard time? (${S(4)})`, "Loop feel", "Heard time when monitoring through Blocks"],
          ["A4", "Does inference return ≥ 3 ranked alternates with confidence?", "“Count it as”, low-confidence state", "Required"],
          ["A5", "One grid per sketch? Per-layer loop lengths?", "Layers overview", "One grid; multiples allowed"],
          ["A6", "Capture target: empty layer only, or overdub/merge?", "Target semantics", "Empty target; merge P1"],
          ["A7", "On-screen key events in the same buffer with source label?", "Capture without MIDI", "Yes"],
          ["A8", "CC64 and other CCs in takes: kept, exported, editable?", "Lanes, export", "Keep + export CC64; display only"],
          ["A9", "Stem render path and tail length", "Export progress", "Loop ×4 + 2 s tail"],
          ["A10", "Undo history persisted across relaunch?", "Undo after recovery", "Session only; versions persist"],
          ["A11", "Layer count fixed at 4?", "Layout", "Fixed for P0"],
          ["A12", "Stable note IDs across re-inference and quantise?", "Selection persistence", "Required"]
        ]} />
        <Text>Timing appears only as state requirements. Input-event time is preserved (A3). Synthetic releases are stored separately. Every input event carries a stable ID (A12), a source tag (A7) and a monotonic timestamp in one timebase per platform (native nanoseconds; web performance clock mapped to audio time). The UI also needs: buffer start and end, last event time, audio state, MIDI access state, which ports are receiving, history gaps and delivery state, the inference result (pulse found or none; alternatives only when justified), the locked sketch tempo, and the queued layer join time. Engine internals are not specified.</Text>
      </Section>

      <Section heading="Changelog" id="changes">
        <Text><b>Rev 3.2.1 — 8 Nov 2026 (doc-only, no visual changes)</b></Text>
        <BulletList items={[
          "Repeating pickup is explicit PROPOSED behaviour, not an engine contract; “first pass only” is an unresolved audition/test question (spec OQ-1, QA item 18, usability task R4). No control added.",
          "Every numeric gesture value (32 dp edge zone, ≥ 6 s Undo toast, 72 dp magnifier offset, 40 dp slide-up, zoom limits, 15 px label cap) is provisional until device testing.",
          "Harmony labels and role tags are optional and research-gated, with no further visual work; arpeggio and bass tags are deliberately not drawn.",
          "Archive package made self-contained: README file index and rebuild steps, LIMITATIONS.md, checks/ with a re-runnable check script and dated log, fonts and wireframe generator copied in, and this Page's source exported to page/."
        ]} />
        <Text><b>Rev 3.2 — 8 Nov 2026 (Settings; take history and capture range; Haris via lead)</b></Text>
        <BulletList items={[
          "Settings → Appearance: System (default), Light, Dark; reached from the Blocks ⌄ menu; switching is instant and never interrupts audio, playback or MIDI; the choice persists (AC-SET-01–03).",
          "Take history becomes the main Play view: a real piano roll with the proposed capture range, 48 dp ⟦/⟧ handles, magnifier, auto-follow and Back to live; layer cards stay visible.",
          "Priority framing: one-action success first (09), then the short guess (10) and its correction (11, 12).",
          "Three operations kept apart: (a) boundary adjustment, where the start drag changes length with the end fixed; (c) Slide, which keeps length and shifts beat one; (b) destructive cuts and note edits only in Edit.",
          "States for free time vs grid, snap and override, pan/zoom/follow, pickups and held notes at loop edges, and Undo.",
          "Optional harmony labels and role tags as a PROPOSED capability (recognition under research, mock data).",
          "Docs: spec §0b, gestures §9, new state machines, AC-RNG-01–11, AC-HAR-01, AC-SET-01–03; prototype extended."
        ]} />
        <Text><b>Rev 3.1 — 8 Nov 2026 (hybrid precedence, Haris via lead)</b></Text>
        <BulletList items={[
          "Precedence: Graphite Studio's main UI is the structural base. Its IA, separate instrument/layer cards, controls and feature discoverability win any conflict.",
          "Paper Score adds character only: serif sketch titles and capture headlines (“Four bars, at ninety-two.”), italic chord names and sound names, and stave hairlines inside layer cards. It never replaces the structure with a score sheet and never hides instruments.",
          "One cohesive hybrid in dark (the default for playing) and light (daylight, review, export). The light palette passes WCAG AA (hifi/contrast.tsv, themes C and D).",
          "New assets in hifi/hybrid/. The prototype and this Page's storyboard now show the hybrid, with a Dark / Light switch."
        ]} />
        <Text><b>Rev 3 — 8 Nov 2026 (high-fidelity pass)</b></Text>
        <BulletList items={[
          "Two hi-fi directions: A Graphite Studio (dark instrument) and B Paper Score (light editorial). A is recommended; B is kept for a light theme and the export view.",
          "Seven-frame storyboard in A: free play, Capture with immediate loop, the honest no-pulse state, bass over the loop, the in-sync second Capture with phase OK and Undo, drums on screen pads, and optional quantise. Fold-expanded and desktop key frames.",
          "Interactive storyboard on this Page, plus a self-contained clickable prototype (hifi/prototype/index.html). Both are labelled simulation, not working MIDI/audio.",
          "New Capture glyph (reach back around a held note), so Capture never reads as record. Empty slots fold into one row, which keeps every real layer visible above the thumb zone.",
          "All earlier decisions kept: A1–A12, placeholder sound names, no fake MIDI readiness (device chips are example data), 48 dp targets, WCAG AA text, non-colour cues, and no automatic timing shift."
        ]} />
        <Text><b>Rev 2 — 8 Nov 2026</b></Text>
        <BulletList items={[
          "Visual north star “sexy, sleek” (owner direction from Haris): a dark-first premium instrument look with one accent (Signal), refined type, negative space, minimal chrome, subtle motion that respects reduced motion, and a hardware-like finish. Includes do/don't rules and contrast ratios. Six wireframes restyled; Fold-open M/S enlarged to 48dp. Sexy never overrides usability or accessibility.",
          "Adopted by the lead: immediate loop after Capture with a persistent silent option; non-blocking review plus undo; original take, grid, playback tempo and quantise kept separate; queued layer join at the next loop boundary.",
          "A1–A12 marked RESOLVED (lead decision) and applied throughout: history and overload states, locked tempo, preserved input time, honest alternatives and the no-pulse state, explicit choice when slots are full, source-tagged touch keys, raw controller-data export, release-aware stem tails, session undo, four parts as a milestone, stable IDs.",
          "Corrections: no spare pedal required (any CC/button); no default takeover of sustain or keys; controller actions staged, not dropped; stems and full touch selection are required milestones; capture while playing never takes future notes; placeholder sound name “Warm EP”; first-run touch count not fixed; no unchecked browser recommendation; every number is a proposal pending measurement.",
          "New wireframe 16 (capture edge states) and new acceptance criteria AC-DEC-01…11 and AC-VIS-01…04."
        ]} />
        <Text><b>Rev 1 — 8 Nov 2026</b> — initial PROPOSED package.</Text>
      </Section>

      <Section heading="Assets, checks & sources" id="assets">
        <Table columns={["Asset (shared box)", "Contents"]} rows={[
          ["/workspace/blocks-design/spec.md", "Full spec: §0 visual north star, screens, edge states, §8 resolved lead decisions A1–A12"],
          ["/workspace/blocks-design/CHANGELOG.md · README.md", "Revision history (rev 1, rev 2) and index"],
          ["/workspace/blocks-design/research.md · sources.md · link-check.tsv", "Findings → decisions, plus the source list with how each source was opened and its HTTP status"],
          ["/workspace/blocks-design/gestures.md", "Gesture ownership, gesture table, visual states, equivalents and sizes"],
          ["/workspace/blocks-design/acceptance-criteria.md", "P0/P1 testable criteria"],
          ["/workspace/blocks-design/state-machines.md", "Mermaid diagrams: readiness, capture, transport, pointer, save"],
          ["/workspace/blocks-design/components.md · tokens.json", "Component inventory; sizes, breakpoints, motion, type, and light/dark colours"],
          ["/workspace/blocks-design/qa-review.md · usability-test-script.md", "QA review points and test script"],
          ["/workspace/blocks-design/wireframes/00–16 *.svg", "17 wireframes: the 9 shown above plus tabletop, readiness errors, sound browser, layers, piano-roll states, controller learn, save/export and the nav map. Six are in the north-star dark style"]
        ]} />
        <Callout tone="info" lead="Checks (rev 3, 8 Nov 2026):">The hi-fi frames, boards and prototype were rendered at 2x in headless Chrome and inspected visually, then fixed over several rounds for overlap, clipping, wrapping and alignment. Contrast pairs for both palettes were computed with the WCAG formula and are in hifi/contrast.tsv. Body text passes AA, and the decorative dim steps were raised to pass as well. Rev 2: All 17 SVGs re-parse (Python ElementTree) and were re-rendered in headless Chrome after the rev 2 changes. A grep confirms the old electric-piano sound name appears nowhere, and the only browser mention left is a qualified, not-recommended note in research.md. Rev 1 note: all 16 SVGs parse as XML (Python ElementTree; xmllint wasn't available) and were rendered in headless Chrome for visual review. tokens.json parses. All 36 source URLs returned HTTP 200 on re-check, and each was read with WebFetch or curl.</Callout>
        <LinkCards links={SOURCES} />
      </Section>
    </Page>
  );
}
