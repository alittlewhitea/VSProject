import type { Locale } from "../../i18n/routing";

export type StudioOnboardingCopy = {
  guestBadge: string;
  guestText: string;
  guestCta: string;
  guestDismiss: string;
  authBadge: string;
  authPetTitle: string;
  authPetSubtitle: string;
  welcomeBadgeWithCredits: string;
  welcomeBadgeDefault: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeCardPetTitle: string;
  welcomeCardPetDesc: string;
  welcomeCardPetBadge: string;
  welcomeCardI2VTitle: string;
  welcomeCardI2VDesc: string;
  welcomeCardAvatarTitle: string;
  welcomeCardAvatarDesc: string;
  welcomeSkip: string;
  welcomeClose: string;
};

const EN: StudioOnboardingCopy = {
  guestBadge: "FREE START",
  guestText: "Sign in with Google or email to unlock starter credits and save your creations.",
  guestCta: "Sign in free",
  guestDismiss: "Dismiss",
  authBadge: "Free starter credits for eligible new accounts",
  authPetTitle: "Sign in to animate your pet",
  authPetSubtitle: "We will start generating your pet video automatically right after sign-in.",
  welcomeBadgeWithCredits: "{credits} credits ready",
  welcomeBadgeDefault: "Welcome to DreamFace Studio",
  welcomeTitle: "Pick a quick way to create your first video",
  welcomeSubtitle: "Start with a one-click template or jump straight into any workspace.",
  welcomeCardPetTitle: "Pet Sing & Dance",
  welcomeCardPetDesc: "Upload 1 pet photo · Pick a style · Instant singing & dancing video",
  welcomeCardPetBadge: "HOT",
  welcomeCardI2VTitle: "Image to Video",
  welcomeCardI2VDesc: "Animate any portrait, product, or scene with native synced audio",
  welcomeCardAvatarTitle: "Talking Avatar",
  welcomeCardAvatarDesc: "Turn any photo into a realistic speaking presenter in seconds",
  welcomeSkip: "Explore Studio on my own",
  welcomeClose: "Close"
};

const ZH_CN: StudioOnboardingCopy = {
  guestBadge: "新人体验",
  guestText: "登录即可领取新人体验积分并云端保存你的所有作品。",
  guestCta: "免费登录",
  guestDismiss: "关闭提示",
  authBadge: "符合条件的新账号注册即赠免费体验积分",
  authPetTitle: "登录后立即生成宠物视频",
  authPetSubtitle: "完成登录后将自动接续上传并开始生成，无需重新选择。",
  welcomeBadgeWithCredits: "已有 {credits} 积分可用",
  welcomeBadgeDefault: "欢迎来到 DreamFace Studio",
  welcomeTitle: "选一个最快上手的玩法，1 分钟出片",
  welcomeSubtitle: "可以从零提示词模板开始，或直接进入专业工作台。",
  welcomeCardPetTitle: "宠物唱歌跳舞",
  welcomeCardPetDesc: "上传 1 张宠物照 · 选 16 套热舞/唱歌模板 · 视频直出原声",
  welcomeCardPetBadge: "热门",
  welcomeCardI2VTitle: "图生视频",
  welcomeCardI2VDesc: "上传任意图片，一键生成带同步音效的高清动态视频",
  welcomeCardAvatarTitle: "AI 数字人开口",
  welcomeCardAvatarDesc: "单张人像配合文案或配音，快速生成自然口播视频",
  welcomeSkip: "我自己先随便逛逛",
  welcomeClose: "关闭"
};

const ZH_TW: StudioOnboardingCopy = {
  ...ZH_CN,
  guestBadge: "新人體驗",
  guestText: "登入即可領取新人體驗積分並雲端儲存你的所有作品。",
  guestCta: "免費登入",
  guestDismiss: "關閉提示",
  authBadge: "符合條件的新帳號註冊即贈免費體驗積分",
  authPetTitle: "登入後立即生成寵物影片",
  authPetSubtitle: "完成登入後將自動接續上傳並開始生成，無需重新選擇。",
  welcomeBadgeWithCredits: "已有 {credits} 積分可用",
  welcomeTitle: "選一個最快上手的玩法，1 分鐘出片",
  welcomeSubtitle: "可從零提示詞範本開始，或直接進入專業工作台。",
  welcomeCardPetTitle: "寵物唱歌跳舞",
  welcomeCardPetDesc: "上傳 1 張寵物照 · 選 16 套熱舞/唱歌範本 · 影片直出原聲",
  welcomeCardPetBadge: "熱門",
  welcomeCardI2VTitle: "圖生影片",
  welcomeCardI2VDesc: "上傳任意圖片，一鍵生成帶同步音效的高畫質動態影片",
  welcomeCardAvatarTitle: "AI 數位人開口",
  welcomeCardAvatarDesc: "單張人像配合文案或配音，快速生成自然口播影片",
  welcomeSkip: "我自己先逛逛",
  welcomeClose: "關閉"
};

