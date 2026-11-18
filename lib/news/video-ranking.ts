// Classement explicable des vidéos : aucun appel réseau ni IA nécessaire.
// Les liens et métadonnées des plateformes sont des signaux, pas des preuves.
export type VideoCandidate = {
  id: string;
  title: string | null;
  author: string | null;
  publishedAt: string;
  live: boolean;
  source: "youtube" | "web" | "mastodon" | "report";
};

export type VideoRanking = { score: number; matchedLocation: boolean; matchedTopic: boolean };

const TOPICS = [
  "manifestation", "manifestations", "manif", "greve", "grève", "protest", "protests",
  "protesting", "strike", "strikes", "rally", "demonstration", "manifestacion",
  "manifestación", "protesta", "protesto", "مظاهرة", "احتجاج", "تظاهرة",
];

export function normalizeVideoText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function scoreVideo(video: VideoCandidate, location: string, now = Date.now()): VideoRanking {
  const text = normalizeVideoText([video.title, video.author].filter(Boolean).join(" "));
  const city = normalizeVideoText(location.split(",")[0] ?? "");
  const matchedLocation = city.length >= 3 && (` ${text} `).includes(` ${city} `);
  const matchedTopic = TOPICS.some((word) => (` ${text} `).includes(` ${normalizeVideoText(word)} `));
  const ageHours = (now - Date.parse(video.publishedAt)) / 3_600_000;
  let score = matchedLocation ? 35 : 0;
  if (matchedTopic) score += 25;
  if (Number.isFinite(ageHours) && ageHours >= 0) {
    if (ageHours <= 6) score += 20;
    else if (ageHours <= 24) score += 12;
    else if (ageHours <= 72) score += 4;
    else if (ageHours > 168) score -= 25;
  }
  if (video.live) score += 15;
  // Un signalement est une piste communautaire, jamais une vérification indépendante.
  if (video.source === "report") score += 5;
  return { score, matchedLocation, matchedTopic };
}

export function rankVideos<T extends VideoCandidate>(videos: T[], location: string, now = Date.now()): T[] {
  return [...videos].sort((a, b) => {
    const scoreDiff = scoreVideo(b, location, now).score - scoreVideo(a, location, now).score;
    return scoreDiff || Number(b.live) - Number(a.live) || b.publishedAt.localeCompare(a.publishedAt);
  });
}
