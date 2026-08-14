// Activities API module
// Production: integrate with GetYourGuide API or Viator API
// GetYourGuide docs: https://api.getyourguide.com

import { v4 as uuid } from "uuid";
import { DESTINATION_ALIASES } from "@/lib/data/destinationAliases";
import { resolvePool } from "@/lib/api/poolLookup";
import { getActivitiesForDestination, type DestinationActivity } from "@/lib/data/destinationActivities";
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
  // Direct pool-key match beats the shared DESTINATION_ALIASES entry
  // ("florence" → "italy"), so a Florence search resolves here instead of
  // reusing Rome's content under a mismatched city label — see resolvePool.
  florence: [
    { name: "Uffizi Gallery skip-the-line tour", category: "cultural",     duration: "3h",   price: 90,  rating: 9.6, reviewCount: 15600, isLocalFavorite: false, description: "Botticelli's Birth of Venus, Michelangelo, da Vinci — reserved entry with an art historian who makes the Renaissance click." },
    { name: "Brunelleschi's Dome climb",         category: "adventure",    duration: "1.5h", price: 40,  rating: 9.5, reviewCount: 9200,  isLocalFavorite: true,  description: "463 steps between the Duomo's double shells to a terrace view over the terracotta rooftops — book weeks ahead, it sells out." },
    { name: "Chianti countryside wine day trip", category: "food",         duration: "Full day", price: 135, rating: 9.4, reviewCount: 3100, isLocalFavorite: false, description: "Rolling vineyards south of the city, tasting Chianti Classico at a family-run estate most tour buses skip." },
    { name: "Oltrarno artisan workshop walk",    category: "guided_walking_tour", duration: "2.5h", price: 55, rating: 9.3, reviewCount: 1700, isLocalFavorite: true, description: "Cross the Arno to the leather and goldsmith workshops where Florentines actually shop — a different city from the Duomo crowds." },
  ],
  venice: [
    { name: "Doge's Palace & St. Mark's Basilica skip-the-line tour", category: "cultural", duration: "3h", price: 85, rating: 9.5, reviewCount: 12000, isLocalFavorite: false, description: "Reserved entry to the Doge's private chambers and the Basilica's golden mosaics before the day-trip crowds arrive." },
    { name: "Venetian mask-making workshop",  category: "cultural",     duration: "2h",   price: 60,  rating: 9.2, reviewCount: 2100,  isLocalFavorite: true,  description: "A third-generation mascherari studio in Cannaregio — paint your own Carnevale mask to take home." },
    { name: "Grand Canal sunset gondola ride", category: "sailing",     duration: "1h",   price: 90,  rating: 9.6, reviewCount: 8400,  isLocalFavorite: true,  description: "Skip the San Marco touts and book a private gondolier through a local guide — the Rialto at golden hour is unmissable." },
    { name: "Burano & Murano islands boat tour", category: "sailing",   duration: "5h",   price: 75,  rating: 9.3, reviewCount: 5200,  isLocalFavorite: false, description: "Lace-making Burano's candy-coloured houses and Murano's glass furnaces, away from the San Marco crowds." },
  ],
  naples: [
    { name: "Pompeii ruins guided tour",      category: "cultural",     duration: "4h",   price: 70,  rating: 9.6, reviewCount: 9800,  isLocalFavorite: false, description: "Walk the frozen streets of Pompeii with an archaeologist guide who brings 79 AD back into focus." },
    { name: "Naples pizza-making class",      category: "food", duration: "2.5h", price: 55, rating: 9.4, reviewCount: 3100, isLocalFavorite: true, description: "Learn true Neapolitan dough technique from a family that's been making pizza since the 1950s." },
    { name: "Napoli Sotterranea underground tour", category: "cultural", duration: "2h",  price: 35,  rating: 9.2, reviewCount: 4200,  isLocalFavorite: true,  description: "Descend into the Greco-Roman aqueducts and WWII bomb shelters beneath the chaotic streets above." },
    { name: "Capri boat day trip",            category: "sailing",      duration: "Full day", price: 120, rating: 9.5, reviewCount: 6100, isLocalFavorite: false, description: "Blue Grotto, the Faraglioni rocks, and a swim stop off Capri's cliffs — the classic Bay of Naples excursion." },
  ],
  milan: [
    { name: "Last Supper reserved viewing",   category: "cultural",     duration: "1h",   price: 45,  rating: 9.3, reviewCount: 11000, isLocalFavorite: false, description: "Timed 15-minute entry to see da Vinci's mural in Santa Maria delle Grazie — book months ahead, it always sells out." },
    { name: "Milan fashion district shopping walk", category: "guided_walking_tour", duration: "2h", price: 40, rating: 8.8, reviewCount: 1800, isLocalFavorite: true, description: "The Quadrilatero della Moda with a stylist guide who knows which showrooms let walk-ins browse." },
    { name: "Duomo rooftop terraces",         category: "cultural",     duration: "1.5h", price: 35,  rating: 9.4, reviewCount: 8700,  isLocalFavorite: false, description: "Walk among the cathedral's marble spires with the Alps visible on a clear day." },
    { name: "Aperitivo crawl in Navigli",     category: "food",         duration: "3h",   price: 50,  rating: 9.1, reviewCount: 2600,  isLocalFavorite: true,  description: "Milan invented the aperitivo — hop between canal-side bars for spritz and the free buffet that comes with it." },
  ],
  amalfi: [
    { name: "Amalfi Coast boat trip",         category: "sailing",      duration: "6h",   price: 140, rating: 9.7, reviewCount: 4800, isLocalFavorite: true,  description: "Private boat along the clifftop towns — Ravello, Positano, Praiano — with swimming stops in hidden coves." },
    { name: "Limoncello-making class",        category: "food",         duration: "2h",   price: 65,  rating: 9.2, reviewCount: 2100, isLocalFavorite: true,  description: "A local family shares their terrace lemon grove and century-old recipe. You leave with a bottle." },
    { name: "Sentiero degli Dei hike",        category: "hiking",       duration: "5h",   price: 45,  rating: 9.8, reviewCount: 3300, isLocalFavorite: true,  description: "The 'Path of the Gods' — arguably the most scenic coastal walk in Europe. Staggering views at every step." },
    { name: "Ravello Villa & Garden tour",    category: "cultural",     duration: "3h",   price: 55,  rating: 9.1, reviewCount: 1900, isLocalFavorite: false, description: "The clifftop gardens of Villa Rufolo and Villa Cimbrone. Wagner composed here. You'll understand why." },
  ],
  sicily: [
    { name: "Valley of the Temples sunset tour", category: "cultural", duration: "3h", price: 65, rating: 9.5, reviewCount: 5200, isLocalFavorite: false, description: "Agrigento's Doric temples glow gold at sunset — a UNESCO site with a fraction of Rome's crowds." },
    { name: "Mount Etna guided hike & wine tasting", category: "adventure", duration: "6h", price: 95, rating: 9.6, reviewCount: 3800, isLocalFavorite: true, description: "Trek the black lava trails of Europe's most active volcano, then taste wine grown in its mineral-rich soil." },
    { name: "Palermo street food market tour", category: "food", duration: "3h", price: 55, rating: 9.4, reviewCount: 4100, isLocalFavorite: true, description: "Ballarò and Vucciria markets — arancini, panelle, and the famous (not for the faint-hearted) pani ca meusa." },
    { name: "Taormina & Isola Bella boat trip", category: "sailing", duration: "4h", price: 80, rating: 9.3, reviewCount: 2600, isLocalFavorite: false, description: "Sail beneath Taormina's clifftop theatre to the turquoise coves of Isola Bella nature reserve." },
  ],
  bologna: [
    { name: "Bologna food & market walking tour", category: "food", duration: "3h", price: 70, rating: 9.5, reviewCount: 3400, isLocalFavorite: true, description: "Quadrilatero market stalls, a mortadella tasting, and the parmesan and balsamic history that built this city's food fame." },
    { name: "Fresh pasta-making class with a sfoglina", category: "food", duration: "3h", price: 75, rating: 9.6, reviewCount: 2100, isLocalFavorite: true, description: "Learn tagliatelle and tortellini from an actual Bolognese grandmother in her home kitchen." },
    { name: "Ferrari Museum & balsamic vinegar day trip", category: "cultural", duration: "Full day", price: 110, rating: 9.2, reviewCount: 1800, isLocalFavorite: false, description: "Maranello's Ferrari collection paired with a traditional acetaia tasting 25-year balsamic straight from the barrel." },
    { name: "Le Due Torri & portico rooftop climb", category: "cultural", duration: "1.5h", price: 25, rating: 8.9, reviewCount: 4100, isLocalFavorite: false, description: "Climb the leaning Asinelli Tower for the best rooftop view in Emilia-Romagna, then walk the world's longest portico." },
  ],
  tuscany: [
    { name: "Siena Palio history walk & Duomo",   category: "cultural", duration: "3h", price: 55, rating: 9.3, reviewCount: 2400, isLocalFavorite: false, description: "Walk the Campo where the Palio horse race runs twice a year, then step inside Siena's black-and-white striped Duomo." },
    { name: "San Gimignano towers & Vernaccia tasting", category: "food", duration: "4h", price: 70, rating: 9.2, reviewCount: 1900, isLocalFavorite: true, description: "The 'Medieval Manhattan' of 14 surviving stone towers, paired with a tasting of the region's crisp white wine." },
    { name: "Val d'Orcia countryside driving tour", category: "photography", duration: "Full day", price: 130, rating: 9.7, reviewCount: 1600, isLocalFavorite: false, description: "Chauffeured through the cypress-lined hills of Pienza, Montalcino, and Montepulciano — the postcard Tuscany." },
    { name: "Brunello di Montalcino vineyard tasting", category: "food", duration: "5h", price: 110, rating: 9.5, reviewCount: 2100, isLocalFavorite: true, description: "A family-run Montalcino estate walks you through Brunello's strict aging rules, ending in a proper sit-down tasting." },
  ],
  cinque: [
    { name: "Sentiero Azzurro hike through all five villages", category: "hiking", duration: "Full day", price: 45, rating: 9.7, reviewCount: 4800, isLocalFavorite: true, description: "The classic blue trail linking Monterosso to Riomaggiore along the cliffs — buy the Cinque Terre Card for trail access." },
    { name: "Vernazza harbour swim & pesto-making class", category: "food", duration: "3h", price: 65, rating: 9.4, reviewCount: 2100, isLocalFavorite: true, description: "Swim in Vernazza's tiny harbour, then learn real Ligurian pesto from a local — mortar and pestle, no shortcuts." },
    { name: "Cinque Terre coastal boat tour", category: "sailing", duration: "4h", price: 85, rating: 9.6, reviewCount: 3600, isLocalFavorite: false, description: "See all five villages from the water — the only angle that shows why they're called the 'five lands'." },
    { name: "Manarola sunset photography walk", category: "photography", duration: "2h", price: 40, rating: 9.5, reviewCount: 1400, isLocalFavorite: false, description: "The most photographed village in Liguria at golden hour, with a guide who knows the quiet vantage points." },
  ],
  dolomit: [
    { name: "Via Ferrata Piccolo Lagazuoi",   category: "adventure",    duration: "6h",   price: 95,  rating: 9.6, reviewCount: 2700, isLocalFavorite: true,  description: "The most dramatic via ferrata in the Alps — through WWI tunnels and along sheer limestone walls." },
    { name: "Alta Via 1 guided day hike",     category: "hiking",       duration: "Full day", price: 110, rating: 9.7, reviewCount: 1800, isLocalFavorite: true, description: "The high route above the tree line — marmots, ibex, and views that justify every switchback." },
    { name: "Sunrise photography at Tre Cime",category: "photography",  duration: "4h",   price: 75,  rating: 9.8, reviewCount: 4600, isLocalFavorite: false, description: "The Tre Cime di Lavaredo at golden hour is one of the great mountain photographs. A guide gets you there at the right moment." },
    { name: "Dolomites e-bike tour",          category: "cycling",      duration: "5h",   price: 120, rating: 9.3, reviewCount: 3100, isLocalFavorite: true,  description: "Pedal through alpine meadows and traditional Ladin villages with a local guide, letting the motor help on the climbs." },
  ],
  madrid: [
    { name: "Prado Museum skip-the-line guided tour", category: "cultural", duration: "3h", price: 75, rating: 9.5, reviewCount: 8200, isLocalFavorite: false, description: "Velázquez, Goya, and Bosch with an art historian guide who cuts through the crowds and the audio-guide clichés." },
    { name: "Retiro Park & Royal Palace walking tour", category: "guided_walking_tour", duration: "3h", price: 45, rating: 9.0, reviewCount: 3400, isLocalFavorite: false, description: "Madrid's green lung and the largest working royal palace in Europe, paired in one manageable afternoon." },
    { name: "Tapas crawl in La Latina",           category: "food", duration: "3h", price: 65, rating: 9.4, reviewCount: 4600, isLocalFavorite: true, description: "Cava Baja's tapas bars the way madrileños actually do it — standing room, jamón, and vermouth on tap." },
    { name: "Mercado de San Miguel food hall visit", category: "food", duration: "2h", price: 30, rating: 8.8, reviewCount: 9800, isLocalFavorite: false, description: "A glass-walled 1916 market hall turned upscale tapas bazaar — touristy but genuinely excellent, right off Plaza Mayor." },
  ],
  seville: [
    { name: "Real Alcázar & Santa Cruz quarter tour", category: "cultural", duration: "3h", price: 65, rating: 9.5, reviewCount: 5600, isLocalFavorite: false, description: "The oldest royal palace still in use in Europe — Mudéjar architecture that inspired parts of Game of Thrones' Dorne." },
    { name: "Flamenco show in Triana",            category: "cultural", duration: "1.5h", price: 40, rating: 9.3, reviewCount: 4200, isLocalFavorite: true, description: "Flamenco's actual birthplace neighbourhood, across the river from the tourist zone — raw and unpolished in the best way." },
    { name: "Seville Cathedral & Giralda tower climb", category: "cultural", duration: "2h", price: 35, rating: 9.2, reviewCount: 6100, isLocalFavorite: false, description: "The world's largest Gothic cathedral, with a ramp (not stairs) to the top of the Giralda for panoramic city views." },
    { name: "Tapas crawl through Santa Cruz & Alfalfa", category: "food", duration: "3h", price: 55, rating: 9.4, reviewCount: 3100, isLocalFavorite: true, description: "Hop between family-run bars for salmorejo, croquetas, and sherry the way sevillanos have for generations." },
  ],
  // Kept as a fallback for a bare "Spain" search — already pure Barcelona
  // content, and the "barcelona": "spain" alias correctly routes Barcelona
  // searches here. Madrid and Seville above now get their own pools.
  spain: [
    { name: "Sagrada Família & Park Güell guided tour", category: "cultural", duration: "4h", price: 95, rating: 9.5, reviewCount: 12000, isLocalFavorite: false, description: "Skip-the-line access to Gaudí's masterpieces with an architecture-focused guide who makes the modernist movement click." },
    { name: "Tapas & vermouth crawl in El Born",  category: "food",     duration: "3h",  price: 75,  rating: 9.4, reviewCount: 3400, isLocalFavorite: true,  description: "Hop between four family-run bodegas most tourists walk straight past, pairing vermut on tap with proper jamón." },
    { name: "Flamenco show in a traditional tablao", category: "cultural", duration: "2h", price: 55, rating: 9.0, reviewCount: 5200, isLocalFavorite: false, description: "An intimate, un-touristy tablao in Poble Sec — raw, percussive flamenco with no dinner-theatre gimmicks." },
    { name: "Costa Brava sailing day trip",       category: "sailing",  duration: "Full day", price: 140, rating: 9.3, reviewCount: 1600, isLocalFavorite: true, description: "Sail the coves north of Barcelona, with swimming stops in water most day-trippers never reach by land." },
  ],
  athens: [
    { name: "Acropolis & Acropolis Museum private tour", category: "cultural", duration: "4h", price: 110, rating: 9.6, reviewCount: 9800, isLocalFavorite: false, description: "Early-access entry before the tour buses arrive, with an archaeologist guide who brings the ruins back to life." },
    { name: "Athens food and market crawl",       category: "food",     duration: "3h",  price: 70,  rating: 9.3, reviewCount: 2900, isLocalFavorite: true,  description: "Central Market, a century-old souvlaki counter, and a family bakery locals queue for at dawn." },
    { name: "Plaka & Anafiotika sunset walk",      category: "guided_walking_tour", duration: "2h", price: 45, rating: 9.1, reviewCount: 2400, isLocalFavorite: true, description: "The village-like alleys beneath the Acropolis, built by Cycladic islanders in the 1800s — Athens's prettiest, least touristy corner." },
    { name: "National Archaeological Museum tour", category: "cultural", duration: "2.5h", price: 50, rating: 8.9, reviewCount: 1800, isLocalFavorite: false, description: "The world's best collection of ancient Greek art, walked through with a guide who turns statues back into stories." },
  ],
  santorini: [
    { name: "Santorini caldera sunset sailing",    category: "sailing",  duration: "5h",  price: 130, rating: 9.7, reviewCount: 4100, isLocalFavorite: false, description: "Catamaran around the volcanic caldera with swimming stops and a barbecue dinner as the sun drops behind the cliffs." },
    { name: "Oia sunset viewpoint & wine tasting", category: "food",     duration: "3h",  price: 85,  rating: 9.6, reviewCount: 5200, isLocalFavorite: false, description: "The world-famous Oia sunset paired with a tasting flight from a clifftop winery growing grapes in volcanic ash." },
    { name: "Akrotiri ruins & Red Beach",          category: "cultural", duration: "3h",  price: 40,  rating: 9.0, reviewCount: 1600, isLocalFavorite: false, description: "The 'Greek Pompeii' — a Bronze Age city preserved under volcanic ash, a short walk from the striking Red Beach." },
    { name: "Santorini volcano hike & hot springs", category: "hiking",  duration: "4h",  price: 55,  rating: 9.2, reviewCount: 2900, isLocalFavorite: true,  description: "Boat to the still-active volcanic islet, hike the crater rim, then swim in the sulphur hot springs offshore." },
  ],
  thessaloniki: [
    { name: "White Tower & waterfront promenade walk", category: "guided_walking_tour", duration: "2h", price: 30, rating: 8.8, reviewCount: 1400, isLocalFavorite: false, description: "Thessaloniki's Ottoman-era landmark tower, plus the long seafront promenade locals actually walk every evening." },
    { name: "Ano Poli old town & Byzantine walls tour", category: "cultural", duration: "2.5h", price: 40, rating: 9.1, reviewCount: 1100, isLocalFavorite: true, description: "The hillside old town above the modern grid — Byzantine churches, city walls, and views over the Thermaic Gulf." },
    { name: "Modiano Market food tour",            category: "food", duration: "3h", price: 55, rating: 9.3, reviewCount: 1900, isLocalFavorite: true, description: "Thessaloniki's historic covered market — bougatsa, souvlaki, and the city's famously good street food scene." },
    { name: "Vergina royal tombs day trip",        category: "cultural", duration: "Full day", price: 90, rating: 9.0, reviewCount: 700, isLocalFavorite: false, description: "The gold-filled tomb of Philip II of Macedon, Alexander the Great's father — one of Greece's great archaeological finds." },
  ],
  // Kept as a fallback for a bare "Greece" search with no specific city —
  // same pattern as the "italy" pool below (falls back to Rome). Athens,
  // Santorini, and Thessaloniki above now resolve to their own pools first.
  greece: [
    { name: "Acropolis & Acropolis Museum private tour", category: "cultural", duration: "4h", price: 110, rating: 9.6, reviewCount: 9800, isLocalFavorite: false, description: "Early-access entry before the tour buses arrive, with an archaeologist guide who brings the ruins back to life." },
    { name: "Athens food and market crawl",       category: "food",     duration: "3h",  price: 70,  rating: 9.3, reviewCount: 2900, isLocalFavorite: true,  description: "Central Market, a century-old souvlaki counter, and a family bakery locals queue for at dawn." },
    { name: "Santorini caldera sunset sailing",   category: "sailing",  duration: "5h",  price: 130, rating: 9.7, reviewCount: 4100, isLocalFavorite: false, description: "Catamaran around the volcanic caldera with swimming stops and a barbecue dinner as the sun drops behind the cliffs." },
    { name: "Hydra day trip by ferry",            category: "hiking",   duration: "Full day", price: 65, rating: 9.1, reviewCount: 1200, isLocalFavorite: true, description: "A car-free island an hour from Piraeus — donkey paths, hidden coves, and none of Mykonos's cruise-ship crowds." },
  ],
  lisbon: [
    { name: "Belém & Jerónimos Monastery guided walk", category: "cultural", duration: "3h", price: 60, rating: 9.2, reviewCount: 3300, isLocalFavorite: false, description: "The monastery, the tower, and the original pastel de nata bakery, tied together with Portugal's Age of Discovery history." },
    { name: "Tram 28 & Alfama food tour",         category: "food",     duration: "3h",  price: 80,  rating: 9.4, reviewCount: 2600, isLocalFavorite: true,  description: "Ride the old wooden tram through Lisbon's oldest quarter, stopping for ginjinha, bifanas, and a fado-house nightcap." },
    { name: "Sintra day trip: palaces and forests", category: "cultural", duration: "Full day", price: 95, rating: 9.5, reviewCount: 5400, isLocalFavorite: false, description: "Pena Palace's technicolor towers and the mossy Quinta da Regaleira, away from the Lisbon heat in the hills." },
    { name: "LX Factory street art & design walk", category: "guided_walking_tour", duration: "2h", price: 35, rating: 8.9, reviewCount: 2100, isLocalFavorite: true, description: "A former industrial complex turned street-art and indie-design hub under the 25 de Abril bridge — Lisbon's coolest afternoon." },
  ],
  porto: [
    { name: "Douro Valley wine tasting day trip", category: "food",     duration: "Full day", price: 150, rating: 9.6, reviewCount: 1800, isLocalFavorite: true, description: "Terraced vineyards by train from Porto, tasting port and table wine at a family-run quinta most tours skip." },
    { name: "Port wine lodge tour & tasting",     category: "food",     duration: "2.5h", price: 40,  rating: 9.4, reviewCount: 3600, isLocalFavorite: true,  description: "Cross the Dom Luís bridge to the port wine cellars where every major house ages its barrels along the riverbank." },
    { name: "Ribeira riverside & Livraria Lello tour", category: "guided_walking_tour", duration: "2h", price: 35, rating: 9.2, reviewCount: 4100, isLocalFavorite: false, description: "Porto's UNESCO riverfront district, ending at the ornate bookshop rumoured to have inspired Harry Potter's Flourish and Blotts." },
    { name: "Douro River six-bridges cruise",     category: "sailing",  duration: "1h",   price: 20,  rating: 8.8, reviewCount: 5200, isLocalFavorite: true,  description: "A short boat ride past all six of Porto's bridges — the classic, cheap way to see the city from the water." },
  ],
  // Kept as a fallback for a bare "Portugal" search — Lisbon and Porto
  // above now resolve to their own pools first (this pool was previously
  // mostly Lisbon content with one Porto item mixed in).
  portugal: [
    { name: "Belém & Jerónimos Monastery guided walk", category: "cultural", duration: "3h", price: 60, rating: 9.2, reviewCount: 3300, isLocalFavorite: false, description: "The monastery, the tower, and the original pastel de nata bakery, tied together with Portugal's Age of Discovery history." },
    { name: "Tram 28 & Alfama food tour",         category: "food",     duration: "3h",  price: 80,  rating: 9.4, reviewCount: 2600, isLocalFavorite: true,  description: "Ride the old wooden tram through Lisbon's oldest quarter, stopping for ginjinha, bifanas, and a fado-house nightcap." },
    { name: "Sintra day trip: palaces and forests", category: "cultural", duration: "Full day", price: 95, rating: 9.5, reviewCount: 5400, isLocalFavorite: false, description: "Pena Palace's technicolor towers and the mossy Quinta da Regaleira, away from the Lisbon heat in the hills." },
    { name: "Douro Valley wine tasting day trip", category: "food",     duration: "Full day", price: 150, rating: 9.6, reviewCount: 1800, isLocalFavorite: true, description: "Terraced vineyards by train from Porto, tasting port and table wine at a family-run quinta most tours skip." },
  ],
  london: [
    { name: "Westminster & Parliament insider tour", category: "cultural", duration: "3h", price: 85, rating: 9.1, reviewCount: 4200, isLocalFavorite: false, description: "Access areas closed to the general public, with a guide who separates the history from the tourist myths." },
    { name: "Borough Market & Southwark food crawl", category: "food",  duration: "3h",  price: 75,  rating: 9.3, reviewCount: 3100, isLocalFavorite: true,  description: "London's oldest food market plus the backstreet pie shops and cheesemongers locals actually shop at." },
    { name: "British Museum & Rosetta Stone tour",  category: "cultural", duration: "2.5h", price: 40, rating: 9.2, reviewCount: 6800, isLocalFavorite: false, description: "The Rosetta Stone, Egyptian mummies, and the Parthenon marbles — free entry, but a guide makes sense of the scale." },
    { name: "West End theatre show with backstage tour", category: "cultural", duration: "3h", price: 90, rating: 9.0, reviewCount: 2100, isLocalFavorite: false, description: "A matinee ticket to a long-running West End show, paired with a backstage look at how London theatre actually runs." },
  ],
  edinburgh: [
    { name: "Edinburgh Old Town ghost & vaults tour", category: "cultural", duration: "2h", price: 45, rating: 9.0, reviewCount: 6700, isLocalFavorite: false, description: "The underground vaults beneath South Bridge, with the city's genuinely unsettling history rather than jump-scares." },
    { name: "Scottish Highlands day trip from Edinburgh", category: "hiking", duration: "Full day", price: 110, rating: 9.5, reviewCount: 2900, isLocalFavorite: true, description: "Glencoe and Loch Ness in a single day, timed to reach the glens before the tour-bus convoys." },
    { name: "Edinburgh Castle & Royal Mile guided walk", category: "cultural", duration: "2.5h", price: 35, rating: 9.3, reviewCount: 4600, isLocalFavorite: false, description: "The castle that's dominated the skyline for a thousand years, then down the Royal Mile through Old Town closes and wynds." },
    { name: "Whisky tasting in a historic Old Town cellar", category: "food", duration: "2h", price: 60, rating: 9.4, reviewCount: 1800, isLocalFavorite: true, description: "A guided flight through Scotland's whisky regions in a 16th-century vault beneath the Royal Mile." },
  ],
  glasgow: [
    { name: "Glasgow mural trail & street art walk", category: "guided_walking_tour", duration: "2h", price: 30, rating: 9.0, reviewCount: 1600, isLocalFavorite: true, description: "The City Centre Mural Trail — dozens of large-scale street art pieces most visitors walk straight past." },
    { name: "Kelvingrove Art Gallery & Museum tour", category: "cultural", duration: "2h", price: 25, rating: 9.1, reviewCount: 3400, isLocalFavorite: false, description: "A Victorian red-sandstone museum with everything from a Spitfire to Dalí — free entry, genuinely excellent collection." },
    { name: "Glasgow whisky & gin tasting",         category: "food",     duration: "2h",  price: 55,  rating: 9.2, reviewCount: 1400, isLocalFavorite: true, description: "Scotland's other whisky city — a guided tasting through Lowland and Highland drams in a West End bar." },
    { name: "West End & Ashton Lane food crawl",    category: "food", duration: "2.5h", price: 45, rating: 8.9, reviewCount: 1100, isLocalFavorite: true, description: "Glasgow's leafy, studenty West End — cobbled Ashton Lane's bars and the city's best casual food scene." },
  ],
  // Kept as a fallback for a bare "UK" search — London and Edinburgh above
  // now get their own clean pools (this pool previously mixed both
  // together, so even a London-only search got Highlands day-trip content).
  uk: [
    { name: "Westminster & Parliament insider tour", category: "cultural", duration: "3h", price: 85, rating: 9.1, reviewCount: 4200, isLocalFavorite: false, description: "Access areas closed to the general public, with a guide who separates the history from the tourist myths." },
    { name: "Borough Market & Southwark food crawl", category: "food",  duration: "3h",  price: 75,  rating: 9.3, reviewCount: 3100, isLocalFavorite: true,  description: "London's oldest food market plus the backstreet pie shops and cheesemongers locals actually shop at." },
    { name: "Edinburgh Old Town ghost & vaults tour", category: "cultural", duration: "2h", price: 45, rating: 9.0, reviewCount: 6700, isLocalFavorite: false, description: "The underground vaults beneath South Bridge, with the city's genuinely unsettling history rather than jump-scares." },
    { name: "Scottish Highlands day trip from Edinburgh", category: "hiking", duration: "Full day", price: 110, rating: 9.5, reviewCount: 2900, isLocalFavorite: true, description: "Glencoe and Loch Ness in a single day, timed to reach the glens before the tour-bus convoys." },
  ],
  default: [
    { name: "Private city food tour",            category: "food",     duration: "3h",  price: 95,  rating: 9.4, reviewCount: 2400, isLocalFavorite: true,  description: "Curated neighbourhoods and stops that locals love — vetted by our on-the-ground advisors." },
    { name: "Sunrise hike with local guide",     category: "hiking",   duration: "5h",  price: 80,  rating: 9.2, reviewCount: 1800, isLocalFavorite: true,  description: "The best viewpoints before the tour groups arrive, with a guide who grew up here." },
    { name: "Cultural immersion workshop",       category: "cultural", duration: "3h",  price: 65,  rating: 9.0, reviewCount: 3200, isLocalFavorite: false, description: "Hands-on traditional crafts, cooking, or art — a memorable way to connect with local culture." },
    { name: "Private photography walk",          category: "photography", duration: "4h", price: 150, rating: 9.5, reviewCount: 800, isLocalFavorite: false, description: "A pro photographer takes you to the best light and hidden spots — you leave with stunning shots." },
    { name: "Exclusive wine or spirit tasting",  category: "food",     duration: "2h",  price: 120, rating: 9.3, reviewCount: 1400, isLocalFavorite: false, description: "Small-group tasting with a sommelier or master distiller — paired with regional food." },
  ],
};

