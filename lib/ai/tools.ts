import type Anthropic from "@anthropic-ai/sdk";

// Tool definitions passed to the Claude API for structured outputs.
// Each tool maps to a backend function in the API routes.

export const TRAVEL_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_flights",
    description:
      "Search for available flights matching the user's preferences. Returns up to 4 recommended options ranked by value and airline preference.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string", description: "IATA airport code for departure (e.g. JFK)" },
        destination: { type: "string", description: "IATA airport code for arrival (e.g. NRT)" },
        departure_date: { type: "string", description: "ISO date string (YYYY-MM-DD)" },
        return_date: { type: "string", description: "ISO date string for return flight" },
        cabin_class: {
          type: "string",
          enum: ["economy", "premium_economy", "business", "first"],
        },
        preferred_airlines: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of preferred airline names",
        },
        nonstop_only: { type: "boolean" },
        lowest_fare_mode: {
          type: "boolean",
          description:
            "Set true when the traveller wants the cheapest fares over airline/cabin preference — searches all carriers in economy and sorts by price. Combine with nonstop_only if they also want nonstop.",
        },
        preferred_arrival_time: {
          type: "string",
          description: "24h \"HH:MM\" — set only on the OUTBOUND leg search when the traveller stated a specific arrival time (e.g. \"landing at 14:30\"). Results are biased toward this arrival time. Omit if not stated.",
        },
        preferred_departure_time_of_day: {
          type: "string",
          enum: ["morning", "afternoon", "evening"],
          description: "Set only on the RETURN leg search when the traveller stated a rough departure preference (e.g. \"leaving in the morning\"). Results are biased toward this window. Omit if not stated.",
        },
      },
      required: ["origin", "destination", "departure_date"],
    },
  },

  {
    name: "search_hotels",
    description:
      "Search for hotels or Airbnb properties matching the user's preferences. Returns 3 curated options with reasoning for each pick.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: { type: "string", description: "City or region name" },
        check_in: { type: "string", description: "ISO date (YYYY-MM-DD)" },
        check_out: { type: "string", description: "ISO date (YYYY-MM-DD)" },
        min_stars: { type: "number", enum: [3, 4, 5] },
        types: {
          type: "array",
          items: { type: "string", enum: ["hotel", "airbnb", "boutique", "resort"] },
        },
        max_price_per_night: { type: "number" },
        amenities: { type: "array", items: { type: "string" } },
      },
      required: ["destination"],
    },
  },

  {
    name: "search_activities",
    description:
      "Find top activities and experiences at the destination. Returns a mix of must-see highlights and hidden local gems.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: { type: "string" },
        categories: {
          type: "array",
          items: {
            type: "string",
            enum: ["hiking", "skiing", "sailing", "food", "diving", "cycling", "cultural", "photography", "wellness", "adventure"],
          },
        },
        vibes: {
          type: "array",
          items: { type: "string" },
        },
        max_price_per_person: { type: "number" },
        duration_days: { type: "number", description: "Total trip length in days" },
      },
      required: ["destination"],
    },
  },

  {
    name: "search_restaurants",
    description:
      "Find top restaurants at the destination across all price tiers — from street food to fine dining. Prioritizes restaurants with Michelin Guide recognition (stars, Bib Gourmand) that fit the requested budget tier. Returns 3-4 curated picks.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: { type: "string" },
        cuisine_preferences: { type: "array", items: { type: "string" } },
        budget_level: { type: "string", enum: ["low", "mid", "high"] },
        meal_types: { type: "array", items: { type: "string", enum: ["breakfast", "lunch", "dinner"] } },
      },
      required: ["destination"],
    },
  },

  {
    name: "generate_itinerary",
    description:
      "Generate a detailed day-by-day travel itinerary based on all collected preferences. This is the final synthesis step.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        activities: { type: "array", items: { type: "string" } },
        vibes: { type: "array", items: { type: "string" } },
        budget_range: { type: "string" },
        transportation_modes: { type: "array", items: { type: "string" } },
        selected_hotels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              city: { type: "string", description: "Must exactly match one of the destination city names given in the prompt." },
              hotel_id: { type: "string", description: "The id of the specific hotel from search_hotels' results for this city that you recommend and describe in your final written summary." },
            },
            required: ["city", "hotel_id"],
          },
          description:
            "For each destination city, the hotel you're actually recommending — required so the app's displayed lodging pick matches what your summary describes instead of an arbitrary result.",
        },
        selected_flight_ids: { type: "array", items: { type: "string" } },
        selected_activity_ids: { type: "array", items: { type: "string" } },
        inter_city_travel: {
          type: "array",
          items: {
            type: "object",
            properties: {
              to_city: { type: "string", description: "The destination city of this leg — must exactly match one of the destination city names given in the prompt, excluding the very first city (there's nothing to travel from before it)." },
              note: { type: "string", description: "One short, concrete sentence on how to actually make this transfer — mode (train/flight/rental car/ferry) and a rough duration, e.g. \"Take the ~2.5hr AVE high-speed train from Barcelona to Seville.\" Base this on real-world geography and the traveller's stated local transport preferences." },
            },
            required: ["to_city", "note"],
          },
          description: "Required for multi-destination trips: one entry per city-to-city transfer, in visiting order, describing how the traveller actually gets from the previous city to this one.",
        },
        gateway_advisory: {
          type: "string",
          description:
            "Only set this if the traveller's arrival/departure airport is in a city that ISN'T one of their destination cities, AND reaching the first (or leaving from the last) destination the same day genuinely isn't realistic — e.g. no practical same-day onward connection, or it would eat most of a travel day. State plainly that they should plan on a night in the gateway city before heading to the first destination and/or before the flight home, and roughly why. Omit entirely if the traveller is flying directly into/out of one of their own destination cities, or if a same-day onward connection is realistic.",
        },
      },
      required: ["destination"],
    },
  },
];

