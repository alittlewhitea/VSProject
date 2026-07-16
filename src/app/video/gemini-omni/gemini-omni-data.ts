export type GeminiOmniExample = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  supplemental: string;
  videoUrl: string;
  poster: string;
  tags: readonly string[];
  detailsTitle: string;
  details: string | readonly string[];
  detailsKind: "text" | "ordered" | "unordered" | "storyboard";
  uploadDate: string;
  duration: string;
};

const mediaBaseUrl = "https://media.dreamface.io/Gemini%20Omni";

export const geminiOmniExamples: readonly GeminiOmniExample[] = [
  {
    id: "anime-stickers",
    eyebrow: "STYLE TRANSFORMATION",
    title: "Turn the Real World into Anime Stickers",
    description:
      "A live-action street vlog transforms into a playful 2D anime world. Zebra crossings, a baby T-Rex, flying fish and animated shadows appear while the original street perspective and physical movement remain visually connected.",
    supplemental:
      "The sequence was designed around one shared prompt direction across five clips, helping the visual language stay consistent from scene to scene.",
    videoUrl: `${mediaBaseUrl}/Gemini-Omni-Anime-Stickers.mp4`,
    poster: "/images/gemini-omni/gemini-omni-anime-stickers-poster.webp",
    tags: ["Anime Stickers", "Live Action", "Style Transfer", "Scene Consistency"],
    detailsTitle: "Creative Direction",
    details:
      "Blend a live-action street vlog with flat 2D anime stickers. Use a magic marker as the transformation trigger, keep the added elements aligned with the street perspective and preserve believable motion throughout the sequence.",
    detailsKind: "text",
    uploadDate: "2026-07-16T14:03:13+08:00",
    duration: "PT50S"
  },
  {
    id: "flash-video-generation",
    eyebrow: "VIDEO GENERATION",
    title: "Generate and Refine Video with Natural Language",
    description:
      "Gemini Omni Flash is designed for high-quality, cost-efficient video workflows in which creators can generate scenes and continue refining them through simple conversational instructions.",
    supplemental:
      "Instead of relying only on a single prompt, the workflow emphasizes iteration: create an initial result, describe what should change and continue developing the video step by step.",
    videoUrl: `${mediaBaseUrl}/Gemini-Omni-Flash-Video-Generation.mp4`,
    poster: "/images/gemini-omni/gemini-omni-flash-video-generation-poster.webp",
    tags: ["Video Generation", "Natural Language", "Iterative Editing", "Multimodal Workflow"],
    detailsTitle: "Workflow",
    details: [
      "Provide a prompt or reference.",
      "Generate the first version.",
      "Describe the visual, motion or scene changes.",
      "Review and continue refining the result."
    ],
    detailsKind: "ordered",
    uploadDate: "2026-07-16T14:03:13+08:00",
    duration: "PT19S"
  },
  {
    id: "asmr-storyboard",
    eyebrow: "STORYBOARD TO VIDEO",
    title: "Build an ASMR Product Video from a Storyboard",
    description:
      "A structured product storyboard defines the pacing, shots, hand movements, sound cues and dialogue for a 30-second ASMR unboxing concept. The sequence demonstrates how image generation, planning and video creation can work together in one production workflow.",
    supplemental:
      "The concept uses POV hands, warm product photography, close-up textures and carefully timed actions such as crinkling, tearing, pouring and stirring.",
    videoUrl: `${mediaBaseUrl}/Gemini-Omni-ASMR-Storyboard.mp4`,
    poster: "/images/gemini-omni/gemini-omni-asmr-storyboard-poster.webp",
    tags: ["ASMR", "Product Video", "Storyboard", "Commercial Creative"],
    detailsTitle: "Storyboard Structure",
    details: [
      "Introduce the product box",
      "Open the packaging",
      "Reveal the sachets",
      "Select one sachet",
      "Capture the crinkle sound",
      "Tear the packaging",
      "Reveal the product texture",
      "Pour into a mug",
      "Add hot water",
      "Stir the drink",
      "Show the finished texture",
      "End with the product and a thumbs-up"
    ],
    detailsKind: "storyboard",
    uploadDate: "2026-07-16T14:03:08+08:00",
    duration: "PT30S"
  },
  {
    id: "world-understanding",
    eyebrow: "WORLD UNDERSTANDING",
    title: "Create New Scenes from Photos, Video and Audio",
    description:
      "Gemini Omni explores a broader form of multimodal creation in which photos, video, audio and written instructions can contribute to a new scene. Creators can also provide their own footage and continue iterating on an idea instead of starting over for every edit.",
    supplemental:
      "This workflow is designed to connect visual understanding with video creation, making it possible to reshape environments, actions, objects and story direction through successive instructions.",
    videoUrl: `${mediaBaseUrl}/Gemini-Omni-World-Understanding.mp4`,
    poster: "/images/gemini-omni/gemini-omni-world-understanding-poster.webp",
    tags: ["World Understanding", "Multimodal Editing", "Video Transformation", "Creative Iteration"],
    detailsTitle: "What You Can Explore",
    details: [
      "Restyle an existing video",
      "Introduce a new object or character",
      "Change the environment",
      "Use an image as a visual reference",
      "Refine the result through follow-up instructions"
    ],
    detailsKind: "unordered",
    uploadDate: "2026-07-16T14:03:06+08:00",
    duration: "PT9S"
  }
] as const;

export const geminiOmniFaq = [
  {
    question: "What is Gemini Omni?",
    answer:
      "Gemini Omni is a multimodal model concept focused on understanding and creating across text, images, video and audio. For video workflows, it is designed to support both generation and iterative editing through natural-language instructions."
  },
  {
    question: "What is Gemini Omni Flash?",
    answer:
      "Gemini Omni Flash refers to a video-focused model designed for high-quality, cost-efficient generation and conversational editing across multimodal workflows."
  },
  {
    question: "Can Gemini Omni edit an existing video?",
    answer:
      "Its editing workflow is designed to accept source footage and instructions describing changes to style, objects, characters, environments or actions. The exact options available depend on the platform and implementation being used."
  },
  {
    question: "What inputs can be used with Gemini Omni?",
    answer:
      "The broader workflow can involve text prompts and multimodal reference material such as images, video and audio. Available input types and limits may vary by product or API implementation."
  },
  {
    question: "What is conversational video editing?",
    answer:
      "Conversational video editing means refining a video using follow-up natural-language instructions, rather than rebuilding the entire project after every change."
  },
  {
    question: "Can Gemini Omni create anime-style videos?",
    answer:
      "It can be used for visual transformation concepts such as combining live-action footage with illustrated or anime-inspired elements, as demonstrated in the examples on this page."
  },
  {
    question: "Is Gemini Omni available on Dreamface?",
    answer:
      "Yes. Gemini Omni Flash is available as a selectable model in Dreamface's AI Video workspace for text-to-video and image-to-video workflows. Model availability can change, so open the generator to see the latest supported options."
  }
] as const;
