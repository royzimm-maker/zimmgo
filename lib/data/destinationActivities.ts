// Curated destination-specific activity recommendations.
// Matched by keyword against the destination displayName (case-insensitive).
// Each entry is what a knowledgeable travel advisor would immediately suggest.

export interface DestinationActivity {
  name: string;
  description: string;
  emoji: string;
  category: string;
  isSignature?: boolean; // "must-do" for this destination
}

const DB: { keywords: string[]; activities: DestinationActivity[] }[] = [
  {
    keywords: ["greece", "santorini", "mykonos", "athens", "crete", "rhodes"],
    activities: [
      { name: "Sailing between the Cyclades",                    emoji: "⛵", category: "sailing",             isSignature: true,  description: "Hop between Santorini, Mykonos, Paros and Naxos by catamaran or gulet — the definitive Greek islands experience." },
      { name: "Acropolis & Ancient Agora — Context Travel",      emoji: "🏛️", category: "guided_walking_tour", isSignature: true,  description: "Context Travel's scholar-led small-group walk (max 6) with an archaeologist — covers the Parthenon, Erechtheion and the Agora in depth. contexttravel.com" },
      { name: "Athens Food Walk — Culinary Backstreets",         emoji: "🥙", category: "guided_food_tour",    isSignature: true,  description: "Culinary Backstreets' flagship Athens walk hits Monastiraki, Psiri and Koukaki — souvlaki, loukoumades, mezedes and natural wine in locals-only spots. culinarybackstreets.com" },
      { name: "Oia caldera sunset watch",                        emoji: "🌅", category: "cultural",            isSignature: true,  description: "Santorini's most iconic moment — position yourself at the kasteli ruins for the best unobstructed view." },
      { name: "Olive oil & wine tasting, Crete",                 emoji: "🫒", category: "food",                               description: "Visit a family estate in the Cretan countryside for fresh-pressed oil, local cheeses and Assyrtiko wine." },
      { name: "Sea kayaking along volcanic coastline",           emoji: "🚣", category: "adventure",                          description: "Paddle through sea caves and lava cliffs around Milos or Santorini — surreal colours unique to this archipelago." },
      { name: "Delphi day trip",                                 emoji: "🗿", category: "cultural",                           description: "The ancient oracle site sits dramatically on Mount Parnassus — one of the most atmospheric ruins in Europe." },
    ],
  },
  {
    keywords: ["istanbul", "turkey", "bosphorus", "cappadocia", "ankara"],
    activities: [
      { name: "Bosphorus sunrise boat cruise",                   emoji: "🚢", category: "sailing",             isSignature: true,  description: "See two continents from the water at dawn — palaces, minarets and fishing villages slide past in golden light." },
      { name: "Old City Walk — Context Travel",                  emoji: "🕌", category: "guided_walking_tour", isSignature: true,  description: "Context Travel pairs you with an Istanbul-based historian for an in-depth walk through Sultanahmet, Hagia Sophia and the Topkapi — max 6 people. contexttravel.com" },
      { name: "Istanbul Food Walk — Culinary Backstreets",       emoji: "🍢", category: "guided_food_tour",    isSignature: true,  description: "Culinary Backstreets pioneered the neighbourhood food walk in Istanbul — their Beyoğlu and Balık Ekmek walks are considered the gold standard for eating like a local. culinarybackstreets.com" },
      { name: "Grand Bazaar & Spice Market deep dive",           emoji: "🛍️", category: "cultural",            isSignature: true,  description: "4,000+ shops across 61 covered streets — go with a guide who knows the hidden corners and honest vendors." },
      { name: "Traditional hammam experience",                   emoji: "🧖", category: "wellness",                            description: "A 16th-century ritual bath in a historic Ottoman hammam — the Çemberlitaş is architecturally stunning." },
      { name: "Ballooning over Cappadocia",                      emoji: "🎈", category: "adventure",                          description: "Float above the fairy chimneys and honeycombed valleys at sunrise — one of the world's most iconic balloon routes." },
      { name: "Turkish cooking class",                           emoji: "🍳", category: "food",                               description: "Learn meze, stuffed peppers and baklava from a local chef in their home kitchen — a genuinely intimate experience." },
      { name: "Princes' Islands day trip",                       emoji: "🚲", category: "cycling",                            description: "No cars allowed — explore these forested Ottoman-era islands by bike or horse-drawn carriage." },
    ],
  },
  {
    keywords: ["japan", "tokyo", "kyoto", "osaka", "hiroshima", "nara"],
    activities: [
      { name: "Tsukiji Market Food Walk — Culinary Backstreets", emoji: "🍣", category: "guided_food_tour",    isSignature: true,  description: "Culinary Backstreets' Tokyo walk goes far beyond the outer market — guides with deep chef connections take you into the stalls that supply the city's best restaurants. culinarybackstreets.com" },
      { name: "Kyoto Temples & Gardens — Context Travel",        emoji: "⛩️", category: "guided_walking_tour", isSignature: true,  description: "Context Travel's Kyoto walk with an art historian — covers Ryoanji, Kinkakuji and the Philosopher's Path with genuine depth, no rushing. contexttravel.com" },
      { name: "Sumo stable morning practice",                    emoji: "🤼", category: "cultural",            isSignature: true,  description: "Rare access to watch Japan's national sport before the tourists arrive — arranged through specialist fixers only." },
      { name: "Arashiyama bamboo grove at dawn",                 emoji: "🎋", category: "photography",                         description: "Kyoto's most magical sight — the light through the bamboo at 6am is transformative; by 9am it's a traffic jam." },
      { name: "Nishiki Market food crawl",                       emoji: "🥢", category: "food",                               description: "Kyoto's 'kitchen' — 130 stalls in a covered alley selling pickles, dashi, skewered tofu and wagyu." },
      { name: "TeamLab Borderless digital art",                  emoji: "🌀", category: "cultural",                           description: "Genuinely unlike anything else in the world — immersive rooms where art responds to your movement." },
      { name: "Ryokan overnight with kaiseki dinner",            emoji: "🍱", category: "wellness",                           description: "One night in a traditional inn — tatami mats, yukata robes, a private onsen and a 12-course seasonal menu." },
    ],
  },
  {
    keywords: ["paris", "france", "provence", "bordeaux", "nice", "lyon"],
    activities: [
      { name: "Louvre & Orsay — Context Travel",                 emoji: "🖼️", category: "guided_walking_tour", isSignature: true,  description: "Context Travel's art historians lead private and small-group tours through both museums — they cut straight to what matters and give genuine context. contexttravel.com" },
      { name: "Paris Market & Bistro Walk — Culinary Backstreets",emoji: "🥐", category: "guided_food_tour",   isSignature: true,  description: "Culinary Backstreets takes you through the Marché d'Aligre and surrounding bistros — the market Parisians actually shop at, not the tourist version. culinarybackstreets.com" },
      { name: "Canal Saint-Martin bike ride",                    emoji: "🚴", category: "cycling",             isSignature: true,  description: "The Paris that Parisians actually inhabit — iron footbridges, cool cafés and indie boutiques along the canal." },
      { name: "Burgundy wine estate day trip",                   emoji: "🍷", category: "food",                               description: "2 hours south: a full day among the Grand Cru vineyards of Beaune with a sommelier — bring an extra case." },
      { name: "Père Lachaise cemetery walk",                     emoji: "🌿", category: "cultural",                           description: "Not morbid — beautiful. One of Europe's greatest parks, with Proust, Chopin and Oscar Wilde as neighbours." },
      { name: "Cooking class in a Parisian kitchen",             emoji: "🍳", category: "food",                               description: "Learn French technique from a chef in their actual home kitchen in the Marais — market shopping included." },
      { name: "Versailles gardens at closing time",              emoji: "🌸", category: "cultural",                           description: "The palace at dusk when tour groups have left — the gardens are extraordinary in late afternoon light." },
    ],
  },
  {
    keywords: ["iceland", "reykjavik"],
    activities: [
      { name: "Northern lights snowmobile tour",      emoji: "🌌", category: "adventure", isSignature: true,  description: "Chase auroras by snowmobile in the backcountry — a completely different experience from the coach tours." },
      { name: "Langjökull glacier ice cave walk",     emoji: "🧊", category: "hiking",    isSignature: true,  description: "Walk through tunnels inside one of Europe's largest glaciers — a surreal world of electric blue and white." },
      { name: "Þórsmörk highland hike",              emoji: "🥾", category: "hiking",    isSignature: true,  description: "The Fimmvörðuháls trail from Skógar past waterfalls and lava fields — virtually no crowds." },
      { name: "Secret Lagoon geothermal soak",        emoji: "♨️", category: "wellness",                     description: "Iceland's oldest natural pool — half the price of the Blue Lagoon and far more authentic." },
      { name: "Whale watching from Húsavík",          emoji: "🐋", category: "adventure",                    description: "The best whale watching in Europe — humpbacks and minkes are reliably spotted in Skjálfandi Bay." },
      { name: "Lava tube caving",                     emoji: "🕳️", category: "adventure",                    description: "Descend into Vatnshellir, a 8,000-year-old lava tube — otherworldly rock formations in total silence." },
      { name: "Sea angling in the Westfjords",        emoji: "🎣", category: "adventure",                    description: "The most remote corner of Iceland — fish for Arctic char and cod with a local fisherman." },
    ],
  },
  {
    keywords: ["italy", "rome", "florence", "venice", "amalfi", "sicily", "milan", "tuscany", "naples"],
    activities: [
      { name: "Rome Ancient City — Context Travel",              emoji: "🏛️", category: "guided_walking_tour", isSignature: true,  description: "Context Travel's most popular tour worldwide — an archaeologist guides you through the Forum, Palatine Hill and Colosseum with genuine scholarly depth. Max 6 people. contexttravel.com" },
      { name: "Naples Street Food Walk — Culinary Backstreets",  emoji: "🍕", category: "guided_food_tour",    isSignature: true,  description: "Culinary Backstreets' Naples walk digs into friggitorie, pizzerie and pastry shops that visitors walk straight past — the real Neapolitan eating culture. culinarybackstreets.com" },
      { name: "Florence Art & Markets — Eating Europe",          emoji: "🖼️", category: "guided_food_tour",                      description: "Eating Europe's Florence tour combines the Mercato Centrale with a guided walk through the Oltrarno — pecorino, lampredotto and Chianti included. eatingeurope.com" },
      { name: "Colosseum underground & arena floor",             emoji: "🏟️", category: "cultural",                              description: "Skip the standard tour — access the hypogeum (where gladiators waited) and stand on the arena floor itself." },
      { name: "Truffle hunt in Umbria",                          emoji: "🍄", category: "food",                                  description: "A morning in the forest with a truffle dog and local hunter — lunch with freshly shaved tartufo bianco follows." },
      { name: "Cinque Terre hiking trail",                       emoji: "🥾", category: "hiking",                                description: "Walk all five clifftop villages connected by the Sentiero Azzurro — dip in the sea between each village." },
      { name: "Venice lagoon by private boat",                   emoji: "🚣", category: "cultural",                              description: "Skip the gondola — hire a private boat to explore Burano, Torcello and the quieter northern lagoon islands." },
      { name: "Amalfi coast boat hire",                          emoji: "⛵", category: "sailing",                               description: "Rent a small motorboat and explore the sea caves of Positano and Capri at your own pace." },
    ],
  },
  {
    keywords: ["morocco", "marrakech", "fes", "fez", "sahara", "casablanca"],
    activities: [
      { name: "Fès Medina Walk — Context Travel",                emoji: "🕌", category: "guided_walking_tour", isSignature: true,  description: "Context Travel pairs you with a local historian to navigate the world's largest car-free urban area — the tanneries, madrasas and hidden fondouks. contexttravel.com" },
      { name: "Marrakech Food Walk — Culinary Backstreets",      emoji: "🫕", category: "guided_food_tour",    isSignature: true,  description: "Culinary Backstreets' Marrakech walk covers the souks at dawn, a traditional harira breakfast and the city's best bastilla — far from the tourist menus. culinarybackstreets.com" },
      { name: "Sahara desert overnight camp",                    emoji: "🌙", category: "adventure",           isSignature: true,  description: "Camel trek into the Erg Chebbi dunes at sunset, sleep in a luxury camp and wake to silence and stars." },
      { name: "Hammam & argan oil ritual",                       emoji: "🧖", category: "wellness",                              description: "A full traditional hammam with black soap and kessa scrub — the Mouassine in Marrakech is exceptional." },
      { name: "Atlas Mountains day hike",                        emoji: "🏔️", category: "hiking",                                description: "Trek through Berber villages above the snowline — the views back over Marrakech are extraordinary." },
      { name: "Leather tanneries of Fès",                        emoji: "👜", category: "cultural",                              description: "Watch ancient dyeing techniques from the rooftop terraces of surrounding leather shops — unchanged for centuries." },
      { name: "Jemaa el-Fna night market",                       emoji: "🎭", category: "food",                                  description: "The square transforms at dusk into a swirl of food stalls, musicians, storytellers and acrobats." },
    ],
  },
  {
    keywords: ["new york", "nyc", "manhattan"],
    activities: [
      { name: "NYC Architecture Walk — Context Travel",          emoji: "🏙️", category: "guided_walking_tour", isSignature: true,  description: "Context Travel's New York tours are led by architects and historians — their Lower Manhattan and Art Deco walks are outstanding. contexttravel.com" },
      { name: "Queens & Brooklyn Food Walk — Culinary Backstreets", emoji: "🥯", category: "guided_food_tour", isSignature: true, description: "Culinary Backstreets' New York tours go deep into the outer borough food scenes — Flushing dim sum, Jackson Heights curry row, Bed-Stuy Caribbean. culinarybackstreets.com" },
      { name: "High Line walk & Chelsea Market",                 emoji: "🌿", category: "cultural",                              description: "The elevated park above the West Side — end at Chelsea Market for artisan food stalls and the best chowder in the city." },
      { name: "Metropolitan Museum rooftop at sunset",           emoji: "🏛️", category: "cultural",                              description: "The Met rooftop bar closes at dusk but the view of Central Park from the roof is always open — and free." },
      { name: "Jazz in the Village Vanguard",                    emoji: "🎷", category: "cultural",                              description: "The greatest jazz club in the world, unchanged since 1935 — book the Monday night house band." },
      { name: "Central Park dawn run",                           emoji: "🏃", category: "adventure",                             description: "The park at 6am belongs to locals — the reservoir loop is 1.6 miles of uninterrupted skyline views." },
    ],
  },
  {
    keywords: ["patagonia", "el calafate", "puerto natales", "torres del paine"],
    activities: [
      { name: "Torres del Paine W Trek",              emoji: "🏔️", category: "hiking",    isSignature: true,  description: "The bucket-list hike of South America — 5 days, granite towers, glaciers and condors overhead." },
      { name: "Perito Moreno glacier walk",           emoji: "🧊", category: "adventure", isSignature: true,  description: "Strap crampons to your boots and walk across a living glacier — the calving ice is thunderous." },
      { name: "Kayaking in the fjords",               emoji: "🚣", category: "adventure",                    description: "Paddle through the channels of Tierra del Fuego — see sea lions, dolphins and albatross at close range." },
      { name: "Estancia horseback riding",            emoji: "🐴", category: "adventure",                    description: "Ride with a gaucho across the steppe — an authentic working sheep farm, not a tourist operation." },
      { name: "Fly fishing on the Río Serrano",       emoji: "🎣", category: "adventure",                    description: "World-class brown trout in pristine wilderness — guided half-days with expert local outfitters." },
    ],
  },
  {
    keywords: ["southeast asia", "thailand", "bangkok", "vietnam", "bali", "cambodia", "singapore", "chiang mai"],
    activities: [
      { name: "Dawn temple tour, Angkor Wat",         emoji: "🛕", category: "cultural",  isSignature: true,  description: "Watch the sun rise over the world's largest religious monument — arrive at 4:30am with a guide who knows the best spot." },
      { name: "Thai cooking class, Chiang Mai",       emoji: "🍜", category: "food",      isSignature: true,  description: "Market shopping at dawn, then learn 5 regional dishes in an open-air sala kitchen — take the recipes home." },
      { name: "Mekong river slow boat journey",       emoji: "🚢", category: "sailing",                      description: "Two days drifting through Laos on a wooden boat — riverside villages, monks and mountains in total peace." },
      { name: "Balinese rice terrace trek",           emoji: "🌾", category: "hiking",                       description: "Walk the Tegalalang terraces with a local farmer at dawn — the engineering is 1,000 years old." },
      { name: "Scuba diving, Koh Tao",                emoji: "🤿", category: "diving",                       description: "One of the world's best value dive destinations — whale sharks and leopard sharks year-round." },
      { name: "Night market & street food crawl",     emoji: "🥟", category: "food",                         description: "From pad see ew on a plastic stool to mango sticky rice — the best meals in Bangkok cost under $5." },
    ],
  },
];

// Fuzzy match a destination displayName against the keyword lists
export function getActivitiesForDestination(displayName: string): DestinationActivity[] {
  const lower = displayName.toLowerCase();
  const results: DestinationActivity[] = [];

  for (const entry of DB) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      results.push(...entry.activities);
    }
  }

  return results;
}

// Given a combined multi-destination string (e.g. "Greece, Istanbul"),
// return activities grouped by destination for display.
export function getActivitiesByDestination(
  displayName: string
): { destination: string; activities: DestinationActivity[] }[] {
  const destinations = displayName.split(", ").filter(Boolean);
  return destinations
    .map((dest) => ({
      destination: dest,
      activities: getActivitiesForDestination(dest),
    }))
    .filter((g) => g.activities.length > 0);
}
