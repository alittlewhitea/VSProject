type FeaturedVideoRatio = "16x9" | "1x1";

export const studioFeaturedVideos = [
  {
    key: "baseball", file: "baseball-game-broadcast-shot", ratio: "16x9", width: 1280, height: 716,
    prompt: "A baseball game broadcast shot - person sits in stadium stands in a team jersey, watching the field and posing softly like a viral stargirl moment caught on live TV."
  },
  {
    key: "cgi", file: "cgi-breakdown-reveal", ratio: "16x9", width: 1280, height: 720,
    prompt: "CGI breakdown reveal - mesh to beauty pass, each render layer cuts in sequence, turntable camera, ending on the final polished visual."
  },
  {
    key: "tokyo", file: "tokyo-night-street-racing", ratio: "16x9", width: 1280, height: 720,
    prompt: "Tokyo night street racing - cars drift and donut around the character, low angles and 35mm film grain, blockbuster reveal."
  },
  {
    key: "spectator", file: "spectator-sprints-from-the-stands", ratio: "1x1", width: 1280, height: 1280,
    prompt: "Spectator sprints from the stands, jumps fences, evades security, charges onto the pitch and strikes - all in one continuous telephoto take."
  }
] as const;

export function studioFeaturedVideoUrl(file: string, ratio: FeaturedVideoRatio) {
  return `https://media.dreamface.io/ai_video/${ratio}/${file}-${ratio}.mp4`;
}

export function studioFeaturedVideoHref(prompt: string) {
  return `/studio?mode=video&workflow=text-to-video&duration=5s&prompt=${encodeURIComponent(prompt)}`;
}
