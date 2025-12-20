"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Circle, Dot, ChevronDown } from "lucide-react";

type Status = "done" | "in-progress" | "planned";

type RoadmapItem = {
  id: string;
  label: string;
  status: Status;
};

type Phase = {
  id: string;
  title: string;
  subtitle: string;
  theme: "pink" | "indigo" | "fuchsia" | "green";
  items: RoadmapItem[];
};

function ThemeDot({ theme }: { theme: Phase["theme"] }) {
  const cls =
    theme === "pink"
      ? "from-pink-600 to-fuchsia-600"
      : theme === "indigo"
      ? "from-indigo-600 to-purple-600"
      : theme === "fuchsia"
      ? "from-fuchsia-600 to-pink-600"
      : "from-emerald-600 to-teal-600";

  return (
    <div
      className={`h-10 w-10 rounded-2xl bg-gradient-to-r ${cls} shadow flex items-center justify-center`}
      aria-hidden="true"
    >
      <div className="h-3 w-3 rounded-full bg-white/90" />
    </div>
  );
}

function PhaseBadge({
  theme,
  text,
}: {
  theme: Phase["theme"];
  text: string;
}) {
  const cls =
    theme === "pink"
      ? "bg-pink-50 text-pink-700 border-pink-200"
      : theme === "indigo"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : theme === "fuchsia"
      ? "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold ${cls}`}
    >
      {text}
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const cls =
    status === "done"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "in-progress"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-50 text-slate-600 border-slate-200";

  const label =
    status === "done" ? "Completed" : status === "in-progress" ? "In progress" : "Planned";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <CheckCircle2 className="text-emerald-600" />;
  if (status === "in-progress") return <Dot className="text-amber-500 scale-[2]" />;
  return <Circle className="text-slate-400" />;
}

