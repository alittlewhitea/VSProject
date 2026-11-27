import type { Locale } from "../../i18n/routing";
import type { PetSingDanceTemplate } from "./studio-apps-catalog";

export type StudioAppsCopy = {
  navLabel: string;
  navBadge: string;
  hubTitle: string;
  hubSubtitle: string;
  hubFeaturedTag: string;
  hubOpenApp: string;
  hubComingSoon: string;
  petAppTitle: string;
  petAppTagline: string;
  petAppDescription: string;
  petAppBadge: string;
  voiceAppTitle: string;
  voiceAppDescription: string;
  voiceAppBadge: string;
  comingOutfitTitle: string;
  comingOutfitDescription: string;
  comingBabyTitle: string;
  comingBabyDescription: string;
  backToApps: string;
  stepPhoto: string;
  stepTemplate: string;
  stepSettings: string;
  uploadTitle: string;
  uploadHint: string;
  uploadChange: string;
  uploadRemove: string;
  uploadInvalid: string;
  uploadFailed: string;
  uploadRequired: string;
  filterAll: string;
  filterDance: string;
  filterSing: string;
  modelLabel: string;
  durationLabel: string;
  resolutionLabel: string;
  nativeAudioNote: string;
  promptDetailsLabel: string;
  promptDetailsHint: string;
  generateButton: string;
  generatingButton: string;
  creditsUnit: string;
  stageEmptyTitle: string;
  stageEmptyHint: string;
  stageReadyLabel: string;
  stageAudioBadge: string;
  stageQueued: string;
  stageRunning: string;
  stageCompleted: string;
  stageFailed: string;
  downloadVideo: string;
  openInProjects: string;
  tryAnother: string;
  recentTitle: string;
  tabTemplates: string;
  tabCreations: string;
  changeTemplate: string;
  previewAction: string;
  useStyleAction: string;
  closePreview: string;
  selectedLabel: string;
  emptyCreationsTitle: string;
  emptyCreationsHint: string;
  badges: Record<NonNullable<PetSingDanceTemplate["badge"]>, string>;
  templates: Record<PetSingDanceTemplate["id"], { title: string; subtitle: string }>;
};