// Reasonable duration/price estimates by category — destinationActivities.ts's
// curated picks are real, named experiences (with a real operator's site to
// book through) but weren't collected with duration/price attached, so we
// fill in the same kind of illustrative estimate the rest of this mock pool
// already uses.
const SIGNATURE_ESTIMATE: Record<string, { duration: string; price: number }> = {
  guided_walking_tour: { duration: "3h", price: 60 },
  food:                { duration: "3h", price: 65 },
  sailing:             { duration: "Full day", price: 150 },
  cultural:            { duration: "2.5h", price: 45 },
  adventure:           { duration: "4h", price: 140 },
  wellness:            { duration: "2h", price: 70 },
  hiking:              { duration: "5h", price: 40 },
  cycling:             { duration: "3h", price: 45 },
  photography:         { duration: "3h", price: 90 },
  diving:              { duration: "Full day", price: 130 },
  skiing:              { duration: "Full day", price: 120 },
};

function signatureToActivityOption(a: DestinationActivity): Partial<ActivityOption> {
  const estimate = SIGNATURE_ESTIMATE[a.category] ?? { duration: "3h", price: 70 };
  const provider = a.alternatives?.[0];
  return {
    name: a.name,
    category: a.category,
    duration: estimate.duration,
    price: estimate.price,
    rating: 9.6,
    reviewCount: 1500,
    isLocalFavorite: true,
    description: a.description,
    bookingUrl: provider ? `https://${provider.url}` : undefined,
  };
}