export default function RoadmapPage() {
  // ✅ Public-facing progress:
  // Update roadmap status here only (done / in-progress / planned)
  const phases: Phase[] = useMemo(
    () => [
      {
        id: "phase-1",
        title: "Phase 1 — Initial Rollout & Testing",
        subtitle:
          "Foundation work: site, whitepaper, test deployments, and core workflows.",
        theme: "pink",
        items: [
          { id: "p1-website", label: "Website UI/UX baseline complete", status: "done" },
          { id: "p1-whitepaper", label: "Whitepaper v1.0 published (web + downloadable PDF)", status: "done" },
          { id: "p1-roadmap-graphic", label: "Roadmap live (timeline + phases)", status: "done" },
          { id: "p1-amoy-contract", label: "Amoy test NFT contract deployed & verified", status: "done" },
          { id: "p1-mint-flow", label: "Mint flow working end-to-end from the website", status: "done" },
          { id: "p1-metadata", label: "Metadata hosting + tokenURI reliably resolving", status: "done" },
          { id: "p1-founder-art", label: "Founders Series card art created for Bingo! cards", status: "in-progress" },
          { id: "p1-amoy-token", label: "Test token configured + faucet/test flow validated + token contract deployed", status: "planned" },
          { id: "p1-basic-game-spec", label: "Gameplay spec locked (rules + patterns + resolution)", status: "planned" },
        ],
      },
      {
        id: "phase-2",
        title: "Phase 2 — Founder System & Ecosystem Design",
        subtitle:
          "Founder edition mechanics, staking/revenue concepts, and full game economy design.",
        theme: "indigo",
        items: [
          { id: "p2-founder-cards", label: "Founder card bonuses finalized", status: "done" },
          { id: "p2-founder-mint", label: "Founder mint page + supply controls", status: "in-progress" },
          { id: "p2-staking-model", label: "Card staking/delegating bonuses model defined", status: "done" },
          { id: "p2-economy-model", label: "Ecosystem economic model documented (fees, prizes, sustainability)", status: "done" },
          { id: "p2-creator-partners", label: "Creator partnership pipeline defined (artwork → cards → rewards loop)", status: "done" },
          { id: "p2-compliance-pass", label: "Risk & compliance considerations documented (jurisdiction approach)", status: "in-progress" },
          { id: "p2-founders-launch", label: "Founders Edition card mint live", status: "planned" },
          { id: "p2-testnet-alpha-games", label: "Game ecosystem live on Polygon amoy testnet - Alpha Testers Whitelist", status: "planned" },
          { id: "p2-testnet-beta-games", label: "Game ecosystem live on Polygon amoy testnet - Beta Testers Whitelist", status: "planned" },
        ],
      },
      {
        id: "phase-3",
        title: "Phase 3 — Polygon Launch: Token + Games Go Live",
        subtitle:
          "Mainnet deployment, token launch, live games, and production reliability.",
        theme: "fuchsia",
        items: [
          { id: "p3-mainnet-contracts", label: "Deploy production contracts on Polygon (mainnet)", status: "planned" },
          { id: "p3-token-launch", label: "Token launch + liquidity plan executed", status: "planned" },
          { id: "p3-game-live", label: "Game system live (rolling games, payouts, verification)", status: "planned" },
          { id: "p3-wallet-polish", label: "Wallet UX polished (errors, network handling, clarity)", status: "planned" },
          { id: "p3-prizes", label: "Prize system live (token prizes + NFT prize capability)", status: "planned" },
          { id: "p3-monitoring", label: "Monitoring + incident plan (alerts, logging, rollback strategy)", status: "planned" },
        ],
      },
      {
        id: "phase-4",
        title: "Phase 4 — Expansion & Real-World Integration",
        subtitle:
          "Physical hall integration, partnerships, mobile/kiosk options, and scaling.",
        theme: "green",
        items: [
          { id: "p4-mobile", label: "Mobile-friendly play experience (or dedicated app plan)", status: "planned" },
          { id: "p4-hall-pilot", label: "Pilot physical bingo hall / community event integration", status: "planned" },
          { id: "p4-kiosk-mode", label: "Kiosk / tablet mode interface for venues", status: "planned" },
          { id: "p4-licensing", label: "White-label / licensing strategy for halls & charities", status: "planned" },
          { id: "p4-crosshall", label: "Cross-hall jackpots / sponsored events", status: "planned" },
          { id: "p4-growth", label: "Growth engine: creator series cadence + community events", status: "planned" },
        ],
      },
    ],
    []
  );

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({
    "phase-1": true,
    "phase-2": true,
    "phase-3": true,
    "phase-4": true,
  });

  const togglePhaseOpen = (phaseId: string) => {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const allItems = phases.flatMap((p) => p.items);
  const totalCount = allItems.length;
  const doneCount = allItems.filter((i) => i.status === "done").length;
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 px-6 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900">
            NFTBingo Roadmap
          </h1>
          <p className="mt-4 text-slate-600 max-w-3xl mx-auto">
            A phase-based timeline. Status is updated by the team as milestones are reached.
          </p>

          {/* Legend */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
              <CheckCircle2 className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">Completed</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
              <Dot className="text-amber-500 scale-[2]" />
              <span className="text-sm font-semibold text-slate-700">In progress</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
              <Circle className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Planned</span>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="mt-8 max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>Overall Progress</span>
              <span>
                {doneCount}/{totalCount} • {progressPct}%
              </span>
            </div>
            <div className="mt-3 h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" aria-hidden="true" />

          <div className="space-y-8">
            {phases.map((phase, idx) => {
              const phaseTotal = phase.items.length;
              const phaseDone = phase.items.filter((i) => i.status === "done").length;
              const phasePct = phaseTotal === 0 ? 0 : Math.round((phaseDone / phaseTotal) * 100);
              const isOpen = openPhases[phase.id] ?? true;

              return (
                <div key={phase.id} className="relative pl-16">
                  {/* dot */}
                  <div className="absolute left-0 top-3">
                    <ThemeDot theme={phase.theme} />
                  </div>

                  {/* phase card */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => togglePhaseOpen(phase.id)}
                      className="w-full text-left px-6 py-5 hover:bg-slate-50 transition flex items-start justify-between gap-4"
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                            {phase.title}
                          </h2>
                          <PhaseBadge
                            theme={phase.theme}
                            text={`${phaseDone}/${phaseTotal} • ${phasePct}%`}
                          />
                        </div>
                        <p className="mt-2 text-slate-600">{phase.subtitle}</p>
                      </div>

                      <ChevronDown
                        className={`transition-transform ${
                          isOpen ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6">
                        <div className="h-px bg-slate-100 mb-5" />

                        <ul className="space-y-3">
                          {phase.items.map((item) => {
                            const done = item.status === "done";
                            const inProgress = item.status === "in-progress";

                            const rowCls = done
                              ? "border-emerald-200 bg-emerald-50"
                              : inProgress
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-200 bg-white";

                            return (
                              <li key={item.id}>
                                <div
                                  className={`w-full flex items-start gap-3 rounded-2xl border px-4 py-3 ${rowCls}`}
                                >
                                  <span className="mt-0.5">
                                    <StatusIcon status={item.status} />
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`font-semibold ${
                                        done
                                          ? "text-emerald-900"
                                          : inProgress
                                          ? "text-amber-900"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {item.label}
                                    </p>
                                    <div className="mt-1">
                                      <StatusPill status={item.status} />
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {idx !== phases.length - 1 && (
                          <div className="mt-6 text-sm text-slate-400">
                            Next: {phases[idx + 1].title}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center text-sm text-slate-500">
          © 2025 NFTBingo • Built on Polygon • nftbingo.net • Roadmap version 1.0
        </div>
      </div>
    </main>
  );
}
