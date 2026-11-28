import type { Locale } from "../i18n/routing";

export type HomeShowcaseMode = "video" | "image" | "avatar" | "audio";

export type HomeShowcaseSlide = {
  id: string;
  key: "ugc" | "tiktok" | "pet-sing-dance" | "ads" | "motion";
  posterUrl: string;
  videoUrl?: string;
  href: string;
  hot?: boolean;
};

export type HomeShowcasePill = {
  id: string;
  emoji: string;
  label: string;
  mode: HomeShowcaseMode;
  prompt: string;
};

export type HomeStudioShowcaseCopy = {
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  hotBadge: string;
  cardTry: string;
  cardOpen: string;
  slides: Record<HomeShowcaseSlide["key"], string>;
  modes: Record<HomeShowcaseMode, string>;
  placeholders: Record<HomeShowcaseMode, string>;
  submitLabel: string;
  pills: [HomeShowcasePill, HomeShowcasePill, HomeShowcasePill, HomeShowcasePill];
  carouselAriaLabel: string;
  promptAriaLabel: string;
  modeGroupAriaLabel: string;
};

export const HOME_SHOWCASE_MODES: readonly HomeShowcaseMode[] = ["video", "image", "avatar", "audio"] as const;

export const HOME_SHOWCASE_SLIDES: readonly HomeShowcaseSlide[] = [
  {
    id: "home-showcase-ugc",
    key: "ugc",
    posterUrl:
      "https://cdn.higgsfield.ai/cdn-cgi/image/width=480,quality=80,format=auto/user_3Cfdr00kbZ1hJCLpPQkaicInqxv/hf_20260603_150008_ee9cf142-7741-40e9-8076-897fb0947742_thumbnail.webp",
    videoUrl:
      "https://d29nkk4626dxhc.cloudfront.net/marketing_studio_video_preset/c9f0c947-946a-4e15-b124-b7031b432434-983df3ca6a193776.mp4",
    href: "/studio?mode=video&workflow=text-to-video"
  },
  {
    id: "home-showcase-tiktok",
    key: "tiktok",
    posterUrl:
      "https://d29nkk4626dxhc.cloudfront.net/marketing_studio_preset_thumbnails/a9af9e6c-f2ca-4bc6-8681-bb8e132a0af3-685ceb1fb93b1eee.jpg",
    videoUrl:
      "https://d29nkk4626dxhc.cloudfront.net/marketing_studio_video_preset/a9af9e6c-f2ca-4bc6-8681-bb8e132a0af3-90973eabda978417.mp4",
    href: "/studio?mode=video&workflow=image-to-video"
  },
  {
    id: "home-showcase-pet-sing-dance",
    key: "pet-sing-dance",
    posterUrl: "https://media.dreamface.io/images/studio-pet-sing-dance-carousel-poster.webp",
    videoUrl: "https://media.dreamface.io/videos/studio-pet-sing-dance-carousel.mp4",
    href: "/studio?view=apps&app=pet-sing-dance",
    hot: true
  },
  {
    id: "home-showcase-ads",
    key: "ads",
    posterUrl:
      "https://cdn.higgsfield.ai/cdn-cgi/image/width=480,quality=80,format=auto/marketing-studio-v2-ad/bfb667bd-81ee-464f-badb-3c03eacc6d2d.webp",
    href: "/studio?mode=image&workflow=text-to-image"
  },
  {
    id: "home-showcase-motion",
    key: "motion",
    posterUrl:
      "https://cdn.higgsfield.ai/cdn-cgi/image/width=480,quality=80,format=auto/marketing-studio-motion-preview/eb685bb2-9aa9-42e1-bd9f-3296a5b7eae9.webp",
    videoUrl:
      "https://cdn.higgsfield.ai/marketing-studio-motion-preview/68a696dc-2c2e-43b1-b285-511c8783db1f.mp4",
    href: "/studio?mode=video&workflow=text-to-video"
  }
] as const;

