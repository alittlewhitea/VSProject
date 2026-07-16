export type SeedanceExample = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlight: string;
  videoUrl: string;
  poster: string;
  tags: readonly string[];
  detailsTitle: string;
  details: string | readonly string[];
  detailsKind: "prompt" | "workflow";
  uploadDate: string;
  duration: string;
};

const mediaBaseUrl = "https://media.dreamface.io/Seedance2.0";

export const seedanceExamples: readonly SeedanceExample[] = [
  {
    id: "ai-discourse-meme",
    eyebrow: "AI MEME",
    title: "AI Discourse as a Meme",
    description: "A satirical take on modern AI discussions using exaggerated cinematic storytelling and absurd humor.",
    highlight: "Shows how short-form comedy can be combined with expressive character performance and fast-paced editing.",
    videoUrl: `${mediaBaseUrl}/Seedance-2.0-AI-Discourse-Meme.mp4`,
    poster: "/images/seedance-2/seedance-2-ai-discourse-meme-poster.webp",
    tags: ["Comedy", "Meme", "Storytelling", "Social Video"],
    detailsTitle: "Prompt Summary",
    details: "Summarize today's AI discourse as an over-the-top cinematic meme.",
    detailsKind: "prompt",
    uploadDate: "2026-07-16T14:37:41+08:00",
    duration: "PT16S"
  },
  {
    id: "friends-road-trip",
    eyebrow: "CHARACTER STORY",
    title: "A Road Trip That Goes Completely Wrong",
    description: "A light-hearted story about friends heading out for a drive before everything unexpectedly escalates.",
    highlight: "Demonstrates multiple characters, vehicle motion and narrative pacing.",
    videoUrl: `${mediaBaseUrl}/Seedance-2.0-Friends-Road-Trip.mp4`,
    poster: "/images/seedance-2/seedance-2-friends-road-trip-poster.webp",
    tags: ["Friends", "Driving", "Comedy", "Narrative"],
    detailsTitle: "Prompt Summary",
    details: "Create a fun road trip that slowly turns into complete chaos.",
    detailsKind: "prompt",
    uploadDate: "2026-07-16T14:37:34+08:00",
    duration: "PT15S"
  },
  {
    id: "storyboard-to-film",
    eyebrow: "FILM WORKFLOW",
    title: "Turn Storyboards into Cinematic Scenes",
    description: "A workflow that combines storyboard generation with AI video creation, transforming visual planning into a complete cinematic sequence.",
    highlight: "Visual planning gives each shot a clearer role before motion is introduced.",
    videoUrl: `${mediaBaseUrl}/Seedance-2.0-Storyboard-to-Film.mp4`,
    poster: "/images/seedance-2/seedance-2-storyboard-to-film-poster.webp",
    tags: ["Storyboard", "Film", "Workflow", "Creative Pipeline"],
    detailsTitle: "Creative Workflow",
    details: ["ChatGPT Image 2", "Storyboard", "Seedance 2.0", "Film Scene"],
    detailsKind: "workflow",
    uploadDate: "2026-07-16T14:37:35+08:00",
    duration: "PT15S"
  },
  {
    id: "new-legend-ride",
    eyebrow: "ACTION SCENE",
    title: "A New Legend Joins the Ride",
    description: "A dramatic character introduction built around cinematic action, expressive animation and dynamic camera movement.",
    highlight: "Designed for entertaining, highly shareable short-form content.",
    videoUrl: `${mediaBaseUrl}/Seedance-2.0-New-Legend-Ride.mp4`,
    poster: "/images/seedance-2/seedance-2-new-legend-ride-poster.webp",
    tags: ["Action", "Character", "Vehicles", "Entertainment"],
    detailsTitle: "Prompt Summary",
    details: "Introduce a legendary new character through an over-the-top action sequence.",
    detailsKind: "prompt",
    uploadDate: "2026-07-16T14:38:15+08:00",
    duration: "PT30S"
  }
] as const;

export const seedanceFaq = [
  {
    question: "What is Seedance 2.0?",
    answer: "Seedance 2.0 is an AI video model focused on expressive motion, cinematic scenes and story-driven video creation from creative prompts and references."
  },
  {
    question: "What makes Seedance different?",
    answer: "Its creative appeal comes from combining character performance, camera movement and narrative pacing in workflows designed around visual storytelling rather than isolated technical demonstrations."
  },
  {
    question: "Can it create cinematic videos?",
    answer: "Yes. Seedance 2.0 can be used to explore cinematic framing, action, atmosphere and camera movement. The final result still depends on the prompt, source material and selected generation settings."
  },
  {
    question: "Can it generate meme videos?",
    answer: "It can support comedic and meme-style concepts that use recognizable situations, exaggerated performances and fast visual storytelling."
  },
  {
    question: "Can it be used for storytelling?",
    answer: "Yes. Creators can plan a short narrative, define characters and scenes, then use iterative generation to develop the idea into a more complete sequence."
  },
  {
    question: "Can it create social media videos?",
    answer: "Seedance 2.0 can be used for short-form entertainment, character clips, cinematic concepts and other creative videos intended for social platforms."
  },
  {
    question: "How does Dreamface support AI video creation?",
    answer: "Dreamface provides an AI Video workspace where Seedance 2.0 is available as a selectable model for supported text-to-video and image-to-video workflows. Model options and availability may change over time."
  }
] as const;
