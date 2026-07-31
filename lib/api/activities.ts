// Activities API module
// Production: integrate with GetYourGuide API or Viator API
// GetYourGuide docs: https://api.getyourguide.com

import { v4 as uuid } from "uuid";
import { DESTINATION_ALIASES } from "@/lib/data/destinationAliases";
import type { ActivityOption } from "@/types/trip";

interface ActivitySearchParams {
  destination: string;
  categories?: string[];
  vibes?: string[];
  max_price_per_person?: number;
  duration_days?: number;
}

const ACTIVITY_POOLS: Record<string, Partial<ActivityOption>[]> = {
  tokyo: [
    { name: "Tsukiji Outer Market food tour",    category: "food",     duration: "3h",  price: 85,  rating: 9.6, reviewCount: 4200, isLocalFavorite: true,  description: "Skip the tourist restaurants — this guided tour covers the best stalls insiders actually eat at." },
    { name: "Sumo stable morning practice",       category: "cultural", duration: "2h",  price: 120, rating: 9.4, reviewCount: 1100, isLocalFavorite: true,  description: "Rare access to watch Japan's national sport in an authentic setting before the tourists arrive." },
    { name: "TeamLab Borderless digital art",     category: "cultural", duration: "3h",  price: 32,  rating: 9.1, reviewCount: 18000, isLocalFavorite: false, description: "Immersive digital art installation — genuinely unlike anything else in the world." },
    { name: "Day trip to Nikko",                  category: "cultural", duration: "Full day", price: 95, rating: 8.9, reviewCount: 3400, isLocalFavorite: false, description: "Elaborate 17th-century shrines set in mountain forests — far less crowded than Kyoto." },
  ],
  paris: [
    { name: "Private Louvre morning tour",        category: "cultural", duration: "3h",  price: 180, rating: 9.7, reviewCount: 2100, isLocalFavorite: false, description: "Avoid the crowds completely — private early access with an art historian guide." },
    { name: "Marché des Enfants Rouges picnic",   category: "food",     duration: "2h",  price: 25,  rating: 9.5, reviewCount: 1800, isLocalFavorite: true,  description: "Paris's oldest covered market — graze through Moroccan, Japanese, and French stalls like a local." },
    { name: "Canal Saint-Martin bike ride",       category: "cycling",  duration: "3h",  price: 45,  rating: 9.2, reviewCount: 2600, isLocalFavorite: true,  description: "The Paris that Parisians actually inhabit — iron bridges, trendy cafés, and indie boutiques." },
    { name: "Guided wine cave tasting in Burgundy", category: "food",   duration: "Full day", price: 220, rating: 9.8, reviewCount: 580, isLocalFavorite: false, description: "Drive 2h south for a full day in the world's most famous wine region with a sommelier guide." },
  ],
  iceland: [
    { name: "Northern lights snowmobile tour",    category: "adventure", duration: "4h", price: 185, rating: 9.5, reviewCount: 3200, isLocalFavorite: false, description: "Chase auroras by snowmobile in the backcountry — a completely different experience from coach tours." },
    { name: "Langjökull glacier ice cave walk",   category: "hiking",    duration: "4h", price: 140, rating: 9.3, reviewCount: 4100, isLocalFavorite: false, description: "Walk through ice tunnels in one of Europe's largest glaciers — surreal blue-white world." },
    { name: "Secret Lagoon geothermal pool",      category: "wellness",  duration: "2h", price: 55,  rating: 9.1, reviewCount: 5600, isLocalFavorite: true,  description: "Iceland's oldest natural pool — half the price of the Blue Lagoon and twice as authentic." },
    { name: "Þórsmörk highland hiking",          category: "hiking",    duration: "Full day", price: 95, rating: 9.7, reviewCount: 1200, isLocalFavorite: true,  description: "The Fimmvörðuháls trail from Skógar — waterfalls, lava fields, and virtually no crowds." },
  ],
  italy: [
    { name: "Colosseum early-access tour",    category: "cultural",     duration: "2.5h", price: 65,  rating: 9.5, reviewCount: 28000, isLocalFavorite: false, description: "Beat the queues with skip-the-line early access and a guide who brings the gladiators back to life." },
    { name: "Trastevere street food walk",    category: "food",         duration: "2.5h", price: 75,  rating: 9.3, reviewCount: 8400,  isLocalFavorite: true,  description: "Explore Rome's most authentic neighbourhood: supplì, fried artichokes, and a glass of house white." },
    { name: "Vatican Museums & Sistine Chapel",category: "cultural",    duration: "3h",   price: 85,  rating: 9.4, reviewCount: 45000, isLocalFavorite: false, description: "Reserved-entry tour that gets you in before the crowds. The ceiling is even more staggering in person." },
    { name: "Vespa tour of the old city",     category: "guided_walking_tour", duration: "3h", price: 120, rating: 9.6, reviewCount: 3200, isLocalFavorite: true,  description: "See the city the Roman way — on the back of a Vespa with a local guide." },
  ],
  amalfi: [
    { name: "Amalfi Coast boat trip",         category: "sailing",      duration: "6h",   price: 140, rating: 9.7, reviewCount: 4800, isLocalFavorite: true,  description: "Private boat along the clifftop towns — Ravello, Positano, Praiano — with swimming stops in hidden coves." },
    { name: "Limoncello-making class",        category: "food",         duration: "2h",   price: 65,  rating: 9.2, reviewCount: 2100, isLocalFavorite: true,  description: "A local family shares their terrace lemon grove and century-old recipe. You leave with a bottle." },
    { name: "Sentiero degli Dei hike",        category: "hiking",       duration: "5h",   price: 45,  rating: 9.8, reviewCount: 3300, isLocalFavorite: true,  description: "The 'Path of the Gods' — arguably the most scenic coastal walk in Europe. Staggering views at every step." },
    { name: "Ravello Villa & Garden tour",    category: "cultural",     duration: "3h",   price: 55,  rating: 9.1, reviewCount: 1900, isLocalFavorite: false, description: "The clifftop gardens of Villa Rufolo and Villa Cimbrone. Wagner composed here. You'll understand why." },
  ],
  dolomit: [
    { name: "Via Ferrata Piccolo Lagazuoi",   category: "adventure",    duration: "6h",   price: 95,  rating: 9.6, reviewCount: 2700, isLocalFavorite: true,  description: "The most dramatic via ferrata in the Alps — through WWI tunnels and along sheer limestone walls." },
    { name: "Alta Via 1 guided day hike",     category: "hiking",       duration: "Full day", price: 110, rating: 9.7, reviewCount: 1800, isLocalFavorite: true, description: "The high route above the tree line — marmots, ibex, and views that justify every switchback." },
    { name: "Sunrise photography at Tre Cime",category: "photography",  duration: "4h",   price: 75,  rating: 9.8, reviewCount: 4600, isLocalFavorite: false, description: "The Tre Cime di Lavaredo at golden hour is one of the great mountain photographs. A guide gets you there at the right moment." },
    { name: "Dolomites e-bike tour",          category: "cycling",      duration: "5h",   price: 120, rating: 9.3, reviewCount: 3100, isLocalFavorite: true,  description: "Pedal through alpine meadows and traditional Ladin villages with a local guide, letting the motor help on the climbs." },
  ],
  default: [
    { name: "Private city food tour",            category: "food",     duration: "3h",  price: 95,  rating: 9.4, reviewCount: 2400, isLocalFavorite: true,  description: "Curated neighbourhoods and stops that locals love — vetted by our on-the-ground advisors." },
    { name: "Sunrise hike with local guide",     category: "hiking",   duration: "5h",  price: 80,  rating: 9.2, reviewCount: 1800, isLocalFavorite: true,  description: "The best viewpoints before the tour groups arrive, with a guide who grew up here." },
    { name: "Cultural immersion workshop",       category: "cultural", duration: "3h",  price: 65,  rating: 9.0, reviewCount: 3200, isLocalFavorite: false, description: "Hands-on traditional crafts, cooking, or art — a memorable way to connect with local culture." },
    { name: "Private photography walk",          category: "photography", duration: "4h", price: 150, rating: 9.5, reviewCount: 800, isLocalFavorite: false, description: "A pro photographer takes you to the best light and hidden spots — you leave with stunning shots." },
    { name: "Exclusive wine or spirit tasting",  category: "food",     duration: "2h",  price: 120, rating: 9.3, reviewCount: 1400, isLocalFavorite: false, description: "Small-group tasting with a sommelier or master distiller — paired with regional food." },
  ],
};