export function buildHomeShowcaseStudioHref(mode: HomeShowcaseMode, prompt: string): string {
  const workflow =
    mode === "avatar"
      ? "avatar-video"
      : mode === "image"
        ? "text-to-image"
        : mode === "audio"
          ? "text-to-audio"
          : "text-to-video";
  const params = new URLSearchParams({ mode, workflow });
  const trimmed = prompt.trim();
  if (trimmed) {
    params.set("prompt", trimmed.slice(0, 800));
  }
  return `/studio?${params.toString()}`;
}

const EN: HomeStudioShowcaseCopy = {
  eyebrow: "Interactive Studio Preview",
  titlePrefix: "Pick a viral style or",
  titleAccent: "type a prompt",
  subtitle: "Start creating right from the homepage — your prompt carries straight into DreamFace Studio with zero setup.",
  hotBadge: "HOT",
  cardTry: "Try",
  cardOpen: "Open",
  slides: {
    ugc: "UGC",
    tiktok: "TikTok",
    "pet-sing-dance": "Pet Sing & Dance",
    ads: "Ads",
    motion: "Motion"
  },
  modes: {
    video: "Video",
    image: "Image",
    avatar: "Avatar",
    audio: "Audio"
  },
  placeholders: {
    video: "Describe the video you want to create — e.g. Three fluffy kittens in winter mittens singing and dancing under cozy fairy lights...",
    image: "Describe the image you want to generate — e.g. Luxury perfume bottle on wet volcanic stone with cyan rim lighting...",
    avatar: "Write the script for your AI presenter — e.g. Welcome to our product launch! Here are 3 reasons creators love it...",
    audio: "Enter narration text or describe the voiceover you want to generate..."
  },
  submitLabel: "Create in Studio",
  pills: [
    {
      id: "pet",
      emoji: "🐱",
      label: "Pet Sing & Dance",
      mode: "video",
      prompt: "Three fluffy kittens in knitted mittens singing and dancing happily under cozy winter lights, viral TikTok style"
    },
    {
      id: "ad",
      emoji: "🎬",
      label: "Product Video Ad",
      mode: "video",
      prompt: "Macro slow-motion commercial of an iced matcha latte splashing with golden sunlight, cinematic 4K product ad"
    },
    {
      id: "avatar",
      emoji: "🗣️",
      label: "Talking Avatar",
      mode: "avatar",
      prompt: "Friendly tech creator explaining our new AI product launch in a bright modern studio, crisp natural lip-sync"
    },
    {
      id: "product",
      emoji: "✨",
      label: "Studio Product Shot",
      mode: "image",
      prompt: "Editorial luxury perfume bottle on wet volcanic stone with cyan rim lighting, studio photography"
    }
  ],
  carouselAriaLabel: "Featured Studio styles carousel",
  promptAriaLabel: "Prompt input",
  modeGroupAriaLabel: "Creation mode"
};

const ZH_CN: HomeStudioShowcaseCopy = {
  eyebrow: "工作台实时预览",
  titlePrefix: "选一个爆款风格，或直接",
  titleAccent: "输入灵感",
  subtitle: "在首页就能直接开始创作——点击按钮会带着你的提示词直达 DreamFace 工作台。",
  hotBadge: "热门",
  cardTry: "去体验",
  cardOpen: "打开",
  slides: {
    ugc: "UGC 种草",
    tiktok: "TikTok 爆款",
    "pet-sing-dance": "宠物唱歌跳舞",
    ads: "广告创意",
    motion: "动感镜头"
  },
  modes: {
    video: "视频",
    image: "图片",
    avatar: "数字人",
    audio: "音频"
  },
  placeholders: {
    video: "描述你想生成的视频画面——例如：三只戴着毛线手套的小奶猫在暖光灯下一起开心唱歌跳舞…",
    image: "描述你想生成的图片——例如：高级感香水瓶置于微湿火山岩上，青色轮廓光，商业棚拍质感…",
    avatar: "输入数字人口播台词——例如：欢迎来到新品发布会，30 秒带你看完这次最惊艳的三个升级…",
    audio: "输入配音文案或你想生成的声音风格…"
  },
  submitLabel: "进入工作台创作",
  pills: [
    {
      id: "pet",
      emoji: "🐱",
      label: "宠物唱歌跳舞",
      mode: "video",
      prompt: "三只戴着毛线手套的毛茸茸小奶猫在温暖冬日灯光下开心唱歌跳舞，TikTok 爆款短视频风格"
    },
    {
      id: "ad",
      emoji: "🎬",
      label: "商品视频广告",
      mode: "video",
      prompt: "冰抹茶拿铁在金色阳光下飞溅的微距慢动作商业广告，电影级 4K 质感"
    },
    {
      id: "avatar",
      emoji: "🗣️",
      label: "AI 口播数字人",
      mode: "avatar",
      prompt: "亲切自然的科技博主在明亮现代摄影棚里介绍 AI 新品发布，口型自然清晰"
    },
    {
      id: "product",
      emoji: "✨",
      label: "棚拍产品大图",
      mode: "image",
      prompt: "高端香水瓶置于湿润火山岩上，清冷青色轮廓光，时尚杂志级商业摄影"
    }
  ],
  carouselAriaLabel: "精选工作台风格轮播",
  promptAriaLabel: "提示词输入框",
  modeGroupAriaLabel: "创作模式"
};

