import type { Destination } from "@/types/trip";

// A short, situational nudge shown on the Getting Around step — not a hard
// rule, just context so the choice isn't made blind (e.g. "you probably
// don't need a rental car in Tokyo" vs "Iceland's countryside has almost no
// public transit, budget for a car"). Curated for the destinations this app
// already has real content for; unrecognized destinations get a neutral
// fallback rather than a guess.
interface TransitNote {
  keywords: string[];
  note: string;
}

const NOTES: TransitNote[] = [
  {
    keywords: ["tokyo", "kyoto", "osaka", "japan"],
    note: "Japan's public transit is excellent — trains and subways run on time, and signage and announcements are almost always in English too. Most travellers get by comfortably without a car.",
  },
  {
    keywords: ["london", "edinburgh", "glasgow", "uk", "united kingdom", "britain"],
    note: "The UK's cities are well served by public transit — the Tube, buses, and rail all take contactless card payment directly, no ticket app needed. A car is more of a liability than a help in central London.",
  },
  {
    keywords: ["paris"],
    note: "Paris's Métro is fast, dense, and easy to navigate even without much French. Renting a car here mostly adds parking headaches — public transit or walking covers almost everything.",
  },
  {
    keywords: ["venice"],
    note: "Venice has no cars at all in the historic centre — you'll walk and take the vaporetto (water bus) everywhere. Don't plan around a rental car here.",
  },
  {
    keywords: ["rome", "florence", "milan", "bologna", "naples", "sicily", "italy"],
    note: "Italian cities have decent public transit, but signage and announcements lean more Italian-only than somewhere like Tokyo or London — a translation app helps. Trains (Trenitalia/Italo) are the easy way to move between cities.",
  },
  {
    keywords: ["cinque terre"],
    note: "The Cinque Terre train line connecting all five villages is cheap, frequent, and honestly the whole point — the coastal road is narrow and parking is scarce, so skip the car here.",
  },
  {
    keywords: ["tuscany", "chianti", "dolomit", "amalfi", "patagonia", "countryside", "wine country"],
    note: "This is countryside/scenic-drive territory with sparse public transit — a rental car (or private driver) is genuinely the practical way to see it, not just the flexible one.",
  },
  {
    keywords: ["iceland"],
    note: "Outside Reykjavik, Iceland has almost no public transit — seeing the Ring Road or highlands realistically means a rental car.",
  },
  {
    keywords: ["santorini", "mykonos", "greek island", "greek islands"],
    note: "The Greek islands have limited bus service between towns — a lot of travellers rent a scooter or small car, or rely on taxis, to get around comfortably.",
  },
  {
    keywords: ["athens", "thessaloniki", "greece"],
    note: "Athens has a solid, easy-to-use metro that reaches most major sites. Beyond the city, service thins out fast.",
  },
  {
    keywords: ["barcelona", "madrid"],
    note: "Barcelona and Madrid both have extensive, easy-to-use metro systems — most visitors don't need a car for the city itself.",
  },
  {
    keywords: ["seville"],
    note: "Seville's historic centre is compact and very walkable — public transit exists but you may not need much of it day-to-day.",
  },
  {
    keywords: ["lisbon", "porto", "portugal"],
    note: "Lisbon and Porto both have trams, metro, and rail that cover the city well, though the hills mean a lot of walking either way.",
  },
];

const DEFAULT_NOTE =
  "Every destination's transit quality is different — worth a quick check on how easy it is to get around without a car before you commit to a mode here.";

function destinationText(destination?: Destination): string {
  if (!destination) return "";
  return [
    destination.displayName,
    destination.freeText,
    destination.country,
    destination.region,
    ...(destination.cities ?? []),
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
}

export function getTransitNote(destination?: Destination): string {
  const text = destinationText(destination);
  if (!text) return DEFAULT_NOTE;
  const match = NOTES.find((n) => n.keywords.some((kw) => text.includes(kw)));
  return match?.note ?? DEFAULT_NOTE;
}
