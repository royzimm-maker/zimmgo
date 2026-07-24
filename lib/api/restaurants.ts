// Restaurants API module
// Production: integrate with OpenTable, TheFork, or Google Places API

import { v4 as uuid } from "uuid";
import type { RestaurantOption, RestaurantTier } from "@/types/trip";

interface RestaurantSearchParams {
  destination: string;
  cuisine_preferences?: string[];
  budget_level?: "low" | "mid" | "high";
  meal_types?: string[];
}

const PLAYFUL_LABELS: Record<RestaurantTier, string> = {
  fine_dining: "Michelin or bust",
  upscale:     "Great food without the theatre",
  midrange:    "Great food at prices that won't blow your budget",
  casual:      "Super casual — show up hungry",
  street_food: "Street food that'll leave you wanting more",
  brunch:      "Coffee and a reason to linger",
};

const PRICE_RANGES: Record<RestaurantTier, "$" | "$$" | "$$$" | "$$$$"> = {
  fine_dining: "$$$$",
  upscale:     "$$$",
  midrange:    "$$",
  casual:      "$",
  street_food: "$",
  brunch:      "$",
};

type RestaurantSeed = Omit<RestaurantOption, "id" | "playfulCategory" | "priceRange" | "imageUrl" | "menuUrl" | "bookingUrl">;