// Forced-tool-call schema for parsing the Destination step's free-text input.
// A regex heuristic (tuned for the curated "Country — City, City & City"
// quick-pick format) previously handled this and broke on arbitrary natural
// language — e.g. a comma appearing before the first dash derailed the whole
// parse into sentence-fragment "cities". This tool handles any phrasing.
export const PARSE_DESTINATION_TOOL: Anthropic.Tool = {
  name: "parse_destination",
  description: "Extract the actual city/region names the traveller wants to visit, in the order they'd logically be visited, plus a clean display label.",
  input_schema: {
    type: "object" as const,
    properties: {
      cities: {
        type: "array",
        items: { type: "string" },
        description: "Real place names only (e.g. \"Barcelona\", \"Kyoto\") — never sentence fragments, filler words, or the traveller's own instructions. A single-city trip should have exactly one entry. For multiple places, order them in a logical geographic visiting sequence, not necessarily the order the traveller typed them.",
      },
      displayName: {
        type: "string",
        description: "A short, clean human-readable label for this trip, e.g. \"Barcelona, Spain\" or \"Italy — Rome, Florence & Amalfi Coast\".",
      },
      likelyRoadTrip: {
        type: "boolean",
        description: "True ONLY if the traveller explicitly said they're driving/road-tripping (e.g. \"road trip\", \"driving up\", \"drive from Seattle\"). Never infer this from the destination or place names alone — a false positive would wrongly suppress flight search for someone who needs it. Default false when in doubt.",
      },
    },
    required: ["cities", "displayName", "likelyRoadTrip"],
  },
};

