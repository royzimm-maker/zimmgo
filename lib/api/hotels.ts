// Hotels API module
// Production: integrate with Booking.com Demand API or Airbnb API
// Booking.com docs: https://developers.booking.com

import { v4 as uuid } from "uuid";
import type { HotelOption } from "@/types/trip";
import { randomInt } from "@/lib/utils";
import { resolvePool } from "@/lib/api/poolLookup";

interface HotelSearchParams {
  destination: string;
  check_in?: string;
  check_out?: string;
  min_stars?: number;
  types?: string[];
  max_price_per_night?: number;
  amenities?: string[];
  limit?: number;
}

// Hotel type tags used to filter by accommodation preference
type HotelType = "hotel" | "boutique" | "resort" | "guesthouse";
// User-facing lodging types requested from the planning form (types/trip.ts LodgingType) —
// a superset of HotelType since "airbnb"/"hostel" aren't tagged in this mock inventory
// and resolve to a nearest-match HotelType instead (see matchesType below).
type RequestedType = HotelType | "airbnb" | "hostel";

// Curated mock hotel data per destination keyword
const HOTEL_DB: Record<string, (Partial<HotelOption> & { hotelType?: HotelType })[]> = {
  rome: [
    { name: "Hotel de Russie",          stars: 5, hotelType: "hotel",    location: "Via del Babuino, Rome",      rating: 9.5, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Secret garden", "Rocco Forte spa", "Steps from Piazza del Popolo"] },
    { name: "J.K. Place Roma",          stars: 5, hotelType: "boutique", location: "Via di Monte d'Oro, Rome",   rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 980,  highlights: ["Intimate boutique feel", "Rooftop terrace", "Near the Pantheon"] },
    { name: "Hotel Raphael",            stars: 4, hotelType: "boutique", location: "Largo Febo, Rome",           rating: 9.0, ratingSource: "Booking.com",    reviewCount: 2400, highlights: ["Ivy-covered façade", "Rooftop with Pantheon views", "Art collection"] },
    { name: "Hotel Santa Maria",        stars: 4, hotelType: "hotel",    location: "Trastevere, Rome",           rating: 8.8, ratingSource: "Google Reviews", reviewCount: 3100, highlights: ["Trastevere neighborhood", "Orange garden courtyard", "Quiet side streets"] },
    { name: "Hotel Arco del Lauro",     stars: 3, hotelType: "guesthouse", location: "Trastevere, Rome",         rating: 8.6, ratingSource: "Booking.com",    reviewCount: 4200, highlights: ["Charming guesthouse", "Walking distance to everything", "Great value"] },
    { name: "Hotel Navona",             stars: 3, hotelType: "hotel",    location: "Piazza Navona, Rome",        rating: 8.2, ratingSource: "TripAdvisor",    reviewCount: 5600, highlights: ["Unbeatable location", "Simple and clean", "Budget-friendly"] },
  ],
  florence: [
    { name: "Four Seasons Hotel Firenze", stars: 5, hotelType: "resort",   location: "Piazza SS. Annunziata, Florence", rating: 9.5, ratingSource: "Google Reviews", reviewCount: 1600, highlights: ["15th-century palazzo", "Largest private garden in Florence", "Michelin dining"] },
    { name: "Portrait Firenze",         stars: 5, hotelType: "boutique", location: "Lungarno, Florence",       rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 780,  highlights: ["Arno river views", "Ferragamo family design", "Rooftop restaurant"] },
    { name: "Hotel Brunelleschi",       stars: 4, hotelType: "hotel",    location: "Piazza Santa Elisabetta, Florence", rating: 8.9, ratingSource: "Booking.com", reviewCount: 2100, highlights: ["Built around a Byzantine tower", "Steps from the Duomo", "On-site museum"] },
    { name: "Hotel L'Orologio",         stars: 4, hotelType: "boutique", location: "Santa Maria Novella, Florence", rating: 8.8, ratingSource: "Google Reviews", reviewCount: 1400, highlights: ["Watch-themed design", "Near Santa Maria Novella station", "Rooftop terrace"] },
    { name: "Hotel Scoti",              stars: 3, hotelType: "guesthouse", location: "Via de' Tornabuoni, Florence", rating: 8.6, ratingSource: "TripAdvisor", reviewCount: 1200, highlights: ["Frescoed breakfast room", "On the main shopping street", "Family-run for decades"] },
    { name: "Hotel Dalí",               stars: 3, hotelType: "hotel",    location: "Santa Croce, Florence",    rating: 8.0, ratingSource: "Booking.com",    reviewCount: 1900, highlights: ["Free parking", "Quiet courtyard", "Budget-friendly"] },
  ],
  venice: [
    { name: "The Gritti Palace",        stars: 5, hotelType: "hotel",    location: "Grand Canal, Venice",     rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1800, highlights: ["Grand Canal views", "Doge's Palace nearby", "Legendary service"] },
    { name: "Ca' Sagredo Hotel",        stars: 5, hotelType: "boutique", location: "Rialto, Venice",          rating: 9.3, ratingSource: "TripAdvisor",    reviewCount: 950,  highlights: ["Frescoed ceilings", "Steps from Rialto Market", "Historic palazzo"] },
    { name: "Hotel Ai Reali",           stars: 4, hotelType: "hotel",    location: "Cannaregio, Venice",      rating: 9.0, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["Quiet canal-side setting", "Rooftop spa", "Away from the crowds"] },
    { name: "Novecento Boutique Hotel", stars: 4, hotelType: "boutique", location: "San Marco, Venice",       rating: 8.9, ratingSource: "Google Reviews", reviewCount: 1300, highlights: ["Moroccan-Venetian design", "Walk to St. Mark's", "Charming courtyard"] },
    { name: "Hotel Flora",              stars: 3, hotelType: "guesthouse", location: "San Marco, Venice",     rating: 8.6, ratingSource: "TripAdvisor",    reviewCount: 2600, highlights: ["Secret garden", "Family-run since the 1960s", "Central location"] },
    { name: "Hotel Antiche Figure",     stars: 3, hotelType: "hotel",    location: "Santa Croce, Venice",     rating: 8.1, ratingSource: "Booking.com",    reviewCount: 3100, highlights: ["Steps from the train station", "Canal views", "Budget-friendly"] },
  ],
  naples: [
    { name: "Grand Hotel Vesuvio",      stars: 5, hotelType: "hotel",    location: "Via Partenope, Naples",   rating: 9.4, ratingSource: "Google Reviews", reviewCount: 1900, highlights: ["Bay of Naples views", "Rooftop restaurant", "Historic since 1882"] },
    { name: "Romeo Hotel",              stars: 5, hotelType: "boutique", location: "Municipio, Naples",       rating: 9.2, ratingSource: "TripAdvisor",    reviewCount: 1100, highlights: ["Design-forward interiors", "Rooftop pool over the port", "Sushi bar"] },
    { name: "Hotel Piazza Bellini",     stars: 4, hotelType: "boutique", location: "Centro Storico, Naples",  rating: 8.9, ratingSource: "Booking.com",    reviewCount: 1600, highlights: ["Contemporary art collection", "Steps from Cappella Sansevero", "Historic center"] },
    { name: "Hotel Mediterraneo",       stars: 4, hotelType: "hotel",    location: "Santa Lucia, Naples",     rating: 8.7, ratingSource: "Google Reviews", reviewCount: 2400, highlights: ["Harbor views", "Rooftop terrace", "Central location"] },
    { name: "Belle Arti Resort",        stars: 3, hotelType: "guesthouse", location: "Centro Storico, Naples", rating: 8.5, ratingSource: "TripAdvisor",   reviewCount: 900,  highlights: ["Boutique feel", "Near the archaeological museum", "Great value"] },
    { name: "Hotel Il Convento",        stars: 3, hotelType: "hotel",    location: "Quartieri Spagnoli, Naples", rating: 8.0, ratingSource: "Booking.com", reviewCount: 1800, highlights: ["Character-filled former convent", "Walkable to everything", "Budget-friendly"] },
  ],
  milan: [
    { name: "Bulgari Hotel Milano",     stars: 5, hotelType: "hotel",    location: "Brera, Milan",            rating: 9.5, ratingSource: "Google Reviews", reviewCount: 1400, highlights: ["Private garden oasis", "Steps from La Scala", "Iconic spa"] },
    { name: "Room Mate Giulia",         stars: 5, hotelType: "boutique", location: "Duomo, Milan",            rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 1700, highlights: ["Design hotel facing the Duomo", "Rooftop terrace", "Playful modern interiors"] },
    { name: "Hotel Viu Milan",          stars: 4, hotelType: "boutique", location: "Isola, Milan",            rating: 9.0, ratingSource: "Booking.com",    reviewCount: 1200, highlights: ["Rooftop infinity pool", "Trendy Isola neighborhood", "Design-forward rooms"] },
    { name: "NH Collection Milano President", stars: 4, hotelType: "hotel", location: "Porta Romana, Milan",  rating: 8.6, ratingSource: "Google Reviews", reviewCount: 2500, highlights: ["Business-friendly", "Fashion district access", "Reliable comfort"] },
    { name: "Maison Borella",           stars: 3, hotelType: "guesthouse", location: "Navigli, Milan",        rating: 8.7, ratingSource: "TripAdvisor",    reviewCount: 1000, highlights: ["Canal-side charm", "Navigli nightlife nearby", "Boutique feel"] },
    { name: "Hotel Berna",              stars: 3, hotelType: "hotel",    location: "Stazione Centrale, Milan", rating: 7.9, ratingSource: "Booking.com",   reviewCount: 3200, highlights: ["Steps from Central Station", "Clean and simple", "Budget-friendly"] },
  ],
  amalfi: [
    { name: "Hotel Santa Caterina",     stars: 5, hotelType: "hotel",    location: "Amalfi town",                rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1450, highlights: ["Clifftop with sea elevator", "Saltwater pool", "Lemon grove gardens"] },
    { name: "Le Sirenuse",              stars: 5, hotelType: "boutique", location: "Positano",                   rating: 9.5, ratingSource: "TripAdvisor",    reviewCount: 1820, highlights: ["Iconic Positano views", "Pool terrace", "La Sponda restaurant"] },
    { name: "Hotel Luna Convento",      stars: 4, hotelType: "hotel",    location: "Amalfi town",                rating: 8.9, ratingSource: "Booking.com",    reviewCount: 2300, highlights: ["Former 13th-century convent", "Seafront pool", "Byzantine cloister"] },
    { name: "Casa Angelina",            stars: 4, hotelType: "boutique", location: "Praiano",                    rating: 9.2, ratingSource: "Google Reviews", reviewCount: 1100, highlights: ["Clifftop infinity pool", "White minimalist design", "Quieter than Positano"] },
    { name: "Hotel Buca di Bacco",      stars: 3, hotelType: "hotel",    location: "Positano",                   rating: 8.4, ratingSource: "Booking.com",    reviewCount: 3400, highlights: ["Right on the beach", "Terrace restaurant", "Lively atmosphere"] },
    { name: "Albergo A'Scalinatella",   stars: 3, hotelType: "guesthouse", location: "Ravello",                  rating: 8.7, ratingSource: "TripAdvisor",    reviewCount: 1900, highlights: ["Quiet Ravello hilltop", "Garden with views", "Family-run charm"] },
  ],
  sicily: [
    { name: "Villa Igiea",              stars: 5, hotelType: "hotel",    location: "Acquasanta, Palermo",      rating: 9.4, ratingSource: "Google Reviews", reviewCount: 1100, highlights: ["Belle Époque waterfront palace", "Rocco Forte spa", "Private harbor"] },
    { name: "San Domenico Palace",      stars: 5, hotelType: "hotel",    location: "Taormina",                  rating: 9.6, ratingSource: "TripAdvisor",    reviewCount: 890,  highlights: ["Former 14th-century monastery", "Etna and sea views", "White Lotus filming location"] },
    { name: "Hotel Villa Athena",       stars: 4, hotelType: "boutique", location: "Agrigento",                 rating: 9.2, ratingSource: "Booking.com",    reviewCount: 1600, highlights: ["Views of the Valley of the Temples", "Infinity pool facing the ruins", "Quiet countryside setting"] },
    { name: "Ortea Palace Hotel",       stars: 4, hotelType: "hotel",    location: "Ortigia, Syracuse",         rating: 8.9, ratingSource: "Google Reviews", reviewCount: 1400, highlights: ["Baroque old-town setting", "Rooftop restaurant", "Steps from the Duomo"] },
    { name: "Palazzo Failla",           stars: 3, hotelType: "guesthouse", location: "Modica",                  rating: 8.7, ratingSource: "TripAdvisor",    reviewCount: 780,  highlights: ["Baroque townhouse", "Home to a Michelin-starred kitchen", "Quiet hill-town charm"] },
    { name: "Hotel Moderno",            stars: 3, hotelType: "hotel",    location: "Taormina",                  rating: 8.0, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["Central old-town location", "Terrace views", "Budget-friendly"] },
  ],
  bologna: [
    { name: "Grand Hotel Majestic già Baglioni", stars: 5, hotelType: "hotel", location: "Via Indipendenza, Bologna", rating: 9.3, ratingSource: "Google Reviews", reviewCount: 1300, highlights: ["18th-century palace", "Frescoed ceilings", "Central location"] },
    { name: "I Portici Hotel",          stars: 5, hotelType: "boutique", location: "Via Indipendenza, Bologna", rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 980,  highlights: ["Former 1920s theatre", "Michelin-starred restaurant on-site", "Art Nouveau design"] },
    { name: "Art Hotel Novecento",      stars: 4, hotelType: "boutique", location: "Via del Riscatto, Bologna", rating: 8.9, ratingSource: "Booking.com",    reviewCount: 1500, highlights: ["1930s design throughout", "Steps from Piazza Maggiore", "Quiet side street"] },
    { name: "Hotel Corona d'Oro",       stars: 4, hotelType: "hotel",    location: "Via Oberdan, Bologna",      rating: 8.7, ratingSource: "Google Reviews", reviewCount: 2000, highlights: ["14th-century building", "Glass-roofed courtyard", "Central old town"] },
    { name: "Hotel Metropolitan",       stars: 3, hotelType: "hotel",    location: "Via dell'Orso, Bologna",    rating: 8.3, ratingSource: "TripAdvisor",    reviewCount: 1600, highlights: ["Small rooftop terrace", "Central location", "Good value"] },
    { name: "Combo Bologna",            stars: 3, hotelType: "guesthouse", location: "Via de' Carbonesi, Bologna", rating: 8.0, ratingSource: "Booking.com", reviewCount: 2200, highlights: ["Design hostel-hotel hybrid", "Social atmosphere", "Budget-friendly"] },
  ],
  tuscany: [
    { name: "Castello di Casole",       stars: 5, hotelType: "resort",   location: "Casole d'Elsa, Tuscany",    rating: 9.5, ratingSource: "Google Reviews", reviewCount: 780,  highlights: ["10th-century castle estate", "Working farm and vineyard", "Panoramic countryside views"] },
    { name: "Borgo Santo Pietro",       stars: 5, hotelType: "boutique", location: "Chiusdino, Tuscany",        rating: 9.6, ratingSource: "TripAdvisor",    reviewCount: 620,  highlights: ["Two Michelin-starred restaurant on-site", "13th-century manor", "Extensive gardens"] },
    { name: "Hotel Athena",             stars: 4, hotelType: "hotel",    location: "San Gimignano, Tuscany",    rating: 8.9, ratingSource: "Booking.com",    reviewCount: 1900, highlights: ["Views of the medieval towers", "Just outside the old walls", "Easy parking"] },
    { name: "Palazzo Ravizza",          stars: 4, hotelType: "boutique", location: "Siena, Tuscany",            rating: 9.0, ratingSource: "Google Reviews", reviewCount: 1400, highlights: ["Renaissance palazzo", "Garden terrace", "Steps from the Duomo"] },
    { name: "Podere Val d'Orcia",       stars: 3, hotelType: "guesthouse", location: "Val d'Orcia, Tuscany",    rating: 8.8, ratingSource: "TripAdvisor",    reviewCount: 640,  highlights: ["Working farmhouse stay", "Home-cooked breakfast", "Cypress-lined views"] },
    { name: "Hotel Villa San Lucchese", stars: 3, hotelType: "hotel",    location: "Poggibonsi, Tuscany",       rating: 8.1, ratingSource: "Booking.com",    reviewCount: 1100, highlights: ["Convenient Chianti base", "Pool and gardens", "Budget-friendly"] },
  ],
  cinque: [
    { name: "Hotel Porto Roca",         stars: 4, hotelType: "hotel",    location: "Monterosso al Mare, Cinque Terre", rating: 9.2, ratingSource: "Google Reviews", reviewCount: 1100, highlights: ["Clifftop with sea views", "Private beach access", "Terrace restaurant"] },
    { name: "La Mala",                  stars: 4, hotelType: "boutique", location: "Manarola, Cinque Terre",    rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 620,  highlights: ["Adults-only clifftop suites", "Panoramic terrace", "No cars — boat or trail access only"] },
    { name: "Locanda Ca' dei Duxi",     stars: 3, hotelType: "guesthouse", location: "Riomaggiore, Cinque Terre", rating: 9.0, ratingSource: "Booking.com",  reviewCount: 1400, highlights: ["Village-center location", "Home-style breakfast", "Family-run"] },
    { name: "Hotel Gianni Franzi",      stars: 3, hotelType: "hotel",    location: "Vernazza, Cinque Terre",    rating: 8.7, ratingSource: "Google Reviews", reviewCount: 1800, highlights: ["Harbor-front rooms", "Castle-view terrace restaurant", "Central Vernazza"] },
    { name: "Albergo Marina Piccola",   stars: 3, hotelType: "hotel",    location: "Manarola, Cinque Terre",    rating: 8.5, ratingSource: "TripAdvisor",    reviewCount: 1200, highlights: ["Seafront terrace", "Simple comfortable rooms", "Steps from the harbor"] },
    { name: "Ostello Corniglia",        stars: 3, hotelType: "guesthouse", location: "Corniglia, Cinque Terre", rating: 8.0, ratingSource: "Booking.com",    reviewCount: 700,  highlights: ["Hilltop village, fewer crowds", "Terrace views over the vineyards", "Budget-friendly"] },
  ],
  athens: [
    { name: "Hotel Grande Bretagne",    stars: 5, hotelType: "hotel",    location: "Syntagma Square, Athens", rating: 9.5, ratingSource: "Google Reviews", reviewCount: 3100, highlights: ["Historic 1874 grand hotel", "Acropolis-view rooftop pool", "Syntagma Square location"] },
    { name: "AthensWas Design Hotel",   stars: 4, hotelType: "boutique", location: "Acropolis area, Athens",  rating: 9.1, ratingSource: "Booking.com",    reviewCount: 1200, highlights: ["Direct Acropolis views", "Rooftop restaurant", "Design-forward rooms"] },
    { name: "Electra Palace Athens",    stars: 4, hotelType: "hotel",    location: "Plaka, Athens",            rating: 8.8, ratingSource: "Google Reviews", reviewCount: 2400, highlights: ["Rooftop pool with Acropolis views", "Plaka old-town location", "Reliable comfort"] },
    { name: "Adonis Hotel",             stars: 3, hotelType: "guesthouse", location: "Plaka, Athens",          rating: 8.3, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["Small family-run hotel", "Plaka's quiet alleys", "Great value"] },
  ],
  santorini: [
    { name: "Katikies Santorini",       stars: 5, hotelType: "boutique", location: "Oia, Santorini",           rating: 9.7, ratingSource: "Google Reviews", reviewCount: 980,  highlights: ["Iconic cliffside caldera views", "Infinity pools", "Cave-style suites"] },
    { name: "Canaves Oia Suites",       stars: 4, hotelType: "boutique", location: "Oia, Santorini",           rating: 9.3, ratingSource: "Booking.com",    reviewCount: 1100, highlights: ["Whitewashed cave suites", "Private plunge pools", "Sunset views"] },
    { name: "Aroma Suites",             stars: 4, hotelType: "boutique", location: "Fira, Santorini",          rating: 8.9, ratingSource: "Google Reviews", reviewCount: 900,  highlights: ["Caldera views without Oia prices", "Infinity pool", "Central Fira location"] },
    { name: "Villa Roussa",             stars: 3, hotelType: "guesthouse", location: "Fira, Santorini",        rating: 8.2, ratingSource: "Booking.com",    reviewCount: 1300, highlights: ["Inland, budget-friendly", "Walking distance to Fira center", "Simple comfortable rooms"] },
  ],
  thessaloniki: [
    { name: "Makedonia Palace",         stars: 5, hotelType: "hotel",    location: "Nea Paralia, Thessaloniki", rating: 9.1, ratingSource: "Google Reviews", reviewCount: 1400, highlights: ["Waterfront promenade location", "Rooftop pool", "Panoramic Thermaic Gulf views"] },
    { name: "Daios Luxury Living",      stars: 4, hotelType: "hotel",    location: "Nea Paralia, Thessaloniki", rating: 8.9, ratingSource: "Booking.com",    reviewCount: 1600, highlights: ["Sea-view rooms", "Modern design", "Waterfront promenade"] },
    { name: "Colors Central Square Hotel", stars: 4, hotelType: "hotel", location: "Aristotelous Square, Thessaloniki", rating: 8.7, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Central square location", "Rooftop bar", "Easy walk to everything"] },
    { name: "Rotonda Hotel",            stars: 3, hotelType: "guesthouse", location: "Ano Poli, Thessaloniki", rating: 8.0, ratingSource: "Booking.com",    reviewCount: 1100, highlights: ["Old-town hillside location", "Byzantine walls nearby", "Budget-friendly"] },
  ],
  lisbon: [
    { name: "Four Seasons Hotel Ritz Lisbon", stars: 5, hotelType: "hotel", location: "Marquês de Pombal, Lisbon", rating: 9.3, ratingSource: "Google Reviews", reviewCount: 1800, highlights: ["Panoramic city views", "Rooftop terrace", "Iconic since 1959"] },
    { name: "Palácio Belmonte",         stars: 5, hotelType: "boutique", location: "Alfama, Lisbon",           rating: 9.5, ratingSource: "TripAdvisor",    reviewCount: 620,  highlights: ["15th-century palace", "Hand-painted tiled interiors", "Castle-view suites"] },
    { name: "LX Boutique Hotel",        stars: 4, hotelType: "boutique", location: "Cais do Sodré, Lisbon",    rating: 8.9, ratingSource: "Booking.com",    reviewCount: 1400, highlights: ["Riverside Pink Street location", "Design-forward rooms", "Nightlife district"] },
    { name: "Residencial Florescente",  stars: 3, hotelType: "guesthouse", location: "Baixa, Lisbon",          rating: 8.4, ratingSource: "TripAdvisor",    reviewCount: 1600, highlights: ["Central Baixa location", "Simple comfortable rooms", "Great value"] },
  ],
  porto: [
    { name: "The Yeatman",              stars: 5, hotelType: "resort",   location: "Vila Nova de Gaia, Porto", rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1400, highlights: ["Michelin-starred restaurant", "Infinity pool over the Douro", "Wine-themed suites"] },
    { name: "Torel Avantgarde",         stars: 4, hotelType: "boutique", location: "Bonfim, Porto",            rating: 9.2, ratingSource: "TripAdvisor",    reviewCount: 780,  highlights: ["Art-themed suites", "Panoramic city terrace", "Design-forward"] },
    { name: "Pestana Vintage Porto",    stars: 4, hotelType: "hotel",    location: "Ribeira, Porto",           rating: 8.9, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["UNESCO riverside setting", "Historic townhouses", "River views"] },
    { name: "Guest House Douro",        stars: 3, hotelType: "guesthouse", location: "Ribeira, Porto",         rating: 8.5, ratingSource: "Google Reviews", reviewCount: 900,  highlights: ["River-view rooms", "Family-run", "Central Ribeira location"] },
  ],
  barcelona: [
    { name: "Hotel Arts Barcelona",     stars: 5, hotelType: "resort",   location: "Port Olímpic, Barcelona",  rating: 9.4, ratingSource: "Google Reviews", reviewCount: 2400, highlights: ["Beachfront skyscraper", "Michelin dining", "Rooftop pool"] },
    { name: "Hotel Neri",               stars: 4, hotelType: "boutique", location: "Gothic Quarter, Barcelona", rating: 9.2, ratingSource: "Booking.com",   reviewCount: 780,  highlights: ["14th-century palace", "Gothic Quarter setting", "Intimate scale"] },
    { name: "Casa Bonay",               stars: 4, hotelType: "boutique", location: "Eixample, Barcelona",      rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 1200, highlights: ["Design-led rooms", "Rooftop bar", "Central Eixample location"] },
    { name: "Hostal Grau",              stars: 3, hotelType: "guesthouse", location: "El Raval, Barcelona",    rating: 8.5, ratingSource: "Google Reviews", reviewCount: 1600, highlights: ["Eco-friendly design", "Near MACBA museum", "Great value"] },
  ],
  madrid: [
    { name: "Rosewood Villa Magna",     stars: 5, hotelType: "hotel",    location: "Salamanca, Madrid",        rating: 9.4, ratingSource: "Google Reviews", reviewCount: 1800, highlights: ["Elegant Salamanca district", "Michelin dining", "Garden terrace"] },
    { name: "Only YOU Hotel Atocha",    stars: 4, hotelType: "boutique", location: "Atocha, Madrid",           rating: 9.0, ratingSource: "TripAdvisor",    reviewCount: 1400, highlights: ["Design-forward interiors", "Near Retiro Park", "Rooftop restaurant"] },
    { name: "Praktik Metropol",         stars: 4, hotelType: "hotel",    location: "Centro, Madrid",           rating: 8.7, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["Central Gran Vía location", "Balcony rooms", "Good value for the location"] },
    { name: "Hostal Central Palace Madrid", stars: 3, hotelType: "guesthouse", location: "Centro, Madrid",     rating: 8.3, ratingSource: "Google Reviews", reviewCount: 1900, highlights: ["Steps from Plaza Mayor", "Simple comfortable rooms", "Budget-friendly"] },
  ],
  seville: [
    { name: "Hotel Alfonso XIII",       stars: 5, hotelType: "hotel",    location: "Centro, Seville",          rating: 9.3, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Historic 1928 palace hotel", "Andalusian courtyard", "Walking distance to the Cathedral"] },
    { name: "Hotel Casa 1800",          stars: 4, hotelType: "boutique", location: "Santa Cruz, Seville",      rating: 9.2, ratingSource: "Booking.com",    reviewCount: 1600, highlights: ["19th-century mansion", "Courtyard with fountain", "Free afternoon tea"] },
    { name: "EME Catedral Hotel",       stars: 4, hotelType: "boutique", location: "Santa Cruz, Seville",      rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 1300, highlights: ["Rooftop views of the Cathedral", "Santa Cruz location", "Design-forward"] },
    { name: "Pensión San Pancracio",    stars: 3, hotelType: "guesthouse", location: "Santa Cruz, Seville",    rating: 8.4, ratingSource: "Google Reviews", reviewCount: 900,  highlights: ["Family-run", "Central Santa Cruz alleys", "Great value"] },
  ],
  london: [
    { name: "The Savoy",                stars: 5, hotelType: "hotel",    location: "Strand, London",           rating: 9.4, ratingSource: "Google Reviews", reviewCount: 3200, highlights: ["Iconic Thames-side address", "Art Deco glamour", "Legendary afternoon tea"] },
    { name: "The Zetter Townhouse",     stars: 4, hotelType: "boutique", location: "Clerkenwell, London",      rating: 9.1, ratingSource: "Booking.com",    reviewCount: 980,  highlights: ["Quirky Georgian townhouse", "Cocktail parlour", "Intimate scale"] },
    { name: "The Hoxton Shoreditch",    stars: 4, hotelType: "boutique", location: "Shoreditch, London",       rating: 9.0, ratingSource: "TripAdvisor",    reviewCount: 2400, highlights: ["Design-led rooms", "Buzzy East London location", "Lively lobby bar"] },
    { name: "Premier Inn London County Hall", stars: 3, hotelType: "hotel", location: "South Bank, London",    rating: 8.5, ratingSource: "Google Reviews", reviewCount: 5600, highlights: ["Riverside location by the London Eye", "Reliable comfort", "Good value for central London"] },
  ],
  edinburgh: [
    { name: "The Witchery by the Castle", stars: 5, hotelType: "boutique", location: "Royal Mile, Edinburgh", rating: 9.5, ratingSource: "TripAdvisor",    reviewCount: 620,  highlights: ["Gothic opulent suites", "Steps from the castle", "Legendary atmosphere"] },
    { name: "The Balmoral",             stars: 5, hotelType: "hotel",    location: "Princes Street, Edinburgh", rating: 9.4, ratingSource: "Google Reviews", reviewCount: 1900, highlights: ["Iconic clock tower landmark", "Castle views", "Michelin-starred dining on-site"] },
    { name: "Fingal",                   stars: 4, hotelType: "boutique", location: "Leith, Edinburgh",         rating: 9.2, ratingSource: "Booking.com",    reviewCount: 890,  highlights: ["Converted 1960s lighthouse ship", "Leith waterfront", "Nautical Art Deco design"] },
    { name: "Ibis Edinburgh Centre",    stars: 3, hotelType: "hotel",    location: "Royal Mile, Edinburgh",    rating: 8.1, ratingSource: "Google Reviews", reviewCount: 2600, highlights: ["Central Royal Mile location", "Simple reliable rooms", "Budget-friendly"] },
  ],
  glasgow: [
    { name: "Kimpton Blythswood Square", stars: 5, hotelType: "hotel",   location: "Blythswood Square, Glasgow", rating: 9.2, ratingSource: "Google Reviews", reviewCount: 1600, highlights: ["Georgian townhouse setting", "Rooftop spa", "Central city location"] },
    { name: "Hotel du Vin Glasgow",     stars: 4, hotelType: "boutique", location: "West End, Glasgow",        rating: 9.0, ratingSource: "Booking.com",    reviewCount: 1300, highlights: ["Victorian townhouse conversion", "Wine-themed interiors", "West End location"] },
    { name: "Grasshoppers Hotel",       stars: 4, hotelType: "boutique", location: "Central Station, Glasgow", rating: 8.9, ratingSource: "TripAdvisor",    reviewCount: 1100, highlights: ["Quirky rooftop location above Central Station", "Free evening supper", "Great value boutique"] },
    { name: "Ibis Glasgow City Centre", stars: 3, hotelType: "hotel",    location: "City Centre, Glasgow",     rating: 8.0, ratingSource: "Google Reviews", reviewCount: 2400, highlights: ["Central location", "Simple reliable rooms", "Budget-friendly"] },
  ],
  dolomit: [
    { name: "Rosa Alpina",              stars: 5, hotelType: "boutique", location: "San Cassiano, Alta Badia",   rating: 9.7, ratingSource: "Google Reviews", reviewCount: 890,  highlights: ["St. Hubertus 3★ Michelin", "Ski-in/ski-out", "Legendary spa"] },
    { name: "Cristallo Resort & Spa",   stars: 5, hotelType: "resort",   location: "Cortina d'Ampezzo",          rating: 9.3, ratingSource: "TripAdvisor",    reviewCount: 1540, highlights: ["Palace hotel since 1901", "Panoramic Dolomite views", "Full spa"] },
    { name: "Hotel Adler Dolomiti",     stars: 4, hotelType: "resort",   location: "Val Gardena",                rating: 9.1, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["Ski-in/ski-out", "Panoramic pool", "Traditional South Tyrolean style"] },
    { name: "Chalet Gerard",            stars: 4, hotelType: "boutique", location: "Corvara, Alta Badia",        rating: 9.0, ratingSource: "Google Reviews", reviewCount: 1200, highlights: ["Authentic mountain chalet", "Panoramic terrace", "Local wine cellar"] },
    { name: "Hotel Posta Zirm",         stars: 3, hotelType: "hotel",    location: "Corvara, Alta Badia",        rating: 8.5, ratingSource: "Booking.com",    reviewCount: 2800, highlights: ["Classic mountain hotel", "Good ski access", "Traditional cuisine"] },
    { name: "Garni Pia",                stars: 3, hotelType: "guesthouse", location: "Ortisei, Val Gardena",     rating: 8.8, ratingSource: "TripAdvisor",    reviewCount: 1600, highlights: ["Family-run guesthouse", "Mountain breakfast", "Great value"] },
  ],
  tokyo: [
    { name: "Aman Tokyo",            stars: 5, hotelType: "boutique", location: "Otemachi, Tokyo",    rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1240, highlights: ["Stunning city views", "Aman spa", "Traditional aesthetics"] },
    { name: "The Peninsula Tokyo",   stars: 5, hotelType: "hotel",    location: "Yurakucho, Tokyo",   rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 2180, highlights: ["Impeccable service", "Michelin dining", "Ginza proximity"] },
    { name: "Park Hyatt Tokyo",      stars: 5, hotelType: "hotel",    location: "Shinjuku, Tokyo",    rating: 9.2, ratingSource: "Booking.com",    reviewCount: 3400, highlights: ["Lost in Translation fame", "Pool with Mt. Fuji views", "Jazz bar"] },
    { name: "Shinjuku Granbell",     stars: 4, hotelType: "boutique", location: "Shinjuku, Tokyo",    rating: 8.5, ratingSource: "Booking.com",    reviewCount: 4100, highlights: ["Design hotel", "Rooftop bar", "Great value"] },
    { name: "APA Hotel Shinjuku",    stars: 3, hotelType: "hotel",    location: "Kabukicho, Tokyo",   rating: 7.9, ratingSource: "TripAdvisor",    reviewCount: 6800, highlights: ["Central location", "Compact & clean", "Budget-friendly"] },
    { name: "Khaosan Tokyo Ninja",   stars: 3, hotelType: "guesthouse", location: "Asakusa, Tokyo",   rating: 8.1, ratingSource: "Booking.com",    reviewCount: 3200, highlights: ["Cultural district", "Quirky design", "Walking to temples"] },
  ],
  paris: [
    { name: "Le Bristol Paris",       stars: 5, hotelType: "hotel",    location: "8th arr., Paris",   rating: 9.5, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Palace hotel", "3★ Michelin restaurant", "Garden courtyard"] },
    { name: "Hôtel Costes",           stars: 4, hotelType: "boutique", location: "Rue Saint-Honoré",  rating: 8.9, ratingSource: "TripAdvisor",    reviewCount: 1850, highlights: ["Iconic Paris bar", "Stunning decor", "Fashion district"] },
    { name: "Mama Shelter Paris",     stars: 4, hotelType: "boutique", location: "20th arr., Paris",  rating: 8.4, ratingSource: "Booking.com",    reviewCount: 5200, highlights: ["Design-led boutique", "Great rooftop", "Vibrant neighborhood"] },
    { name: "Ibis Paris Gare de Lyon",stars: 3, hotelType: "hotel",    location: "12th arr., Paris",  rating: 7.8, ratingSource: "Booking.com",    reviewCount: 7400, highlights: ["Metro access", "Clean & reliable", "Budget pick"] },
    { name: "Generator Paris",        stars: 3, hotelType: "guesthouse", location: "10th arr., Paris",rating: 8.0, ratingSource: "TripAdvisor",    reviewCount: 4900, highlights: ["Trendy hostel-hotel", "Canal Saint-Martin", "Social atmosphere"] },
  ],
  iceland: [
    { name: "ION Adventure Hotel",    stars: 4, hotelType: "boutique", location: "Nesjavellir Geothermal Area", rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 870,  highlights: ["Northern lights viewing", "Lava field views", "Hot springs"] },
    { name: "Reykjavik EDITION",      stars: 5, hotelType: "hotel",    location: "Reykjavik harbor",           rating: 9.3, ratingSource: "Google Reviews", reviewCount: 1200, highlights: ["Harbor views", "Rooftop bar", "Spa"] },
    { name: "Hotel Rangá",            stars: 4, hotelType: "boutique", location: "South Iceland",               rating: 9.4, ratingSource: "Booking.com",    reviewCount: 640,  highlights: ["Aurora observatory", "Romantic", "Remote wilderness"] },
    { name: "Guesthouse Baldursbra",  stars: 3, hotelType: "guesthouse", location: "Reykjavik",                 rating: 8.3, ratingSource: "Booking.com",    reviewCount: 1100, highlights: ["Cosy guesthouse", "Walking distance to city", "Friendly hosts"] },
  ],
  default: [
    { name: "Four Seasons",           stars: 5, hotelType: "resort",   location: "City center",       rating: 9.3, ratingSource: "Google Reviews", reviewCount: 2800, highlights: ["World-class service", "Exceptional dining", "Spa"] },
    { name: "Rosewood Collection",    stars: 5, hotelType: "boutique", location: "Prime location",    rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 1900, highlights: ["Iconic design", "Butler service", "Local experiences"] },
    { name: "The Grand",              stars: 5, hotelType: "hotel",    location: "City center",       rating: 9.0, ratingSource: "Google Reviews", reviewCount: 2400, highlights: ["Grand heritage building", "Fine dining", "Concierge"] },
    { name: "Maison Boutique",        stars: 4, hotelType: "boutique", location: "Old town",          rating: 8.9, ratingSource: "Google Reviews", reviewCount: 1800, highlights: ["Local art collection", "Rooftop terrace", "Neighborhood feel"] },
    { name: "The Mercure",            stars: 3, hotelType: "hotel",    location: "City center",       rating: 8.0, ratingSource: "Booking.com",    reviewCount: 4500, highlights: ["Reliable mid-range", "Good location", "Clean rooms"] },
    { name: "ibis Styles",            stars: 3, hotelType: "hotel",    location: "Central district",  rating: 7.7, ratingSource: "TripAdvisor",    reviewCount: 5800, highlights: ["Great value", "Modern design", "Easy access"] },
  ],
};

// Florence, Venice, Naples, Milan, Sicily, Bologna, Tuscany, and Cinque
// Terre are no longer listed here — they're now direct HOTEL_DB keys, and
// resolvePool checks pool keys before consulting this alias map, so an
// explicit entry pointing them at "rome" would be dead code (and
// misleading to a future reader) rather than doing anything. Generic
// "italy" (no specific city given) still falls back to Rome's pool —
// a reasonable default, not a mismatch.
const HOTEL_ALIASES: Record<string, string> = {
  "positano": "amalfi", "ravello": "amalfi", "praiano": "amalfi", "sorrento": "amalfi",
  "cortina":  "dolomit","bolzano": "dolomit","merano":  "dolomit","alta badia": "dolomit",
  "val gardena": "dolomit","ortisei": "dolomit","corvara": "dolomit",
  "italy": "rome",
};

function findHotelBase(destination: string): (Partial<HotelOption> & { hotelType?: HotelType })[] {
  return resolvePool(destination, HOTEL_DB, HOTEL_ALIASES);
}


export async function searchHotels(params: HotelSearchParams): Promise<HotelOption[]> {
  // --- PRODUCTION SWAP POINT ---
  // const response = await fetch("https://distribution-xml.booking.com/2.0/json/hotels?...", {
  //   headers: { Authorization: `Basic ${process.env.BOOKING_API_KEY}` },
  // });
  // return transformBookingResponse(response);

  const base = findHotelBase(params.destination);
  const maxPrice = params.max_price_per_night ?? 300;  // conservative default — AI should pass explicit value
  const minStars = params.min_stars ?? 3;
  const requestedTypes = (params.types ?? []) as RequestedType[];

  // Per-night price bands by star rating
  const priceBand: Record<number, [number, number]> = {
    5: [350, 900],
    4: [150, 350],
    3: [60, 150],
  };

  // Map user-facing lodging types to internal hotel type tags. This mock
  // inventory has no dedicated "hostel" entries, so a hostel request maps to
  // the nearest existing category — budget-tier "guesthouse" listings —
  // rather than either fabricating data per city or (the previous bug)
  // silently matching every hotel type regardless of what was asked for.
  function matchesType(h: Partial<HotelOption> & { hotelType?: HotelType }): boolean {
    if (requestedTypes.length === 0) return true;
    const ht = h.hotelType ?? "hotel";
    return requestedTypes.some((t) => {
      if (t === "boutique") return ht === "boutique";
      if (t === "hotel")    return ht === "hotel";
      if (t === "resort")   return ht === "resort";
      if (t === "hostel")   return ht === "guesthouse";
      return true; // airbnb, other free-text types → show all (AirBnB-only handled in UI)
    });
  }

  const passStars = (h: Partial<HotelOption> & { hotelType?: HotelType }) => (h.stars ?? 5) >= minStars;
  const passPrice = (h: Partial<HotelOption> & { hotelType?: HotelType }) => {
    const [lo] = priceBand[h.stars ?? 5] ?? [60, 900];
    return lo <= maxPrice;
  };

  // Mock inventory per city/star-tier is small enough that a narrow filter
  // (e.g. "boutique" + 4★ minimum) can leave only 1 real match — too few to
  // fill the standard 3-card comparison. Backfill with the next-best
  // matches, relaxing type then price then stars, so there's always
  // something to show; strict matches are always ranked first, and within
  // each relaxation tier results are still rating-sorted.
  const tiers = [
    base.filter((h) => passStars(h) && passPrice(h) && matchesType(h)),
    base.filter((h) => passStars(h) && passPrice(h)),
    base.filter((h) => passStars(h)),
    base,
  ];
  const seen = new Set<string>();
  const ranked: (Partial<HotelOption> & { hotelType?: HotelType })[] = [];
  for (const tier of tiers) {
    for (const h of [...tier].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))) {
      if (seen.has(h.name!)) continue;
      seen.add(h.name!);
      ranked.push(h);
    }
  }

  return ranked
    // Capped at `limit` (well above what any caller currently shows) so a
    // real production API — potentially returning hundreds of results —
    // doesn't get fully constructed here just to be discarded downstream.
    .slice(0, params.limit ?? 12)
    .map((h) => {
      const [lo, hi] = priceBand[h.stars ?? 5] ?? [60, 900];
      const GENERIC = new Set(["city center", "prime location", "old town", "central district"]);
      const rawLoc = (h.location ?? "").toLowerCase();
      const fullLocation = GENERIC.has(rawLoc) ? params.destination : (h.location ?? params.destination);
      return {
        id: uuid(),
        name: h.name!,
        stars: h.stars!,
        location: fullLocation,
        city: params.destination,
        pricePerNight: Math.min(randomInt(lo, hi), maxPrice),
        currency: "USD",
        rating: h.rating!,
        ratingSource: h.ratingSource,
        reviewCount: h.reviewCount!,
        highlights: h.highlights!,
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(h.name!)}/800/400`,
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(h.name + " " + params.destination)}&order=score`,
      };
    });
}
