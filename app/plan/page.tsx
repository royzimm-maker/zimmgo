import { PlanningFlow } from "@/components/planning/PlanningFlow";

export const metadata = {
  title: "Plan your trip — ZimmGo",
};

export default function PlanPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
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
