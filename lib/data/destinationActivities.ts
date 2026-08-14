// Curated destination-specific activity recommendations.
// Matched by keyword against the destination displayName (case-insensitive).
// Each entry is what a knowledgeable travel advisor would immediately suggest.

export interface AlternativeProvider {
  name: string;
  url: string;
  note: string;
}

export interface DestinationActivity {
  name: string;
  description: string;
  emoji: string;
  category: string;
  isSignature?: boolean;
  /** Why we recommend this specific provider — sourced from public reputation, not invented */
  providerWhy?: string;
  /** Honest note about guide availability / assignment process */
  guideNote?: string;
  /** Other real, verifiable providers to consider */
  alternatives?: AlternativeProvider[];
}

const DB: { keywords: string[]; activities: DestinationActivity[] }[] = [
  {
    keywords: ["greece", "santorini", "mykonos", "athens", "crete", "rhodes"],
    activities: [
      { name: "Sailing between the Cyclades",                    emoji: "⛵", category: "sailing",             isSignature: true,  description: "Hop between Santorini, Mykonos, Paros and Naxos by catamaran or gulet — the definitive Greek islands experience." },
      {
        name: "Acropolis & Ancient Agora — Context Travel", emoji: "🏛️", category: "guided_walking_tour", isSignature: true,
        description: "Scholar-led small-group walk (max 6) with an archaeologist — covers the Parthenon, Erechtheion and the Agora in depth.",
        providerWhy: "Context Travel was founded on the principle that tours should feel like a conversation with an expert friend, not a lecture. Every guide holds an advanced degree in a relevant discipline (archaeology, history, art history) and is independently reviewed by the company before leading tours. Groups are capped at 6, making it genuinely possible to ask questions and go at your own pace.",
        guideNote: "Guide assignment is based on availability and expertise match — specific guide profiles and their academic backgrounds are listed on contexttravel.com before booking, so you can read their credentials in advance.",
        alternatives: [
          { name: "Walks of Athens", url: "walksofathens.com", note: "Small-group specialist with strong emphasis on local historians" },
          { name: "WithLocals", url: "withlocals.com", note: "Private tours with vetted local guides; customisable itinerary" },
          { name: "GetYourGuide", url: "getyourguide.com", note: "Large marketplace with verified reviews; compare multiple operators" },
        ],
      },
      {
        name: "Athens Food Walk — Culinary Backstreets", emoji: "🥙", category: "food", isSignature: true,
        description: "The flagship Athens walk hits Monastiraki, Psiri and Koukaki — souvlaki, loukoumades, mezedes and natural wine in locals-only spots.",
        providerWhy: "Culinary Backstreets was founded by food journalists and neighbourhood specialists who were frustrated by tours that took people to tourist-facing venues. Their guides are embedded locals — often food writers, chefs, or restaurant insiders — who take small groups to the places they actually eat at. No placement fees, no tourist menus.",
        guideNote: "Guides are not publicly named in advance (they vary by schedule), but Culinary Backstreets consistently receives top marks specifically for guide knowledge and authenticity in independent reviews. You can read past participant reviews on their site and on TripAdvisor.",
        alternatives: [
          { name: "Devour Athens", url: "devourtours.com", note: "Food tour operator with strong Athens presence and good reviews" },
          { name: "Airbnb Experiences", url: "airbnb.com/s/experiences", note: "Local-hosted food experiences, vetted and reviewed by past guests" },
          { name: "Viator", url: "viator.com", note: "Marketplace for food tours; filter by review score" },
        ],
      },
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
      {
        name: "Old City Walk — Context Travel", emoji: "🕌", category: "guided_walking_tour", isSignature: true,
        description: "An Istanbul-based historian leads an in-depth walk through Sultanahmet, Hagia Sophia and the Topkapı — maximum 6 people, seminar pace.",
        providerWhy: "Context Travel is widely regarded as the benchmark for intellectually serious guided tours. Their Istanbul guides are scholars living in the city — they bring depth that goes well beyond architectural facts into Byzantine history, Ottoman culture and living urban dynamics. The 6-person cap is genuine, not aspirational.",
        guideNote: "Guide profiles are published on contexttravel.com, including their academic background and specialist focus. If you have a specific interest (Byzantine mosaics, Ottoman calligraphy, etc.), the booking process allows you to request a guide whose expertise matches.",
        alternatives: [
          { name: "Istanbul Walks", url: "istanbulwalks.com", note: "Istanbul-based specialist with strong local guide team" },
          { name: "WithLocals", url: "withlocals.com", note: "Private tours; easily customisable around your interests" },
          { name: "GetYourGuide", url: "getyourguide.com", note: "Wide selection with verified traveller reviews" },
        ],
      },
      {
        name: "Istanbul Food Walk — Culinary Backstreets", emoji: "🍢", category: "food", isSignature: true,
        description: "Culinary Backstreets pioneered the neighbourhood food walk in Istanbul — their Beyoğlu and Balık Ekmek walks are widely regarded as the gold standard for eating like a local.",
        providerWhy: "Culinary Backstreets has operated in Istanbul since 2009 — longer than almost any other food tour company in the city. Their Istanbul team has included Turkish food journalists and chefs who built personal relationships with vendors before ever running tours. They explicitly do not charge restaurants for inclusion, so every stop is a genuine recommendation.",
        guideNote: "Guide names are not listed in advance, but Culinary Backstreets publishes detailed editorial about each of their walks on their website, which gives a clear sense of what the guide knows. Reviews on TripAdvisor and their own site frequently cite guide expertise as the defining element.",
        alternatives: [
          { name: "Devour Istanbul", url: "devourtours.com", note: "Established food tour operator with a good Istanbul programme" },
          { name: "Airbnb Experiences", url: "airbnb.com/s/experiences", note: "Host-led food experiences, reviewed by past guests" },
          { name: "Viator", url: "viator.com", note: "Marketplace; useful for comparing multiple food tour operators" },
        ],
      },
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
      {
        name: "Tsukiji Market Food Walk — Culinary Backstreets", emoji: "🍣", category: "food", isSignature: true,
        description: "Goes far beyond the outer market — guides with deep chef connections take you into the stalls that supply Tokyo's best restaurants.",
        providerWhy: "Culinary Backstreets' Tokyo team includes food writers and chefs with long-standing relationships in the professional kitchen world. Their access to specific vendors inside the market and in surrounding Tsukiji and Toyosu goes beyond what a general tour operator can offer — these are contacts built over years of editorial work, not commission arrangements.",
        guideNote: "Specific guide assignment is not listed in advance. Culinary Backstreets publishes profiles and editorial features about their Tokyo guides on their website — reading these beforehand gives a clear sense of the expertise you'll be travelling with.",
        alternatives: [
          { name: "Arigato Japan Food Tours", url: "arigatojapan.co.jp", note: "Well-reviewed Tokyo and Kyoto food specialist; strong on izakaya culture" },
          { name: "Airbnb Experiences", url: "airbnb.com/s/experiences", note: "Local-hosted food experiences with traveller reviews" },
          { name: "Viator", url: "viator.com", note: "Marketplace with multiple Tokyo food tour operators and verified reviews" },
        ],
      },
      {
        name: "Kyoto Temples & Gardens — Context Travel", emoji: "⛩️", category: "guided_walking_tour", isSignature: true,
        description: "An art historian leads you through Ryōanji, Kinkakuji and the Philosopher's Path with genuine depth — maximum 6 people, no rushing.",
        providerWhy: "Context Travel's Japan guides are specialists who typically have academic training in Japanese art, religion, or architectural history. The tour is structured as a slow, deep exploration rather than a checklist — guides encourage questions and are able to adapt the focus based on what the group finds most interesting.",
        guideNote: "Guide profiles are listed on contexttravel.com. Context Travel Japan has operated since the early 2010s, and many guides have been with the company for years — their individual reviews are visible on the booking page.",
        alternatives: [
          { name: "Inside Japan Tours", url: "insidejapantours.com", note: "Specialist Japan operator with strong guide quality" },
          { name: "WithLocals", url: "withlocals.com", note: "Private local-led tours, customisable to your pace and interests" },
          { name: "GetYourGuide", url: "getyourguide.com", note: "Broad marketplace; filter by rating to find top Kyoto guides" },
        ],
      },
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
      {
        name: "Louvre & Orsay — Context Travel", emoji: "🖼️", category: "guided_walking_tour", isSignature: true,
        description: "Art historians lead private and small-group tours through both museums — they cut directly to what matters, skipping what doesn't, and give real interpretive context.",
        providerWhy: "Context Travel's Paris guides are art historians, many with PhD-level training in French and European art. Their Louvre tour is one of the company's most reviewed globally — the consistent feedback is that it transforms a potentially overwhelming museum into a coherent, personal experience. They are authorised to access all public areas of both museums.",
        guideNote: "Guide profiles and areas of specialisation are listed on contexttravel.com before booking. If you have a particular period or artist you want to focus on (Impressionism, Renaissance, antiquities), noting this at booking often allows a better guide match.",
        alternatives: [
          { name: "Walks of Paris", url: "walksofparis.com", note: "Small-group museum specialist with strong art history focus" },
          { name: "Louvre Official Tours", url: "louvre.fr/en/visit/guided-tours", note: "Officially accredited guides; book directly through the museum" },
          { name: "GetYourGuide", url: "getyourguide.com", note: "Wide selection; filter for skip-the-line access and review score" },
        ],
      },
      {
        name: "Paris Market & Bistro Walk — Culinary Backstreets", emoji: "🥐", category: "food", isSignature: true,
        description: "Takes you through the Marché d'Aligre and surrounding bistros — the market Parisians actually shop at, not the tourist version.",
        providerWhy: "Culinary Backstreets' Paris team includes French food journalists and restaurant insiders who have spent years writing about the city's neighbourhood eating culture. Their walks deliberately avoid the famous markets and instead focus on the authentic daily food infrastructure of Paris — venues with no financial relationship with tour operators.",
        guideNote: "As with all Culinary Backstreets tours, specific guide names are not listed in advance. Their Paris guides are profiled in editorial features on the website, and independently reviewed on TripAdvisor, where the Paris walk consistently receives 5-star ratings.",
        alternatives: [
          { name: "Devour Paris", url: "devourtours.com", note: "Well-regarded food tour company with strong Paris offerings" },
          { name: "Eating Europe Paris", url: "eatingeurope.com", note: "Established food tour brand; good Montmartre and Le Marais options" },
          { name: "Airbnb Experiences", url: "airbnb.com/s/experiences", note: "Local-hosted food experiences reviewed by verified guests" },
        ],
      },
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
      {
        name: "Rome Ancient City — Context Travel", emoji: "🏛️", category: "guided_walking_tour", isSignature: true,
        description: "Context Travel's most-reviewed tour worldwide — an archaeologist guides you through the Forum, Palatine Hill and Colosseum with genuine scholarly depth. Maximum 6 people.",
        providerWhy: "Context Travel's Rome programme is the most established in their global portfolio and widely cited in travel media (New York Times, Guardian, Condé Nast Traveler) as the standard for serious guided touring in the city. Their Rome guides are typically practising archaeologists or academics who live and work in Rome — the depth of knowledge is substantively different from a licensed tour guide who has memorised facts.",
        guideNote: "Specific guide profiles are listed on contexttravel.com and include each guide's academic background and areas of expertise. Rome guides frequently have decades of experience and some have published scholarly work on the sites they cover. Past guests are encouraged to note specific interests at booking.",
        alternatives: [
          { name: "Walks of Rome", url: "walksofrome.com", note: "Well-established Rome specialist with strong Vatican and Ancient Rome options" },
          { name: "Through Eternity Rome", url: "througheternity.com", note: "Rome-based specialist; particularly strong for Sistine Chapel and Vatican" },
          { name: "GetYourGuide", url: "getyourguide.com", note: "Large marketplace; filter for 5-star rated Colosseum and Forum tours" },
        ],
      },
      {
        name: "Naples Street Food Walk — Culinary Backstreets", emoji: "🍕", category: "food", isSignature: true,
        description: "Digs into friggitorie, pizzerie and pastry shops that visitors walk straight past — the real Neapolitan eating culture, not the tourist strip.",
        providerWhy: "Culinary Backstreets' Naples walk is run by local food journalists and writers who have covered Neapolitan food culture for years. Naples presents a particular challenge for food tours because the best eating is often hidden in residential areas with no signage — their team's local knowledge is genuinely difficult to replicate from a guidebook.",
        guideNote: "Culinary Backstreets does not name guides in advance, but detailed editorial about the walk and its stops is published on their website. Independent reviews consistently describe guides as knowledgeable insiders rather than professional tour guides.",
        alternatives: [
          { name: "Eating Europe Naples", url: "eatingeurope.com", note: "Established operator with a well-reviewed Naples street food tour" },
          { name: "Devour Naples", url: "devourtours.com", note: "Food-focused tour company with Naples programme" },
          { name: "Airbnb Experiences", url: "airbnb.com/s/experiences", note: "Local-hosted food experiences; good option for smaller group or private tour" },
        ],
      },
      {
        name: "Florence Art & Markets — Eating Europe", emoji: "🖼️", category: "food",
        description: "Combines the Mercato Centrale with a guided walk through the Oltrarno — pecorino, lampredotto and Chianti included.",
        providerWhy: "Eating Europe has operated food tours across major European cities for over a decade. Their Florence programme is specifically designed around the working food culture of the Oltrarno district, which remains more local than the tourist-heavy centre. They vet all stops for quality and consistency.",
        guideNote: "Eating Europe lists their guide team on their website and provides transparent booking information. Their guides typically have backgrounds in food writing, hospitality, or culinary arts.",
        alternatives: [
          { name: "Culinary Backstreets Florence", url: "culinarybackstreets.com", note: "If available, their Florence walks apply the same neighbourhood-deep approach" },
          { name: "Devour Florence", url: "devourtours.com", note: "Well-reviewed food tour company with Florence offerings" },
          { name: "Viator", url: "viator.com", note: "Marketplace; compare multiple Florence food tours by review score" },
        ],
      },
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
      {
        name: "Fès Medina Walk — Context Travel", emoji: "🕌", category: "guided_walking_tour", isSignature: true,
        description: "A local historian guides you through the world's largest car-free urban area — the tanneries, medieval madrasas and hidden fondouks that most visitors never find.",
        providerWhy: "Context Travel's Fès programme is staffed by guides who are either native to the city or have spent many years living and studying there. Fès el-Bali is genuinely disorienting without deep local knowledge — it's one of the destinations where the quality of the guide makes the largest difference. Context Travel specifically recruits academics and specialists rather than licensed generalist guides.",
        guideNote: "Guide profiles are listed on contexttravel.com. For Morocco specifically, guides typically have backgrounds in Islamic history, architecture, or North African cultural studies. As Fès is a smaller Context Travel operation than Rome or Paris, guide availability should be confirmed well in advance.",
        alternatives: [
          { name: "Plan-it Fez", url: "plan-it-fez.com", note: "Fès-based specialist with highly rated medina walking tours" },
          { name: "WithLocals", url: "withlocals.com", note: "Private tours with Moroccan local guides; good for custom itineraries" },
          { name: "GetYourGuide", url: "getyourguide.com", note: "Multiple Fès and Marrakech tour options with verified reviews" },
        ],
      },
      {
        name: "Marrakech Food Walk — Culinary Backstreets", emoji: "🫕", category: "food", isSignature: true,
        description: "Covers the souks at dawn, a traditional harira breakfast and the city's best bastilla — stops chosen entirely outside the tourist menus.",
        providerWhy: "Culinary Backstreets' Marrakech walks are designed around the premise that the best Moroccan food in Marrakech is almost never found in the Djemaa el-Fna area. Their team identifies venues that serve the working local population — foundouks, neighbourhood ovens, and family kitchens — and builds relationships with them over time before including them in tours.",
        guideNote: "As with all Culinary Backstreets operations, guide names are not listed in advance. Their Marrakech editorial on the website explains the walk's philosophy and stops in detail. Independent reviews on TripAdvisor describe guides as 'genuine food insiders' rather than tourist industry professionals.",
        alternatives: [
          { name: "Marrakech Food Tours", url: "marrakechfoodtours.com", note: "Local specialist with well-reviewed food and medina walks" },
          { name: "Airbnb Experiences", url: "airbnb.com/s/experiences", note: "Local-hosted food experiences; good option for private or small-group tours" },
          { name: "Viator", url: "viator.com", note: "Multiple Marrakech food tour operators with verified traveller reviews" },
        ],
      },
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
      {
        name: "NYC Architecture Walk — Context Travel", emoji: "🏙️", category: "guided_walking_tour", isSignature: true,
        description: "Led by architects and architectural historians — their Lower Manhattan and Art Deco midtown walks are among the most detailed available in the city.",
        providerWhy: "Context Travel's New York guides are working architects, urban historians, and preservationists. The city's built environment is one of the richest and most layered in the world, and Context Travel's walks treat it with corresponding seriousness — covering structural engineering, urban planning decisions, and social history alongside aesthetics.",
        guideNote: "New York is one of Context Travel's most active markets and their guide roster is larger and more varied here than in most other cities. Guide profiles are listed on contexttravel.com with areas of specialisation — worth reviewing if you have a specific neighbourhood or period in mind (Gilded Age, Beaux-Arts, post-war modernism, etc.).",
        alternatives: [
          { name: "Big Onion Walking Tours", url: "bigonion.com", note: "New York institution since 1991; graduate student guides with deep local knowledge" },
          { name: "Free Tours by Foot NYC", url: "freetoursbyfoot.com/new-york-tours", note: "Pay-what-you-like tours with professional guides; good for neighbourhood walks" },
          { name: "The Municipal Art Society", url: "mas.org/tours", note: "NYC's premier architectural advocacy organisation; runs expert-led urban tours" },
        ],
      },
      {
        name: "Queens & Brooklyn Food Walk — Culinary Backstreets", emoji: "🥯", category: "food", isSignature: true,
        description: "Goes deep into the outer borough food scenes — Flushing dim sum, Jackson Heights curry row, Bed-Stuy Caribbean — areas Manhattan-focused food tours never reach.",
        providerWhy: "Culinary Backstreets' New York operation is built around the outer boroughs specifically because that is where the authentic immigrant food culture lives. Their team includes food writers and restaurant journalists who cover NYC food professionally — the stops are based on genuine editorial judgement, not commercial partnerships.",
        guideNote: "Culinary Backstreets publishes detailed editorial about their New York walks on their website, which gives a strong sense of guide expertise and stop selection. Independent reviews on TripAdvisor and Yelp consistently cite guides as the standout element.",
        alternatives: [
          { name: "Devour NYC", url: "devourtours.com", note: "Food tour operator with New York coverage and good reviews" },
          { name: "Foods of New York Tours", url: "foodsofny.com", note: "Long-running NYC food tour company; Chelsea Market and West Village walks" },
          { name: "Airbnb Experiences NYC", url: "airbnb.com/s/experiences", note: "Local-hosted food and neighbourhood experiences with verified reviews" },
        ],
      },
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
