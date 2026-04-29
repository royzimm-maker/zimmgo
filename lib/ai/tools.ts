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
        selected_hotel_id: { type: "string" },
        selected_flight_ids: { type: "array", items: { type: "string" } },
        selected_activity_ids: { type: "array", items: { type: "string" } },
      },
      required: ["destination"],
    },
  },
];
