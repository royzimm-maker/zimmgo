import { PlanningFlow } from "@/components/planning/PlanningFlow";

export const metadata = {
  title: "Plan your trip — ZimmGo",
};

export default function PlanPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Beta notice */}
      <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
        <p className="text-xs text-amber-700">
          <span className="inline-flex items-center gap-1 font-semibold">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Beta</span>
          </span>
          {" "}ZimmGo is an early prototype — recommendations are illustrative and not live booking data.
        </p>
      </div>

      {/* Top nav */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-brand-600 tracking-tight">ZimmGo</span>
            <span className="hidden text-xs text-slate-400 sm:block">AI Travel Planner</span>
          </a>
          <a
            href="/"
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Start new trip
          </a>
        </div>
      </header>

      {/* Main planning area — fills remaining viewport */}
      <div className="flex-1 overflow-hidden">
        <PlanningFlow />
      </div>
    </div>
  );
}