const ZH_TW: HomeStudioShowcaseCopy = {
  eyebrow: "工作台即時預覽",
  titlePrefix: "挑選熱門風格，或直接",
  titleAccent: "輸入靈感",
  subtitle: "在首頁就能直接開始創作——點擊按鈕會帶著你的提示詞直達 DreamFace 工作台。",
  hotBadge: "熱門",
  cardTry: "去體驗",
  cardOpen: "開啟",
  slides: {
    ugc: "UGC 推薦",
    tiktok: "TikTok 爆款",
    "pet-sing-dance": "寵物唱歌跳舞",
    ads: "廣告創意",
    motion: "動態鏡頭"
  },
  modes: {
    video: "影片",
    image: "圖片",
    avatar: "虛擬人",
    audio: "音訊"
  },
  placeholders: {
    video: "描述你想生成的影片畫面——例如：三隻戴著毛線手套的小貓咪在暖光燈下開心唱歌跳舞…",
    image: "描述你想生成的圖片——例如：奢華香水瓶置於微濕火山岩上，青色輪廓光，棚拍質感…",
    avatar: "輸入虛擬人口播台詞——例如：歡迎來到新品發表會，30 秒帶你看這次最亮眼的三個升級…",
    audio: "輸入配音文案或你想生成的聲音風格…"
  },
  submitLabel: "進入工作台創作",
  pills: [
    {
      id: "pet",
      emoji: "🐱",
      label: "寵物唱歌跳舞",
      mode: "video",
      prompt: "三隻戴著毛線手套的毛茸茸小貓咪在溫暖冬日燈光下開心唱歌跳舞，TikTok 爆款短影音風格"
    },
    {
      id: "ad",
      emoji: "🎬",
      label: "商品廣告影片",
      mode: "video",
      prompt: "冰抹茶拿鐵在金色陽光下飛濺的微距慢動作商業廣告，電影級 4K 質感"
    },
    {
      id: "avatar",
      emoji: "🗣️",
      label: "AI 口播虛擬人",
      mode: "avatar",
      prompt: "親切自然的科技創作者在明亮現代攝影棚介紹 AI 新品發表，口型自然清晰"
    },
    {
      id: "product",
      emoji: "✨",
      label: "棚拍產品大片",
      mode: "image",
      prompt: "高級香水瓶置於濕潤火山岩上，清冷青色輪廓光，時尚雜誌級商業攝影"
    }
  ],
  carouselAriaLabel: "精選工作台風格輪播",
  promptAriaLabel: "提示詞輸入框",
  modeGroupAriaLabel: "創作模式"
};