const OVERRIDES: Partial<Record<Locale, Partial<StudioOnboardingCopy>>> = {
  ja: {
    guestBadge: "無料スタート",
    guestText: "Google またはメールでログインして無料クレジットを受け取り、作品を保存しましょう。",
    guestCta: "無料でログイン",
    authBadge: "新規アカウント向け無料スタータークレジット",
    authPetTitle: "ログインしてペット動画を生成",
    authPetSubtitle: "ログイン後すぐに自動で動画生成を開始します。",
    welcomeBadgeWithCredits: "{credits} クレジット利用可能",
    welcomeTitle: "最初の動画を作成するスタイルを選択",
    welcomeCardPetTitle: "ペット歌＆ダンス",
    welcomeCardI2VTitle: "画像から動画",
    welcomeCardAvatarTitle: "トーキングアバター",
    welcomeSkip: "自分で探索する"
  },
  ko: {
    guestBadge: "무료 시작",
    guestText: "Google 또는 이메일로 로그인하고 무료 스타터 크레딧을 받아 작품을 저장하세요.",
    guestCta: "무료 로그인",
    authBadge: "신규 계정을 위한 무료 스타터 크레딧",
    authPetTitle: "로그인하고 반려동물 영상 생성",
    authPetSubtitle: "로그인 완료 즉시 자동으로 영상 생성이 시작됩니다.",
    welcomeBadgeWithCredits: "{credits} 크레딧 사용 가능",
    welcomeTitle: "첫 영상을 만들 빠른 방법을 선택하세요",
    welcomeCardPetTitle: "반려동물 노래 & 댄스",
    welcomeCardI2VTitle: "이미지로 영상 만들기",
    welcomeCardAvatarTitle: "토킹 아바타",
    welcomeSkip: "직접 둘러보기"
  },
  es: {
    guestBadge: "GRATIS",
    guestText: "Inicia sesión con Google o correo para obtener créditos iniciales y guardar tus creaciones.",
    guestCta: "Entrar gratis",
    authBadge: "Créditos iniciales gratis para cuentas nuevas elegibles",
    authPetTitle: "Inicia sesión para animar a tu mascota",
    authPetSubtitle: "Comenzaremos a generar tu video automáticamente justo después de iniciar sesión.",
    welcomeBadgeWithCredits: "{credits} créditos listos",
    welcomeTitle: "Elige una forma rápida de crear tu primer video",
    welcomeCardPetTitle: "Mascotas Cantan y Bailan",
    welcomeCardI2VTitle: "Imagen a Video",
    welcomeCardAvatarTitle: "Avatar Hablante",
    welcomeSkip: "Explorar por mi cuenta"
  },
  fr: {
    guestBadge: "GRATUIT",
    guestText: "Connectez-vous avec Google ou e-mail pour débloquer des crédits gratuits et sauvegarder vos créations.",
    guestCta: "Connexion gratuite",
    authBadge: "Crédits de démarrage gratuits pour les nouveaux comptes éligibles",
    authPetTitle: "Connectez-vous pour animer votre animal",
    authPetSubtitle: "La génération de votre vidéo démarrera automatiquement juste après la connexion.",
    welcomeBadgeWithCredits: "{credits} crédits prêts",
    welcomeTitle: "Choisissez comment créer votre première vidéo",
    welcomeCardPetTitle: "Animaux Chant & Danse",
    welcomeCardI2VTitle: "Image vers Vidéo",
    welcomeCardAvatarTitle: "Avatar Parlant",
    welcomeSkip: "Explorer librement"
  },
  de: {
    guestBadge: "GRATIS",
    guestText: "Mit Google oder E-Mail anmelden, um Start-Credits freizuschalten und Werke zu speichern.",
    guestCta: "Kostenlos anmelden",
    authBadge: "Kostenlose Start-Credits für berechtigte neue Konten",
    authPetTitle: "Anmelden & Haustier-Video erstellen",
    authPetSubtitle: "Dein Video wird direkt nach der Anmeldung automatisch gestartet.",
    welcomeBadgeWithCredits: "{credits} Credits bereit",
    welcomeTitle: "Wähle einen schnellen Start für dein erstes Video",
    welcomeCardPetTitle: "Haustier Sing & Tanz",
    welcomeCardI2VTitle: "Bild zu Video",
    welcomeCardAvatarTitle: "Sprechender Avatar",
    welcomeSkip: "Selbst erkunden"
  },
  "pt-BR": {
    guestBadge: "GRÁTIS",
    guestText: "Entre com Google ou e-mail para liberar créditos iniciais e salvar suas criações.",
    guestCta: "Entrar grátis",
    authBadge: "Créditos iniciais grátis para novas contas elegíveis",
    authPetTitle: "Entre para animar seu pet",
    authPetSubtitle: "Seu vídeo começará a ser gerado automaticamente logo após o login.",
    welcomeBadgeWithCredits: "{credits} créditos prontos",
    welcomeTitle: "Escolha um caminho rápido para criar seu primeiro vídeo",
    welcomeCardPetTitle: "Pets Cantando e Dançando",
    welcomeCardI2VTitle: "Imagem para Vídeo",
    welcomeCardAvatarTitle: "Avatar Falante",
    welcomeSkip: "Explorar por conta própria"
  },
  ru: {
    guestBadge: "БЕСПЛАТНО",
    guestText: "Войдите через Google или email, чтобы получить стартовые кредиты и сохранять проекты.",
    guestCta: "Войти бесплатно",
    authBadge: "Стартовые кредиты для новых аккаунтов",
    authPetTitle: "Войдите, чтобы оживить питомца",
    authPetSubtitle: "Генерация видео начнётся автоматически сразу после входа.",
    welcomeBadgeWithCredits: "Доступно {credits} кредитов",
    welcomeTitle: "Выберите быстрый старт для первого видео",
    welcomeCardPetTitle: "Поющие и танцующие питомцы",
    welcomeCardI2VTitle: "Изображение в видео",
    welcomeCardAvatarTitle: "Говорящий аватар",
    welcomeSkip: "Осмотреться самостоятельно"
  },
  vi: {
    guestBadge: "MIỄN PHÍ",
    guestCta: "Đăng nhập miễn phí",
    welcomeCardPetTitle: "Thú Cưng Hát & Nhảy",
    welcomeSkip: "Tự khám phá"
  },
  th: {
    guestBadge: "เริ่มฟรี",
    guestCta: "เข้าสู่ระบบฟรี",
    welcomeCardPetTitle: "สัตว์เลี้ยงร้องและเต้น",
    welcomeSkip: "สำรวจเอง"
  },
  nl: {
    guestBadge: "GRATIS",
    guestCta: "Gratis inloggen",
    welcomeCardPetTitle: "Huisdier Zingt & Danst",
    welcomeSkip: "Zelf verkennen"
  },
  it: {
    guestBadge: "GRATIS",
    guestCta: "Accedi gratis",
    welcomeCardPetTitle: "Animali Cantano e Ballano",
    welcomeSkip: "Esplora da solo"
  },
  ar: {
    guestBadge: "بداية مجانية",
    guestCta: "تسجيل مجاني",
    welcomeCardPetTitle: "الحيوانات الأليفة تغني وترقص",
    welcomeSkip: "استكشاف بنفسي"
  },
  he: {
    guestBadge: "התחלה בחינם",
    guestCta: "התחברות בחינם",
    welcomeCardPetTitle: "חיות מחמד שרות ורוקדות",
    welcomeSkip: "לחקור לבד"
  }
};

const WELCOME_SEEN_PREFIX = "dreamface_welcome_seen:";

export function welcomeSeenStorageKey(userId: string) {
  return `${WELCOME_SEEN_PREFIX}${userId}`;
}

export function shouldShowWelcomeModal(input: {
  authReady: boolean;
  signedIn: boolean;
  userId: string | null;
  creditBalance: number | null;
  tasksLoaded: boolean;
  taskCount: number;
  suppressed: boolean;
  alreadySeen: boolean;
}) {
  return Boolean(
    input.authReady &&
      input.signedIn &&
      input.userId &&
      typeof input.creditBalance === "number" &&
      input.tasksLoaded &&
      input.taskCount === 0 &&
      !input.suppressed &&
      !input.alreadySeen
  );
}

export function studioOnboardingCopy(locale: Locale): StudioOnboardingCopy {
  if (locale === "zh-CN") return ZH_CN;
  if (locale === "zh-TW") return ZH_TW;
  const override = OVERRIDES[locale];
  return override ? { ...EN, ...override } : EN;
}
