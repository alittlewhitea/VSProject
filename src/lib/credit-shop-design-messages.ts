import type {Locale} from "../i18n/routing";

const english = {
  previewFor: "Preview output for:", usageEstimator: "Credit usage estimator",
  modeAll: "All Tools Mix", modeVideo: "AI Video (H3 Max)", modeImage: "Basic Images", modeAvatar: "Avatars & Voice",
  mostPopular: "Most Popular", perCredit: "/ cr", savings: "{percent}% OFF vs Starter Pack", standardRate: "Standard pay-as-you-go rate", bonus: "(+{credits} bonus)",
  upTo: "Up to", basicImages: "basic images", or: "Or", outputVideos: "{count} videos", outputImages: "{count} images", outputAvatars: "{count} avatar clips",
  estimateVideo: "AI Video Generation", estimateImage: "AI Image Generation", estimateAvatar: "Talking Avatars & TTS",
  eachCredits: "{credits} cr/video", imageBasis: "FLUX Schnell · {credits} cr/image", avatarBasis: "Kling Avatar Standard · {seconds}s · uploaded audio", voiceCapacity: "Or {count} voiceovers · {characters} characters each",
  buyAmount: "Buy {credits} credits", buyStarter: "Buy Starter", buyCreator: "Buy Creator", buyStudio: "Buy Studio", buyPro: "Buy Pro",
  allTools: "Works across all tools:", toolImage: "Image", toolVideo: "Video", toolAvatar: "Avatar", toolAudio: "Audio",
  neverExpire: "Purchased credits never expire", usageNote: "USD · Usage varies by model",
  backToPacks: "Back to packs", instantCheckout: "Instant Top-Up Checkout", creditsAdded: "Credits added", newBalance: "New balance after purchase", discountTier: "Discount tier", dueToday: "Total due today", secureCheckout: "Secure payment · One-time charge, no recurring fees"
};
// Values follow the English key order. Validate length so new copy cannot
// silently shift translations into the wrong field.
const copy:Record<Exclude<Locale,"en">,string[]> = {
  "zh-CN": [
    "预览可生成数量：", "积分用量估算", "全部工具", "AI 视频（H3 Max）", "基础图片", "数字人和配音",
    "最受欢迎", "/ 积分", "比入门包每积分优惠 {percent}%", "标准按量付费价格", "（含 {credits} 赠送积分）",
    "最多", "张基础图片", "或", "{count} 条视频", "{count} 张图片", "{count} 条数字人视频",
    "AI 视频生成", "AI 图片生成", "数字人与语音合成",
    "每条 {credits} 积分", "FLUX Schnell · 每张 {credits} 积分", "Kling Avatar Standard · {seconds} 秒 · 自备音频", "或 {count} 段配音 · 每段 {characters} 字符",
    "购买 {credits} 积分", "购买入门包", "购买创作者包", "购买工作室包", "购买专业包",
    "所有创作工具通用：", "图片", "视频", "数字人", "音频",
    "购买的积分永久有效", "USD · 用量因模型而异",
    "返回积分包", "安全快捷充值", "充值积分", "购买后预计余额", "优惠档位", "本次应付", "安全支付 · 一次付费，不自动续费"
  ],
  "zh-TW": [
    "預覽可生成數量：", "點數用量估算", "全部工具", "AI 影片（H3 Max）", "基本圖片", "虛擬人與配音",
    "最受歡迎", "/ 點數", "比入門包每點數優惠 {percent}%", "標準按量付費價格", "（含 {credits} 贈送點數）",
    "最多", "張基本圖片", "或", "{count} 支影片", "{count} 張圖片", "{count} 支虛擬人影片",
    "AI 影片生成", "AI 圖片生成", "虛擬人與語音合成",
    "每支 {credits} 點數", "FLUX Schnell · 每張 {credits} 點數", "Kling Avatar Standard · {seconds} 秒 · 自備音訊", "或 {count} 段配音 · 每段 {characters} 字元",
    "購買 {credits} 點數", "購買入門包", "購買創作者包", "購買工作室包", "購買專業包",
    "所有創作工具通用：", "圖片", "影片", "虛擬人", "音訊",
    "購買的點數永久有效", "USD · 用量因模型而異",
    "返回點數包", "安全快捷儲值", "儲值點數", "購買後預估餘額", "優惠級別", "本次應付", "安全付款 · 單次付費，不自動續訂"
  ],
  "pt-BR": [
    "Prévia de produção:", "Estimativa de uso de créditos", "Todas as ferramentas", "Vídeo IA (H3 Max)", "Imagens básicas", "Avatares e voz",
    "Mais popular", "/ crédito", "{percent}% OFF vs Starter Pack", "Preço padrão por uso", "(+{credits} de bônus)",
    "Até", "imagens básicas", "Ou", "{count} vídeos", "{count} imagens", "{count} vídeos de avatar",
    "Geração de vídeo IA", "Geração de imagem IA", "Avatares e síntese de voz",
    "{credits} créditos/vídeo", "FLUX Schnell · {credits} créditos/imagem", "Kling Avatar Standard · {seconds}s · áudio enviado", "Ou {count} locuções · {characters} caracteres cada",
    "Comprar {credits} créditos", "Comprar Starter", "Comprar Creator", "Comprar Studio", "Comprar Pro",
    "Use em todas as ferramentas:", "Imagem", "Vídeo", "Avatar", "Áudio",
    "Créditos comprados não expiram", "USD · Uso varia por modelo",
    "Voltar aos pacotes", "Recarga rápida e segura", "Créditos adicionados", "Saldo estimado após a compra", "Faixa de desconto", "Total a pagar hoje", "Pagamento seguro · Compra única, sem cobrança recorrente"
  ],
  ru: [
    "Оценка результата:", "Оценка расхода кредитов", "Все инструменты", "ИИ-видео (H3 Max)", "Базовые изображения", "Аватары и голос",
    "Популярный выбор", "/ кредит", "На {percent}% дешевле Starter Pack", "Стандартная цена по использованию", "(+{credits} бонусных)",
    "До", "базовых изображений", "Или", "{count} видео", "{count} изображений", "{count} роликов с аватаром",
    "Генерация ИИ-видео", "Генерация изображений", "Аватары и синтез речи",
    "{credits} кредитов/видео", "FLUX Schnell · {credits} кредитов/изображение", "Kling Avatar Standard · {seconds} с · свой звук", "Или {count} озвучек · по {characters} символов",
    "Купить {credits} кредитов", "Купить Starter", "Купить Creator", "Купить Studio", "Купить Pro",
    "Для всех инструментов:", "Изображения", "Видео", "Аватары", "Аудио",
    "Купленные кредиты не сгорают", "USD · Расход зависит от модели",
    "Назад к пакетам", "Быстрое пополнение", "Добавляемые кредиты", "Ожидаемый баланс после покупки", "Уровень скидки", "К оплате сегодня", "Безопасная оплата · Разовая покупка без регулярных списаний"
  ],
  vi: [
    "Xem trước sản lượng:", "Ước tính sử dụng tín dụng", "Tất cả công cụ", "Video AI (H3 Max)", "Ảnh cơ bản", "Avatar và giọng nói",
    "Phổ biến nhất", "/ tín dụng", "Giảm {percent}% so với Starter Pack", "Giá tiêu chuẩn theo mức dùng", "(+{credits} thưởng)",
    "Tối đa", "ảnh cơ bản", "Hoặc", "{count} video", "{count} ảnh", "{count} video avatar",
    "Tạo video AI", "Tạo ảnh AI", "Avatar và tổng hợp giọng nói",
    "{credits} tín dụng/video", "FLUX Schnell · {credits} tín dụng/ảnh", "Kling Avatar Standard · {seconds}s · âm thanh tải lên", "Hoặc {count} bản lồng tiếng · {characters} ký tự mỗi bản",
    "Mua {credits} tín dụng", "Mua Starter", "Mua Creator", "Mua Studio", "Mua Pro",
    "Dùng cho mọi công cụ:", "Ảnh", "Video", "Avatar", "Âm thanh",
    "Tín dụng đã mua không hết hạn", "USD · Mức dùng tùy mô hình",
    "Quay lại gói", "Nạp nhanh an toàn", "Tín dụng được thêm", "Số dư dự kiến sau mua", "Mức giảm giá", "Tổng trả hôm nay", "Thanh toán an toàn · Trả một lần, không gia hạn tự động"
  ],
  de: [
    "Ausgabevorschau:", "Kreditverbrauch schätzen", "Alle Tools", "KI-Video (H3 Max)", "Basisbilder", "Avatare & Stimme",
    "Am beliebtesten", "/ Credit", "{percent}% günstiger als Starter Pack", "Standardpreis nach Verbrauch", "(+{credits} Bonus)",
    "Bis zu", "Basisbilder", "Oder", "{count} Videos", "{count} Bilder", "{count} Avatar-Clips",
    "KI-Videogenerierung", "KI-Bildgenerierung", "Avatare & Sprachsynthese",
    "{credits} Credits/Video", "FLUX Schnell · {credits} Credits/Bild", "Kling Avatar Standard · {seconds}s · eigenes Audio", "Oder {count} Sprachaufnahmen · je {characters} Zeichen",
    "{credits} Credits kaufen", "Starter kaufen", "Creator kaufen", "Studio kaufen", "Pro kaufen",
    "Für alle Tools:", "Bild", "Video", "Avatar", "Audio",
    "Gekaufte Credits verfallen nicht", "USD · Verbrauch je nach Modell",
    "Zurück zu den Paketen", "Schnell und sicher aufladen", "Zusätzliche Credits", "Erwartetes Guthaben nach Kauf", "Rabattstufe", "Heute fälliger Betrag", "Sichere Zahlung · Einmalig, keine wiederkehrenden Gebühren"
  ],
  fr: [
    "Aperçu de production :", "Estimation des crédits", "Tous les outils", "Vidéo IA (H3 Max)", "Images de base", "Avatars et voix",
    "Le plus populaire", "/ crédit", "{percent}% de moins que Starter Pack", "Tarif standard à l’usage", "(+{credits} offerts)",
    "Jusqu’à", "images de base", "Ou", "{count} vidéos", "{count} images", "{count} clips d’avatar",
    "Génération vidéo IA", "Génération d’images IA", "Avatars et synthèse vocale",
    "{credits} crédits/vidéo", "FLUX Schnell · {credits} crédits/image", "Kling Avatar Standard · {seconds}s · audio fourni", "Ou {count} voix off · {characters} caractères chacune",
    "Acheter {credits} crédits", "Acheter Starter", "Acheter Creator", "Acheter Studio", "Acheter Pro",
    "Pour tous vos outils :", "Image", "Vidéo", "Avatar", "Audio",
    "Les crédits achetés n’expirent pas", "USD · Usage selon le modèle",
    "Retour aux packs", "Recharge rapide et sécurisée", "Crédits ajoutés", "Solde estimé après achat", "Niveau de remise", "Total à payer aujourd’hui", "Paiement sécurisé · Achat unique, sans frais récurrents"
  ],
  ja: [
    "生成数の目安：", "クレジット使用量の目安", "すべてのツール", "AI動画（H3 Max）", "基本画像", "アバター・音声",
    "人気のプラン", "/ クレジット", "Starter Pack比 {percent}%お得", "標準の従量料金", "（{credits}ボーナス込み）",
    "最大", "枚の基本画像", "または", "動画{count}本", "画像{count}枚", "アバター動画{count}本",
    "AI動画生成", "AI画像生成", "アバター・音声合成",
    "1本{credits}クレジット", "FLUX Schnell · 1枚{credits}クレジット", "Kling Avatar Standard · {seconds}秒 · 音声持ち込み", "または音声{count}件 · 各{characters}文字",
    "{credits}クレジットを購入", "Starterを購入", "Creatorを購入", "Studioを購入", "Proを購入",
    "すべてのツールで利用可能：", "画像", "動画", "アバター", "音声",
    "購入クレジットは有効期限なし", "USD · 使用量はモデルによって異なります",
    "パックに戻る", "安全・簡単チャージ", "追加クレジット", "購入後の予想残高", "割引区分", "今回のお支払い", "安全な決済 · 買い切り、自動更新なし"
  ],
  th: [
    "ดูจำนวนผลงานโดยประมาณ:", "ประมาณการใช้เครดิต", "ทุกเครื่องมือ", "วิดีโอ AI (H3 Max)", "ภาพพื้นฐาน", "อวาตาร์และเสียง",
    "ยอดนิยม", "/ เครดิต", "ถูกกว่า Starter Pack {percent}%", "ราคามาตรฐานตามการใช้งาน", "(+{credits} โบนัส)",
    "สูงสุด", "ภาพพื้นฐาน", "หรือ", "{count} วิดีโอ", "{count} ภาพ", "{count} คลิปอวาตาร์",
    "สร้างวิดีโอ AI", "สร้างภาพ AI", "อวาตาร์และสังเคราะห์เสียง",
    "{credits} เครดิต/วิดีโอ", "FLUX Schnell · {credits} เครดิต/ภาพ", "Kling Avatar Standard · {seconds} วินาที · ใช้เสียงอัปโหลด", "หรือ {count} เสียงพากย์ · ชุดละ {characters} อักขระ",
    "ซื้อ {credits} เครดิต", "ซื้อ Starter", "ซื้อ Creator", "ซื้อ Studio", "ซื้อ Pro",
    "ใช้ได้กับทุกเครื่องมือ:", "ภาพ", "วิดีโอ", "อวาตาร์", "เสียง",
    "เครดิตที่ซื้อไม่มีวันหมดอายุ", "USD · การใช้ขึ้นอยู่กับโมเดล",
    "กลับไปที่แพ็ก", "เติมเครดิตอย่างปลอดภัย", "เครดิตที่จะได้รับ", "ยอดคาดการณ์หลังซื้อ", "ระดับส่วนลด", "ยอดชำระวันนี้", "ชำระเงินปลอดภัย · จ่ายครั้งเดียว ไม่มีค่าบริการประจำ"
  ],
  nl: [
    "Bekijk geschatte uitvoer:", "Creditverbruik schatten", "Alle tools", "AI-video (H3 Max)", "Basisafbeeldingen", "Avatars en stem",
    "Meest populair", "/ credit", "{percent}% korting t.o.v. Starter Pack", "Standaard gebruikstarief", "(+{credits} bonus)",
    "Tot", "basisafbeeldingen", "Of", "{count} video's", "{count} afbeeldingen", "{count} avatarclips",
    "AI-video genereren", "AI-afbeeldingen genereren", "Avatars en spraaksynthese",
    "{credits} credits/video", "FLUX Schnell · {credits} credits/afbeelding", "Kling Avatar Standard · {seconds}s · eigen audio", "Of {count} voice-overs · elk {characters} tekens",
    "Koop {credits} credits", "Koop Starter", "Koop Creator", "Koop Studio", "Koop Pro",
    "Voor al je tools:", "Afbeelding", "Video", "Avatar", "Audio",
    "Gekochte credits verlopen niet", "USD · Gebruik varieert per model",
    "Terug naar pakketten", "Snel en veilig opwaarderen", "Toegevoegde credits", "Verwacht saldo na aankoop", "Kortingsniveau", "Vandaag te betalen", "Veilig betalen · Eenmalig, geen terugkerende kosten"
  ],
  he: [
    "תצוגה מקדימה של תפוקה:", "הערכת שימוש בקרדיטים", "כל הכלים", "וידאו AI ‏(H3 Max)", "תמונות בסיסיות", "אווטארים וקול",
    "הכי פופולרי", "/ קרדיט", "{percent}% פחות מ-Starter Pack", "תעריף רגיל לפי שימוש", "(+{credits} בונוס)",
    "עד", "תמונות בסיסיות", "או", "{count} סרטונים", "{count} תמונות", "{count} סרטוני אווטאר",
    "יצירת וידאו AI", "יצירת תמונות AI", "אווטארים וסינתזת דיבור",
    "{credits} קרדיטים לסרטון", "FLUX Schnell · {credits} קרדיטים לתמונה", "Kling Avatar Standard · {seconds} שניות · אודיו שהועלה", "או {count} קריינויות · {characters} תווים כל אחת",
    "רכישת {credits} קרדיטים", "רכישת Starter", "רכישת Creator", "רכישת Studio", "רכישת Pro",
    "לכל כלי היצירה:", "תמונה", "וידאו", "אווטאר", "אודיו",
    "קרדיטים שנרכשו אינם פגים", "USD · השימוש משתנה לפי מודל",
    "חזרה לחבילות", "טעינה מהירה ומאובטחת", "קרדיטים שיתווספו", "יתרה צפויה לאחר הרכישה", "דרגת הנחה", "סך לתשלום היום", "תשלום מאובטח · חד פעמי, ללא חיובים חוזרים"
  ],
  ko: [
    "예상 생성량:", "크레딧 사용량 계산", "모든 도구", "AI 동영상 (H3 Max)", "기본 이미지", "아바타 및 음성",
    "가장 인기 있는 팩", "/ 크레딧", "Starter Pack 대비 {percent}% 할인", "표준 종량제 요금", "({credits} 보너스 포함)",
    "최대", "장의 기본 이미지", "또는", "동영상 {count}개", "이미지 {count}장", "아바타 영상 {count}개",
    "AI 동영상 생성", "AI 이미지 생성", "아바타 및 음성 합성",
    "영상당 {credits} 크레딧", "FLUX Schnell · 이미지당 {credits} 크레딧", "Kling Avatar Standard · {seconds}초 · 업로드한 오디오", "또는 음성 {count}개 · 각 {characters}자",
    "{credits} 크레딧 구매", "Starter 구매", "Creator 구매", "Studio 구매", "Pro 구매",
    "모든 도구에서 사용:", "이미지", "동영상", "아바타", "오디오",
    "구매한 크레딧은 만료되지 않음", "USD · 사용량은 모델에 따라 다름",
    "팩으로 돌아가기", "빠르고 안전한 충전", "추가 크레딧", "구매 후 예상 잔액", "할인 등급", "오늘 결제 금액", "안전한 결제 · 일회성 구매, 정기 결제 없음"
  ],
  es: [
    "Vista previa de producción:", "Estimador de uso de créditos", "Todas las herramientas", "Vídeo IA (H3 Max)", "Imágenes básicas", "Avatares y voz",
    "Más popular", "/ crédito", "{percent}% menos que Starter Pack", "Tarifa estándar por uso", "(+{credits} de regalo)",
    "Hasta", "imágenes básicas", "O", "{count} vídeos", "{count} imágenes", "{count} clips de avatar",
    "Generación de vídeo IA", "Generación de imágenes IA", "Avatares y síntesis de voz",
    "{credits} créditos/vídeo", "FLUX Schnell · {credits} créditos/imagen", "Kling Avatar Standard · {seconds}s · audio propio", "O {count} locuciones · {characters} caracteres cada una",
    "Comprar {credits} créditos", "Comprar Starter", "Comprar Creator", "Comprar Studio", "Comprar Pro",
    "Para todas tus herramientas:", "Imagen", "Vídeo", "Avatar", "Audio",
    "Los créditos comprados no caducan", "USD · Uso según el modelo",
    "Volver a los packs", "Recarga rápida y segura", "Créditos añadidos", "Saldo estimado tras la compra", "Nivel de descuento", "Total a pagar hoy", "Pago seguro · Compra única, sin cargos recurrentes"
  ],
  it: [
    "Anteprima della produzione:", "Stima dell’uso dei crediti", "Tutti gli strumenti", "Video IA (H3 Max)", "Immagini di base", "Avatar e voce",
    "Più popolare", "/ credito", "{percent}% in meno di Starter Pack", "Tariffa standard a consumo", "(+{credits} in omaggio)",
    "Fino a", "immagini di base", "Oppure", "{count} video", "{count} immagini", "{count} clip avatar",
    "Generazione video IA", "Generazione immagini IA", "Avatar e sintesi vocale",
    "{credits} crediti/video", "FLUX Schnell · {credits} crediti/immagine", "Kling Avatar Standard · {seconds}s · audio caricato", "Oppure {count} voci fuori campo · {characters} caratteri ciascuna",
    "Acquista {credits} crediti", "Acquista Starter", "Acquista Creator", "Acquista Studio", "Acquista Pro",
    "Per tutti i tuoi strumenti:", "Immagine", "Video", "Avatar", "Audio",
    "I crediti acquistati non scadono", "USD · Consumo in base al modello",
    "Torna ai pacchetti", "Ricarica rapida e sicura", "Crediti aggiunti", "Saldo stimato dopo l’acquisto", "Fascia di sconto", "Totale da pagare oggi", "Pagamento sicuro · Acquisto singolo, nessun costo ricorrente"
  ],
  ar: [
    "معاينة عدد النتائج:", "تقدير استخدام الأرصدة", "جميع الأدوات", "فيديو AI ‏(H3 Max)", "صور أساسية", "أفاتار وصوت",
    "الأكثر شعبية", "/ رصيد", "أقل بنسبة {percent}% من Starter Pack", "السعر القياسي حسب الاستخدام", "(+{credits} مكافأة)",
    "حتى", "صورة أساسية", "أو", "{count} فيديو", "{count} صورة", "{count} مقطع أفاتار",
    "إنشاء فيديو بالذكاء الاصطناعي", "إنشاء صور بالذكاء الاصطناعي", "أفاتار وتحويل النص إلى كلام",
    "{credits} رصيد لكل فيديو", "FLUX Schnell · {credits} رصيد لكل صورة", "Kling Avatar Standard · {seconds} ثوانٍ · صوت مرفوع", "أو {count} تعليق صوتي · {characters} حرفًا لكل تعليق",
    "شراء {credits} رصيد", "شراء Starter", "شراء Creator", "شراء Studio", "شراء Pro",
    "تعمل مع جميع الأدوات:", "صور", "فيديو", "أفاتار", "صوت",
    "الأرصدة المشتراة لا تنتهي صلاحيتها", "USD · الاستخدام يختلف حسب النموذج",
    "العودة إلى الباقات", "شحن سريع وآمن", "الأرصدة المضافة", "الرصيد المتوقع بعد الشراء", "فئة الخصم", "المبلغ المستحق اليوم", "دفع آمن · دفعة واحدة، دون رسوم متكررة"
  ]
};
const paymentMethodLabel:Record<Locale,string> = {
  en:"Choose a payment method", "zh-CN":"选择支付方式", "zh-TW":"選擇付款方式", "pt-BR":"Escolha uma forma de pagamento", ru:"Выберите способ оплаты", vi:"Chọn phương thức thanh toán", de:"Zahlungsmethode wählen", fr:"Choisissez un moyen de paiement", ja:"お支払い方法を選択", th:"เลือกวิธีชำระเงิน", nl:"Kies een betaalmethode", he:"בחירת אמצעי תשלום", ko:"결제 수단 선택", es:"Elige un método de pago", it:"Scegli un metodo di pagamento", ar:"اختر طريقة الدفع"
};
export const creditShopDesignMessages = Object.fromEntries((Object.keys({en:[],...copy}) as Locale[]).map((locale):[Locale,Record<string,string>] => {
  const keys=Object.keys(english),values=locale==="en"?Object.values(english):copy[locale];
  if(values.length!==keys.length)throw new Error(`Credit shop design copy is incomplete: ${locale}`);
  return [locale,{...Object.fromEntries(keys.map((key,index)=>[`creditShop.${key}`,values[index]])),"creditShop.chooseMethod":paymentMethodLabel[locale]}];
})) as Record<Locale,Record<string,string>>;
