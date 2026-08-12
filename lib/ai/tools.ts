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
      "Find top restaurants at the destination across all price tiers — from street food to fine dining. Returns 3-4 curated picks.",
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
        description: "Real place names only (e.g. \"Barcelona\", \"Kyoto\") — never sentence fragments, filler words, or the traveller's own instructions. A single-city trip should have exactly one entry.",
      },
      displayName: {
        type: "string",
        description: "A short, clean human-readable label for this trip, e.g. \"Barcelona, Spain\" or \"Italy — Rome, Florence & Amalfi Coast\".",
      },
    },
    required: ["cities", "displayName"],
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
          "The traveller's full desired list of activities — category ids from: guided_walking_tour, guided_food_tour, hiking, skiing, sailing, food, diving, cycling, cultural, photography, wellness, adventure, plus free text for anything that doesn't fit those (e.g. \"Surfing\", \"Bird watching\"). Carry forward their existing selections unless they're clearly replacing them.",
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
        items: { type: "string", enum: ["Delta Air Lines", "United Airlines", "American Airlines", "Emirates", "Singapore Airlines", "Lufthansa", "British Airways", "Air France", "Qatar Airways", "Cathay Pacific"] },
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
