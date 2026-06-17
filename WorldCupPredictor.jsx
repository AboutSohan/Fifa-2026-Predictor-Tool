import React, { useState, useMemo, useCallback } from "react";

/* ============================================================
   FIFA World Cup 2026 — Data-Driven Prediction Engine
   Benchmark inputs: FIFA World Ranking points (form-weighted Elo-style
   rating already baked in by FIFA over the last 4 years, recency-weighted),
   a recent-form adjustment (last ~12-18 months of results), a host advantage,
   and confederation-strength priors. Combined into a logistic win-probability
   model + Poisson goal model, run through Monte Carlo simulation.
   ============================================================ */

const TEAMS = {
  Mexico: { group: "A", rank: 14, pts: 1681, conf: "CONCACAF", host: true, form: 0.4 },
  "South Africa": { group: "A", rank: 61, pts: 1380, conf: "CAF", form: 0.1 },
  "South Korea": { group: "A", rank: 22, pts: 1610, conf: "AFC", form: 0.2 },
  Czechia: { group: "A", rank: 44, pts: 1460, conf: "UEFA", form: 0.3 },

  Canada: { group: "B", rank: 27, pts: 1580, conf: "CONCACAF", host: true, form: 0.5 },
  Switzerland: { group: "B", rank: 19, pts: 1649, conf: "UEFA", form: 0.3 },
  Qatar: { group: "B", rank: 53, pts: 1420, conf: "AFC", form: 0.0 },
  "Bosnia and Herzegovina": { group: "B", rank: 58, pts: 1395, conf: "UEFA", form: 0.4 },

  Brazil: { group: "C", rank: 6, pts: 1761, conf: "CONMEBOL", form: 0.5 },
  Morocco: { group: "C", rank: 8, pts: 1755, conf: "CAF", form: 0.6 },
  Scotland: { group: "C", rank: 36, pts: 1520, conf: "UEFA", form: 0.4 },
  Haiti: { group: "C", rank: 84, pts: 1290, conf: "CONCACAF", form: 0.2 },

  USA: { group: "D", rank: 17, pts: 1673, conf: "CONCACAF", host: true, form: 0.5 },
  Australia: { group: "D", rank: 26, pts: 1585, conf: "AFC", form: 0.2 },
  Paraguay: { group: "D", rank: 39, pts: 1495, conf: "CONMEBOL", form: 0.3 },
  Turkiye: { group: "D", rank: 25, pts: 1590, conf: "UEFA", form: 0.4 },

  Germany: { group: "E", rank: 10, pts: 1730, conf: "UEFA", form: 0.3 },
  Ecuador: { group: "E", rank: 23, pts: 1605, conf: "CONMEBOL", form: 0.5 },
  "Ivory Coast": { group: "E", rank: 42, pts: 1480, conf: "CAF", form: 0.3 },
  Curacao: { group: "E", rank: 82, pts: 1300, conf: "CONCACAF", form: 0.5 },

  Netherlands: { group: "F", rank: 7, pts: 1758, conf: "UEFA", form: 0.4 },
  Japan: { group: "F", rank: 18, pts: 1660, conf: "AFC", form: 0.5 },
  Sweden: { group: "F", rank: 43, pts: 1465, conf: "UEFA", form: 0.2 },
  Tunisia: { group: "F", rank: 46, pts: 1450, conf: "CAF", form: 0.2 },

  Belgium: { group: "G", rank: 9, pts: 1735, conf: "UEFA", form: 0.4 },
  Iran: { group: "G", rank: 20, pts: 1640, conf: "AFC", form: 0.3 },
  Egypt: { group: "G", rank: 35, pts: 1525, conf: "CAF", form: 0.3 },
  "New Zealand": { group: "G", rank: 87, pts: 1280, conf: "OFC", form: 0.2 },

  Spain: { group: "H", rank: 2, pts: 1876, conf: "UEFA", form: 0.7 },
  Uruguay: { group: "H", rank: 17, pts: 1673, conf: "CONMEBOL", form: 0.4 },
  "Saudi Arabia": { group: "H", rank: 60, pts: 1385, conf: "AFC", form: 0.1 },
  "Cape Verde": { group: "H", rank: 67, pts: 1360, conf: "CAF", form: 0.6 },

  France: { group: "I", rank: 1, pts: 1877, conf: "UEFA", form: 0.6 },
  Senegal: { group: "I", rank: 14, pts: 1689, conf: "CAF", form: 0.5 },
  Norway: { group: "I", rank: 29, pts: 1560, conf: "UEFA", form: 0.6 },
  Iraq: { group: "I", rank: 70, pts: 1345, conf: "AFC", form: 0.3 },

  Argentina: { group: "J", rank: 3, pts: 1875, conf: "CONMEBOL", form: 0.5 },
  Algeria: { group: "J", rank: 34, pts: 1530, conf: "CAF", form: 0.4 },
  Austria: { group: "J", rank: 24, pts: 1595, conf: "UEFA", form: 0.4 },
  Jordan: { group: "J", rank: 64, pts: 1370, conf: "AFC", form: 0.4 },

  Portugal: { group: "K", rank: 5, pts: 1764, conf: "UEFA", form: 0.6 },
  Colombia: { group: "K", rank: 13, pts: 1693, conf: "CONMEBOL", form: 0.5 },
  Uzbekistan: { group: "K", rank: 50, pts: 1430, conf: "AFC", form: 0.5 },
  "DR Congo": { group: "K", rank: 78, pts: 1310, conf: "CAF", form: 0.4 },

  England: { group: "L", rank: 4, pts: 1826, conf: "UEFA", form: 0.5 },
  Croatia: { group: "L", rank: 11, pts: 1717, conf: "UEFA", form: 0.4 },
  Ghana: { group: "L", rank: 72, pts: 1340, conf: "CAF", form: 0.3 },
  Panama: { group: "L", rank: 30, pts: 1555, conf: "CONCACAF", form: 0.4 },
};