const EN: StudioAppsCopy = {
  navLabel: "Apps",
  navBadge: "HOT",
  hubTitle: "Creative Apps",
  hubSubtitle: "One-click AI templates and voice tools — zero prompt writing required.",
  hubFeaturedTag: "Featured · Native Video + Audio",
  hubOpenApp: "Open App",
  hubComingSoon: "Coming Soon",
  petAppTitle: "Pet Sing & Dance",
  petAppTagline: "Upload 1 pet photo · Pick a style · Instant singing & dancing video with music",
  petAppDescription:
    "Turn any cat or dog photo into a viral vertical singing or dancing video with synced music and vocal audio in one click.",
  petAppBadge: "HOT",
  voiceAppTitle: "Voice & Music Studio",
  voiceAppDescription:
    "Generate realistic speech, multi-speaker dialogue, and full AI music tracks with ElevenLabs, Gemini TTS, HeyGen Voice & MiniMax Music.",
  voiceAppBadge: "Audio",
  comingOutfitTitle: "AI Outfit Try-On",
  comingOutfitDescription: "Swap outfits on any portrait while preserving pose, lighting, and face identity.",
  comingBabyTitle: "Talking Pet & Baby Clips",
  comingBabyDescription: "Make cute characters deliver funny birthday wishes and viral commentary.",
  backToApps: "All Apps",
  stepPhoto: "1. Pet Photo",
  stepTemplate: "2. Choose a Style",
  stepSettings: "3. Output Settings",
  uploadTitle: "Upload your pet photo",
  uploadHint: "Clear front-facing cat or dog photo · JPG, PNG, WebP (max 30 MB)",
  uploadChange: "Replace",
  uploadRemove: "Remove",
  uploadInvalid: "Please upload a JPG, PNG, or WebP image under 30 MB.",
  uploadFailed: "Could not read that image. Please try another photo.",
  uploadRequired: "Upload a pet photo first to generate your video.",
  filterAll: "All",
  filterDance: "Dance",
  filterSing: "Sing",
  modelLabel: "Model",
  durationLabel: "Duration",
  resolutionLabel: "Resolution",
  nativeAudioNote: "Synced music & audio generated automatically with the video",
  promptDetailsLabel: "View built-in director prompt",
  promptDetailsHint: "Automatically sent for this template — no editing needed.",
  generateButton: "Generate Video",
  generatingButton: "Generating...",
  creditsUnit: "credits",
  stageEmptyTitle: "9:16 Pet Stage",
  stageEmptyHint: "Upload 1 photo on the left and pick a dance or singing template to preview here.",
  stageReadyLabel: "Ready to animate",
  stageAudioBadge: "Synced Audio",
  stageQueued: "Queued in studio...",
  stageRunning: "Animating your pet & syncing audio...",
  stageCompleted: "Done! Tap play to watch with sound.",
  stageFailed: "Generation failed. Credits are refunded automatically.",
  downloadVideo: "Download MP4",
  openInProjects: "View in Projects",
  tryAnother: "Make Another",
  recentTitle: "Recent Pet Videos",
  tabTemplates: "Styles",
  tabCreations: "My Creations",
  changeTemplate: "Change",
  previewAction: "Preview",
  useStyleAction: "Use This Style",
  closePreview: "Close",
  selectedLabel: "Selected",
  emptyCreationsTitle: "Your generated pet videos appear here",
  emptyCreationsHint: "Pick any dance or singing style, upload 1 pet photo on the left, and tap Generate.",
  badges: {
    hot: "HOT",
    viral: "VIRAL",
    new: "NEW",
    funny: "FUNNY",
    gift: "GIFT"
  },
  templates: {
    "tiktok-shuffle": { title: "Viral TikTok Dance", subtitle: "Catchy pop beat · Cute paw groove" },
    "disco-paw": { title: "Disco Paw Groove", subtitle: "70s disco ball · Funky bassline" },
    "hiphop-street": { title: "Street Hip-Hop", subtitle: "Golden-hour swag · Boom-bap beat" },
    "kpop-idol": { title: "K-Pop Stage Idol", subtitle: "Neon concert · Sparkling chorus" },
    "salsa-fiesta": { title: "Latin Salsa Twist", subtitle: "Sunny patio · Lively percussion" },
    "breakdance-spin": { title: "Breakdance B-Boy", subtitle: "Loft cardboard · Funky breakbeat" },
    "cowboy-country": { title: "Cowboy Line Dance", subtitle: "Golden barn · Country fiddle" },
    "ballet-tutu": { title: "Ballet Pirouette", subtitle: "Sunlit studio · Graceful waltz" },
    "dj-neon-rave": { title: "Neon DJ Rave", subtitle: "Laser club · EDM bass drop" },
    "pop-star-sing": { title: "Pop Star Vocals", subtitle: "Studio mic · Catchy pop chorus" },
    "opera-diva": { title: "Opera High Note", subtitle: "Velvet stage · Dramatic aria" },
    "birthday-song": { title: "Birthday Serenade", subtitle: "Candle bokeh · Happy birthday song" },
    "rock-guitar": { title: "Rock Star Anthem", subtitle: "Electric guitar · Arena chorus" },
    "rap-mic": { title: "Freestyle Rapper", subtitle: "Studio booth · Trap hip-hop bars" },
    "jazz-lounge": { title: "Smooth Jazz Crooner", subtitle: "Candlelit lounge · Sultry sax" },
    "karaoke-duet": { title: "KTV Party Mic", subtitle: "Rainbow lounge · Sing-along hit" }
  }
};

