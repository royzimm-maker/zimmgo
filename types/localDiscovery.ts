// Shape of the curated Local Discovery guide (lib/data/localDiscovery.ts,
// served by /api/local-discovery). Types only, so client code can use them
// without pulling the data itself into the browser bundle.

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
