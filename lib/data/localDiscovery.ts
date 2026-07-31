// Curated local discovery data — matched by keyword against destination displayName.
// Covers: local scene/events, music, essential apps, airport transfers, hidden gems.
// Tone: friendly and a little whimsical — the advice a well-connected local friend would give.

export interface LocalEvent {
  name: string;
  description: string;
  emoji: string;
  type: "music" | "theater" | "dance" | "market" | "festival" | "literary" | "art" | "food" | "sport";
  url?: string;
  tipNote?: string;
}

export interface LocalArtist {
  name: string;
  genre: string;
  why: string;
  searchUrl: string;
}

export interface MusicVenue {
  name: string;
  vibe: string;
  genre: string;
  url?: string;
}

export interface LocalApp {
  name: string;
  category: "transit" | "taxi" | "food" | "payment" | "language" | "events" | "maps";
  description: string;
  emoji: string;
  url: string;
  platform: "iOS" | "Android" | "both";
}

export interface AirportTransfer {
  option: string;
  emoji: string;
  timeEst: string;
  costEst: string;
  recommended: boolean;
  description: string;
  tip?: string;
}

export interface HiddenGem {
  name: string;
  description: string;
  emoji: string;
  type: string;
  sourceUrl?: string;
}

export interface LocalDiscovery {
  destination: string;
  sceneIntro: string;
  events: LocalEvent[];
  music: {
    intro: string;
    artists: LocalArtist[];
    venues: MusicVenue[];
    playlistSearchUrl: string;
  };
  apps: LocalApp[];
  airportTransfers: AirportTransfer[];
  hiddenGems: HiddenGem[];
}