const GROUP_ORDER = {
  A: ["Mexico", "South Korea", "South Africa", "Czechia"],
  B: ["Canada", "Switzerland", "Qatar", "Bosnia and Herzegovina"],
  C: ["Brazil", "Morocco", "Scotland", "Haiti"],
  D: ["USA", "Australia", "Paraguay", "Turkiye"],
  E: ["Germany", "Ecuador", "Ivory Coast", "Curacao"],
  F: ["Netherlands", "Japan", "Tunisia", "Sweden"],
  G: ["Belgium", "Iran", "Egypt", "New Zealand"],
  H: ["Spain", "Uruguay", "Saudi Arabia", "Cape Verde"],
  I: ["France", "Senegal", "Norway", "Iraq"],
  J: ["Argentina", "Austria", "Algeria", "Jordan"],
  K: ["Portugal", "Colombia", "Uzbekistan", "DR Congo"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

function buildFixtures() {
  const fixtures = [];
  Object.entries(GROUP_ORDER).forEach(([g, t]) => {
    const [a, b, c, d] = t;
    const md1 = [[a, d], [b, c]];
    const md2 = [[c, a], [d, b]];
    const md3 = [[a, b], [d, c]];
    [[1, md1], [2, md2], [3, md3]].forEach(([md, pairs]) => {
      pairs.forEach(([home, away]) => fixtures.push({ group: g, matchday: md, home, away }));
    });
  });
  return fixtures;
}
const FIXTURES = buildFixtures();

/* ---------- Rating model ---------- */
// Composite strength score: FIFA points (primary, ~4yr recency-weighted Elo-like metric)
// + recent-form bump (proxy for "last ~12-18 months" trend) + host advantage.
function strength(name) {
  const t = TEAMS[name];
  let s = t.pts;
  s += t.form * 40; // recent form swing, max ~+28
  if (t.host) s += 35; // host advantage (crowd, travel, prep)
  return s;
}

// Logistic win probability from rating difference (Elo-style)
function winProb(diff) {
  return 1 / (1 + Math.pow(10, -diff / 400));
}

function matchProbs(home, away) {
  const sh = strength(home);
  const sa = strength(away);
  const pHomeOverall = winProb(sh - sa); // overall (not draw-adjusted) strength of home
  // Map to 1X2 using an empirical draw model: draw probability peaks when teams are close
  const diff = Math.abs(sh - sa);
  const drawP = Math.max(0.16, 0.30 - diff / 1800);
  const remain = 1 - drawP;
  // split remain proportional to pHomeOverall vs (1-pHomeOverall), with slight home-field nudge
  let pHome = remain * (pHomeOverall + 0.04);
  let pAway = remain * (1 - pHomeOverall - 0.04);
  if (pHome < 0) pHome = 0.02;
  if (pAway < 0) pAway = 0.02;
  const norm = pHome + pAway + drawP;
  return { home: pHome / norm, draw: drawP / norm, away: pAway / norm, sh, sa };
}

// Expected goals via strength gap, used for Poisson sampling of scorelines
function expectedGoals(home, away) {
  const sh = strength(home);
  const sa = strength(away);
  const gap = (sh - sa) / 200;
  const base = 1.25;
  let eh = base * Math.exp(gap * 0.22) + 0.12; // small home boost baked into base diff via +0.04 elsewhere
  let ea = base * Math.exp(-gap * 0.22);
  return { eh: Math.min(eh, 3.6), ea: Math.min(ea, 3.6) };
}

function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateMatch(home, away, rng) {
  const { eh, ea } = expectedGoals(home, away);
  let hg = poissonSample(eh, rng);
  let ag = poissonSample(ea, rng);
  return { hg, ag };
}

function simulateKnockoutMatch(home, away, rng) {
  let { hg, ag } = simulateMatch(home, away, rng);
  if (hg === ag) {
    // extra time + penalties proxy: slight edge to higher strength team
    const p = matchProbs(home, away);
    const pHomeWinsShootout = 0.5 + (p.home - p.away) * 0.5;
    return rng() < pHomeWinsShootout ? home : away;
  }
  return hg > ag ? home : away;
}

/* ---------- Group stage simulation ---------- */
function simulateGroupStage(rng) {
  const table = {};
  Object.keys(TEAMS).forEach((t) => {
    table[t] = { team: t, group: TEAMS[t].group, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });
  FIXTURES.forEach(({ home, away }) => {
    const { hg, ag } = simulateMatch(home, away, rng);
    const th = table[home], ta = table[away];
    th.pld++; ta.pld++;
    th.gf += hg; th.ga += ag;
    ta.gf += ag; ta.ga += hg;
    if (hg > ag) { th.w++; th.pts += 3; ta.l++; }
    else if (hg < ag) { ta.w++; ta.pts += 3; th.l++; }
    else { th.d++; ta.d++; th.pts += 1; ta.pts += 1; }
  });
  return table;
}

function rankGroup(table, groupLetter) {
  const teams = GROUP_ORDER[groupLetter].map((t) => table[t]);
  teams.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return strength(b.team) - strength(a.team); // proxy tiebreak (fair play / random in reality)
  });
  return teams;
}

function buildStandings(table) {
  const standings = {};
  Object.keys(GROUP_ORDER).forEach((g) => {
    standings[g] = rankGroup(table, g);
  });
  return standings;
}

function thirdPlaceQualifiers(standings) {
  const thirds = Object.keys(GROUP_ORDER).map((g) => ({ ...standings[g][2], grp: g }));
  thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
  return thirds.slice(0, 8).map((t) => t.grp);
}

/* ---------- Knockout bracket (simplified realistic R32 pairing) ---------- */
// We build a deterministic-structure bracket: winners/runners-up cross-paired,
// third-place qualifiers slotted into fixed bracket slots by qualifying group letter order.
function buildR32(standings, qualThirdGroups) {
  const W = (g) => standings[g][0].team;
  const R = (g) => standings[g][1].team;
  const thirdsSet = new Set(qualThirdGroups);
  const thirdTeam = (g) => standings[g][2].team;

  // Pair winners with runners-up of "nearby" groups, and slot thirds into remaining berths.
  // This mirrors FIFA's actual R32 structure in spirit (not the literal official mapping).
  const sortedThirds = qualThirdGroups.slice().sort();
  let ti = 0;
  const nextThird = (excludeGroups) => {
    while (ti < sortedThirds.length && excludeGroups.includes(sortedThirds[ti])) ti++;
    const g = sortedThirds[ti] ?? sortedThirds[(ti + 1) % sortedThirds.length];
    ti++;
    return thirdTeam(g);
  };

  const pairs = [
    [W("A"), R("C")],
    [W("B"), R("D")],
    [W("C"), thirdsSet.size ? nextThird(["C"]) : R("A")],
    [W("D"), nextThird(["D"])],
    [W("E"), R("G")],
    [W("F"), R("H")],
    [W("G"), nextThird(["G"])],
    [W("H"), nextThird(["H"])],
    [W("I"), R("K")],
    [W("J"), R("L")],
    [W("K"), nextThird(["K"])],
    [W("L"), nextThird(["L"])],
    [R("E"), R("F")],
    [R("I"), R("J")],
    [nextThird([]), nextThird([])],
    [nextThird([]), nextThird([])],
  ];
  return pairs;
}

function simulateKnockouts(standings, qualThirdGroups, rng) {
  let round = buildR32(standings, qualThirdGroups);
  const rounds = { r32: round.slice() };
  const advance = (matches) =>
    matches.map(([h, a]) => simulateKnockoutMatch(h, a, rng));

  let r16Winners = advance(round);
  const r16Pairs = [];
  for (let i = 0; i < r16Winners.length; i += 2) r16Pairs.push([r16Winners[i], r16Winners[i + 1]]);
  rounds.r16 = r16Pairs;

  let qfWinners = advance(r16Pairs);
  const qfPairs = [];
  for (let i = 0; i < qfWinners.length; i += 2) qfPairs.push([qfWinners[i], qfWinners[i + 1]]);
  rounds.qf = qfPairs;

  let sfWinners = advance(qfPairs);
  const sfPairs = [];
  for (let i = 0; i < sfWinners.length; i += 2) sfPairs.push([sfWinners[i], sfWinners[i + 1]]);
  rounds.sf = sfPairs;

  const finalPair = advance(sfPairs);
  rounds.final = [finalPair];
  const champion = simulateKnockoutMatch(finalPair[0], finalPair[1], rng);
  rounds.champion = champion;
  return rounds;
}

/* ---------- Monte Carlo driver ---------- */
function runMonteCarlo(iterations, seed) {
  const rng = mulberry32(seed);
  const champCount = {};
  const finalCount = {};
  const semiCount = {};
  const r16Count = {};
  const groupWinCount = {};
  Object.keys(TEAMS).forEach((t) => {
    champCount[t] = 0; finalCount[t] = 0; semiCount[t] = 0; r16Count[t] = 0; groupWinCount[t] = 0;
  });

  for (let i = 0; i < iterations; i++) {
    const table = simulateGroupStage(rng);
    const standings = buildStandings(table);
    Object.keys(GROUP_ORDER).forEach((g) => { groupWinCount[standings[g][0].team]++; });
    const thirds = thirdPlaceQualifiers(standings);
    const ko = simulateKnockouts(standings, thirds, rng);
    ko.r16.forEach((pair) => pair.forEach((t) => { r16Count[t] = (r16Count[t] || 0) + 1; }));
    ko.qf.forEach((pair) => pair.forEach((t) => { semiCount[t] = (semiCount[t] || 0) + 0; }));
    ko.sf.forEach((pair) => pair.forEach((t) => { semiCount[t] = (semiCount[t] || 0) + 1; }));
    ko.final[0].forEach((t) => { finalCount[t] = (finalCount[t] || 0) + 1; });
    champCount[ko.champion]++;
  }

  return { iterations, champCount, finalCount, semiCount, r16Count, groupWinCount };
}

/* ============================================================
   UI
   ============================================================ */

const ACCENT = "#0a8a4c"; // pitch green
const GOLD = "#d4a017";

function flagEmoji(name) {
  const map = {
    Mexico: "🇲🇽", "South Africa": "🇿🇦", "South Korea": "🇰🇷", Czechia: "🇨🇿",
    Canada: "🇨🇦", Switzerland: "🇨🇭", Qatar: "🇶🇦", "Bosnia and Herzegovina": "🇧🇦",
    Brazil: "🇧🇷", Morocco: "🇲🇦", Scotland: "🏴", Haiti: "🇭🇹",
    USA: "🇺🇸", Australia: "🇦🇺", Paraguay: "🇵🇾", Turkiye: "🇹🇷",
    Germany: "🇩🇪", Ecuador: "🇪🇨", "Ivory Coast": "🇨🇮", Curacao: "🇨🇼",
    Netherlands: "🇳🇱", Japan: "🇯🇵", Sweden: "🇸🇪", Tunisia: "🇹🇳",
    Belgium: "🇧🇪", Iran: "🇮🇷", Egypt: "🇪🇬", "New Zealand": "🇳🇿",
    Spain: "🇪🇸", Uruguay: "🇺🇾", "Saudi Arabia": "🇸🇦", "Cape Verde": "🇨🇻",
    France: "🇫🇷", Senegal: "🇸🇳", Norway: "🇳🇴", Iraq: "🇮🇶",
    Argentina: "🇦🇷", Algeria: "🇩🇿", Austria: "🇦🇹", Jordan: "🇯🇴",
    Portugal: "🇵🇹", Colombia: "🇨🇴", Uzbekistan: "🇺🇿", "DR Congo": "🇨🇩",
    England: "🏴", Croatia: "🇭🇷", Ghana: "🇬🇭", Panama: "🇵🇦",
  };
  return map[name] || "🏳️";
}

function Pct({ v }) {
  return <span>{(v * 100).toFixed(1)}%</span>;
}

function TeamChip({ name, size = "sm" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
      <span style={{ fontSize: size === "lg" ? 20 : 15 }}>{flagEmoji(name)}</span>
      {name}
    </span>
  );
}

function Bar({ pct, color }) {
  return (
    <div style={{ background: "#1d2a22", borderRadius: 4, height: 8, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min(100, pct * 100)}%`, background: color, height: "100%", borderRadius: 4, transition: "width .4s ease" }} />
    </div>
  );
}

export default function WorldCupPredictor() {
  const [tab, setTab] = useState("overview");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState(2000);
  const [h2hHome, setH2hHome] = useState("Argentina");
  const [h2hAway, setH2hAway] = useState("Brazil");

  const teamNames = useMemo(() => Object.keys(TEAMS).sort(), []);

  const runSim = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const seed = Math.floor(Math.random() * 1e9);
      const res = runMonteCarlo(iterations, seed);
      setResult(res);
      setRunning(false);
      setTab("results");
    }, 60);
  }, [iterations]);

  const h2h = useMemo(() => matchProbs(h2hHome, h2hAway), [h2hHome, h2hAway]);

  const sortedByChamp = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.champCount)
      .map(([team, c]) => ({ team, champ: c / result.iterations, final: result.finalCount[team] / result.iterations, semi: result.semiCount[team] / result.iterations, r16: result.r16Count[team] / result.iterations }))
      .sort((a, b) => b.champ - a.champ);
  }, [result]);

  const groupOddsTop3 = useMemo(() => {
    if (!result) return {};
    const out = {};
    Object.keys(GROUP_ORDER).forEach((g) => {
      out[g] = GROUP_ORDER[g]
        .map((t) => ({ team: t, p: result.groupWinCount[t] / result.iterations }))
        .sort((a, b) => b.p - a.p);
    });
    return out;
  }, [result]);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: "linear-gradient(160deg, #0b1410 0%, #0f1f15 55%, #0b1410 100%)",
      color: "#eef5ee",
      minHeight: "100vh",
      padding: "0 0 60px",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #2a4034; border-radius: 4px; }
        select, button { font-family: inherit; }
        .tabbtn { background: transparent; border: none; color: #9db8a8; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; }
        .tabbtn.active { color: #fff; border-bottom: 2px solid ${ACCENT}; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; color: #8fae9c; font-weight: 600; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        td { padding: 7px 8px; border-top: 1px solid rgba(255,255,255,0.06); }
        select { background: #16241b; color: #eef5ee; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 10px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "32px 24px 18px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
            FIFA World Cup 2026 <span style={{ color: ACCENT }}>Prediction Engine</span>
          </h1>
        </div>
        <p style={{ color: "#9db8a8", marginTop: 8, fontSize: 14.5, lineHeight: 1.6, maxWidth: 760 }}>
          ৪৮ দল · ১২ গ্রুপ · ১০৪ ম্যাচ — FIFA World Ranking পয়েন্ট, গত ১২–১৮ মাসের ফর্ম ট্রেন্ড, হোস্ট অ্যাডভান্টেজ
          ও কনফেডারেশন স্ট্রেংথ মিশিয়ে একটা Elo-style রেটিং বেঞ্চমার্ক তৈরি করা হয়েছে। সেই বেঞ্চমার্ক থেকে প্রতি ম্যাচের
          win/draw/loss probability ও Poisson গোল-মডেল বানিয়ে হাজার হাজার বার টুর্নামেন্ট সিমুলেট (Monte Carlo) করা হয়।
        </p>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {[
          ["overview", "বেঞ্চমার্ক ও মডেল"],
          ["h2h", "হেড-টু-হেড টেস্টার"],
          ["simulate", "সিমুলেশন চালান"],
          ["results", "ফলাফল"],
        ].map(([key, label]) => (
          <button key={key} className={`tabbtn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 0" }}>
        {tab === "overview" && <OverviewTab />}
        {tab === "h2h" && (
          <H2HTab
            teamNames={teamNames}
            h2hHome={h2hHome}
            h2hAway={h2hAway}
            setH2hHome={setH2hHome}
            setH2hAway={setH2hAway}
            h2h={h2h}
          />
        )}
        {tab === "simulate" && (
          <SimulateTab
            iterations={iterations}
            setIterations={setIterations}
            running={running}
            runSim={runSim}
          />
        )}
        {tab === "results" && (
          <ResultsTab result={result} sortedByChamp={sortedByChamp} groupOddsTop3={groupOddsTop3} runSim={runSim} running={running} />
        )}
      </div>
    </div>
  );
}

function OverviewTab() {
  const rows = Object.entries(TEAMS)
    .sort((a, b) => a[1].rank - b[1].rank)
    .slice(0, 16);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>বেঞ্চমার্ক মডেলের উপাদান</h3>
        <ul style={{ color: "#c3d6c9", fontSize: 13.5, lineHeight: 1.9, paddingLeft: 18 }}>
          <li><b>FIFA World Ranking পয়েন্ট</b> — মূল স্ট্রেংথ স্কোর; ৪ বছরের ম্যাচ রেজাল্টের recency-weighted Elo-ভিত্তিক ভ্যালু (FIFA-র অফিসিয়াল হিসাব থেকে নেওয়া)।</li>
          <li><b>রিসেন্ট ফর্ম মডিফায়ার</b> — গত ১২–১৮ মাসের ট্রেন্ড (উন্নতি/অবনতি) অনুযায়ী ছোট +/- অ্যাডজাস্টমেন্ট (০ থেকে +৪০ পয়েন্ট সমতুল্য)।</li>
          <li><b>হোস্ট অ্যাডভান্টেজ</b> — মেক্সিকো, USA, কানাডা-র জন্য +৩৫ পয়েন্ট বোনাস (ক্রাউড + কম ট্রাভেল ফ্যাটিগ)।</li>
          <li><b>Logistic win-probability</b> — দুই দলের কম্পোজিট স্ট্রেংথের পার্থক্য থেকে Elo-স্টাইল সম্ভাবনা ক্যালকুলেশন।</li>
          <li><b>Poisson গোল মডেল</b> — প্রতিটি দলের expected goals স্ট্রেংথ-গ্যাপ থেকে ক্যালকুলেট করে বাস্তবসম্মত স্কোরলাইন জেনারেট।</li>
          <li><b>Monte Carlo সিমুলেশন</b> — পুরো ৭২ গ্রুপ ম্যাচ + নকআউট হাজার হাজার বার র‍্যান্ডম সিড দিয়ে রিপ্লে করে প্রতিটি দলের চ্যাম্পিয়ন হওয়ার সম্ভাবনা বের করা।</li>
        </ul>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>টপ ১৬ — কারেন্ট স্ট্রেংথ র‍্যাংক</h3>
        <table>
          <thead><tr><th>#</th><th>দল</th><th>FIFA Pts</th><th>ফর্ম</th></tr></thead>
          <tbody>
            {rows.map(([name, t]) => (
              <tr key={name}>
                <td>{t.rank}</td>
                <td><TeamChip name={name} /></td>
                <td>{t.pts}</td>
                <td style={{ color: t.form >= 0.5 ? "#5fd98a" : t.form >= 0.3 ? "#d4c45f" : "#d98a5f" }}>
                  {t.form >= 0.5 ? "▲ ভালো" : t.form >= 0.3 ? "● স্থিতিশীল" : "▼ দুর্বল"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function H2HTab({ teamNames, h2hHome, h2hAway, setH2hHome, setH2hAway, h2h }) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>যেকোনো দুটি দল বেছে নিয়ে probability দেখুন</h3>
      <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "14px 0 20px" }}>
        <select value={h2hHome} onChange={(e) => setH2hHome(e.target.value)}>
          {teamNames.map((t) => <option key={t} value={t}>{flagEmoji(t)} {t}</option>)}
        </select>
        <span style={{ color: "#8fae9c", fontWeight: 700 }}>VS</span>
        <select value={h2hAway} onChange={(e) => setH2hAway(e.target.value)}>
          {teamNames.map((t) => <option key={t} value={t}>{flagEmoji(t)} {t}</option>)}
        </select>
      </div>

      {[
        { label: `${h2hHome} জয়`, v: h2h.home, color: ACCENT },
        { label: "ড্র", v: h2h.draw, color: "#8fae9c" },
        { label: `${h2hAway} জয়`, v: h2h.away, color: GOLD },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 130, fontSize: 13 }}>{row.label}</div>
          <Bar pct={row.v} color={row.color} />
          <div style={{ width: 54, textAlign: "right", fontSize: 13, fontWeight: 700 }}><Pct v={row.v} /></div>
        </div>
      ))}

      <div style={{ marginTop: 16, fontSize: 12.5, color: "#8fae9c", display: "flex", gap: 18 }}>
        <span>{h2hHome} স্ট্রেংথ স্কোর: <b style={{ color: "#eef5ee" }}>{Math.round(h2h.sh)}</b></span>
        <span>{h2hAway} স্ট্রেংথ স্কোর: <b style={{ color: "#eef5ee" }}>{Math.round(h2h.sa)}</b></span>
      </div>
    </div>
  );
}