const ZH_CN: StudioAppsCopy = {
  navLabel: "应用中心",
  navBadge: "热门",
  hubTitle: "创意应用中心",
  hubSubtitle: "一键玩法模板与语音音乐工具，无需手写复杂提示词。",
  hubFeaturedTag: "主推玩法 · 视频直出同步音乐",
  hubOpenApp: "立即体验",
  hubComingSoon: "即将上线",
  petAppTitle: "宠物唱歌跳舞",
  petAppTagline: "上传 1 张宠物照 · 选模板 · 一键生成带音乐的竖屏短视频",
  petAppDescription:
    "只需上传猫咪或狗狗照片，选择内置热舞或唱歌模板，直接生成画音同步的爆款短视频，零学习成本。",
  petAppBadge: "热门",
  voiceAppTitle: "语音与音乐工作台",
  voiceAppDescription:
    "原来的语音/音频入口：支持 ElevenLabs、Gemini TTS、HeyGen 语音配音与 MiniMax 音乐创作。",
  voiceAppBadge: "语音/音频",
  comingOutfitTitle: "AI 一键换装",
  comingOutfitDescription: "上传人物照片与服装图，保持五官姿势自然换装。",
  comingBabyTitle: "萌宠/萌娃开口祝福",
  comingBabyDescription: "让照片里的萌宠或宝宝说出专属生日与节日祝福。",
  backToApps: "返回应用中心",
  stepPhoto: "1. 上传宠物照片",
  stepTemplate: "2. 选择唱跳模板",
  stepSettings: "3. 生成参数",
  uploadTitle: "点击或拖拽上传宠物照片",
  uploadHint: "建议清晰的猫咪/狗狗正面照 · 支持 JPG、PNG、WebP（最大 30MB）",
  uploadChange: "更换照片",
  uploadRemove: "清除",
  uploadInvalid: "请上传 30MB 以内的 JPG、PNG 或 WebP 图片。",
  uploadFailed: "图片读取失败，请换一张照片重试。",
  uploadRequired: "请先上传一张宠物照片，再开始生成。",
  filterAll: "全部",
  filterDance: "热舞",
  filterSing: "唱歌",
  modelLabel: "视频模型",
  durationLabel: "时长",
  resolutionLabel: "分辨率",
  nativeAudioNote: "视频直出同步音乐与人声，无需额外配乐步骤",
  promptDetailsLabel: "查看内置导演级提示词",
  promptDetailsHint: "已按所选模板自动配置，无需手动修改。",
  generateButton: "一键生成视频",
  generatingButton: "正在生成...",
  creditsUnit: "积分",
  stageEmptyTitle: "9:16 竖屏成片舞台",
  stageEmptyHint: "在左侧上传 1 张宠物照并挑选唱跳模板，即可在此预览和播放成片。",
  stageReadyLabel: "已就绪，点击左侧立即生成",
  stageAudioBadge: "视频直出原声",
  stageQueued: "任务已排队，正在分配算力...",
  stageRunning: "正在让宠物起舞并合成同步音乐...",
  stageCompleted: "生成完成！点击播放欣赏带音效的成片。",
  stageFailed: "生成失败，消耗积分已自动退回。",
  downloadVideo: "下载 MP4",
  openInProjects: "在项目中查看",
  tryAnother: "换个模板再来一条",
  recentTitle: "最近生成的宠物视频",
  tabTemplates: "热门模板",
  tabCreations: "我的作品",
  changeTemplate: "更换",
  previewAction: "预览",
  useStyleAction: "使用此模板",
  closePreview: "关闭",
  selectedLabel: "已选中",
  emptyCreationsTitle: "你生成的宠物唱跳视频会显示在这里",
  emptyCreationsHint: "挑选任意热门模板，在左侧上传 1 张宠物照片并点击一键生成即可。",
  badges: {
    hot: "热门",
    viral: "爆款",
    new: "上新",
    funny: "搞笑",
    gift: "祝福"
  },
  templates: {
    "tiktok-shuffle": { title: "爆款短视频热舞", subtitle: "动感流行节奏 · 萌爪摇摆舞" },
    "disco-paw": { title: "迪斯科闪耀舞", subtitle: "复古迪斯科球 · 律动放克电音" },
    "hiphop-street": { title: "街头嘻哈舞王", subtitle: "日落街头范 · 律动节拍卡点" },
    "kpop-idol": { title: "韩流偶像舞台", subtitle: "霓虹打歌舞台 · 活力女团男团舞" },
    "salsa-fiesta": { title: "拉丁萨尔萨舞", subtitle: "暖阳庭院 · 欢快拉丁鼓点扭扭舞" },
    "breakdance-spin": { title: "街舞霹雳舞王", subtitle: "阁楼纸板 · 复古搓碟地板舞" },
    "cowboy-country": { title: "牛仔乡村摇摆", subtitle: "金色谷仓 · 欢快乡村提琴踏步" },
    "ballet-tutu": { title: "优雅芭蕾旋转", subtitle: "阳光练功房 · 轻盈华尔兹转圈" },
    "dj-neon-rave": { title: "电音打碟蹦迪", subtitle: "霓虹激光夜店 · 炸场电音节拍" },
    "pop-star-sing": { title: "流行麦霸主唱", subtitle: "复古麦克风 · 活力流行副歌献唱" },
    "opera-diva": { title: "灵魂歌剧高音", subtitle: "剧院聚光灯 · 戏精爆笑美声咏叹" },
    "birthday-song": { title: "生日快乐献唱", subtitle: "暖光烛火 · 萌宠专属生日祝福歌" },
    "rock-guitar": { title: "摇滚吉他主唱", subtitle: "炫酷电吉他 · 万人演唱会燃唱" },
    "rap-mic": { title: "嘻哈说唱大神", subtitle: "紫光录音棚 · 带感说唱炸场" },
    "jazz-lounge": { title: "爵士蓝调情歌", subtitle: "烛光爵士吧 · 慵懒萨克斯低吟" },
    "karaoke-duet": { title: "KTV 麦霸嗨唱", subtitle: "炫彩包厢 · 全场大合唱高光" }
  }
};

