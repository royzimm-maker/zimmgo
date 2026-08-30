import type { Destination } from "@/types/trip";

// Visa guidance is inherently time-sensitive and nationality-specific — this
// is illustrative, US-passport-holder guidance for this app's curated
// destinations, not a substitute for checking official sources. Every entry
// says so implicitly by living behind the disclaimer rendered alongside it
// (see components/planning/VisaRequirements.tsx). Unrecognized destinations
// are left out entirely rather than guessed — a wrong "no visa needed" is
// far worse than no answer at all.
export interface VisaInfo {
  required: boolean;
  summary: string;
  link?: string;
  linkLabel?: string;
}

interface CountryVisaEntry {
  country: string;
  keywords: string[];
  visa: VisaInfo;
}

const VISA_TABLE: CountryVisaEntry[] = [
  {
    country: "Turkey",
    keywords: ["istanbul", "cappadocia", "turkey"],
    visa: {
      required: true,
      summary: "US passport holders need an e-Visa — apply online in advance (takes minutes, but don't leave it for the airport).",
      link: "https://www.evisa.gov.tr",
      linkLabel: "Apply for Turkey e-Visa",
    },
  },
  {
    country: "Vietnam",
    keywords: ["vietnam", "hanoi", "ho chi minh", "halong"],
    visa: {
      required: true,
      summary: "US passport holders need an e-Visa arranged before departure.",
      link: "https://evisa.xuatnhapcanh.gov.vn",
      linkLabel: "Apply for Vietnam e-Visa",
    },
  },
  {
    country: "India",
    keywords: ["india", "delhi", "mumbai", "jaipur", "goa"],
    visa: {
      required: true,
      summary: "US passport holders need an e-Visa arranged before departure.",
      link: "https://indianvisaonline.gov.in",
      linkLabel: "Apply for India e-Visa",
    },
  },
  {
    country: "Egypt",
    keywords: ["egypt", "cairo", "luxor", "giza"],
    visa: {
      required: true,
      summary: "US passport holders need a visa — an e-Visa or visa on arrival is available, but arranging it before you fly is safer.",
      link: "https://visa2egypt.gov.eg",
      linkLabel: "Apply for Egypt e-Visa",
    },
  },
  {
    country: "Australia",
    keywords: ["australia", "sydney", "melbourne"],
    visa: {
      required: true,
      summary: "US passport holders need an ETA (a simple online authorization, not a full visa application) before travel.",
      link: "https://www.eta.homeaffairs.gov.au",
      linkLabel: "Apply for Australia ETA",
    },
  },
  {
    country: "China",
    keywords: ["china", "beijing", "shanghai"],
    visa: {
      required: true,
      summary: "US passport holders need a visa arranged in advance through a Chinese embassy, consulate, or visa service — this one isn't a quick online form.",
    },
  },
  {
    country: "United Kingdom",
    keywords: ["london", "edinburgh", "glasgow", "uk", "united kingdom", "britain", "scotland"],
    visa: {
      required: true,
      summary: "No visa needed for short tourist stays, but US passport holders now need an ETA (Electronic Travel Authorisation) arranged online before travel.",
      link: "https://www.gov.uk/eta",
      linkLabel: "Apply for UK ETA",
    },
  },
  {
    country: "Canada",
    keywords: ["canada", "toronto", "vancouver", "montreal", "banff"],
    visa: {
      required: true,
      summary: "No visa needed for short tourist stays, but US passport holders flying in need an eTA (Electronic Travel Authorization) — a quick online form, not a full visa.",
      link: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html",
      linkLabel: "Apply for Canada eTA",
    },
  },
  {
    country: "Schengen Area",
    keywords: [
      "paris", "france", "provence",
      "rome", "florence", "venice", "milan", "naples", "sicily", "bologna", "amalfi", "tuscany", "chianti", "dolomit", "cinque terre", "italy",
      "madrid", "seville", "barcelona", "spain", "andalusia",
      "athens", "santorini", "mykonos", "thessaloniki", "greece",
      "lisbon", "porto", "portugal",
      "iceland", "reykjavik",
    ],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 90 days in any 180-day period. An ETIAS travel authorization has long been planned for US passport holders but has been repeatedly delayed — worth a quick check closer to your trip.",
      link: "https://travel-europe.europa.eu/etias_en",
      linkLabel: "ETIAS status",
    },
  },
  {
    country: "Japan",
    keywords: ["tokyo", "kyoto", "osaka", "japan", "nikko", "hakone"],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 90 days.",
    },
  },
  {
    country: "Morocco",
    keywords: ["morocco", "marrakech", "sahara", "fes", "casablanca"],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 90 days.",
    },
  },
  {
    country: "Thailand",
    keywords: ["thailand", "bangkok", "phuket", "chiang mai", "koh samui", "koh phi phi"],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 30 days.",
    },
  },
  {
    country: "Chile",
    keywords: ["chile", "santiago", "patagonia", "atacama"],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 90 days.",
    },
  },
  {
    country: "Argentina",
    keywords: ["argentina", "buenos aires", "bariloche"],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 90 days.",
    },
  },
  {
    country: "Mexico",
    keywords: ["mexico", "cancun", "tulum", "mexico city", "oaxaca"],
    visa: {
      required: false,
      summary: "No visa needed for tourist stays up to 180 days.",
    },
  },
  {
    country: "United Arab Emirates",
    keywords: ["dubai", "abu dhabi", "uae"],
    visa: {
      required: false,
      summary: "No visa needed — a 30-day tourist entry stamp is issued on arrival.",
    },
  },
];

export interface TripVisaEntry {
  country: string;
  visa: VisaInfo;
}

// One entry per unique country actually visited, in visiting order — a
// multi-country trip (e.g. Rome then Istanbul) surfaces each separately,
// since "no visa needed" for one leg shouldn't bury "e-Visa required" for
// another. Cities that don't match a known country are silently skipped,
// not guessed at.
export function getVisaRequirementsForTrip(destination?: Destination): TripVisaEntry[] {
  const cities = destination?.cities?.filter(Boolean) ?? [];
  const searchTexts = cities.length ? cities : [destination?.displayName, destination?.freeText].filter((s): s is string => !!s);

  const seen = new Set<string>();
  const results: TripVisaEntry[] = [];
  for (const text of searchTexts) {
    const lc = text.toLowerCase();
    const match = VISA_TABLE.find((entry) => entry.keywords.some((kw) => lc.includes(kw)));
    if (match && !seen.has(match.country)) {
      seen.add(match.country);
      results.push({ country: match.country, visa: match.visa });
    }
  }
  return results;
}