// Forced-tool-call schema for the free-text "describe your whole trip" intake
// mode — a single natural-language paragraph parsed into as much of
// TripPreferences as is actually stated. Every field except cities/
// displayName/likelyRoadTrip/summary is optional and MUST be omitted rather
// than guessed when the traveller didn't say it — the app pre-fills the
// normal step-by-step wizard with whatever comes back and sends the
// traveller through any step this couldn't fill, so a confident wrong guess
// is worse than an honest gap.
export const PARSE_FULL_TRIP_TOOL: Anthropic.Tool = {
  name: "parse_full_trip",
  description: "Extract as much of a complete trip plan as the traveller actually stated from one free-text description — destination, dates, travelers, budget, dietary needs, pace preferences, vibe, and activities. Omit any field not clearly stated; never guess.",
  input_schema: {
    type: "object" as const,
    properties: {
      cities: {
        type: "array",
        items: { type: "string" },
        description: "Real place names only, in a logical geographic visiting order. A single-city trip has exactly one entry.",
      },
      displayName: { type: "string", description: "A short, clean human-readable label for this trip, e.g. \"Rome, Italy\"." },
      likelyRoadTrip: { type: "boolean", description: "True ONLY if the traveller explicitly said they're driving/road-tripping. Default false when in doubt." },
      departureAirport: { type: "string", description: "The traveller's departure city or airport, ONLY if explicitly stated (e.g. \"flying from Boston\", \"we're in JFK\"). Omit if not stated — do not guess a home airport." },
      travelers: { type: "number", description: "Number of people on the trip, only if stated (e.g. \"we're two people\", \"a family of four\")." },
      dates: {
        type: "object",
        description: "Omit entirely if no dates or timeframe were mentioned.",
        properties: {
          type: { type: "string", enum: ["exact", "flexible"], description: "\"exact\" if specific calendar dates were given, \"flexible\" if only a rough month/duration was given." },
          startDate: { type: "string", description: "ISO date YYYY-MM-DD. Required when type is \"exact\". Resolve any relative or partial dates (e.g. \"next Tuesday\", \"Oct 13\") against the current date given in the prompt." },
          endDate: { type: "string", description: "ISO date YYYY-MM-DD. Required when type is \"exact\"." },
          preferredArrivalTime: { type: "string", description: "24h \"HH:MM\", ONLY if the traveller stated a specific arrival time for the outbound flight (e.g. \"landing at 14:30\")." },
          preferredDepartureTimeOfDay: { type: "string", enum: ["morning", "afternoon", "evening"], description: "ONLY if the traveller stated a rough return-flight departure preference (e.g. \"leaving in the morning\")." },
          flexibleMonth: { type: "string", description: "\"YYYY-MM\", required when type is \"flexible\"." },
          flexibleDuration: { type: "number", description: "Trip length in days, required when type is \"flexible\"." },
        },
      },
      budgetTier: {
        type: "string",
        enum: ["under_500", "500_750", "750_1000", "1000_plus"],
        description: "Lodging budget tier per room/night, ONLY if the traveller gave enough signal to map it — under_500 = budget/value, 500_750 = mid-range (\"mid budget\", \"comfortable\"), 750_1000 = premium/upscale, 1000_plus = luxury/no-expense-spared. Omit if genuinely unclear.",
      },
      dietaryRestrictions: {
        type: "array",
        items: { type: "string" },
        description: "Dietary tags actually stated (e.g. \"vegetarian\", \"gluten-free\", \"nut allergy\"). Omit if none mentioned.",
      },
      dietaryNotes: { type: "string", description: "Free-text dietary context that doesn't fit a simple tag, e.g. \"one of us is vegetarian\". Omit if none." },
      avoidLongQueues: { type: "boolean", description: "True ONLY if the traveller expressed wanting to skip lines / avoid crowds / see sights efficiently (e.g. \"without queueing for hours\"). Omit if not mentioned." },
      dayTripRequested: { type: "boolean", description: "True ONLY if the traveller explicitly asked for a day trip or day outside the main city/destination. Omit if not mentioned." },
      vibes: {
        type: "array",
        items: { type: "string", enum: ["nightlife", "great_food", "outdoor", "shopping", "beaches", "architecture", "romantic", "family_friendly", "off_the_beaten_path"] },
        description: "Trip mood/vibe tags actually implied by the text. Omit if nothing suggests a specific vibe.",
      },
      activities: {
        type: "array",
        items: { type: "string" },
        description: "Activity categories or free-text interests actually stated or clearly implied (e.g. \"the main sights\" implies cultural). Omit if nothing specific was said.",
      },
      summary: {
        type: "string",
        description: "A friendly 1-2 sentence recap of the whole trip as understood, written for the traveller to confirm at a glance, e.g. \"A 4-night trip to Rome for two, mid-budget, landing Tue Oct 13 at 14:30 — main sights without long queues, one day trip, and one vegetarian traveller.\"",
      },
    },
    required: ["cities", "displayName", "likelyRoadTrip", "summary"],
  },
};