const OVERRIDES: Partial<Record<Locale, Partial<HomeStudioShowcaseCopy>>> = {
  es: {
    eyebrow: "Vista previa interactiva",
    titlePrefix: "Elige un estilo viral o",
    titleAccent: "escribe un prompt",
    subtitle: "Empieza a crear desde la portada: tu prompt pasa directo a DreamFace Studio sin configuración.",
    cardTry: "Probar",
    cardOpen: "Abrir",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Mascotas bailando", ads: "Anuncios", motion: "Movimiento" },
    modes: { video: "Video", image: "Imagen", avatar: "Avatar", audio: "Audio" },
    submitLabel: "Crear en Studio"
  },
  "pt-BR": {
    eyebrow: "Prévia interativa do Studio",
    titlePrefix: "Escolha um estilo viral ou",
    titleAccent: "digite um prompt",
    subtitle: "Comece a criar direto da página inicial — seu prompt vai automaticamente para o DreamFace Studio.",
    cardTry: "Testar",
    cardOpen: "Abrir",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Pets Cantando", ads: "Anúncios", motion: "Movimento" },
    modes: { video: "Vídeo", image: "Imagem", avatar: "Avatar", audio: "Áudio" },
    submitLabel: "Criar no Studio"
  },
  ja: {
    eyebrow: "インタラクティブ Studio プレビュー",
    titlePrefix: "人気スタイルを選ぶか",
    titleAccent: "プロンプトを入力",
    subtitle: "トップページからすぐ制作スタート。入力したプロンプトはそのまま DreamFace Studio に引き継がれます。",
    hotBadge: "人気",
    cardTry: "試す",
    cardOpen: "開く",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "ペット歌ダンス", ads: "広告", motion: "モーション" },
    modes: { video: "動画", image: "画像", avatar: "アバター", audio: "音声" },
    submitLabel: "Studio で作成"
  },
  ko: {
    eyebrow: "인터랙티브 스튜디오 미리보기",
    titlePrefix: "인기 스타일을 고르거나",
    titleAccent: "프롬프트를 입력하세요",
    subtitle: "홈에서 바로 시작하세요 — 입력한 프롬프트가 DreamFace Studio로 그대로 이어집니다.",
    hotBadge: "인기",
    cardTry: "체험",
    cardOpen: "열기",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "반려동물 노래·댄스", ads: "광고", motion: "모션" },
    modes: { video: "비디오", image: "이미지", avatar: "아바타", audio: "오디오" },
    submitLabel: "Studio에서 만들기"
  },
  fr: {
    eyebrow: "Aperçu interactif du Studio",
    titlePrefix: "Choisissez un style viral ou",
    titleAccent: "écrivez un prompt",
    subtitle: "Créez dès la page d'accueil — votre prompt s'ouvre directement dans DreamFace Studio.",
    cardTry: "Essayer",
    cardOpen: "Ouvrir",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Animaux Danse", ads: "Pubs", motion: "Mouvement" },
    modes: { video: "Vidéo", image: "Image", avatar: "Avatar", audio: "Audio" },
    submitLabel: "Créer dans Studio"
  },
  de: {
    eyebrow: "Interaktive Studio-Vorschau",
    titlePrefix: "Wähle einen Stil oder",
    titleAccent: "gib einen Prompt ein",
    subtitle: "Starte direkt auf der Startseite — dein Prompt wird automatisch ins DreamFace Studio übernommen.",
    cardTry: "Testen",
    cardOpen: "Öffnen",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Haustier-Tanz", ads: "Anzeigen", motion: "Motion" },
    modes: { video: "Video", image: "Bild", avatar: "Avatar", audio: "Audio" },
    submitLabel: "Im Studio erstellen"
  },
  it: {
    eyebrow: "Anteprima interattiva Studio",
    titlePrefix: "Scegli uno stile virale o",
    titleAccent: "scrivi un prompt",
    subtitle: "Inizia a creare dalla home — il tuo prompt arriva direttamente in DreamFace Studio.",
    cardTry: "Prova",
    cardOpen: "Apri",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Animali Ballo", ads: "Annunci", motion: "Motion" },
    modes: { video: "Video", image: "Immagine", avatar: "Avatar", audio: "Audio" },
    submitLabel: "Crea in Studio"
  },
  ru: {
    eyebrow: "Интерактивное превью Studio",
    titlePrefix: "Выберите тренд или",
    titleAccent: "введите промпт",
    subtitle: "Начните творить прямо с главной — ваш промпт сразу откроется в DreamFace Studio.",
    hotBadge: "ХИТ",
    cardTry: "Пробовать",
    cardOpen: "Открыть",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Поющие питомцы", ads: "Реклама", motion: "Моушн" },
    modes: { video: "Видео", image: "Фото", avatar: "Аватар", audio: "Аудио" },
    submitLabel: "Создать в Studio"
  },
  vi: {
    eyebrow: "Xem trước Studio tương tác",
    titlePrefix: "Chọn phong cách hot hoặc",
    titleAccent: "nhập prompt",
    subtitle: "Bắt đầu sáng tạo ngay tại trang chủ — prompt của bạn sẽ tự động điền sẵn trong DreamFace Studio.",
    cardTry: "Thử ngay",
    cardOpen: "Mở",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Thú cưng hát nhảy", ads: "Quảng cáo", motion: "Chuyển động" },
    modes: { video: "Video", image: "Ảnh", avatar: "Avatar", audio: "Âm thanh" },
    submitLabel: "Tạo trong Studio"
  },
  th: {
    eyebrow: "ตัวอย่างสตูดิโอแบบโต้ตอบ",
    titlePrefix: "เลือกสไตล์ไวรัลหรือ",
    titleAccent: "พิมพ์พรอมต์เลย",
    subtitle: "เริ่มสร้างได้ทันทีจากหน้าแรก พรอมต์ของคุณจะถูกส่งต่อไปยัง DreamFace Studio อัตโนมัติ",
    hotBadge: "ฮิต",
    cardTry: "ลองเลย",
    cardOpen: "เปิด",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "สัตว์เลี้ยงร้องเต้น", ads: "โฆษณา", motion: "โมชัน" },
    modes: { video: "วิดีโอ", image: "รูปภาพ", avatar: "อวาตาร์", audio: "เสียง" },
    submitLabel: "สร้างใน Studio"
  },
  nl: {
    eyebrow: "Interactieve Studio-preview",
    titlePrefix: "Kies een virale stijl of",
    titleAccent: "typ een prompt",
    subtitle: "Start direct vanaf de homepage — je prompt gaat rechtstreeks mee naar DreamFace Studio.",
    cardTry: "Probeer",
    cardOpen: "Open",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "Huisdier Dans", ads: "Advertenties", motion: "Motion" },
    modes: { video: "Video", image: "Afbeelding", avatar: "Avatar", audio: "Audio" },
    submitLabel: "Maak in Studio"
  },
  he: {
    eyebrow: "תצוגה מקדימה אינטראקטיבית",
    titlePrefix: "בחרו סגנון ויראלי או",
    titleAccent: "כתבו פרומפט",
    subtitle: "התחילו ליצור ישירות מדף הבית — הפרומפט שלכם עובר אוטומטית ל-DreamFace Studio.",
    hotBadge: "חם",
    cardTry: "נסו",
    cardOpen: "פתיחה",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "חיות שרות ורוקדות", ads: "מודעות", motion: "תנועה" },
    modes: { video: "וידאו", image: "תמונה", avatar: "אווטאר", audio: "אודיו" },
    submitLabel: "צור ב-Studio"
  },
  ar: {
    eyebrow: "معاينة تفاعلية للاستوديو",
    titlePrefix: "اختر أسلوباً رائجاً أو",
    titleAccent: "اكتب وصفك",
    subtitle: "ابدأ الإنشاء مباشرة من الصفحة الرئيسية — ينتقل وصفك تلقائياً إلى DreamFace Studio.",
    hotBadge: "رائج",
    cardTry: "جرّب",
    cardOpen: "افتح",
    slides: { ugc: "UGC", tiktok: "TikTok", "pet-sing-dance": "غناء ورقص الحيوانات", ads: "إعلانات", motion: "حركة" },
    modes: { video: "فيديو", image: "صورة", avatar: "أفاتار", audio: "صوت" },
    submitLabel: "ابدأ في Studio"
  }
};

export function homeStudioShowcaseCopy(locale: Locale): HomeStudioShowcaseCopy {
  if (locale === "zh-CN") return ZH_CN;
  if (locale === "zh-TW") return ZH_TW;
  const override = OVERRIDES[locale];
  if (!override) return EN;
  return {
    ...EN,
    ...override,
    slides: { ...EN.slides, ...override.slides },
    modes: { ...EN.modes, ...override.modes },
    placeholders: { ...EN.placeholders, ...override.placeholders }
  };
}