function findActivityBase(destination: string): Partial<ActivityOption>[] {
  const base = resolvePool(destination, ACTIVITY_POOLS, DESTINATION_ALIASES);

  // getActivitiesForDestination groups by region/country keyword (its "italy"
  // entry covers Rome, Naples, Florence, Venice and Amalfi together), but this
  // is called per-city — querying "Rome" would otherwise pull in Naples's food
  // walk as a Rome recommendation. Keep only entries that actually name-check
  // this specific city (in the name or description), so a broad region match
  // doesn't leak another city's picks into this one's pool.
  const city = destination.toLowerCase().trim();
  const signature = getActivitiesForDestination(destination).filter(
    (a) => city && (a.name.toLowerCase().includes(city) || a.description.toLowerCase().includes(city))
  );
  if (!signature.length) return base;

  // Curated signature picks lead the pool (isSignature ones first) so a
  // destination with genuinely good, named options for a category — a real
  // food-tour operator, a specific art walk — surfaces those ahead of the
  // generic mock listings, instead of getting buried among them.
  const sorted = [...signature].sort((x, y) => Number(!!y.isSignature) - Number(!!x.isSignature));
  const converted = sorted.map(signatureToActivityOption);
  const seen = new Set(converted.map((c) => c.name));
  return [...converted, ...base.filter((b) => !seen.has(b.name))];
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
    bookingUrl: a.bookingUrl ?? `https://www.getyourguide.com/s/?q=${encodeURIComponent(a.name + " " + params.destination)}`,
  }));
}