// Chat tool — lets the conversational advisor actually save things, not just
// talk about them. Not forced (tool_choice: "auto"): most messages are plain
// Q&A, this only fires when the user asks to save/remember/bookmark something.
export const ADD_TO_WANDERLOG_TOOL: Anthropic.Tool = {
  name: "add_to_wanderlog",
  description:
    "Save one or more items to the user's Wanderlog — a save-for-later list separate from the day-by-day itinerary. Call this whenever the user asks to save, remember, bookmark, or add something to their Wanderlog (e.g. \"add that to my wanderlog\", \"remind me to check out X\").",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short name of the thing to save, e.g. a restaurant, activity, or place name" },
            source: { type: "string", enum: ["activity", "restaurant", "discovery", "custom"], description: "What kind of item this is — use \"custom\" if unsure" },
            location: { type: "string", description: "City or neighbourhood, if known" },
            description: { type: "string", description: "One short sentence on what it actually is — enough that the traveller recognizes it when reading their Wanderlog months later, without having to remember this conversation." },
          },
          required: ["label", "source"],
        },
      },
      reply: { type: "string", description: "A short, friendly confirmation message to show the user, naming what was saved" },
    },
    required: ["items", "reply"],
  },
};

// Chat tool — lets the advisor apply a lodging preference change directly
// instead of just talking about it (e.g. "find me resorts instead", "I want
// something more remote"). Not forced: most Lodging-step messages are plain
// questions. Array fields are full-replacement, not additive — the model has
// the traveller's current lodging preferences in its context and is
// instructed to carry forward anything it isn't changing.
export const UPDATE_LODGING_PREFERENCES_TOOL: Anthropic.Tool = {
  name: "update_lodging_preferences",
  description:
    "Update the traveller's lodging preferences when they explicitly ask to change accommodation type, star rating, or amenities (e.g. \"find me resorts instead of boutique\", \"add a pool\", \"I want something more remote\"). Only call this for a clear change request, not general questions about lodging.",
  input_schema: {
    type: "object" as const,
    properties: {
      types: {
        type: "array",
        items: { type: "string", enum: ["hotel", "airbnb", "boutique", "resort"] },
        description: "The traveller's full desired list of accommodation types. Omit entirely if not changing.",
      },
      min_stars: { type: "number", enum: [3, 4, 5], description: "Omit if not changing." },
      amenities: {
        type: "array",
        items: { type: "string" },
        description:
          "The traveller's full desired list of must-have amenities, drawn from: Free breakfast, Pool, Gym, Concierge, Airport transfer, Rooftop bar, Spa, City centre location, Kitchen / kitchenette, High walkability. Carry forward their existing selections unless they're clearly replacing them. Omit if not changing.",
      },
      other_amenity: {
        type: "string",
        description: "A single free-text preference that doesn't fit the fixed amenity list above (e.g. \"remote location\", \"walking distance to the beach\"). Omit if none.",
      },
      reply: { type: "string", description: "A short, friendly confirmation message naming exactly what changed." },
    },
    required: ["reply"],
  },
};

// Chat tool — lets the advisor apply an activity preference change directly
// instead of just talking about it (e.g. "add hiking", "swap food tours for
// adventure sports", "drop anything cultural"). Not forced: most Activities-
// step messages are plain questions. Full-replacement, not additive — the
// model has the traveller's current activity preferences in its context and
// is instructed to carry forward anything it isn't changing.
export const UPDATE_ACTIVITY_PREFERENCES_TOOL: Anthropic.Tool = {
  name: "update_activity_preferences",
  description:
    "Update the traveller's activity preferences when they explicitly ask to change what kinds of experiences they want (e.g. \"add hiking\", \"swap food tours for adventure sports\", \"I don't want anything cultural\"). Only call this for a clear change request, not general questions about activities.",
  input_schema: {
    type: "object" as const,
    properties: {
      activities: {
        type: "array",
        items: { type: "string" },
        description:
          "The traveller's full desired list of activities — category ids from: guided_walking_tour, hiking, skiing, sailing, food, diving, cycling, cultural, photography, wellness, adventure, plus free text for anything that doesn't fit those (e.g. \"Surfing\", \"Bird watching\"). Carry forward their existing selections unless they're clearly replacing them.",
      },
      reply: { type: "string", description: "A short, friendly confirmation message naming exactly what changed." },
    },
    required: ["activities", "reply"],
  },
};