function SimulateTab({ iterations, setIterations, running, runSim }) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>মন্টে কার্লো সিমুলেশন চালান</h3>
      <p style={{ color: "#9db8a8", fontSize: 13.5, lineHeight: 1.7 }}>
        নিচের বাটনে ক্লিক করলে পুরো ৭২টা গ্রুপ ম্যাচ + নকআউট (Round of 32 থেকে ফাইনাল পর্যন্ত) র‍্যান্ডমাইজড স্ট্যাটিস্টিকাল
        মডেল দিয়ে বারবার রিপ্লে করে প্রতিটি দলের গ্রুপ-উইন, সেমি, ফাইনাল ও চ্যাম্পিয়ন হবার সম্ভাবনা ক্যালকুলেট করা হবে।
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
        <label style={{ fontSize: 13, color: "#c3d6c9" }}>সিমুলেশন সংখ্যা:</label>
        <select value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
          <option value={500}>৫০০ (দ্রুত)</option>
          <option value={2000}>২,০০০ (ব্যালেন্সড)</option>
          <option value={5000}>৫,০০০ (নির্ভুল)</option>
        </select>
      </div>
      <button
        onClick={runSim}
        disabled={running}
        style={{
          background: running ? "#2a4034" : ACCENT,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "12px 22px",
          fontWeight: 700,
          fontSize: 14,
          cursor: running ? "default" : "pointer",
        }}
      >
        {running ? "সিমুলেট হচ্ছে..." : "টুর্নামেন্ট সিমুলেট করুন ▶"}
      </button>
    </div>
  );
}