const ZH_TW: StudioAppsCopy = {
  ...ZH_CN,
  navLabel: "應用中心",
  navBadge: "熱門",
  hubTitle: "創意應用中心",
  hubSubtitle: "一鍵玩法範本與語音音樂工具，無需手寫複雜提示詞。",
  hubFeaturedTag: "主推玩法 · 影片直出同步音樂",
  hubOpenApp: "立即體驗",
  hubComingSoon: "即將上線",
  petAppTitle: "寵物唱歌跳舞",
  petAppTagline: "上傳 1 張寵物照 · 選範本 · 一鍵生成帶音樂的直式短片",
  petAppDescription:
    "只需上傳貓咪或狗狗照片，選擇內建熱舞或唱歌範本，直接生成影音同步的爆款短片。",
  petAppBadge: "熱門",
  voiceAppTitle: "語音與音樂工作台",
  voiceAppDescription:
    "原本的語音／音訊入口：支援 ElevenLabs、Gemini TTS、HeyGen 語音配音與 MiniMax 音樂創作。",
  voiceAppBadge: "語音/音訊",
  comingOutfitTitle: "AI 一鍵換裝",
  comingOutfitDescription: "上傳人物照片與服裝圖，保留五官姿勢自然換裝。",
  comingBabyTitle: "萌寵／萌娃開口祝福",
  comingBabyDescription: "讓照片裡的萌寵或寶寶說出專屬生日與節日祝福。",
  backToApps: "返回應用中心",
  stepPhoto: "1. 上傳寵物照片",
  stepTemplate: "2. 選擇唱跳範本",
  stepSettings: "3. 生成參數",
  uploadTitle: "點擊或拖曳上傳寵物照片",
  uploadHint: "建議清晰的貓咪／狗狗正面照 · 支援 JPG、PNG、WebP（最大 30MB）",
  uploadChange: "更換照片",
  uploadRemove: "清除",
  uploadInvalid: "請上傳 30MB 以內的 JPG、PNG 或 WebP 圖片。",
  uploadFailed: "圖片讀取失敗，請換一張照片重試。",
  uploadRequired: "請先上傳一張寵物照片，再開始生成。",
  filterAll: "全部",
  filterDance: "熱舞",
  filterSing: "唱歌",
  modelLabel: "影片模型",
  durationLabel: "時長",
  resolutionLabel: "解析度",
  nativeAudioNote: "影片直出同步音樂與人聲，無需額外配樂步驟",
  promptDetailsLabel: "查看內建導演級提示詞",
  promptDetailsHint: "已依所選範本自動配置，無需手動修改。",
  generateButton: "一鍵生成影片",
  generatingButton: "正在生成...",
  creditsUnit: "積分",
  stageEmptyTitle: "9:16 直式成片舞台",
  stageEmptyHint: "在左側上傳 1 張寵物照並挑選唱跳範本，即可在此預覽與播放。",
  stageReadyLabel: "已就緒，點擊左側立即生成",
  stageAudioBadge: "影片直出原聲",
  stageQueued: "任務已排隊，正在分配算力...",
  stageRunning: "正在讓寵物起舞並合成同步音樂...",
  stageCompleted: "生成完成！點擊播放欣賞帶音效的成片。",
  stageFailed: "生成失敗，消耗積分已自動退回。",
  downloadVideo: "下載 MP4",
  openInProjects: "在專案中查看",
  tryAnother: "換個範本再來一條",
  recentTitle: "最近生成的寵物影片",
  tabTemplates: "熱門範本",
  tabCreations: "我的作品",
  changeTemplate: "更換",
  previewAction: "預覽",
  useStyleAction: "使用此範本",
  closePreview: "關閉",
  selectedLabel: "已選中",
  emptyCreationsTitle: "你生成的寵物唱跳影片會顯示在這裡",
  emptyCreationsHint: "挑選任意熱門範本，在左側上傳 1 張寵物照片並點擊一鍵生成即可。",
  badges: { hot: "熱門", viral: "爆款", new: "上新", funny: "搞笑", gift: "祝福" },
  templates: {
    "tiktok-shuffle": { title: "爆款短影音熱舞", subtitle: "動感流行節奏 · 萌爪搖擺舞" },
    "disco-paw": { title: "迪斯可閃耀舞", subtitle: "復古迪斯可球 · 律動放克電音" },
    "hiphop-street": { title: "街頭嘻哈舞王", subtitle: "日落街頭風 · 律動節拍卡點" },
    "kpop-idol": { title: "韓流偶像舞台", subtitle: "霓虹打歌舞台 · 活力偶像唱跳" },
    "salsa-fiesta": { title: "拉丁騷莎舞", subtitle: "暖陽庭院 · 歡快拉丁鼓點扭扭舞" },
    "breakdance-spin": { title: "街舞霹靂舞王", subtitle: "閣樓紙板 · 復古搓碟地板舞" },
    "cowboy-country": { title: "牛仔鄉村搖擺", subtitle: "金色穀倉 · 歡快鄉村提琴踏步" },
    "ballet-tutu": { title: "優雅芭蕾旋轉", subtitle: "陽光練功房 · 輕盈華爾滋轉圈" },
    "dj-neon-rave": { title: "電音打碟蹦迪", subtitle: "霓虹雷射夜店 · 炸場電音節拍" },
    "pop-star-sing": { title: "流行麥霸主唱", subtitle: "復古麥克風 · 活力流行副歌獻唱" },
    "opera-diva": { title: "靈魂歌劇高音", subtitle: "劇院聚光燈 · 爆笑美聲詠嘆調" },
    "birthday-song": { title: "生日快樂獻唱", subtitle: "暖光燭火 · 萌寵專屬生日祝福歌" },
    "rock-guitar": { title: "搖滾吉他主唱", subtitle: "炫酷電吉他 · 萬人演唱會燃唱" },
    "rap-mic": { title: "嘻哈饒舌大神", subtitle: "紫光錄音棚 · 帶感饒舌炸場" },
    "jazz-lounge": { title: "爵士藍調情歌", subtitle: "燭光爵士吧 · 慵懶薩克斯低吟" },
    "karaoke-duet": { title: "KTV 麥霸嗨唱", subtitle: "炫彩包廂 · 全場大合唱高光" }
  }
};