const RESTAURANT_DB: Record<string, RestaurantSeed[]> = {
  tokyo: [
    {
      name: "Sukiyabashi Jiro Honten",
      cuisine: "Omakase Sushi",
      tier: "fine_dining",
      rating: 9.8,
      reviewCount: 1240,
      location: "Ginza, Tokyo",
      description: "Three Michelin stars. The most famous sushi counter on earth — 20 courses, no choices, pure perfection.",
      mustOrder: "The full omakase — there is no menu",
    },
    {
      name: "Narisawa",
      cuisine: "Innovative Japanese",
      tier: "upscale",
      rating: 9.4,
      reviewCount: 2180,
      location: "Minami-Aoyama, Tokyo",
      description: "Two Michelin stars. Yoshihiro Narisawa's 'Satoyama cuisine' connects the table directly to Japan's forests and coastline.",
      mustOrder: "Bread of the Forest — fermented wild yeast",
    },
    {
      name: "Ichiran Shibuya",
      cuisine: "Tonkotsu Ramen",
      tier: "casual",
      rating: 8.6,
      reviewCount: 18400,
      location: "Shibuya, Tokyo",
      description: "Solo dining booths, a customisable broth form, and ramen so good it became a cultural institution.",
      mustOrder: "Original tonkotsu, extra-firm noodles",
    },
    {
      name: "Tsukiji Outer Market Stalls",
      cuisine: "Japanese Street Food",
      tier: "street_food",
      rating: 9.2,
      reviewCount: 45000,
      location: "Tsukiji, Tokyo",
      description: "The world's most famous fish market corridor. Tamagoyaki, fresh uni, and grilled scallops at 7am.",
      mustOrder: "Fresh uni on rice — straight from the counter",
    },
  ],
  paris: [
    {
      name: "Septime",
      cuisine: "Modern French",
      tier: "upscale",
      rating: 9.5,
      reviewCount: 3100,
      location: "11th Arr., Paris",
      description: "Consistently named among Europe's best. Biodynamic wines, market-driven plates, and a room that feels genuinely Parisian.",
      mustOrder: "Whatever the season says — the menu changes weekly",
    },
    {
      name: "L'Ambroisie",
      cuisine: "Classic French",
      tier: "fine_dining",
      rating: 9.7,
      reviewCount: 870,
      location: "Place des Vosges, Paris",
      description: "Three Michelin stars in the most beautiful square in Paris. Bernard Pacaud's cooking is untouched by trends.",
      mustOrder: "Tarte fine sablée au chocolat amer",
    },
    {
      name: "Le Comptoir du Relais",
      cuisine: "French Bistro",
      tier: "midrange",
      rating: 8.8,
      reviewCount: 7200,
      location: "Saint-Germain, Paris",
      description: "Yves Camdeborde's legendary zinc bar. No reservations at lunch — just queue, order the charcuterie, and settle in.",
      mustOrder: "Terrine maison and a glass of Beaujolais",
    },
    {
      name: "Du Pain et des Idées",
      cuisine: "Artisan Bakery",
      tier: "brunch",
      rating: 9.3,
      reviewCount: 12000,
      location: "10th Arr., Paris",
      description: "Voted Paris's best bakery several years running. The croissant à l'ancienne has a waiting list on weekends.",
      mustOrder: "Croissant à l'ancienne and the pavé aux fruits",
    },
  ],
  iceland: [
    {
      name: "Dill Restaurant",
      cuisine: "New Nordic",
      tier: "fine_dining",
      rating: 9.3,
      reviewCount: 940,
      location: "Reykjavik",
      description: "Iceland's only Michelin-starred restaurant. Ragnar Eiríksson uses foraged herbs and aged lamb to tell Iceland's story on a plate.",
      mustOrder: "Skyr dessert with angelica and crowberries",
    },
    {
      name: "Grillmarkaðurinn",
      cuisine: "Icelandic Grill",
      tier: "upscale",
      rating: 9.0,
      reviewCount: 2800,
      location: "Reykjavik city centre",
      description: "The 'Grill Market' champions Icelandic ingredients — lamb, Arctic char, langoustine — over an open lava stone grill.",
      mustOrder: "Langoustine soup and the slow-roasted lamb",
    },
    {
      name: "Messinn",
      cuisine: "Icelandic Fish",
      tier: "midrange",
      rating: 9.1,
      reviewCount: 4600,
      location: "Reykjavik",
      description: "Rustic fish pan dishes served in the skillet they were cooked in. The freshest catch, the simplest approach.",
      mustOrder: "Pan-fried Arctic char with butter and capers",
    },
    {
      name: "Bæjarins Beztu Pylsur",
      cuisine: "Icelandic Hot Dog",
      tier: "street_food",
      rating: 9.4,
      reviewCount: 28000,
      location: "Reykjavik harbour",
      description: "A red kiosk by the harbour that's been here since 1937. Bill Clinton ate here. So should you.",
      mustOrder: "One with everything — 'eina með öllu'",
    },
  ],
  greece: [
    {
      name: "Varoulko Seaside",
      cuisine: "Modern Greek Seafood",
      tier: "upscale",
      rating: 9.2,
      reviewCount: 1800,
      location: "Mikrolimano, Athens",
      description: "Lefteris Lazarou's Michelin-starred harbourside restaurant. Every plate is a love letter to the Aegean.",
      mustOrder: "Sea urchin with squid ink and caviar",
    },
    {
      name: "Thanasis",
      cuisine: "Greek Souvlaki",
      tier: "casual",
      rating: 8.9,
      reviewCount: 22000,
      location: "Monastiraki, Athens",
      description: "The most famous souvlaki joint in the city. Counter service, paper napkins, and meat that's been on the spit since 1968.",
      mustOrder: "Kalamaki and a can of Fix beer",
    },
    {
      name: "Monastiraki Street Food",
      cuisine: "Greek Street Food",
      tier: "street_food",
      rating: 8.7,
      reviewCount: 35000,
      location: "Monastiraki Square, Athens",
      description: "The square and surrounding alleyways are ringed with spanakopita, loukoumades, and grilled corn stalls.",
      mustOrder: "Loukoumades with honey and sesame",
    },
    {
      name: "Nolan",
      cuisine: "Modern Greek",
      tier: "midrange",
      rating: 9.0,
      reviewCount: 3200,
      location: "Kolonaki, Athens",
      description: "Small plates with a Greek-Asian sensibility. Creative, generous, and a little unpredictable — in the best way.",
      mustOrder: "Lamb gyros tacos and the smoked aubergine",
    },
  ],
  italy: [
    {
      name: "La Pergola",
      cuisine: "Italian Fine Dining",
      tier: "fine_dining",
      rating: 9.8,
      reviewCount: 1100,
      location: "Rome Cavalieri, Rome",
      description: "Three Michelin stars above Rome. Heinz Beck's cuisine is Italy filtered through decades of classical European technique.",
      mustOrder: "Rigatoni with pajata — offal as luxury",
    },
    {
      name: "Da Enzo al 29",
      cuisine: "Roman Trattoria",
      tier: "casual",
      rating: 9.3,
      reviewCount: 8400,
      location: "Trastevere, Rome",
      description: "The definitive Trastevere trattoria. Tables packed tight, wine in a jug, and cacio e pepe made the way it should be.",
      mustOrder: "Cacio e pepe and the artichokes alla romana",
    },
    {
      name: "Supplì Roma",
      cuisine: "Roman Street Food",
      tier: "street_food",
      rating: 9.1,
      reviewCount: 15000,
      location: "Trastevere & city-wide, Rome",
      description: "Crispy fried rice balls filled with ragù and molten mozzarella. The perfect street-food bite in the Eternal City.",
      mustOrder: "Classic supplì al telefono",
    },
    {
      name: "Il Sorpasso",
      cuisine: "Modern Roman",
      tier: "midrange",
      rating: 8.8,
      reviewCount: 5600,
      location: "Prati, Rome",
      description: "An all-day wine bar with a serious kitchen. Great natural wines, cured meats, and a seasonal menu that changes with the market.",
      mustOrder: "The cured meat board and whatever pasta is on today",
    },
  ],
  spain: [
    {
      name: "Disfrutar",
      cuisine: "Avant-Garde Catalan",
      tier: "fine_dining",
      rating: 9.9,
      reviewCount: 980,
      location: "Eixample, Barcelona",
      description: "Recently named the world's best restaurant. Three Michelin stars and a menu that rewrites what dining can be.",
      mustOrder: "The full tasting menu — there is no other way",
    },
    {
      name: "Bar Cañete",
      cuisine: "Catalan Tapas",
      tier: "midrange",
      rating: 9.1,
      reviewCount: 6800,
      location: "El Raval, Barcelona",
      description: "A long marble bar, vermouth at noon, and tapas cooked with real care. The kind of place locals are happy you haven't found yet.",
      mustOrder: "Croquetas de jamón and the grilled razor clams",
    },
    {
      name: "La Boqueria Market",
      cuisine: "Spanish Street Food",
      tier: "street_food",
      rating: 8.9,
      reviewCount: 62000,
      location: "La Rambla, Barcelona",
      description: "Go early, go hungry, ignore the tourist stalls at the front. The inner market is one of the great food experiences in Europe.",
      mustOrder: "Fresh-cut jamón ibérico and seasonal fruit cups",
    },
    {
      name: "El Xampanyet",
      cuisine: "Traditional Catalan",
      tier: "casual",
      rating: 9.0,
      reviewCount: 11000,
      location: "El Born, Barcelona",
      description: "A century-old cava bar serving anchovy toasts and house cava by the glass. It's always a little crowded. It's always worth it.",
      mustOrder: "Anxoves de l'Escala and house cava",
    },
  ],
  portugal: [
    {
      name: "Belcanto",
      cuisine: "Modern Portuguese",
      tier: "fine_dining",
      rating: 9.5,
      reviewCount: 1650,
      location: "Chiado, Lisbon",
      description: "Two Michelin stars. José Avillez's flagship is an ode to Portugal's culinary heritage — reinvented with precision and soul.",
      mustOrder: "Garden of the Goose That Laid the Golden Egg",
    },
    {
      name: "Taberna da Rua das Flores",
      cuisine: "Portuguese Tavern",
      tier: "midrange",
      rating: 9.2,
      reviewCount: 4200,
      location: "Chiado, Lisbon",
      description: "No menu — the waiter tells you what's good today. Traditional petiscos done properly, in a room that feels like old Lisbon.",
      mustOrder: "Whatever the waiter recommends — trust them",
    },
    {
      name: "Time Out Market",
      cuisine: "Portuguese Street Food",
      tier: "street_food",
      rating: 8.8,
      reviewCount: 48000,
      location: "Cais do Sodré, Lisbon",
      description: "The original food-hall concept done right: 40 chefs under one roof, from bifanas to grilled fish to pastel de nata.",
      mustOrder: "Bifana and a pastel de nata from Manteigaria",
    },
    {
      name: "Zé da Mouraria",
      cuisine: "Traditional Portuguese",
      tier: "casual",
      rating: 9.0,
      reviewCount: 3900,
      location: "Mouraria, Lisbon",
      description: "A hole-in-the-wall where the daily specials are written on a chalkboard and the wine costs €1 a glass. Exactly what you hoped for.",
      mustOrder: "Bacalhau à brás and the house tinto",
    },
  ],
  uk: [
    {
      name: "The Clove Club",
      cuisine: "Modern British",
      tier: "fine_dining",
      rating: 9.4,
      reviewCount: 2100,
      location: "Shoreditch, London",
      description: "One Michelin star, one of London's most creative kitchens. Douglas McMaster's tasting menu is ambitious and utterly British.",
      mustOrder: "Pine salt chicken with fermented grain",
    },
    {
      name: "St. John",
      cuisine: "Nose-to-Tail British",
      tier: "upscale",
      rating: 9.3,
      reviewCount: 4800,
      location: "Smithfield, London",
      description: "Fergus Henderson's nose-to-tail landmark. The whitewashed dining room is as unfussy as the cooking is brilliant.",
      mustOrder: "Roast bone marrow and parsley salad",
    },
    {
      name: "Dishoom",
      cuisine: "Bombay Café",
      tier: "midrange",
      rating: 9.2,
      reviewCount: 38000,
      location: "Multiple locations, London",
      description: "A love letter to the old Irani cafés of Bombay. The queues are real. The bacon naan roll is worth every minute.",
      mustOrder: "Bacon naan roll at breakfast, black dal at dinner",
    },
    {
      name: "Borough Market",
      cuisine: "International Street Food",
      tier: "street_food",
      rating: 9.4,
      reviewCount: 55000,
      location: "Southwark, London",
      description: "London's oldest food market. The best raclette, the best Scotch eggs, the best coffee you'll drink between a Thursday and Saturday.",
      mustOrder: "Raclette at Kappacasein and a Neal's Yard cheese",
    },
  ],
  default: [
    {
      name: "The Grand Table",
      cuisine: "Contemporary Fine Dining",
      tier: "fine_dining",
      rating: 9.2,
      reviewCount: 1400,
      location: "City centre",
      description: "The destination restaurant of the city — locally sourced, exquisitely presented, and worth the reservation effort.",
      mustOrder: "Chef's tasting menu with wine pairings",
    },
    {
      name: "Neighbourhood Kitchen",
      cuisine: "Modern Local",
      tier: "midrange",
      rating: 8.8,
      reviewCount: 4200,
      location: "Local district",
      description: "Where residents actually eat. Seasonal menu, honest prices, and a room that's always comfortably full.",
      mustOrder: "The daily special — always the best value",
    },
    {
      name: "The Street Market",
      cuisine: "Local Street Food",
      tier: "street_food",
      rating: 8.9,
      reviewCount: 9800,
      location: "Market square",
      description: "The best food in the city costs less than €10 here. Follow the locals and the longest queues.",
      mustOrder: "Whatever has the longest queue",
    },
    {
      name: "Café Matinal",
      cuisine: "Local Brunch",
      tier: "brunch",
      rating: 8.7,
      reviewCount: 2800,
      location: "Old town",
      description: "The morning ritual spot. Excellent coffee, proper pastries, and a terrace worth lingering on.",
      mustOrder: "House specialty pastry and the local filter coffee",
    },
  ],
};