// Chat tool — lets the advisor apply a vibe change directly instead of just
// talking about it (e.g. "make it more romantic", "drop nightlife, add
// beaches"). Not forced. Full-replacement, not additive — the model has the
// traveller's current vibes in context and is instructed to carry forward
// anything it isn't changing.
export const UPDATE_VIBE_PREFERENCES_TOOL: Anthropic.Tool = {
  name: "update_vibe_preferences",
  description:
    "Update the traveller's trip vibe when they explicitly ask to change the mood/feel of the trip (e.g. \"make it more romantic\", \"drop nightlife, add beaches\", \"add off the beaten path\"). Only call this for a clear change request, not general questions.",
  input_schema: {
    type: "object" as const,
    properties: {
      vibes: {
        type: "array",
        items: { type: "string" },
        description:
          "The traveller's full desired list of vibes — ids from: romantic, nightlife, beaches, shopping, architecture, family_friendly, off_the_beaten_path, plus free text for anything that doesn't fit those (e.g. \"Pet-friendly\"). Carry forward their existing selections unless they're clearly replacing them. 2-4 total tends to work best — mention that if the traveller is about to end up with far more than that.",
      },
      reply: { type: "string", description: "A short, friendly confirmation message naming exactly what changed." },
    },
    required: ["vibes", "reply"],
  },
};

// Chat tool — lets the advisor apply an airline/flight preference change
// directly (e.g. "add nonstop only", "I want business class now", "just
// find me the cheapest fares"). Not forced. Array/boolean fields are
// full-replacement — the model has the traveller's current airline
// preferences in context and is instructed to carry forward anything it
// isn't changing. Deliberately excludes departure/arrival airport — those
// are location lookups, not simple preference toggles.
export const UPDATE_AIRLINE_PREFERENCES_TOOL: Anthropic.Tool = {
  name: "update_airline_preferences",
  description:
    "Update the traveller's airline/flight preferences when they explicitly ask to change preferred airlines, alliances, cabin class, nonstop preference, or lowest-fare priority. Only call this for a clear change request, not general questions about flights.",
  input_schema: {
    type: "object" as const,
    properties: {
      airlines: {
        type: "array",
        items: { type: "string", enum: ["Delta Air Lines", "United Airlines", "American Airlines", "Alaska Airlines", "Emirates", "Singapore Airlines", "Lufthansa", "British Airways", "Air France", "Qatar Airways", "Cathay Pacific"] },
        description: "The traveller's full desired list of preferred airlines. Omit if not changing.",
      },
      alliances: {
        type: "array",
        items: { type: "string", enum: ["star_alliance", "oneworld", "skyteam"] },
        description: "The traveller's full desired list of preferred alliances. Omit if not changing.",
      },
      prefer_nonstop: { type: "boolean", description: "Omit if not changing." },
      cabin_classes: {
        type: "array",
        items: { type: "string", enum: ["economy", "premium_economy", "business", "first"] },
        description: "The traveller's full desired list of cabin classes to compare. Omit if not changing.",
      },
      prioritize_lowest_fare: {
        type: "boolean",
        description: "True if the traveller wants the cheapest fares regardless of airline/cabin — this overrides airlines, alliances, and cabin_classes when true. Omit if not changing.",
      },
      reply: { type: "string", description: "A short, friendly confirmation message naming exactly what changed." },
    },
    required: ["reply"],
  },
};

// Forced-tool-call schema for "let ZiGy choose" — used both for picking a single
// hotel and for arranging a city's activities/restaurants across its days.
export const SMART_PICK_TOOL: Anthropic.Tool = {
  name: "make_selection",
  description: "Return the chosen item(s) with a brief reason for each pick.",
  input_schema: {
    type: "object" as const,
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The id of the chosen item" },
            dayNumber: { type: "number", description: "Which day to place this on (schedule picks only)" },
            reason: { type: "string", description: "One sentence on why this fits" },
          },
          required: ["id", "reason"],
        },
      },
      summary: { type: "string", description: "1-2 sentence overview of the overall reasoning" },
    },
    required: ["picks", "summary"],
  },
};