const NAV_OVERRIDES: Partial<Record<Locale, Partial<StudioAppsCopy>>> = {
  ja: {
    navLabel: "アプリ",
    hubTitle: "クリエイティブアプリ",
    hubSubtitle: "プロンプト不要のワンクリックAIテンプレートと音声スタジオ。",
    petAppTitle: "ペット歌＆ダンス",
    petAppTagline: "ペット写真1枚をアップロード · テンプレート選択 · 音楽付き動画を即生成",
    voiceAppTitle: "音声・音楽スタジオ",
    stepPhoto: "1. ペットの写真",
    stepTemplate: "2. テンプレートを選択",
    stepSettings: "3. 出力設定",
    generateButton: "動画を生成",
    generatingButton: "生成中...",
    filterAll: "すべて",
    filterDance: "ダンス",
    filterSing: "歌う",
    backToApps: "アプリ一覧",
    downloadVideo: "MP4をダウンロード"
  },
  ko: {
    navLabel: "앱",
    hubTitle: "크리에이티브 앱",
    hubSubtitle: "프롬프트 없이 원클릭으로 만드는 AI 템플릿과 오디오 스튜디오.",
    petAppTitle: "반려동물 노래 & 댄스",
    petAppTagline: "반려동물 사진 1장 업로드 · 스타일 선택 · 음악 포함 영상 즉시 생성",
    voiceAppTitle: "음성 & 음악 스튜디오",
    stepPhoto: "1. 반려동물 사진",
    stepTemplate: "2. 스타일 선택",
    stepSettings: "3. 출력 설정",
    generateButton: "영상 생성",
    generatingButton: "생성 중...",
    filterAll: "전체",
    filterDance: "댄스",
    filterSing: "노래",
    backToApps: "앱 목록",
    downloadVideo: "MP4 다운로드"
  },
  es: {
    navLabel: "Apps",
    hubTitle: "Apps Creativas",
    hubSubtitle: "Plantillas IA en un clic y herramientas de voz, sin escribir prompts.",
    petAppTitle: "Mascotas Cantan y Bailan",
    voiceAppTitle: "Estudio de Voz y Música",
    stepPhoto: "1. Foto de tu mascota",
    stepTemplate: "2. Elige un estilo",
    stepSettings: "3. Ajustes",
    generateButton: "Generar video",
    filterAll: "Todos",
    filterDance: "Baile",
    filterSing: "Canto",
    backToApps: "Todas las apps"
  },
  fr: {
    navLabel: "Apps",
    hubTitle: "Apps Créatives",
    hubSubtitle: "Modèles IA en un clic et studio vocal, sans écrire de prompt.",
    petAppTitle: "Animaux Chant & Danse",
    voiceAppTitle: "Studio Voix & Musique",
    stepPhoto: "1. Photo de votre animal",
    stepTemplate: "2. Choisir un style",
    stepSettings: "3. Réglages",
    generateButton: "Générer la vidéo",
    filterAll: "Tout",
    filterDance: "Danse",
    filterSing: "Chant",
    backToApps: "Toutes les apps"
  },
  de: {
    navLabel: "Apps",
    hubTitle: "Kreativ-Apps",
    hubSubtitle: "Ein-Klick-KI-Vorlagen und Audio-Studio ohne Prompt-Schreiben.",
    petAppTitle: "Haustier Sing & Tanz",
    voiceAppTitle: "Stimme & Musik Studio",
    stepPhoto: "1. Haustier-Foto",
    stepTemplate: "2. Stil wählen",
    stepSettings: "3. Einstellungen",
    generateButton: "Video erstellen",
    filterAll: "Alle",
    filterDance: "Tanzen",
    filterSing: "Singen",
    backToApps: "Alle Apps"
  },
  "pt-BR": {
    navLabel: "Apps",
    hubTitle: "Apps Criativos",
    hubSubtitle: "Modelos de IA em um clique e estúdio de voz e música sem prompts.",
    petAppTitle: "Pets Cantando e Dançando",
    voiceAppTitle: "Estúdio de Voz e Música",
    stepPhoto: "1. Foto do seu pet",
    stepTemplate: "2. Escolha um estilo",
    stepSettings: "3. Configurações",
    generateButton: "Gerar vídeo",
    filterAll: "Todos",
    filterDance: "Dança",
    filterSing: "Canto",
    backToApps: "Todos os apps"
  },
  ru: {
    navLabel: "Приложения",
    hubTitle: "Креативные приложения",
    hubSubtitle: "ИИ-шаблоны в один клик и студия озвучки без написания промптов.",
    petAppTitle: "Поющие и танцующие питомцы",
    voiceAppTitle: "Студия голоса и музыки",
    stepPhoto: "1. Фото питомца",
    stepTemplate: "2. Выберите стиль",
    stepSettings: "3. Параметры",
    generateButton: "Создать видео",
    filterAll: "Все",
    filterDance: "Танец",
    filterSing: "Пение",
    backToApps: "Все приложения"
  },
  vi: {
    navLabel: "Ứng dụng",
    hubTitle: "Ứng dụng sáng tạo",
    hubSubtitle: "Mẫu AI một chạm và phòng thu giọng nói, không cần viết prompt.",
    petAppTitle: "Thú Cưng Hát & Nhảy",
    voiceAppTitle: "Phòng thu Giọng nói & Âm nhạc",
    generateButton: "Tạo video",
    backToApps: "Tất cả ứng dụng"
  },
  th: {
    navLabel: "แอป",
    hubTitle: "แอปสร้างสรรค์",
    hubSubtitle: "เทมเพลต AI คลิกเดียวและสตูดิโอเสียง ไม่ต้องเขียนพรอมต์",
    petAppTitle: "สัตว์เลี้ยงร้องและเต้น",
    voiceAppTitle: "สตูดิโอเสียงและดนตรี",
    generateButton: "สร้างวิดีโอ",
    backToApps: "แอปทั้งหมด"
  },
  nl: {
    navLabel: "Apps",
    hubTitle: "Creatieve Apps",
    petAppTitle: "Huisdier Zingt & Danst",
    voiceAppTitle: "Stem & Muziek Studio",
    generateButton: "Video genereren",
    backToApps: "Alle apps"
  },
  it: {
    navLabel: "App",
    hubTitle: "App Creative",
    petAppTitle: "Animali Cantano e Ballano",
    voiceAppTitle: "Studio Voce e Musica",
    generateButton: "Genera video",
    backToApps: "Tutte le app"
  },
  ar: {
    navLabel: "التطبيقات",
    hubTitle: "تطبيقات الإبداع",
    petAppTitle: "الحيوانات الأليفة تغني وترقص",
    voiceAppTitle: "استوديو الصوت والموسيقى",
    generateButton: "إنشاء الفيديو",
    backToApps: "كل التطبيقات"
  },
  he: {
    navLabel: "אפליקציות",
    hubTitle: "אפליקציות יצירה",
    petAppTitle: "חיות מחמד שרות ורוקדות",
    voiceAppTitle: "אולפן קול ומוזיקה",
    generateButton: "צור וידאו",
    backToApps: "כל האפליקציות"
  }
};

export function studioAppsCopy(locale: Locale): StudioAppsCopy {
  if (locale === "zh-CN") return ZH_CN;
  if (locale === "zh-TW") return ZH_TW;
  const override = NAV_OVERRIDES[locale];
  if (!override) return EN;
  return {
    ...EN,
    ...override,
    badges: { ...EN.badges, ...(override.badges || {}) },
    templates: { ...EN.templates, ...(override.templates || {}) }
  };
}
