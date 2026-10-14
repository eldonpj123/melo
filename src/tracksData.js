// Spotify Clone Track Library & Mock/Fallback Audio Sources
// Uses studio quality royalty-free streaming audio tracks with real lyrics and metadata

export const sampleTracks = [
  {
    id: "tr-1",
    title: "Midnight City Lights",
    artist: "Neon Skyline",
    album: "Cyberpunk Nights",
    duration: 218, // seconds
    cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=synthwave-80s-110045.mp3",
    genre: "Synthwave",
    popular: true,
    lyrics: [
      { time: 0, text: "♪ (Upbeat synth intro playing) ♪" },
      { time: 12, text: "Walking down the neon street tonight" },
      { time: 18, text: "Glowing signs reflect in rain so bright" },
      { time: 25, text: "City beats are pulsing through the floor" },
      { time: 31, text: "We keep on dancing, asking for more" },
      { time: 42, text: "Midnight city, take me high" },
      { time: 48, text: "Underneath the velvet electric sky" },
      { time: 55, text: "Feel the frequency in your heart" },
      { time: 61, text: "We're never gonna fall apart" },
      { time: 75, text: "♪ (Synth solo breakdown) ♪" },
      { time: 95, text: "Shadows fade away as morning comes" },
      { time: 102, text: "Lost inside the echo of the drums" },
      { time: 115, text: "Midnight city, take me high..." }
    ]
  },
  {
    id: "tr-2",
    title: "Lo-Fi Coffee & Rain",
    artist: "Aura Beats",
    album: "Quiet Study Sessions",
    duration: 165,
    cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3",
    genre: "Lo-Fi",
    popular: true,
    lyrics: [
      { time: 0, text: "♪ (Soft piano & gentle rain ambience) ♪" },
      { time: 10, text: "Steam rising from a warm mug" },
      { time: 20, text: "Wrapped up tight in a cozy rug" },
      { time: 30, text: "Droplets falling on the window glass" },
      { time: 45, text: "Watching peaceful moments pass" },
      { time: 60, text: "♪ (Chill vinyl crackle loop) ♪" },
      { time: 80, text: "No rush, no stress in the air" },
      { time: 100, text: "Just quiet thoughts everywhere" }
    ]
  },
  {
    id: "tr-3",
    title: "Solar Flare",
    artist: "Cosmic Horizon",
    album: "Deep Space Exploration",
    duration: 245,
    cover: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73220.mp3?filename=ambient-future-10777.mp3",
    genre: "Electronic",
    popular: true,
    lyrics: [
      { time: 0, text: "♪ (Space ambient pads opening) ♪" },
      { time: 20, text: "Signals transmitting through deep space" },
      { time: 35, text: "Searching for a distant time and place" },
      { time: 50, text: "Solar flare ignition light" },
      { time: 65, text: "Shining endless through the night" },
      { time: 90, text: "♪ (Bass drop & electronic pulse) ♪" }
    ]
  },
  {
    id: "tr-4",
    title: "Electric Horizon",
    artist: "Cyber Pulse",
    album: "Overdrive 2099",
    duration: 198,
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f73365.mp3?filename=cyberpunk-2099-123000.mp3",
    genre: "Synthwave",
    popular: false,
    lyrics: [
      { time: 0, text: "♪ (Heavy synth bassline) ♪" },
      { time: 15, text: "Speeding down the grid at top gear" },
      { time: 30, text: "No destination, no room for fear" },
      { time: 45, text: "Neon laser beam in sight" },
      { time: 60, text: "Welcome to the digital night!" }
    ]
  },
  {
    id: "tr-5",
    title: "Acoustic Sunset",
    artist: "Maya Rivers",
    album: "Golden Hour Melodies",
    duration: 180,
    cover: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&q=80",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c268a73562.mp3?filename=acoustic-guitar-chill-10850.mp3",
    genre: "Acoustic",
    popular: true,
    lyrics: [
      { time: 0, text: "♪ (Fingerpicked acoustic guitar) ♪" },
      { time: 10, text: "Sun goes down behind the hill" },
      { time: 22, text: "Everything is quiet and still" },
      { time: 35, text: "Guitar strings softly play" },
      { time: 48, text: "Washing all the worries away" }
    ]
  },
  {
    id: "tr-6",
    title: "Starlight Drive",
    artist: "The Retrowave Collective",
    album: "Vapor Highway",
    duration: 210,
    cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/11/06/audio_2452e85a6a.mp3?filename=starlight-retrowave-126000.mp3",
    genre: "Synthwave",
    popular: false,
    lyrics: [
      { time: 0, text: "♪ (Driving 80s drums) ♪" },
      { time: 18, text: "Windows down, coastal air" },
      { time: 32, text: "Starlight shining in your hair" },
      { time: 50, text: "Memories fading in the rearview mirror" }
    ]
  }
];

export const samplePlaylists = [
  {
    id: "pl-1",
    name: "Cyberpunk Beats 2088",
    description: "High energy retrowave & synthwave tracks for coding & driving.",
    cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80",
    trackIds: ["tr-1", "tr-4", "tr-6"]
  },
  {
    id: "pl-2",
    name: "Lo-Fi Study & Focus",
    description: "Relaxing chillhop & acoustic loops for deep work sessions.",
    cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80",
    trackIds: ["tr-2", "tr-5"]
  },
  {
    id: "pl-3",
    name: "Top 50 Global Hits",
    description: "The most played songs right now across the world.",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
    trackIds: ["tr-1", "tr-2", "tr-3", "tr-5"]
  }
];