function findRestaurantBase(destination: string): RestaurantSeed[] {
  const lower = (destination ?? "").toLowerCase();
  const key = Object.keys(RESTAURANT_DB).find((k) => lower.includes(k));
  return RESTAURANT_DB[key ?? "default"];
}

export async function searchRestaurants(params: RestaurantSearchParams): Promise<RestaurantOption[]> {
  const base = findRestaurantBase(params.destination);

  let filtered = base;
  if (params.budget_level === "low") {
    filtered = base.filter((r) => r.tier === "casual" || r.tier === "street_food" || r.tier === "brunch");
  } else if (params.budget_level === "mid") {
    filtered = base.filter((r) => r.tier !== "fine_dining");
  }

  return filtered.slice(0, 4).map((r) => ({
    ...r,
    id: uuid(),
    playfulCategory: PLAYFUL_LABELS[r.tier],
    priceRange: PRICE_RANGES[r.tier],
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(r.name)}/800/400`,
    bookingUrl: r.tier === "fine_dining" || r.tier === "upscale"
      ? `https://www.opentable.com/s/?term=${encodeURIComponent(r.name + " " + params.destination)}`
      : `https://www.google.com/maps/search/${encodeURIComponent(r.name + " " + params.destination)}`,
    menuUrl: `https://www.google.com/search?q=${encodeURIComponent(r.name + " " + params.destination + " menu")}`,
  }));
}
