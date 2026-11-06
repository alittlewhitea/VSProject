import { seedanceExamples } from "../../app/video/seedance-2/seedance-2-data";

const roadTrip = seedanceExamples.find(example => example.id === "friends-road-trip")!;

/** Existing DreamFace media only. Posters are captures of the matching video. */
export const studioEditorialMedia = {
  cgi: {
    title: "CGI breakdown reveal",
    videoUrl: "https://media.dreamface.io/ai_video/16x9/cgi-breakdown-reveal-16x9.mp4",
    posterUrl: "/images/studio/cgi-breakdown-reveal.webp",
    prompt: "CGI breakdown reveal - mesh to beauty pass, each render layer cuts in sequence, turntable camera, ending on the final polished visual.",
    duration: "7s",
    ratio: "16:9"
  },
  tokyo: {
    title: "Tokyo night street racing",
    videoUrl: "https://media.dreamface.io/ai_video/16x9/tokyo-night-street-racing-16x9.mp4",
    posterUrl: "/images/studio/tokyo-night-street-racing.webp",
    prompt: "Tokyo night street racing - cars drift and donut around the character, low angles and 35mm film grain, blockbuster reveal.",
    duration: "9s",
    ratio: "16:9"
  },
  roadTrip: {
    title: roadTrip.title,
    videoUrl: roadTrip.videoUrl,
    posterUrl: roadTrip.poster,
    prompt: String(roadTrip.details),
    duration: "15s",
    ratio: "16:9",
    provider: "seedance-video"
  }
} as const;