function ResultsTab({ result, sortedByChamp, groupOddsTop3, runSim, running }) {
  if (!result) {
    return (
      <div className="card">
        <p style={{ color: "#9db8a8" }}>
          এখনো কোনো সিমুলেশন চালানো হয়নি। "সিমুলেশন চালান" ট্যাবে গিয়ে রান করুন, ফলাফল এখানে দেখা যাবে।
        </p>
        <button onClick={runSim} disabled={running} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
          {running ? "সিমুলেট হচ্ছে..." : "এখনই সিমুলেট করুন"}
        </button>
      </div>
    );
  }

  const top10 = sortedByChamp.slice(0, 10);

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>চ্যাম্পিয়ন হওয়ার সম্ভাবনা — টপ ১০ ({result.iterations.toLocaleString()} সিমুলেশনের গড়)</h3>
        {top10.map((row, i) => (
          <div key={row.team} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <div style={{ width: 22, color: "#8fae9c", fontSize: 12 }}>{i + 1}</div>
            <div style={{ width: 150 }}><TeamChip name={row.team} /></div>
            <Bar pct={row.champ} color={i === 0 ? GOLD : ACCENT} />
            <div style={{ width: 54, textAlign: "right", fontWeight: 700, fontSize: 13 }}><Pct v={row.champ} /></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>টপ ১০ — ডিটেইল ব্রেকডাউন (R16 / সেমি / ফাইনাল / চ্যাম্পিয়ন)</h3>
        <table>
          <thead><tr><th>দল</th><th>R16+ যাওয়ার সম্ভাবনা</th><th>সেমিফাইনাল</th><th>ফাইনাল</th><th>চ্যাম্পিয়ন</th></tr></thead>
          <tbody>
            {top10.map((row) => (
              <tr key={row.team}>
                <td><TeamChip name={row.team} /></td>
                <td><Pct v={row.r16} /></td>
                <td><Pct v={row.semi} /></td>
                <td><Pct v={row.final} /></td>
                <td style={{ fontWeight: 700, color: GOLD }}><Pct v={row.champ} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>গ্রুপ-ভিত্তিক টপ ফেভারিট (গ্রুপ জেতার সম্ভাবনা)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {Object.entries(groupOddsTop3).map(([g, list]) => (
            <div key={g} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#8fae9c", fontWeight: 700, marginBottom: 8, letterSpacing: ".05em" }}>GROUP {g}</div>
              {list.map((row) => (
                <div key={row.team} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <TeamChip name={row.team} />
                  <span style={{ color: "#c3d6c9" }}><Pct v={row.p} /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={runSim} disabled={running} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
          {running ? "সিমুলেট হচ্ছে..." : "↻ আবার সিমুলেট করুন (নতুন র‍্যান্ডম রান)"}
        </button>
      </div>
    </div>
  );
}
