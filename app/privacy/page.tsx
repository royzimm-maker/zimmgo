import Link from "next/link";
import { Logo } from "@/components/branding/Logo";

export const metadata = {
  title: "Privacy — ZimmGo",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <Logo size={30} showTagline className="hidden sm:inline-flex" />
          <Logo size={30} className="sm:hidden" />
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-xs text-amber-800">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 mr-1.5">Beta</span>
            ZimmGo is an early prototype. This page describes how the app actually works today, not a formal legal policy.
          </p>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-6">Privacy</h1>

        <div className="flex flex-col gap-6 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-1.5">Where your trip data lives</h2>
            <p>
              There are no user accounts and nothing is stored on a server. Your trip — destination, dates, budget, dietary needs, hotel and activity picks, chat history, everything — is saved only in your own browser&apos;s local storage. It never leaves your device except in the specific cases below, and it&apos;s gone if you clear your browser data or switch devices.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-1.5">What gets sent to the AI</h2>
            <p>
              ZimmGo uses Anthropic&apos;s Claude API to parse free-text destination and trip descriptions, power the ZiGy chat advisor, and generate itineraries. Whatever you type into those fields — including the &quot;describe your whole trip&quot; box, chat messages, and destination search text — is sent to Anthropic to generate a response. It is not sent anywhere else, and ZimmGo does not use it for anything beyond producing that one response.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-1.5">What&apos;s in local storage, specifically</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Your current and saved trips (preferences, itineraries, Wanderlog items, chat history)</li>
              <li>A short list of your recent destination searches, so you can quickly re-select one</li>
              <li>A couple of small UI preferences, like panel sizing, that have nothing to do with your trip content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-1.5">No real booking or payment data</h2>
            <p>
              ZimmGo doesn&apos;t process payments or make real bookings — flight, hotel, and activity data shown in this beta is illustrative, not live inventory. &quot;Book&quot; links simply open the airline or provider&apos;s own site in a new tab. ZimmGo never collects payment card details, passwords, or government ID information, and you should never enter that kind of information into this app.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-1.5">Questions</h2>
            <p>
              This is a small beta project, not a company with a support line. If something here seems wrong or you have a question about how your data is handled, the most useful thing is to check the actual behavior described above — it&apos;s meant to match the app exactly.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