const DB: { keywords: string[]; level: "region" | "country"; data: LocalDiscovery }[] = [
  // ── Region-specific entries (matched first for single-city trips) ───────────
  {
    level: "region",
    keywords: ["amalfi", "positano", "ravello", "praiano", "sorrento", "cetara"],
    data: {
      destination: "Amalfi Coast",
      sceneIntro: "The Amalfi Coast moves at the pace of the sea — slow lunches that become slow dinners, lemon groves dripping over whitewashed walls, and fishing boats that leave at 5am and are back by noon. The best moments here aren't planned.",
      events: [
        { name: "Ravello Festival",          emoji: "🎼", type: "festival", description: "July–September. Classical concerts on a clifftop stage with a 270° view of the sea — including a legendary open-air concert platform cantilevered over the Tyrrhenian.", url: "https://www.ravellofestival.com", tipNote: "Buy tickets in advance — the Belvedere concert (held in Villa Rufolo gardens) sells out weeks ahead." },
        { name: "Limoncello tasting trails",  emoji: "🍋", type: "food",     description: "Local producers along the Amalfi Drive open their terraces for tastings — Limone Costa d'Amalfi IGP is the real thing, made with local sfusato lemons, not imports.", tipNote: "Look for Limoncello di Amalfi or Limoncello di Sorrento labels — both are the genuine article." },
        { name: "Festa di Sant'Andrea",       emoji: "⛵", type: "festival", description: "June 27 and November 30. Amalfi town goes all-in for its patron saint — evening procession down to the harbour, fireworks over the sea, and serious local pride on display." },
        { name: "Fishing boat sunrise",       emoji: "🌅", type: "food",     description: "Walk to the harbour in Cetara or Minori at 6am and buy directly from fishermen returning with catch. The alici (anchovies) here are celebrated across Italy." },
      ],
      music: {
        intro: "The Coast has its own musical DNA — tarantella rhythms from the south, the melancholic strumming of Neapolitan song, and the occasional international festival that brings serious classical talent to clifftop stages.",
        artists: [
          { name: "Roberto Murolo",     genre: "Neapolitan song / canzone", why: "The voice of Naples — his recordings of 'O Sole Mio' and 'Torna a Surriento' are essential for the drive down the Costiera.",  searchUrl: "https://open.spotify.com/search/Roberto%20Murolo" },
          { name: "Pino Daniele",       genre: "Neapolitan rock / blues",   why: "The poet of Naples — blends southern Italian folk, blues, and jazz. 'Napule è' is one of the most beautiful songs ever written about a city.", searchUrl: "https://open.spotify.com/search/Pino%20Daniele" },
          { name: "Almamegretta",       genre: "Neapolitan dub / reggae",   why: "Napoli's most original export — reggae sung in Neapolitan dialect. Unexpected and wonderful.",                                          searchUrl: "https://open.spotify.com/search/Almamegretta" },
        ],
        venues: [
          { name: "Bar Calypso, Positano",   vibe: "Sunset terrace bar with live guitar most evenings — the classic Amalfi aperitivo spot", genre: "Acoustic / Guitar" },
          { name: "Music on the Rocks, Positano", vibe: "Legendary club built into a sea cave — the most dramatic nightlife venue in Italy", genre: "Electronic / Pop", url: "https://www.musicontherocks.it" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/canzone%20napoletana%20playlist",
      },
      apps: [
        { name: "Trenitalia",           category: "transit",  emoji: "🚄", description: "Book trains to Naples (NAP), your gateway to the Coast. Circumvesuviana line continues to Sorrento.", url: "https://www.trenitalia.com", platform: "both" },
        { name: "MetroDelMare",         category: "transit",  emoji: "⛴️", description: "High-speed seasonal ferries connecting Amalfi towns and Naples. Much better than the road in summer.", url: "https://www.metrodelmare.com", platform: "both" },
        { name: "FREE NOW",             category: "taxi",     emoji: "🚕", description: "Licensed taxis in Naples for the transfer to/from the airport. Agree the price before you set off — Naples taxis are metered but negotiations happen.", url: "https://free-now.com", platform: "both" },
        { name: "TheFork",             category: "food",     emoji: "🍽️", description: "Reserve at the better restaurants — popular spots in Positano and Ravello book out weeks ahead in high season.", url: "https://www.thefork.com", platform: "both" },
      ],
      airportTransfers: [
        { option: "Naples (NAP) → Sorrento by train + ferry", emoji: "⛴️", timeEst: "90–120 min", costEst: "€12–20", recommended: true,  description: "Train from Naples Centrale to Sorrento via Circumvesuviana (70 min), then ferry or SITA bus along the Coast. The most scenic and affordable option.", tip: "SITA buses run the Amalfi Drive but can be brutally crowded July–August — take the ferry whenever possible." },
        { option: "Naples (NAP) → Private transfer", emoji: "🚗", timeEst: "75–90 min", costEst: "€80–120", recommended: false, description: "Door-to-door to your hotel — worthwhile with luggage since bus and ferry combos involve carrying bags up steep steps. Book in advance.", tip: "Confirm your driver will come to the hotel entrance — not all vehicles can navigate narrow Amalfi streets." },
        { option: "Rome (FCO) → Naples by train", emoji: "🚄", timeEst: "3.5–4.5 h total", costEst: "€25–45", recommended: false, description: "High-speed Frecciarossa Rome → Naples (70 min), then Circumvesuviana + ferry. Manageable but a long day with luggage.", tip: "Book the Rome–Naples leg on Trenitalia or Italo — fares drop significantly if booked 2+ weeks ahead." },
      ],
      hiddenGems: [
        { name: "Sentiero degli Dei (Path of the Gods)", emoji: "🥾", type: "hike",        description: "The Amalfi hinterland trail from Agerola to Nocelle — arguably the most spectacular coastal walk in Europe. Best done early morning before the heat.", sourceUrl: "https://www.amalficoast.it" },
        { name: "Cetara village",                         emoji: "🐟", type: "village",     description: "The last unfashionable village on the Coast — anchovy capital of southern Italy. No yachts, no influencers. Restaurants serve colatura di alici (anchovy extract) on everything.", sourceUrl: "https://www.timeout.com/naples" },
        { name: "Valle delle Ferriere nature reserve",    emoji: "🌿", type: "nature",      description: "A hidden gorge above Amalfi town with waterfalls, ancient paper mills, and rare ferns that survived the ice age. Completely empty on weekdays." },
        { name: "Ravello's private gardens",              emoji: "🌸", type: "garden",      description: "Villa Cimbrone and Villa Rufolo are famous — but ask at the Ravello tourist office about privately-owned garden estates that occasionally open to visitors. Extraordinary." },
      ],
    },
  },
  {
    level: "region",
    keywords: ["dolomit", "cortina", "alta badia", "val gardena", "bolzano", "merano", "south tyrol", "alto adige", "ortisei", "canazei"],
    data: {
      destination: "The Dolomites",
      sceneIntro: "The Dolomites belong to both Italy and Austria in spirit — strudel and grappa at the same table, German and Italian on every sign, and mountain rifugi where hikers have been eating the same goulash for a century. The air is genuinely different here.",
      events: [
        { name: "Rifugio culture",              emoji: "🏔️", type: "food",    description: "The mountain huts (rifugi) are the real social life of the Dolomites — hikers, climbers, and locals share benches at long tables eating polenta, canederli dumplings, and drinking local Lagrein wine.", tipNote: "Book ahead for lunch at Rifugio Averau or Rifugio Lagazuoi — both have 360° views that make lunch a two-hour affair." },
        { name: "Bolzano Christmas market",     emoji: "🎄", type: "market",  description: "One of Italy's best Christmas markets (late November–January) — Austrian-style stalls, mulled Glühwein, hand-carved ornaments, and grilled sausages in the medieval piazza.", url: "https://www.bolzano-bozen.it" },
        { name: "Dolomiti Superbike race",      emoji: "🚵", type: "sport",   description: "July. 4,000 cyclists tackle 85km of legendary passes — Pordoi, Sella, Gardena, Campolongo. Even if you're not racing, the spectacle from a roadside is extraordinary.", url: "https://www.dolomitisuperbike.com" },
        { name: "Reinhold Messner Museum circuit", emoji: "🧗", type: "art", description: "Six mountain fortress museums scattered across the Dolomites — each dedicated to a different chapter of mountaineering history. JUVAL castle is the most atmospheric.", url: "https://www.messner-mountain-museum.it" },
      ],
      music: {
        intro: "South Tyrol is culturally between two worlds — Austrian folk traditions, Italian pop radio, and an emerging electronic scene in Bolzano and Merano that few outsiders know about.",
        artists: [
          { name: "Herbert Pixner Projekt", genre: "Alpine folk / jazz fusion", why: "The most original voice from South Tyrol — accordion-driven folk that sounds like nothing else. Their live shows in village squares are legendary.", searchUrl: "https://open.spotify.com/search/Herbert%20Pixner%20Projekt" },
          { name: "Peter Fox",             genre: "German hip-hop / pop",       why: "Not Tyrolean — but his 'Stadtaffe' album soundtracks every road trip through the Alps perfectly.",                                               searchUrl: "https://open.spotify.com/search/Peter%20Fox" },
          { name: "Haiku Garden",          genre: "Indie / folk",               why: "Bolzano indie act — understated and beautiful. Best heard on a mountain walk.",                                                                    searchUrl: "https://open.spotify.com/search/Haiku%20Garden%20Bolzano" },
        ],
        venues: [
          { name: "Carambolage, Bolzano",     vibe: "The best live music venue in South Tyrol — small, intimate, genuinely local", genre: "Indie / Folk / Jazz", url: "https://www.carambolage.it" },
          { name: "Rifugio aperitivo hour",    vibe: "Mountain huts do their own version of aperitivo — Aperol Spritz at 1,800m elevation while watching the Tre Cime turn pink", genre: "Alpine ambiance" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/alpine%20folk%20south%20tyrol%20playlist",
      },
      apps: [
        { name: "SüdtirolMobil",        category: "transit",  emoji: "🚌", description: "The official South Tyrol transport app — buses, trains, and cable cars in one place. Covers the entire Dolomite region.", url: "https://www.suedtirolmobil.info", platform: "both" },
        { name: "Trenitalia",           category: "transit",  emoji: "🚄", description: "Train to Bolzano from Venice or Verona — the gateway to the Dolomites. Scenic ride through the Adige valley.", url: "https://www.trenitalia.com", platform: "both" },
        { name: "Dolomiti Superski",    category: "events",   emoji: "⛷️", description: "The official ski pass app — covers 1,200km of pistes across 12 valleys. Buy and reload your card from your phone.", url: "https://www.dolomitisuperski.com", platform: "both" },
        { name: "Komoot",              category: "maps",     emoji: "🗺️", description: "The best hiking navigation app for the Alps — download offline maps of your area before you leave the valley.", url: "https://www.komoot.com", platform: "both" },
        { name: "TheFork",             category: "food",     emoji: "🍽️", description: "Reserve at Michelin-starred mountain restaurants (Stüa de Michil, Ristorante Tivoli) — these book out months ahead in peak season.", url: "https://www.thefork.com", platform: "both" },
      ],
      airportTransfers: [
        { option: "Venice (VCE) → Bolzano/Cortina by car", emoji: "🚗", timeEst: "2.5–3 h", costEst: "€70–110 transfer or rental", recommended: true,  description: "The most flexible option — rent a car in Venice and drive through the mountains. The A27 motorway then Dolomite passes is one of the great drives in Europe.", tip: "Snow chains or winter tyres are legally required October–April. Check the hire car includes them." },
        { option: "Venice (VCE) → Cortina by FlixBus/Cortina Express", emoji: "🚌", timeEst: "2.5–3 h", costEst: "€20–35", recommended: false, description: "Direct seasonal coaches from Venice Marco Polo to Cortina d'Ampezzo — runs daily in summer, reduced in off-season.", tip: "Book the Cortina Express online at least a day ahead — the coach fills fast in July and August." },
        { option: "Innsbruck (INN) → Dolomites by car/train", emoji: "🚄", timeEst: "1.5–2 h", costEst: "€40–80", recommended: false, description: "Often overlooked — Innsbruck airport (Austria) is closer to Cortina and Alta Badia than Venice. Good for pure Dolomite trips without Italian city add-ons." },
      ],
      hiddenGems: [
        { name: "Lago di Braies at dawn",             emoji: "🌅", type: "lake",       description: "The most photographed lake in the Dolomites is genuinely extraordinary — but only before 8am. After that it's bus queues and selfie sticks. Stay nearby and walk down at first light.", sourceUrl: "https://www.dolomiti.org" },
        { name: "Val di Funes church",                emoji: "⛪", type: "viewpoint",  description: "Santa Maddalena church with the Odle massif directly behind it — the single most iconic image of the Dolomites. A 10-minute walk from the car park, empty on weekday mornings." },
        { name: "Castel Roncolo (Bolzano)",           emoji: "🏰", type: "museum",     description: "A medieval castle perched above Bolzano's wine trail, decorated with 14th-century secular frescoes showing courtly life — no religious art, no armies. Remarkably rare.", sourceUrl: "https://www.runkelstein.info" },
        { name: "Alpe di Siusi at golden hour",       emoji: "🌄", type: "landscape",  description: "Europe's largest high-altitude alpine meadow — 56 square kilometres at 1,800m. Take the cable car from Ortisei at 5:30pm and stay for the Enrosadira (the famous Dolomite 'alpenglow')." },
      ],
    },
  },

  // ── Country-level entries ──────────────────────────────────────────────────
  {
    level: "country",
    keywords: ["greece", "athens", "santorini", "mykonos", "crete", "rhodes", "thessaloniki"],
    data: {
      destination: "Greece",
      sceneIntro: "Greece hums after dark in ways the guidebooks skim over. Bouzouki bars hidden in Psiri, rooftop cinemas still showing films al fresco, fishermen's tavernas where the raki arrives unasked-for.",
      events: [
        { name: "Odeon of Herodes Atticus",     emoji: "🎭", type: "theater",  description: "Open-air theatre at the foot of the Acropolis — opera, ballet, and concerts under the stars with arguably the best backdrop on earth.", url: "https://www.theinfatuation.com/athens", tipNote: "Book months ahead for summer performances — these sell out fast." },
        { name: "Monastiraki Flea Market",       emoji: "🛍️", type: "market",   description: "Goes into full swing on Sunday mornings. Dig for vintage lamps, antique icons, leather goods, and outrageously priced coffee. Bargaining is expected.", url: "https://www.timeout.com/athens/shopping/monastiraki-flea-market" },
        { name: "Rebetiko nights in Psiri",      emoji: "🎸", type: "music",    description: "Rebetiko is Greece's answer to the blues — soulful bouzouki music born in the tavernas of Piraeus. Stoa Athanaton (Athens) and To Palio Tetradio are the real deal.", tipNote: "Go late — things don't start warming up until midnight." },
        { name: "Athens & Epidaurus Festival",   emoji: "🎪", type: "festival", description: "June–August. Ancient theatres host international acts — from the Berlin Philharmonic to contemporary dance companies.", url: "https://greekfestival.gr" },
        { name: "Cine Thision open-air cinema",  emoji: "🎬", type: "art",      description: "A rooftop cinema in Thission where you watch films with the Acropolis lit up behind the screen. Pure magic. Bring a jumper for late summer.", url: "https://www.cinethision.gr" },
        { name: "Captain Corelli's Mandolin island", emoji: "📖", type: "literary", description: "The novel is set on Kefalonia — visit the village of Assos and the Drogarati cave that featured in the story. Louis de Bernières fans make pilgrimages." },
      ],
      music: {
        intro: "Greek music is having a moment. Laïka pop — a melodic mix of traditional and contemporary — is everywhere, while a new wave of electronic producers is putting Athens on the club map alongside Ibiza and Berlin.",
        artists: [
          { name: "Stavros Xarchakos",  genre: "Laïka / classical", why: "The composer behind Rembetiko — his orchestral folk work defined a generation.",  searchUrl: "https://open.spotify.com/search/Stavros%20Xarchakos" },
          { name: "Haris Alexiou",      genre: "Laïka",             why: "The reigning queen of Greek popular music — emotional, powerful, unmistakably Greek.", searchUrl: "https://open.spotify.com/search/Haris%20Alexiou" },
          { name: "Baby Guru",          genre: "Greek indie rock",   why: "Athens indie darlings — great for understanding the city's cooler, younger side.",   searchUrl: "https://open.spotify.com/search/Baby%20Guru%20Greek" },
          { name: "Giannis Haroulis",   genre: "Neo-folk / Rembetiko", why: "The keeper of the Rembetiko flame — seeing him live is a bucket-list moment.",   searchUrl: "https://open.spotify.com/search/Giannis%20Haroulis" },
        ],
        venues: [
          { name: "Stoa Athanaton",    vibe: "Time-warp Rembetiko taverna in the Central Market", genre: "Rembetiko / Laïka", url: "https://www.theinfatuation.com/athens" },
          { name: "Six D.O.G.S",       vibe: "Courtyard arts space in Monastiraki — great for indie and electronic acts", genre: "Indie / Electronic", url: "https://www.sixdogs.gr" },
          { name: "Gazarte",           vibe: "Rooftop bar + live music with Acropolis views", genre: "Mixed / Pop", url: "https://www.gazarte.gr" },
          { name: "Venue",             vibe: "Athens' best club for international DJs", genre: "Electronic / Techno", url: "https://ra.co/clubs/venue-athens" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/greek%20laika%20playlist",
      },
      apps: [
        { name: "OASA Telematics", category: "transit",   emoji: "🚌", description: "Athens bus and trolley real-time tracking. Essential for navigating the city without a car.", url: "https://telematics.oasa.gr", platform: "both" },
        { name: "Beat",            category: "taxi",      emoji: "🚕", description: "The dominant rideshare app in Greece — think Uber but actually works everywhere here.", url: "https://thebeat.co", platform: "both" },
        { name: "e-food",          category: "food",      emoji: "🛵", description: "Greece's #1 food delivery app — restaurants that don't appear elsewhere often list here.", url: "https://www.e-food.gr", platform: "both" },
        { name: "Google Translate (Greek pack)", category: "language", emoji: "🗣️", description: "Download the Greek offline pack — menus in small villages won't be in English.", url: "https://translate.google.com", platform: "both" },
        { name: "Timeout Athens",  category: "events",    emoji: "🎟️", description: "The best English-language guide to what's on — gigs, openings, pop-ups, rooftop bars.", url: "https://www.timeout.com/athens", platform: "both" },
      ],
      airportTransfers: [
        { option: "Metro (Line 3)", emoji: "🚇", timeEst: "40–50 min", costEst: "€10", recommended: true, description: "Direct from Athens International (Eleftherios Venizelos) to Syntagma or Monastiraki. Clean, reliable, runs until midnight.", tip: "Validate your ticket before boarding — inspectors are active." },
        { option: "Express Bus (X95)", emoji: "🚌", timeEst: "50–70 min", costEst: "€6", recommended: false, description: "Runs 24 hours to Syntagma Square — good for very early or late arrivals. Slower than the metro in traffic.", tip: "Avoid during morning rush (7–9am) — can take over 90 minutes." },
        { option: "Taxi", emoji: "🚕", timeEst: "35–50 min", costEst: "€38–€55", recommended: false, description: "Fixed fare to central Athens (set by law). Use only official yellow cabs from the designated rank — don't accept touts inside the terminal.", tip: "The fixed rate is €38 daytime, €54 at night (midnight–5am). Confirm the rate before you get in." },
        { option: "Private Transfer", emoji: "🚐", timeEst: "35–45 min", costEst: "€50–€80", recommended: false, description: "Meet-and-greet in arrivals. Worth it for families or groups, or if you're arriving after midnight.", tip: "Book through your hotel or a vetted service like Welcome Pickups." },
      ],
      hiddenGems: [
        { name: "Anafiotika",               emoji: "🏡", type: "neighbourhood", description: "A tiny Cycladic village magically transplanted onto the slopes of the Acropolis. 45 houses, cats everywhere, zero tourists at 8am.", sourceUrl: "https://www.timeout.com/athens/things-to-do/anafiotika" },
        { name: "National Garden after dark", emoji: "🌿", type: "park",         description: "Athens' secret evening retreat — locals walk here after dinner when temperatures drop. The tortoises are real and very slow." },
        { name: "To Kati Allo",              emoji: "☕", type: "café",          description: "A bohemian bookshop-café in Exarchia that hosts poetry readings and philosophy nights. Regulars include professors and artists, not tour groups." },
      ],
    },
  },

  {
    level: "country",
    keywords: ["italy", "rome", "florence", "tuscany", "venice", "milan", "naples", "amalfi", "sicily", "bologna"],
    data: {
      destination: "Italy",
      sceneIntro: "Italy doesn't do nightlife early — dinner begins at 9pm, the aperitivo hour is sacred, and the best jazz bar in Rome closes whenever it feels like it. Plan accordingly, and plan to love it.",
      events: [
        { name: "Aperitivo hour",                emoji: "🍹", type: "food",     description: "5–8pm across every Italian city. Order a Negroni or Aperol Spritz and the bar typically lays out free snacks. In larger cities, some bars turn aperitivo into a full buffet dinner.", tipNote: "Ask locals where they actually go — the tourist-facing bars charge twice as much for half the spread." },
        { name: "Arena di Verona opera festival", emoji: "🎼", type: "theater",  description: "June–September, in a 2,000-year-old Roman amphitheatre. They perform Aida and Verdi here under the stars — it's as operatic as opera gets.", url: "https://www.arena.it" },
        { name: "Testaccio Market, Rome",         emoji: "🧀", type: "market",   description: "Rome's best covered market — not the tourist one. Go early for vendors selling tripe sandwiches, hand-rolled pasta, and the cheapest espresso in the city.", url: "https://www.timeout.com/rome" },
        { name: "Mercato Centrale, Florence",     emoji: "🥩", type: "market",   description: "San Lorenzo's sprawling food hall — Florentine steak, lampredotto (tripe) sandwiches, and a rooftop dining floor with great pasta.", url: "https://www.mercatocentrale.it" },
        { name: "Estate Romana",                  emoji: "🎪", type: "festival", description: "Rome's summer festival (June–September) turns piazzas, ruins, and riverside promenades into open-air cinema, concert, and dance venues.", url: "https://www.estateromana.comune.roma.it" },
        { name: "Elena Ferrante's Naples",        emoji: "📖", type: "literary", description: "The Neapolitan Novels are set in the Rione Luzzatti neighbourhood — a gritty, vibrant area rarely visited by tourists. Walking the streets feels like being inside the books.", url: "https://www.timeout.com/naples" },
        { name: "Discoteca Lanificio, Rome",      emoji: "💃", type: "dance",    description: "Rome's best club for serious dancing — in a former wool factory. Resident DJs + occasional live jazz nights. The aperitivo hour here is peak Rome cool." },
      ],
      music: {
        intro: "Italy's music scene runs deeper than Puccini (though Puccini in the right setting will undo you). The contemporary scene blends indie-cantautorato (singer-songwriters), electronic music from Rome and Milan, and a booming neo-soul scene.",
        artists: [
          { name: "Lucio Battisti",  genre: "Italian pop / cantautore", why: "The godfather of modern Italian pop — his 70s albums are essential listening for the drive through Tuscany.", searchUrl: "https://open.spotify.com/search/Lucio%20Battisti" },
          { name: "Calcutta",        genre: "Italian indie pop",        why: "The defining voice of millennial Italy — melodic, wistful, and best heard in a bar in Trastevere.",          searchUrl: "https://open.spotify.com/search/Calcutta%20Italian" },
          { name: "Mahmood",         genre: "Pop / R&B",                why: "Milan-born, Milan-cool — his 2019 Eurovision entry was better than winning would have been.",               searchUrl: "https://open.spotify.com/search/Mahmood" },
          { name: "Antonello Venditti", genre: "Cantautore / Roman rock", why: "The poet of Rome. Playing 'Roma Capoccia' in a car approaching the city gives you chills.",             searchUrl: "https://open.spotify.com/search/Antonello%20Venditti" },
        ],
        venues: [
          { name: "Alexanderplatz Jazz Club", vibe: "Rome's oldest jazz institution — intimate, serious, brilliant", genre: "Jazz", url: "https://www.alexanderplatzjazz.com" },
          { name: "Pigneto neighbourhood bars", vibe: "Rome's coolest local neighbourhood — great live indie music and no tourists", genre: "Indie / Alternative" },
          { name: "Blue Note Milan",            vibe: "World-class jazz in a proper venue — Milan's premier music institution", genre: "Jazz / Blues", url: "https://www.bluenotemilano.com" },
          { name: "Tenax, Florence",            vibe: "Florence's best club — legendary electronic music nights in an industrial space", genre: "Electronic / Techno", url: "https://www.tenax.org" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/italian%20cantautori%20playlist",
      },
      apps: [
        { name: "Trenitalia",    category: "transit",  emoji: "🚄", description: "Book trains between cities — essential for Italy travel. Download tickets to your phone in case of spotty signal.", url: "https://www.trenitalia.com", platform: "both" },
        { name: "italo",         category: "transit",  emoji: "🚅", description: "High-speed rail alternative to Trenitalia — often cheaper on the Rome–Milan–Naples corridor.", url: "https://www.italotreno.it", platform: "both" },
        { name: "FREE NOW",      category: "taxi",     emoji: "🚕", description: "The main licensed taxi app across Italian cities. Use this over hailing a cab — metered, receipt confirmed.", url: "https://free-now.com", platform: "both" },
        { name: "TheFork",       category: "food",     emoji: "🍽️", description: "Restaurant reservations across Italy — many popular spots only take bookings through this.", url: "https://www.thefork.com", platform: "both" },
        { name: "Musei in Comune", category: "events", emoji: "🏛️", description: "Rome's official app for city museums — book timed entries for the Borghese, Capitoline, and others.", url: "https://www.museiincomuneroma.it", platform: "both" },
      ],
      airportTransfers: [
        { option: "Leonardo Express (FCO → Roma Termini)", emoji: "🚄", timeEst: "32 min", costEst: "€14", recommended: true, description: "Direct non-stop train from Fiumicino Airport to Roma Termini. Runs every 15 minutes, 6am–11:30pm. The obvious choice for central Rome.", tip: "Buy tickets at self-service machines — the queues at manned desks can be long." },
        { option: "Regional Train (FCO → Trastevere/Ostiense)", emoji: "🚉", timeEst: "45 min", costEst: "€8", recommended: false, description: "Slower but cheaper — stops at Trastevere and Ostiense before Termini. Good if your hotel is in those areas.", tip: "Validate your ticket on the platform — not doing so risks a fine." },
        { option: "Licensed Taxi", emoji: "🚕", timeEst: "45–60 min", costEst: "€48 (fixed fare)", recommended: false, description: "Fixed rate of €48 from FCO to central Rome. Only use official white taxis from the designated rank — touts inside arrivals charge double.", tip: "Confirm '€48 fixed fare' before getting in. Night surcharge applies after 10pm." },
        { option: "Terravision / SIT Bus (FCO)", emoji: "🚌", timeEst: "60–80 min", costEst: "€6–7", recommended: false, description: "Budget option to Termini — slower but the cheapest way in. Good for travellers with light luggage.", tip: "Buy online for the best price — on the day it costs more." },
      ],
      hiddenGems: [
        { name: "Quartiere Coppedè, Rome",    emoji: "✨", type: "architecture", description: "A fairytale neighbourhood near Villa Borghese that most visitors never find — art nouveau and baroque buildings so fantastical they look CGI.", sourceUrl: "https://www.theinfatuation.com/rome" },
        { name: "Drogheria, Florence",         emoji: "🍷", type: "bar",          description: "A tiny natural wine bar in Santo Spirito that fills up with locals at 7pm. No menu — the owner picks what you drink based on your mood." },
        { name: "San Miniato al Monte at dusk",emoji: "🌅", type: "viewpoint",    description: "The best view of Florence isn't from the Piazzale Michelangelo (too crowded) — it's from the steps of this Romanesque church 10 minutes further up the hill." },
        { name: "Libreria Acqua Alta, Venice", emoji: "📚", type: "bookshop",     description: "Books stacked in gondolas, bathtubs and boats, with a staircase made of books leading to a canal view. Famously eccentric, genuinely wonderful.", sourceUrl: "https://www.timeout.com/venice" },
      ],
    },
  },

  {
    level: "country",
    keywords: ["france", "paris", "lyon", "bordeaux", "marseille", "nice", "provence"],
    data: {
      destination: "France",
      sceneIntro: "Paris invented the concept of doing nothing beautifully — sitting in a café for three hours with one coffee is not laziness, it's cultural participation. Lean in.",
      events: [
        { name: "Fête de la Musique",           emoji: "🎶", type: "festival", description: "Every June 21st, every street in France becomes a concert. Free, spontaneous, and extraordinary — from jazz in courtyards to classical in churches.", url: "https://www.fetedelamusique.culture.fr", tipNote: "The Marais and Saint-Germain become one enormous outdoor festival." },
        { name: "Nuit Blanche",                 emoji: "🌃", type: "art",      description: "October in Paris — one night where museums, galleries, and public spaces stay open all night with free contemporary art installations.", url: "https://www.paris.fr/nuitblanche" },
        { name: "Marché d'Aligre",              emoji: "🥖", type: "market",   description: "Paris's best and least touristy market — produce, flea market next door, and a covered hall where you can drink wine at 10am without judgement.", url: "https://www.timeout.com/paris/en/restaurants-bars/marche-daligre" },
        { name: "Le Bal Blomet",                emoji: "💃", type: "dance",    description: "A 1920s jazz club where they still teach salsa and swing on weekends. One of the last authentic bals musettes in Paris.", url: "https://www.lebalblomet.com" },
        { name: "Shakespeare and Company, Paris", emoji: "📖", type: "literary", description: "The legendary English bookshop by the Seine — readings, literary events, and the ghost of Hemingway on every shelf. The tumbleweed writers who live here are real.", url: "https://shakespeareandcompany.com" },
        { name: "Cinéma en Plein Air",           emoji: "🎬", type: "art",      description: "Free open-air cinema in La Villette park (July–August). Bring a picnic, lie on the grass, and watch classic films projected against the Géode.", url: "https://www.villette.com" },
      ],
      music: {
        intro: "Paris has always been where musicians come to reinvent themselves — Django Reinhardt invented jazz manouche here, Édith Piaf sang it into dust, and the new generation of French artists is quietly redefining what pop means in Europe.",
        artists: [
          { name: "Angèle",          genre: "Belgian pop / indie", why: "The French-language artist who crossed over to global audiences — catchy, smart, and utterly European.", searchUrl: "https://open.spotify.com/search/Ang%C3%A8le" },
          { name: "Stromae",         genre: "Electro-pop",         why: "Brussels-born but claimed by all Francophones — his music video for 'Formidable' is essential Paris viewing.", searchUrl: "https://open.spotify.com/search/Stromae" },
          { name: "Flavien Berger",  genre: "French electronic",   why: "The sound of late-night Paris — melancholic, euphoric, and best heard walking along the Seine at 2am.", searchUrl: "https://open.spotify.com/search/Flavien%20Berger" },
          { name: "Pomme",           genre: "French folk / indie",  why: "Delicate, poetic, acoustic — what French music sounds like when it's being its most genuinely French.", searchUrl: "https://open.spotify.com/search/Pomme%20French" },
        ],
        venues: [
          { name: "La Cigale",          vibe: "Art nouveau concert hall in Pigalle — the perfect mid-size venue", genre: "Mixed / Indie / Rock", url: "https://www.lacigale.fr" },
          { name: "Café de la Danse",   vibe: "Intimate standing venue in Bastille — brilliant for discovering new acts", genre: "Indie / Alternative", url: "https://www.cafedeladanse.com" },
          { name: "Jazz Club Étoile",   vibe: "Traditional jazz in the 17th arrondissement — dinner and live music combo", genre: "Jazz", url: "https://www.lemeridienplus.com" },
          { name: "Le Rex Club",        vibe: "The flagship Paris techno institution — serious sound system, serious DJs", genre: "Electronic / Techno", url: "https://www.rexclub.com" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/french%20indie%20playlist%202024",
      },
      apps: [
        { name: "RATP",         category: "transit",  emoji: "🚇", description: "Paris metro, RER, bus — journey planning, real-time updates, and mobile tickets. Download before you land.", url: "https://www.ratp.fr", platform: "both" },
        { name: "Uber / Bolt",  category: "taxi",     emoji: "🚕", description: "Both work in Paris. G7 Taxi is the licensed alternative (07 27 66 99 99) and often faster at busy times.", url: "https://bolt.eu", platform: "both" },
        { name: "La Fourchette (TheFork)", category: "food", emoji: "🍽️", description: "Restaurant reservations in France — many Parisian restaurants won't accept walk-ins and only book through this.", url: "https://www.lafourchette.com", platform: "both" },
        { name: "Paris Musées", category: "events",   emoji: "🖼️", description: "Book timed entry to Paris city museums — includes the Musée Carnavalet and Petit Palais (both free).", url: "https://www.parismusees.paris.fr", platform: "both" },
        { name: "Vélib'",       category: "transit",  emoji: "🚴", description: "Paris's excellent bike-share system — faster than the metro for many journeys and weirdly enjoyable.", url: "https://www.velib-metropole.fr", platform: "both" },
      ],
      airportTransfers: [
        { option: "RER B (CDG → central Paris)", emoji: "🚇", timeEst: "35–45 min", costEst: "€11.80", recommended: true, description: "Direct train from CDG to Châtelet-Les Halles, Gare du Nord, Saint-Michel. Runs every 10–15 minutes. The logical choice for central Paris.", tip: "Don't use your regular Navigo pass for the airport — buy a specific CDG ticket." },
        { option: "Le Bus Direct (Roissy Bus)", emoji: "🚌", timeEst: "60–75 min", costEst: "€17", recommended: false, description: "Coaches directly to Opera, Trocadéro, Gare Montparnasse, and Gare de Lyon. Comfortable, luggage-friendly — good if your hotel is near these stops.", tip: "Slower in traffic but much more comfortable than the RER with large bags." },
        { option: "Taxi", emoji: "🚕", timeEst: "45–60 min", costEst: "€50–€55 (fixed)", recommended: false, description: "Fixed fare from CDG to Right Bank (€50) or Left Bank (€55). Only official taxis — white or black cars, licensed rank outside arrivals. No negotiation needed.", tip: "Fixed fares are set by law. If a driver tries to negotiate, find another cab." },
        { option: "Orlyval + RER B (ORY)", emoji: "🚄", timeEst: "35 min", costEst: "€13", recommended: true, description: "From Orly Airport — the Orlyval shuttle connects to the RER B at Antony for a direct ride into central Paris.", tip: "A combined Orlyval + RER B ticket is available at the airport." },
      ],
      hiddenGems: [
        { name: "Promenade Plantée",           emoji: "🌳", type: "park",          description: "The original elevated park that inspired New York's High Line — a disused railway viaduct turned into a tree-lined walkway above the 12th arrondissement. You may have it almost to yourself.", sourceUrl: "https://www.timeout.com/paris/en/attractions/promenade-plantee" },
        { name: "Marché Dauphine, Saint-Ouen", emoji: "🖼️", type: "flea market",  description: "The art and antiques section of the Paris flea markets — where galleries and auction houses source their finds. Saturday morning only.", sourceUrl: "https://www.marchesaintouen.com" },
        { name: "La REcyclerie",                emoji: "♻️", type: "bar/café",     description: "A former railway station transformed into a zero-waste café, urban farm, and repair workshop near Porte de Clignancourt. Paris's coolest brunch spot that tourists haven't found yet.", sourceUrl: "https://www.larecyclerie.com" },
      ],
    },
  },

  {
    level: "country",
    keywords: ["spain", "barcelona", "madrid", "seville", "granada", "valencia", "bilbao"],
    data: {
      destination: "Spain",
      sceneIntro: "Spain operates on its own timezone — lunch at 3pm, dinner at 10pm, and the clubs don't hit their stride until 2am. If you fight the schedule, you'll miss the best of it. If you surrender to it, you'll never want to leave.",
      events: [
        { name: "Tablao flamenco",        emoji: "💃", type: "dance",    description: "Not the tourist show at the theatre — find a tablao in a barrio (Triana in Seville, La Latina in Madrid). Small room, close quarters, and the kind of raw performance that makes the hair on your arms stand up.", tipNote: "Ask your hotel concierge where locals actually go — the quality varies wildly." },
        { name: "La Boqueria, Barcelona", emoji: "🍓", type: "market",   description: "Go early (7–9am) before the tourist hordes arrive. This is when the local chefs shop. The best pintxos bar in the market has a queue of chefs at it.", url: "https://www.boqueria.barcelona" },
        { name: "El Rastro, Madrid",      emoji: "🛒", type: "market",   description: "Sunday flea market snaking through La Latina — 3,500 stalls of antiques, junk, vintage clothing, and oddities. The bars around Plaza del Cascorro open at 9am to serve vermouth to market-goers.", url: "https://www.elrastro.org" },
        { name: "Primavera Sound",        emoji: "🎵", type: "festival", description: "Barcelona's world-class music festival (May/June) — always one of the best lineups in Europe. Day tickets usually available even when the festival is sold out.", url: "https://www.primaverasound.com" },
        { name: "Carlos Ruiz Zafón's Barcelona", emoji: "📖", type: "literary", description: "The Shadow of the Wind is set in the El Born neighbourhood — visit Carrer d'Elisabets, the Palau de la Música, and the old Barrio Gótico that Zafón used as his canvas.", url: "https://www.timeout.com/barcelona" },
        { name: "Nit de Foc — Verbena de Sant Joan", emoji: "🎆", type: "festival", description: "June 23rd: the eve of Sant Joan. Every beach and park in Catalonia erupts in fireworks and bonfires all night. Completely spontaneous, completely Spanish." },
      ],
      music: {
        intro: "Spain's music is as regionally diverse as its food — flamenco in Andalusia, rumba catalana in Barcelona, and a booming urban Latin scene centred on Madrid that's producing some of the most-streamed Spanish-language music in the world.",
        artists: [
          { name: "Rosalía",     genre: "Flamenco fusion / pop",  why: "Barcelona's gift to global music — her reinvention of flamenco earned a Grammy and changed what Spanish pop could be.", searchUrl: "https://open.spotify.com/search/Rosal%C3%ADa" },
          { name: "C. Tangana",  genre: "Urban / Latin pop",       why: "Madrid's most interesting pop star — his Almaselo album blends flamenco, bolero, and trap in a way nobody thought possible.", searchUrl: "https://open.spotify.com/search/C.%20Tangana" },
          { name: "Peret",       genre: "Rumba catalana",          why: "The king of Catalan rumba — a Barcelona original who blended flamenco and Cuban rhythms. Hearing it in a bar in El Born is essential.", searchUrl: "https://open.spotify.com/search/Peret%20Rumba%20Catalana" },
          { name: "Camarón de la Isla", genre: "Flamenco",         why: "The greatest flamenco voice ever recorded. Listening to him on the drive to Seville is not optional.", searchUrl: "https://open.spotify.com/search/Camar%C3%B3n%20de%20la%20Isla" },
        ],
        venues: [
          { name: "Razzmatazz, Barcelona", vibe: "Five rooms, five genres — the definitive Barcelona megaclub in a converted industrial space", genre: "Electronic / Indie", url: "https://www.salarazzmatazz.com" },
          { name: "Sala El Sol, Madrid",   vibe: "The birthplace of La Movida — intimate venue dripping in rock history", genre: "Indie / Rock / Spanish pop", url: "https://www.elsol.es" },
          { name: "Casa Patas, Madrid",    vibe: "The most respected flamenco tablao in the capital — serious artists, serious audiences", genre: "Flamenco", url: "https://www.casapatas.com" },
          { name: "Moog, Barcelona",       vibe: "Tiny basement club in the Raval — legendary electronic music, no attitude", genre: "Electronic / Techno" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/flamenco%20nuevo%20playlist",
      },
      apps: [
        { name: "TMB (Barcelona metro)", category: "transit",  emoji: "🚇", description: "Barcelona metro, bus, and tram real-time info. Buy T-Casual 10-trip cards in app — much cheaper than single tickets.", url: "https://www.tmb.cat", platform: "both" },
        { name: "EMT Madrid",            category: "transit",  emoji: "🚌", description: "Madrid bus and metro journey planner — integrates with Cercanías commuter trains.", url: "https://www.emtmadrid.es", platform: "both" },
        { name: "Cabify",                category: "taxi",     emoji: "🚕", description: "The dominant licensed rideshare in Spain — more reliable than taxis for airport runs.", url: "https://cabify.com", platform: "both" },
        { name: "El Tenedor (TheFork)", category: "food",     emoji: "🍽️", description: "Restaurant reservations Spain-wide. Essential for popular restaurants in Barcelona where walk-ins are near impossible.", url: "https://www.eltenedor.es", platform: "both" },
        { name: "Renfe",                 category: "transit",  emoji: "🚄", description: "Spain's national rail — book AVE high-speed trains between cities early (prices double close to departure).", url: "https://www.renfe.com", platform: "both" },
      ],
      airportTransfers: [
        { option: "Aerobus (BCN → Barcelona centre)", emoji: "🚌", timeEst: "35 min", costEst: "€6.75", recommended: true, description: "Express bus from El Prat to Plaça Catalunya — runs every 5–10 minutes, 5am–1am. Drop your bags and you're in the heart of the city.", tip: "Buy return ticket upfront for a slight discount." },
        { option: "Metro L9 Sud (BCN)", emoji: "🚇", timeEst: "45–55 min", costEst: "€5.15 (airport supplement)", recommended: false, description: "Requires a connection — slower than the Aerobus. Only makes sense if your hotel is directly on the L9 or L1 line.", tip: "You need to add an airport supplement to your regular card." },
        { option: "Metro (MAD → Madrid centre)", emoji: "🚇", timeEst: "25–40 min", costEst: "€5 (airport supplement)", recommended: true, description: "Barajas Line 8 connects directly to Nuevos Ministerios in central Madrid. Clean, fast, reliable.", tip: "The €3 airport supplement is added to your single or multi-trip ticket." },
        { option: "Licensed Taxi (Madrid)", emoji: "🚕", timeEst: "20–40 min", costEst: "€30–€40", recommended: false, description: "Fixed rate of €30 from any terminal to central Madrid. Official white cabs with red stripe only.", tip: "No need to negotiate — the fixed rate is mandated." },
      ],
      hiddenGems: [
        { name: "El Xampanyet, Barcelona",    emoji: "🥂", type: "bar",          description: "A cava bar in El Born that hasn't changed since the 1920s — the house cava is under €3 a glass and the anchovies are revelatory.", sourceUrl: "https://www.theinfatuation.com/barcelona" },
        { name: "Mercado de San Fernando",    emoji: "🛒", type: "market",       description: "Madrid's Lavapiés neighbourhood market — local, diverse, zero tourists, and the best falafel in the city in the stalls outside.", sourceUrl: "https://www.mercadodesanfernando.com" },
        { name: "Tibidabo fairground, BCN",   emoji: "🎡", type: "experience",   description: "A 1909 amusement park on the hill above Barcelona — the rides are gloriously antique and the views of the city are better than any lookout point.", sourceUrl: "https://www.tibidabo.cat" },
      ],
    },
  },

  {
    level: "country",
    keywords: ["japan", "tokyo", "kyoto", "osaka", "hiroshima", "nara", "hakone"],
    data: {
      destination: "Japan",
      sceneIntro: "Japan has a culture of craft — the ramen shop that's been perfecting one broth for 40 years, the jazz bar owner who's curated the same vinyl collection since 1973, the izakaya where the menu is entirely dependent on what came in from the fish market that morning. Seek these places.",
      events: [
        { name: "Ohanami (cherry blossom picnics)", emoji: "🌸", type: "festival", description: "Late March–early April: families and colleagues spread tarps under the sakura and drink, eat, and sing. Shinjuku Gyoen and Ueno Park in Tokyo, Maruyama Park in Kyoto. Join rather than observe.", tipNote: "Weekday mornings are much calmer than weekends. Some parks require tickets." },
        { name: "Sumo morning practice",            emoji: "🏟️", type: "sport",    description: "Watch professional wrestlers train (asa-geiko) at a stable in Ryogoku, Tokyo — free, close-up, and completely different from the tournament. Apply in advance through your hotel.", url: "https://www.timeout.com/tokyo", tipNote: "You must arrange this in advance — walk-ins are not permitted at most stables." },
        { name: "Golden Gai, Tokyo",                emoji: "🍶", type: "music",    description: "A labyrinth of 200 micro-bars in Shinjuku, each holding 5–8 people. Many specialise — vinyl jazz, cult cinema, punk music. The bartender picks the music and you listen.", tipNote: "Cover charges (usually ¥500–¥1,000) are normal. Don't be put off — they keep the pretenders out." },
        { name: "Noh theatre at Kongo Noh Stage",   emoji: "🎭", type: "theater",  description: "The world's oldest continuously performed theatrical tradition. Kyoto's Kongo school is the most traditional — silent, strange, and absolutely hypnotic.", url: "https://www.kongou-net.com" },
        { name: "Ozu Yasujiro's Tokyo",             emoji: "📖", type: "literary", description: "The director's films — Late Spring, Tokyo Story — are set in the working-class neighbourhoods of Kamata, Omori, and Ofuna. Walking these areas with his films in mind gives you a completely different city." },
        { name: "Koenji Sunday antique market",     emoji: "🏮", type: "market",   description: "Tokyo's most characterful flea market — vintage kimono, antique ceramics, and mid-century Japanese objects. The neighbourhood around it is the city's indie music heartland." },
      ],
      music: {
        intro: "Japan's music culture is obsessive in the best way — there are jazz bars here that have been playing the same genre since 1965 without irony, city pop is having a global renaissance 40 years late, and the live idol and indie scenes are unlike anything in the world.",
        artists: [
          { name: "Haruomi Hosono",   genre: "City pop / ambient / experimental", why: "The architect of Japanese ambient music and city pop — his 1970s and 80s work sounds startlingly current.", searchUrl: "https://open.spotify.com/search/Haruomi%20Hosono" },
          { name: "Mariya Takeuchi", genre: "City pop",  why: "'Plastic Love' has over 100 million streams — the song the algorithm rediscovered and the world fell in love with.", searchUrl: "https://open.spotify.com/search/Mariya%20Takeuchi" },
          { name: "Kenshi Yonezu",   genre: "J-pop / indie", why: "The defining voice of contemporary Japanese pop — his film soundtracks (Lemon, Paprika) are cultural events.", searchUrl: "https://open.spotify.com/search/Kenshi%20Yonezu" },
          { name: "Suchmos",         genre: "City pop revival / funk", why: "The band that led the city pop revival — their Toyota commercial introduced a generation to the genre.", searchUrl: "https://open.spotify.com/search/Suchmos" },
        ],
        venues: [
          { name: "Blue Note Tokyo",    vibe: "World-class jazz in Minami-Aoyama — international headliners, exceptional sound", genre: "Jazz", url: "https://www.bluenote.co.jp" },
          { name: "Shinjuku Pit Inn",   vibe: "Tokyo's most important jazz venue since 1966 — serious music, no frills, all soul", genre: "Jazz / Avant-garde", url: "https://pit-inn.com" },
          { name: "Womb, Tokyo",        vibe: "Tokyo's legendary techno club — four floors, exceptional sound, open until 7am", genre: "Electronic / Techno", url: "https://www.womb.co.jp" },
          { name: "Unknwon (Koenji)",   vibe: "Underground indie venue in Koenji — where Tokyo's alternative music scene actually lives", genre: "Indie / Punk" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/japanese%20city%20pop%20playlist",
      },
      apps: [
        { name: "Suica / Pasmo",    category: "transit",  emoji: "🚇", description: "IC card for all Tokyo transit — metro, JR trains, buses, and even convenience store purchases. Load it on Apple Pay or Google Pay before you land.", url: "https://www.jreast.co.jp/e/pass/suica.html", platform: "both" },
        { name: "Hyperdia",         category: "transit",  emoji: "🚄", description: "Train and Shinkansen journey planner — more reliable than Google Maps for Japan rail routing.", url: "https://www.hyperdia.com", platform: "both" },
        { name: "GO (タクシーアプリGO)", category: "taxi", emoji: "🚕", description: "Japan's main taxi app — book licensed cabs with English support. Much easier than flagging one in Tokyo.", url: "https://go.goinc.jp", platform: "both" },
        { name: "Tabelog",          category: "food",     emoji: "🍜", description: "Japan's definitive restaurant review site — trust scores over 3.5. English version available.", url: "https://tabelog.com", platform: "both" },
        { name: "PayPay",           category: "payment",  emoji: "💴", description: "Japan's dominant QR code payment app — accepted at millions of vendors who don't take foreign cards. Set up with your card before arrival.", url: "https://paypay.ne.jp", platform: "both" },
      ],
      airportTransfers: [
        { option: "Narita Express (N'EX)", emoji: "🚄", timeEst: "55–80 min", costEst: "¥3,070", recommended: true, description: "Direct from Narita to Shinjuku, Shibuya, and Tokyo station. Reserved seating, luggage storage, seamless.", tip: "The N'EX round-trip pass for foreign visitors is excellent value at ¥4,000." },
        { option: "Keisei Skyliner (Narita → Ueno)", emoji: "🚅", timeEst: "41 min", costEst: "¥2,520", recommended: true, description: "Fastest option from Narita to central Tokyo — arrives at Ueno (great area to stay). Cheaper and faster than the N'EX for this route.", tip: "Best option if your hotel is in the Ueno/Akihabara area." },
        { option: "Limousine Bus (Narita)", emoji: "🚌", timeEst: "75–110 min", costEst: "¥3,200", recommended: false, description: "Direct buses to major hotels in Tokyo — excellent for heavy luggage. Slower in traffic but drops you right at the hotel entrance.", tip: "Book online for guaranteed seat — popular buses do sell out." },
        { option: "Keikyu + Tokyo Monorail (HND → central)", emoji: "🚝", timeEst: "25–35 min", costEst: "¥500–¥700", recommended: true, description: "Haneda Airport is much closer to central Tokyo — the Keikyu line to Shinagawa is fast and cheap.", tip: "Haneda is the domestic airport that handles some international flights — always check which airport before booking." },
      ],
      hiddenGems: [
        { name: "Yanaka neighbourhood",        emoji: "🏘️", type: "neighbourhood", description: "Tokyo's best-preserved Edo-era neighbourhood — temples, cats, independent shops, and a cemetery that's also a park. Completely untouched by development.", sourceUrl: "https://www.timeout.com/tokyo/things-to-do/yanaka" },
        { name: "Tsukiji outer market",        emoji: "🐟", type: "market",         description: "The inner tuna auction moved, but the outer market — chefs' knives, tamagoyaki breakfast, fresh fish on sticks — remains and is unmissable at 6am.", sourceUrl: "https://www.tsukiji.or.jp" },
        { name: "Nishiki Market, Kyoto",       emoji: "🥢", type: "market",         description: "A five-block covered market called 'Kyoto's Kitchen' — pickled vegetables, tofu doughnuts, fresh mochi, and grilled skewers at every turn.", sourceUrl: "https://www.timeout.com/kyoto" },
        { name: "Bar Martha, Kyoto",           emoji: "🎵", type: "bar",             description: "A tiny jazz bar in a machiya townhouse in Gion where the owner plays vinyl on a custom turntable. Tables for four. Perfect." },
      ],
    },
  },

  {
    level: "country",
    keywords: ["uk", "london", "england", "scotland", "edinburgh", "manchester", "bath", "oxford", "cambridge"],
    data: {
      destination: "United Kingdom",
      sceneIntro: "London has more live music venues per square mile than any city on earth, and half of them are in basements you'd never find without a local. The pub is not a drinking establishment — it's the civic infrastructure. Everything else follows from there.",
      events: [
        { name: "Rough Trade East on a Saturday", emoji: "🎵", type: "music",    description: "The best record shop in London does free in-store gigs on Saturday afternoons — you can find yourself three feet from an artist with 50,000 monthly Spotify listeners in front of 80 people.", url: "https://www.roughtrade.com", tipNote: "Shows are usually announced mid-week on their social channels." },
        { name: "Borough Market",                  emoji: "🧇", type: "market",   description: "Thursday–Saturday. The cheesemongers, fishmongers, and bakers who supply half the restaurants in London set up here. Go hungry. Arrive before 10am.", url: "https://boroughmarket.org.uk" },
        { name: "Portobello Road Market",          emoji: "🎨", type: "market",   description: "Saturday morning — the antique section runs from Notting Hill Gate to Ladbroke Grove. Arrive at 8am for the dealers; by 11am it's tourists.", url: "https://www.portobelloroad.co.uk" },
        { name: "Proms at the Royal Albert Hall",  emoji: "🎻", type: "theater",  description: "July–September: the BBC Proms is one of the world's great classical music festivals. Arena (standing) tickets cost £8 — line up for the best spots.", url: "https://www.bbc.co.uk/proms" },
        { name: "Edinburgh Festival Fringe",       emoji: "🎭", type: "festival", description: "August: the world's largest arts festival transforms Edinburgh into one giant venue — 3,500 shows in 300 spaces. Free shows on the Royal Mile all day long.", url: "https://www.edfringe.com" },
        { name: "Brixton Record Shops + Market",   emoji: "💿", type: "music",    description: "Brixton Village market and the surrounding blocks contain the best vinyl shops in south London. Supertone Records and Hank's Records are institutions.", url: "https://www.timeout.com/london" },
        { name: "The Night Tube crawl",            emoji: "🚇", type: "dance",    description: "Friday and Saturday, the London Underground runs all night on five lines — entire pub crawl routes are built around it. The Jubilee Line from the West End to Bermondsey opens late-night clubs previously inaccessible without a cab." },
      ],
      music: {
        intro: "London's music scene is one of the few in the world where a Tuesday night can produce the performance of your life. Grime was invented here, punk was invented here, and whatever comes next is probably fermenting in a pub in Hackney right now.",
        artists: [
          { name: "Arlo Parks",      genre: "Indie soul / poetry-pop",  why: "The sound of contemporary London indie — intimate, literary, and exactly right for a walk through Peckham.", searchUrl: "https://open.spotify.com/search/Arlo%20Parks" },
          { name: "Little Simz",     genre: "UK rap / grime",           why: "North London born, globally acclaimed — her album Sometimes I Might Be Introvert is essential city listening.", searchUrl: "https://open.spotify.com/search/Little%20Simz" },
          { name: "Floating Points", genre: "Electronic / jazz fusion", why: "A neuroscientist who makes some of the most beautiful electronic music alive — his Promises album with Pharoah Sanders is extraordinary.", searchUrl: "https://open.spotify.com/search/Floating%20Points" },
          { name: "Corinne Bailey Rae", genre: "Soul / R&B",            why: "Leeds-born but the definitive sound of a London Sunday morning — put on her debut album and walk along the Thames.", searchUrl: "https://open.spotify.com/search/Corinne%20Bailey%20Rae" },
        ],
        venues: [
          { name: "Ronnie Scott's",        vibe: "Soho institution since 1959 — the definitive London jazz club", genre: "Jazz", url: "https://www.ronniescotts.co.uk" },
          { name: "Fabric",               vibe: "Legendary Farringdon club — the benchmark for UK techno and drum and bass", genre: "Electronic / Techno / Drum & Bass", url: "https://www.fabriclondon.com" },
          { name: "The Jazz Café",         vibe: "Camden institution — jazz, soul, funk, hip-hop in an intimate venue", genre: "Jazz / Soul / Hip-Hop", url: "https://www.thejazzcafelondon.com" },
          { name: "EartH (Hackney)",       vibe: "A converted art deco cinema — stunning venue for mid-size indie and electronic acts", genre: "Indie / Electronic", url: "https://www.earthackney.co.uk" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/london%20indie%20playlist%202024",
      },
      apps: [
        { name: "Citymapper",     category: "transit",  emoji: "🚇", description: "The best transit app in the world, built for London. Uses real-time data for tube, bus, Elizabeth line, Overground, and even river buses.", url: "https://citymapper.com", platform: "both" },
        { name: "TfL Oyster",     category: "transit",  emoji: "💳", description: "Add an Oyster card or use contactless — tap in and out on all public transport. Contactless bank cards work directly too.", url: "https://tfl.gov.uk/fares/how-to-pay-and-where-to-buy-tickets-and-oyster/pay-as-you-go/contactless-and-mobile-pay", platform: "both" },
        { name: "Uber / Bolt",    category: "taxi",     emoji: "🚕", description: "Both work in London. Black cabs can also be hailed — they're expensive but knowledgeable. Bolt is usually 20–30% cheaper than Uber.", url: "https://bolt.eu", platform: "both" },
        { name: "OpenTable",      category: "food",     emoji: "🍽️", description: "Restaurant reservations across London — most serious restaurants won't take walk-ins and list here.", url: "https://www.opentable.co.uk", platform: "both" },
        { name: "Timeout London", category: "events",   emoji: "🎟️", description: "The definitive guide to what's on — gigs, exhibitions, pop-ups, restaurant openings, and the occasional opinion that London is not quite as good as New York.", url: "https://www.timeout.com/london", platform: "both" },
      ],
      airportTransfers: [
        { option: "Elizabeth Line (LHR → central London)", emoji: "🚇", timeEst: "40–45 min", costEst: "£12.80", recommended: true, description: "Direct to Paddington, Bond Street, Liverpool Street. The new Elizabeth line is fast, comfortable, and the logical choice for most central London hotels.", tip: "Contactless payment works directly — no need to buy a ticket in advance." },
        { option: "Heathrow Express (LHR → Paddington)", emoji: "🚄", timeEst: "15 min", costEst: "£25–£37", recommended: false, description: "Fastest option to Paddington — only worth it if you're connecting to a train at Paddington or if time is genuinely critical.", tip: "Book in advance online for a significantly lower fare than the walk-up price." },
        { option: "Gatwick Express (GTW → Victoria)", emoji: "🚅", timeEst: "30 min", costEst: "£19.90", recommended: true, description: "Non-stop from Gatwick to Victoria station every 15 minutes, 5am–midnight.", tip: "The slower Southern service to Victoria costs half the price and takes 10 minutes longer — worth considering." },
        { option: "Stansted Express (STN → Liverpool St)", emoji: "🚉", timeEst: "47 min", costEst: "£19.90", recommended: true, description: "Direct from Stansted to Liverpool Street. Essential — the M11 can take 90+ minutes in traffic.", tip: "Pre-book online for better fares. Easy Jet and Ryanair both use Stansted heavily." },
      ],
      hiddenGems: [
        { name: "Dennis Severs' House",    emoji: "🕯️", type: "experience",    description: "A 'still-life drama' in Spitalfields — 10 rooms frozen in different eras from 1724 to 1914, as if the Huguenot family just stepped out. Nothing else in London is quite like it.", sourceUrl: "https://www.dennissevershouse.co.uk" },
        { name: "Maltby Street Market",    emoji: "🧀", type: "market",         description: "Saturday mornings in Bermondsey — a smaller, calmer, better version of Borough Market where the same producers sell at lower prices.", sourceUrl: "https://www.timeout.com/london/shopping/maltby-street-market" },
        { name: "The Barbican Conservatory", emoji: "🌿", type: "experience",   description: "A tropical rainforest hidden on the 3rd floor of the Barbican Centre — open on Sundays, free with a venue ticket. One of London's most genuinely surprising places.", sourceUrl: "https://www.barbican.org.uk" },
      ],
    },
  },

  {
    level: "country",
    keywords: ["portugal", "lisbon", "porto", "algarve", "madeira", "azores", "sintra"],
    data: {
      destination: "Portugal",
      sceneIntro: "Lisbon has a word — saudade — that doesn't translate. It's a bittersweet longing for something you can't name. You hear it in fado, you feel it watching the sun set over the Tagus, and somehow, mysteriously, you feel it before you've even left.",
      events: [
        { name: "Fado at a casas de fado",    emoji: "🎻", type: "music",    description: "Real fado is performed in small casas — not tourist restaurants. Tasca do Chico in Lisbon's Bica neighbourhood has 30 seats and the real thing. Book weeks in advance.", url: "https://www.tascadochico.net", tipNote: "Silence is the protocol — talking during a fado performance is deeply rude, and will be communicated to you." },
        { name: "Feira da Ladra, Lisbon",     emoji: "🪆", type: "market",   description: "Lisbon's flea market in Alfama (Tuesday and Saturday mornings) — tiles, fishing equipment, vintage fabrics, Soviet binoculars, and inexplicable ceramic donkeys.", url: "https://www.timeout.com/lisbon" },
        { name: "Mercado da Ribeira",         emoji: "🥩", type: "market",   description: "The Time Out Market in the historic Ribeira hall — yes, it's tourist-friendly, but the food is genuinely excellent and the 8pm wine bar section is where the locals end up.", url: "https://www.timeoutmarket.com/lisboa" },
        { name: "LX Factory, Sunday market",  emoji: "🏭", type: "market",   description: "A former industrial complex in Alcântara that hosts Sunday markets, bookshops, restaurants, and occasional rooftop concerts. The kind of place you go for brunch and leave at midnight.", url: "https://www.lxfactory.com" },
        { name: "Fernando Pessoa's Lisbon",   emoji: "📖", type: "literary", description: "The poet's The Book of Disquiet is a portrait of Lisbon as a city of gentle melancholy. His regular café — A Brasileira — and his home (now a museum) are essential stops.", url: "https://casafernandopessoa.cm-lisboa.pt" },
        { name: "Arraial Pride Lisboa",        emoji: "🌈", type: "festival", description: "June: one of Europe's most joyful Pride festivals — the parade goes from Marques de Pombal to Avenida da Liberdade, followed by a free concert at Eduardo VII park." },
      ],
      music: {
        intro: "Fado is the soul of Portugal — but scratch the surface and you find a contemporary music scene that's been absorbing African rhythms from former colonies, blending them into something genuinely new. Kizomba, semba, and the new wave of Portuguese hip-hop are all worth exploring.",
        artists: [
          { name: "Mariza",          genre: "Contemporary fado", why: "The voice that introduced fado to the world — her live performances are extraordinary.", searchUrl: "https://open.spotify.com/search/Mariza%20fado" },
          { name: "Ana Moura",       genre: "Fado / soul",       why: "Prince named her his favourite singer after hearing her perform — that should be enough.", searchUrl: "https://open.spotify.com/search/Ana%20Moura%20fado" },
          { name: "Buraka Som Sistema", genre: "Electronic / kuduro / Afrobeat", why: "The band that fused Portuguese electronic music with Angolan kuduro — their live shows are legendary.", searchUrl: "https://open.spotify.com/search/Buraka%20Som%20Sistema" },
          { name: "Dino d'Santiago",  genre: "African soul / pop", why: "Cape Verdean-Portuguese artist bridging African rhythms with contemporary pop — the sound of modern Lisbon.", searchUrl: "https://open.spotify.com/search/Dino%20d%27Santiago" },
        ],
        venues: [
          { name: "Tasca do Chico",     vibe: "Lisbon's most authentic fado house — 30 seats, reservation essential, profoundly moving", genre: "Fado", url: "https://www.tascadochico.net" },
          { name: "Music Box Lisboa",   vibe: "Under the Arches on Cais do Sodré — great for live bands and electronic nights", genre: "Indie / Electronic", url: "https://www.musicboxlisboa.com" },
          { name: "Lux Frágil",         vibe: "Lisbon's most famous club — in a converted meat factory by the Tagus, co-owned by John Malkovich", genre: "Electronic / House", url: "https://www.luxfragil.com" },
          { name: "O Corvo",            vibe: "Natural wine bar in Graça that hosts acoustic music nights — small, perfect, beloved by locals", genre: "Folk / Acoustic" },
        ],
        playlistSearchUrl: "https://open.spotify.com/search/fado%20contemporaneo%20playlist",
      },
      apps: [
        { name: "Carris Metropolitana", category: "transit",  emoji: "🚌", description: "Lisbon's bus and tram network — the 28 tram is famous, but the app helps you navigate the whole system.", url: "https://www.carrismetropolitana.pt", platform: "both" },
        { name: "BOLT",                 category: "taxi",     emoji: "🚕", description: "The dominant rideshare in Portugal — much cheaper and more available than Uber in smaller cities.", url: "https://bolt.eu", platform: "both" },
        { name: "ZAPP",                 category: "transit",  emoji: "🛵", description: "Electric scooters across Lisbon — great for the flat areas (not the hills). Much better than Lime.", url: "https://zapp.city", platform: "both" },
        { name: "Zomato Portugal",      category: "food",     emoji: "🍽️", description: "Restaurant discovery and delivery — better Portuguese restaurant database than TheFork in smaller cities.", url: "https://www.zomato.com/pt", platform: "both" },
        { name: "Timeout Lisboa",       category: "events",   emoji: "🎟️", description: "English-language guide to events, restaurants, and neighbourhood guides — updated weekly.", url: "https://www.timeout.com/lisbon", platform: "both" },
      ],
      airportTransfers: [
        { option: "Metro (Red Line → Lisbon centre)", emoji: "🚇", timeEst: "20–30 min", costEst: "€1.80", recommended: true, description: "Lisbon's airport metro stop connects directly to Alameda (change for Green Line) and onwards to Rossio, Cais do Sodré, and Baixa-Chiado. Remarkably good value.", tip: "Buy a rechargeable Via Viagem card (€0.50 deposit) — much cheaper than single tickets." },
        { option: "Aerobus",            emoji: "🚌", timeEst: "25–45 min", costEst: "€4", recommended: false, description: "Direct bus to Marquês de Pombal, Rossio, Cais do Sodré, and Belém. Good for those areas but slower than the metro in traffic.", tip: "The metro is almost always faster and cheaper — the bus only makes sense for Belém." },
        { option: "Licensed Taxi",      emoji: "🚕", timeEst: "15–25 min", costEst: "€15–€20", recommended: false, description: "Metered fares from the airport — usually quite reasonable by European standards. Official cream-coloured cabs from the designated rank.", tip: "There's a €1.60 supplement for the airport. Confirm the meter is running when you get in." },
      ],
      hiddenGems: [
        { name: "Miradouro da Graça",        emoji: "🌅", type: "viewpoint",    description: "The best sunset viewpoint in Lisbon — fewer tourists than Santa Catarina or São Pedro de Alcântara, local families bring wine and watch the sun go down over the Tagus.", sourceUrl: "https://www.timeout.com/lisbon" },
        { name: "Museu do Azulejo",          emoji: "🟦", type: "museum",       description: "A 16th-century convent housing Portugal's national tile museum — the 18th-century panel depicting pre-earthquake Lisbon is one of the most extraordinary things in the country.", sourceUrl: "https://www.museudoazulejo.gov.pt" },
        { name: "Cervejaria Ramiro",         emoji: "🦞", type: "restaurant",   description: "The no-reservations, cash-only seafood restaurant that's been a Lisbon institution since 1956. Arrive at 7pm or after 10pm to avoid the worst waits. Order the garlic tiger prawns and a cold Sagres.", sourceUrl: "https://www.cervejaria-ramiro.pt" },
      ],
    },
  },
];

// Generic fallback for destinations without specific data
const GENERIC_DISCOVERY: LocalDiscovery = {
  destination: "Your destination",
  sceneIntro: "Every city has a version of itself that the guidebooks don't capture. It's in the Sunday market that the locals actually use, the bar where the musicians go after their gig, the neighbourhood café that's been doing the same thing impeccably for 40 years.",
  events: [
    { name: "Local market",          emoji: "🛍️", type: "market",   description: "Find the neighbourhood market — not the tourist market. Vendors who sell to locals will tell you more about a place than any guide." },
    { name: "Live music venues",      emoji: "🎵", type: "music",    description: "Look for venues recommended by Resident Advisor (for electronic music) or local blog recommendations — the best small venues rarely make guidebooks.", url: "https://ra.co" },
    { name: "Local arts listings",    emoji: "🎭", type: "art",      description: "Check the local Time Out edition or equivalent — they track events most visitors never discover.", url: "https://www.timeout.com" },
  ],
  music: {
    intro: "The best way to find what's playing locally is to look up the destination on Spotify, Bandcamp, or Resident Advisor — each city has artists and sounds you won't find on any global chart.",
    artists: [],
    venues: [],
    playlistSearchUrl: "https://open.spotify.com/search/local%20music",
  },
  apps: [
    { name: "Google Maps (offline)",  category: "maps",     emoji: "🗺️", description: "Download the offline map of your destination before you arrive — works without data and is more reliable than any local transit app.", url: "https://maps.google.com", platform: "both" },
    { name: "Google Translate",       category: "language", emoji: "🗣️", description: "Download the offline language pack. Camera translation for menus is especially useful.", url: "https://translate.google.com", platform: "both" },
    { name: "Uber / Bolt",            category: "taxi",     emoji: "🚕", description: "Both work in most major cities. Bolt is usually 20–30% cheaper — check both before booking.", url: "https://bolt.eu", platform: "both" },
  ],
  airportTransfers: [
    { option: "Public transit",       emoji: "🚇", timeEst: "Varies", costEst: "Budget option", recommended: true, description: "Usually the cheapest and often the fastest. Check the airport's official website for routes — they're more reliable than third-party sources.", tip: "Buy tickets at the airport before leaving the arrivals area — machines often only take cash or local cards." },
    { option: "Licensed taxi",        emoji: "🚕", timeEst: "Varies", costEst: "Mid-range", recommended: false, description: "Use only designated taxi ranks outside arrivals — not touts inside the terminal. Confirm the fare is metered or agree a fixed price before getting in.", tip: "Take a photo of the cab number/plate before you get in." },
  ],
  hiddenGems: [],
};

export function getLocalDiscovery(destinationName: string): LocalDiscovery {
  const lower = destinationName.toLowerCase();
  const isMultiCity = lower.includes(",");

  if (isMultiCity) {
    // Multi-city trip: prefer country-level entries so we don't lock onto one sub-region
    const countryMatch = DB.find(
      (e) => e.level === "country" && e.keywords.some((kw) => lower.includes(kw))
    );
    const fallback = DB.find((e) => e.keywords.some((kw) => lower.includes(kw)));
    return (countryMatch ?? fallback)?.data ?? { ...GENERIC_DISCOVERY, destination: destinationName };
  }

  // Single destination: try specific region first, then country
  const match = DB.find((e) => e.keywords.some((kw) => lower.includes(kw)));
  return match?.data ?? { ...GENERIC_DISCOVERY, destination: destinationName };
}