function findActivityBase(destination: string): Partial<ActivityOption>[] {
  const lower = (destination ?? "").toLowerCase();
  const direct = Object.keys(ACTIVITY_POOLS).find((k) => lower.includes(k));
  if (direct) return ACTIVITY_POOLS[direct];
  const alias = Object.entries(DESTINATION_ALIASES).find(([a]) => lower.includes(a));
  return ACTIVITY_POOLS[alias?.[1] ?? "default"];
}

export async function searchActivities(params: ActivitySearchParams): Promise<ActivityOption[]> {
  // --- PRODUCTION SWAP POINT ---
  // const response = await fetch("https://api.getyourguide.com/1/activities?q=...", {
  //   headers: { "X-ACCESS-TOKEN": process.env.GYG_API_KEY! },
  // });
  // return transformGYGResponse(response);

  const base = findActivityBase(params.destination);
  const maxPrice = params.max_price_per_person ?? 500;

  let pool = base.filter((a) => (a.price ?? 0) <= maxPrice);

  // Filter by category if requested
  if (params.categories?.length) {
    const cat = params.categories;
    pool = pool.filter((a) => !a.category || cat.includes(a.category));
    // If filter removed everything, fall back to full pool
    if (!pool.length) pool = base;
  }

  return pool.slice(0, 5).map((a) => ({
    id: uuid(),
    name: a.name!,
    category: a.category!,
    duration: a.duration!,
    price: a.price!,
    currency: "USD",
    rating: a.rating!,
    reviewCount: a.reviewCount!,
    isLocalFavorite: a.isLocalFavorite!,
    description: a.description!,
    location: params.destination,
    bookingUrl: `https://www.getyourguide.com/s/?q=${encodeURIComponent(a.name + " " + params.destination)}`,
  }));
}
