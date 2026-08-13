import { PlanningFlow } from "@/components/planning/PlanningFlow";
import { TripSwitcher } from "@/components/TripSwitcher";
import { Logo } from "@/components/branding/Logo";

export const metadata = {
  title: "Plan your trip — ZimmGo",
};

export default function PlanPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden print:h-auto print:overflow-visible">
      {/* Beta notice */}
      <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center print:hidden">
        <p className="text-xs text-amber-700">
          <span className="inline-flex items-center gap-1 font-semibold">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Beta</span>
          </span>
          {" "}ZimmGo is an early prototype — recommendations are illustrative and not live booking data.
        </p>
      </div>

      {/* Top nav */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <Logo size={30} />
              <span className="hidden text-xs text-slate-400 sm:block">AI Travel Planner</span>
            </a>
          </div>
          <TripSwitcher />
        </div>
      </header>

      {/* Main planning area — fills remaining viewport */}
      <div className="flex-1 overflow-hidden print:overflow-visible">
        <PlanningFlow />
      </div>
    </div>
  );
}
