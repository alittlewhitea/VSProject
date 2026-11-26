import type {Locale} from "../i18n/routing";

const english = {
  previewFor: "Preview output for:", usageEstimator: "Credit usage estimator",
  modeAll: "All Tools Mix", modeVideo: "AI Video", modeImage: "AI Images", modeAvatar: "Avatars & Voice",
  mostPopular: "Most Popular", perCredit: "/ cr", savings: "{percent}% OFF vs Starter Pack", standardRate: "Standard pay-as-you-go rate", bonus: "+{credits} bonus",
  upTo: "Up to", basicImages: "images", or: "Or", outputVideos: "{count} videos", outputImages: "{count} images", outputAvatars: "{count} avatar clips", outputVoice: "{count} voiceovers",
  estimateVideo: "AI Video Generation", estimateImage: "AI Image Generation", estimateAvatar: "AI Avatars & Voiceovers",
  eachCredits: "{credits} cr/video", imageBasis: "FLUX Schnell · {credits} cr/image", avatarBasis: "HeyGen Video · {seconds}s · 480p · {credits} cr/clip", voiceCapacity: "Or {count} voiceovers · {characters} chars (HeyGen Voice)",
  buyAmount: "Buy {credits} credits", buyStarter: "Buy Starter", buyCreator: "Buy Creator", buyStudio: "Buy Studio", buyPro: "Buy Pro",
  allTools: "Works across all tools:", toolImage: "Image", toolVideo: "Video", toolAvatar: "Avatar", toolAudio: "Audio",
  neverExpire: "Purchased credits never expire", instantDelivery: "Instant credit delivery", refundProtection: "Failed runs auto-refund",
  usageNote: "Estimated using our most affordable active models (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
  backToPacks: "Back to packs", instantCheckout: "Instant Top-Up Checkout", creditsAdded: "Credits added", newBalance: "New balance after purchase", discountTier: "Discount tier", dueToday: "Total due today", secureCheckout: "Secure payment · One-time charge, no recurring fees"
};
// Values follow the English key order. Validate length so new copy cannot
// silently shift translations into the wrong field.
const copy:Record<Exclude<Locale,"en">,string[]> = {
  "zh-CN": [
    "预览可生成数量：", "积分用量估算", "全部工具", "AI 视频", "AI 图片", "数字人和配音",
    "最受欢迎", "/ 积分", "比入门包省 {percent}%", "标准按量付费价格", "+{credits} 赠送积分",
    "最多", "张图片", "或", "{count} 条视频", "{count} 张图片", "{count} 条数字人视频", "{count} 段配音",
    "AI 视频生成", "AI 图片生成", "数字人与语音合成",
    "每条 {credits} 积分", "FLUX Schnell · 每张 {credits} 积分", "HeyGen Video · {seconds} 秒 · 480p · 每条 {credits} 积分", "或 {count} 段配音 · 每段 {characters} 字符（HeyGen Voice）",
    "购买 {credits} 积分", "购买入门包", "购买创作者包", "购买工作室包", "购买专业包",
    "所有创作工具通用：", "图片", "视频", "数字人", "音频",
    "积分永久有效", "支付完成秒级到账", "生成失败自动退还积分",
    "按当前最经济在售模型测算（FLUX Schnell 1 积分、HeyGen Video 15 积分、HeyGen Voice 1 积分）。",
    "返回积分包", "安全快捷充值", "充值积分", "购买后预计余额", "优惠档位", "本次应付", "安全支付 · 一次付费，不自动续费"
  ],
  "zh-TW": [
    "預覽可生成數量：", "點數用量估算", "全部工具", "AI 影片", "AI 圖片", "虛擬人與配音",
    "最受歡迎", "/ 點數", "比入門包省 {percent}%", "標準按量付費價格", "+{credits} 贈送點數",
    "最多", "張圖片", "或", "{count} 支影片", "{count} 張圖片", "{count} 支虛擬人影片", "{count} 段配音",
    "AI 影片生成", "AI 圖片生成", "虛擬人與語音合成",
    "每支 {credits} 點數", "FLUX Schnell · 每張 {credits} 點數", "HeyGen Video · {seconds} 秒 · 480p · 每支 {credits} 點數", "或 {count} 段配音 · 每段 {characters} 字元（HeyGen Voice）",
    "購買 {credits} 點數", "購買入門包", "購買創作者包", "購買工作室包", "購買專業包",
    "所有創作工具通用：", "圖片", "影片", "虛擬人", "音訊",
    "點數永久有效", "付款完成即時入帳", "生成失敗自動退還點數",
    "依目前最實惠在售模型估算（FLUX Schnell 1 點、HeyGen Video 15 點、HeyGen Voice 1 點）。",
    "返回點數包", "安全快捷儲值", "儲值點數", "購買後預估餘額", "優惠級別", "本次應付", "安全付款 · 單次付費，不自動續訂"
  ],
  "pt-BR": [
    "Prévia de produção:", "Estimativa de uso de créditos", "Todas as ferramentas", "Vídeo IA", "Imagens IA", "Avatares e voz",
    "Mais popular", "/ crédito", "{percent}% OFF vs Starter Pack", "Preço padrão por uso", "+{credits} de bônus",
    "Até", "imagens", "Ou", "{count} vídeos", "{count} imagens", "{count} vídeos de avatar", "{count} locuções",
    "Geração de vídeo IA", "Geração de imagem IA", "Avatares e síntese de voz",
    "{credits} cr/vídeo", "FLUX Schnell · {credits} cr/imagem", "HeyGen Video · {seconds}s · 480p · {credits} cr/clipe", "Ou {count} locuções · {characters} caracteres (HeyGen Voice)",
    "Comprar {credits} créditos", "Comprar Starter", "Comprar Creator", "Comprar Studio", "Comprar Pro",
    "Use em todas as ferramentas:", "Imagem", "Vídeo", "Avatar", "Áudio",
    "Créditos comprados não expiram", "Entrega instantânea", "Reembolso automático em falhas",
    "Estimado com nossos modelos ativos mais econômicos (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
    "Voltar aos pacotes", "Recarga rápida e segura", "Créditos adicionados", "Saldo estimado após a compra", "Faixa de desconto", "Total a pagar hoje", "Pagamento seguro · Compra única, sem cobrança recorrente"
  ],
  ru: [
    "Оценка результата:", "Оценка расхода кредитов", "Все инструменты", "ИИ-видео", "ИИ-изображения", "Аватары и голос",
    "Популярный выбор", "/ кредит", "На {percent}% дешевле Starter Pack", "Стандартная цена по использованию", "+{credits} бонусных",
    "До", "изображений", "Или", "{count} видео", "{count} изображений", "{count} роликов с аватаром", "{count} озвучек",
    "Генерация ИИ-видео", "Генерация изображений", "Аватары и синтез речи",
    "{credits} кр/видео", "FLUX Schnell · {credits} кр/изображение", "HeyGen Video · {seconds} с · 480p · {credits} кр/ролик", "Или {count} озвучек · {characters} символов (HeyGen Voice)",
    "Купить {credits} кредитов", "Купить Starter", "Купить Creator", "Купить Studio", "Купить Pro",
    "Для всех инструментов:", "Изображения", "Видео", "Аватары", "Аудио",
    "Купленные кредиты не сгорают", "Мгновенное зачисление", "Автовозврат при ошибке генерации",
    "Рассчитано по самым выгодным активным моделям (FLUX Schnell 1 кр, HeyGen Video 15 кр, HeyGen Voice 1 кр).",
    "Назад к пакетам", "Быстрое пополнение", "Добавляемые кредиты", "Ожидаемый баланс после покупки", "Уровень скидки", "К оплате сегодня", "Безопасная оплата · Разовая покупка без регулярных списаний"
  ],
  vi: [
    "Xem trước sản lượng:", "Ước tính sử dụng tín dụng", "Tất cả công cụ", "Video AI", "Ảnh AI", "Avatar và giọng nói",
    "Phổ biến nhất", "/ tín dụng", "Giảm {percent}% so với Starter Pack", "Giá tiêu chuẩn theo mức dùng", "+{credits} thưởng",
    "Tối đa", "ảnh", "Hoặc", "{count} video", "{count} ảnh", "{count} video avatar", "{count} bản lồng tiếng",
    "Tạo video AI", "Tạo ảnh AI", "Avatar và tổng hợp giọng nói",
    "{credits} cr/video", "FLUX Schnell · {credits} cr/ảnh", "HeyGen Video · {seconds}s · 480p · {credits} cr/clip", "Hoặc {count} bản lồng tiếng · {characters} ký tự (HeyGen Voice)",
    "Mua {credits} tín dụng", "Mua Starter", "Mua Creator", "Mua Studio", "Mua Pro",
    "Dùng cho mọi công cụ:", "Ảnh", "Video", "Avatar", "Âm thanh",
    "Tín dụng đã mua không hết hạn", "Cộng tín dụng tức thì", "Tự hoàn tín dụng nếu lỗi",
    "Ước tính theo các mô hình đang hoạt động tiết kiệm nhất (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
    "Quay lại gói", "Nạp nhanh an toàn", "Tín dụng được thêm", "Số dư dự kiến sau mua", "Mức giảm giá", "Tổng trả hôm nay", "Thanh toán an toàn · Trả một lần, không gia hạn tự động"
  ],
  de: [
    "Ausgabevorschau:", "Kreditverbrauch schätzen", "Alle Tools", "KI-Video", "KI-Bilder", "Avatare & Stimme",
    "Am beliebtesten", "/ Credit", "{percent}% günstiger als Starter Pack", "Standardpreis nach Verbrauch", "+{credits} Bonus",
    "Bis zu", "Bilder", "Oder", "{count} Videos", "{count} Bilder", "{count} Avatar-Clips", "{count} Sprachaufnahmen",
    "KI-Videogenerierung", "KI-Bildgenerierung", "Avatare & Sprachsynthese",
    "{credits} Cr/Video", "FLUX Schnell · {credits} Cr/Bild", "HeyGen Video · {seconds}s · 480p · {credits} Cr/Clip", "Oder {count} Sprachaufnahmen · {characters} Zeichen (HeyGen Voice)",
    "{credits} Credits kaufen", "Starter kaufen", "Creator kaufen", "Studio kaufen", "Pro kaufen",
    "Für alle Tools:", "Bild", "Video", "Avatar", "Audio",
    "Gekaufte Credits verfallen nicht", "Sofortige Gutschrift", "Automatische Rückerstattung bei Fehlern",
    "Berechnet auf Basis unserer günstigsten aktiven Modelle (FLUX Schnell 1 Cr, HeyGen Video 15 Cr, HeyGen Voice 1 Cr).",
    "Zurück zu den Paketen", "Schnell und sicher aufladen", "Zusätzliche Credits", "Erwartetes Guthaben nach Kauf", "Rabattstufe", "Heute fälliger Betrag", "Sichere Zahlung · Einmalig, keine wiederkehrenden Gebühren"
  ],
  fr: [
    "Aperçu de production :", "Estimation des crédits", "Tous les outils", "Vidéo IA", "Images IA", "Avatars et voix",
    "Le plus populaire", "/ crédit", "{percent}% de moins que Starter Pack", "Tarif standard à l’usage", "+{credits} offerts",
    "Jusqu’à", "images", "Ou", "{count} vidéos", "{count} images", "{count} clips d’avatar", "{count} voix off",
    "Génération vidéo IA", "Génération d’images IA", "Avatars et synthèse vocale",
    "{credits} cr/vidéo", "FLUX Schnell · {credits} cr/image", "HeyGen Video · {seconds}s · 480p · {credits} cr/clip", "Ou {count} voix off · {characters} caractères (HeyGen Voice)",
    "Acheter {credits} crédits", "Acheter Starter", "Acheter Creator", "Acheter Studio", "Acheter Pro",
    "Pour tous vos outils :", "Image", "Vidéo", "Avatar", "Audio",
    "Les crédits achetés n’expirent pas", "Livraison instantanée", "Remboursement auto en cas d’échec",
    "Calculé avec nos modèles actifs les plus économiques (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
    "Retour aux packs", "Recharge rapide et sécurisée", "Crédits ajoutés", "Solde estimé après achat", "Niveau de remise", "Total à payer aujourd’hui", "Paiement sécurisé · Achat unique, sans frais récurrents"
  ],
  ja: [
    "生成数の目安：", "クレジット使用量の目安", "すべてのツール", "AI動画", "AI画像", "アバター・音声",
    "人気のプラン", "/ クレジット", "Starter Pack比 {percent}%お得", "標準の従量料金", "+{credits}ボーナス",
    "最大", "枚の画像", "または", "動画{count}本", "画像{count}枚", "アバター動画{count}本", "音声{count}件",
    "AI動画生成", "AI画像生成", "アバター・音声合成",
    "1本{credits}クレジット", "FLUX Schnell · 1枚{credits}クレジット", "HeyGen Video · {seconds}秒 · 480p · 1本{credits}クレジット", "または音声{count}件 · {characters}文字（HeyGen Voice）",
    "{credits}クレジットを購入", "Starterを購入", "Creatorを購入", "Studioを購入", "Proを購入",
    "すべてのツールで利用可能：", "画像", "動画", "アバター", "音声",
    "購入クレジットは有効期限なし", "決済後すぐ付与", "生成失敗時は自動返還",
    "最安の稼働モデル基準で算出（FLUX Schnell 1cr、HeyGen Video 15cr、HeyGen Voice 1cr）。",
    "パックに戻る", "安全・簡単チャージ", "追加クレジット", "購入後の予想残高", "割引区分", "今回のお支払い", "安全な決済 · 買い切り、自動更新なし"
  ],
  th: [
    "ดูจำนวนผลงานโดยประมาณ:", "ประมาณการใช้เครดิต", "ทุกเครื่องมือ", "วิดีโอ AI", "ภาพ AI", "อวาตาร์และเสียง",
    "ยอดนิยม", "/ เครดิต", "ถูกกว่า Starter Pack {percent}%", "ราคามาตรฐานตามการใช้งาน", "+{credits} โบนัส",
    "สูงสุด", "ภาพ", "หรือ", "{count} วิดีโอ", "{count} ภาพ", "{count} คลิปอวาตาร์", "{count} เสียงพากย์",
    "สร้างวิดีโอ AI", "สร้างภาพ AI", "อวาตาร์และสังเคราะห์เสียง",
    "{credits} เครดิต/วิดีโอ", "FLUX Schnell · {credits} เครดิต/ภาพ", "HeyGen Video · {seconds} วินาที · 480p · {credits} เครดิต/คลิป", "หรือ {count} เสียงพากย์ · {characters} อักขระ (HeyGen Voice)",
    "ซื้อ {credits} เครดิต", "ซื้อ Starter", "ซื้อ Creator", "ซื้อ Studio", "ซื้อ Pro",
    "ใช้ได้กับทุกเครื่องมือ:", "ภาพ", "วิดีโอ", "อวาตาร์", "เสียง",
    "เครดิตที่ซื้อไม่มีวันหมดอายุ", "รับเครดิตทันที", "คืนเครดิตอัตโนมัติหากล้มเหลว",
    "คำนวณจากโมเดลที่คุ้มค่าที่สุดที่เปิดใช้งาน (FLUX Schnell 1 เครดิต, HeyGen Video 15 เครดิต, HeyGen Voice 1 เครดิต)",
    "กลับไปที่แพ็ก", "เติมเครดิตอย่างปลอดภัย", "เครดิตที่จะได้รับ", "ยอดคาดการณ์หลังซื้อ", "ระดับส่วนลด", "ยอดชำระวันนี้", "ชำระเงินปลอดภัย · จ่ายครั้งเดียว ไม่มีค่าบริการประจำ"
  ],
  nl: [
    "Bekijk geschatte uitvoer:", "Creditverbruik schatten", "Alle tools", "AI-video", "AI-afbeeldingen", "Avatars en stem",
    "Meest populair", "/ credit", "{percent}% korting t.o.v. Starter Pack", "Standaard gebruikstarief", "+{credits} bonus",
    "Tot", "afbeeldingen", "Of", "{count} video's", "{count} afbeeldingen", "{count} avatarclips", "{count} voice-overs",
    "AI-video genereren", "AI-afbeeldingen genereren", "Avatars en spraaksynthese",
    "{credits} cr/video", "FLUX Schnell · {credits} cr/afbeelding", "HeyGen Video · {seconds}s · 480p · {credits} cr/clip", "Of {count} voice-overs · {characters} tekens (HeyGen Voice)",
    "Koop {credits} credits", "Koop Starter", "Koop Creator", "Koop Studio", "Koop Pro",
    "Voor al je tools:", "Afbeelding", "Video", "Avatar", "Audio",
    "Gekochte credits verlopen niet", "Directe levering", "Automatische terugbetaling bij fouten",
    "Berekend op basis van onze voordeligste actieve modellen (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
    "Terug naar pakketten", "Snel en veilig opwaarderen", "Toegevoegde credits", "Verwacht saldo na aankoop", "Kortingsniveau", "Vandaag te betalen", "Veilig betalen · Eenmalig, geen terugkerende kosten"
  ],
  he: [
    "תצוגה מקדימה של תפוקה:", "הערכת שימוש בקרדיטים", "כל הכלים", "וידאו AI", "תמונות AI", "אווטארים וקול",
    "הכי פופולרי", "/ קרדיט", "{percent}% פחות מ-Starter Pack", "תעריף רגיל לפי שימוש", "+{credits} בונוס",
    "עד", "תמונות", "או", "{count} סרטונים", "{count} תמונות", "{count} סרטוני אווטאר", "{count} קריינויות",
    "יצירת וידאו AI", "יצירת תמונות AI", "אווטארים וסינתזת דיבור",
    "{credits} קרדיטים לסרטון", "FLUX Schnell · {credits} קרדיטים לתמונה", "HeyGen Video · {seconds} שניות · 480p · {credits} קרדיטים", "או {count} קריינויות · {characters} תווים (HeyGen Voice)",
    "רכישת {credits} קרדיטים", "רכישת Starter", "רכישת Creator", "רכישת Studio", "רכישת Pro",
    "לכל כלי היצירה:", "תמונה", "וידאו", "אווטאר", "אודיו",
    "קרדיטים שנרכשו אינם פגים", "אספקה מיידית", "החזר אוטומטי בכשל יצירה",
    "מחושב לפי המודלים הפעילים המשתלמים ביותר (FLUX Schnell 1, HeyGen Video 15, HeyGen Voice 1).",
    "חזרה לחבילות", "טעינה מהירה ומאובטחת", "קרדיטים שיתווספו", "יתרה צפויה לאחר הרכישה", "דרגת הנחה", "סך לתשלום היום", "תשלום מאובטח · חד פעמי, ללא חיובים חוזרים"
  ],
  ko: [
    "예상 생성량:", "크레딧 사용량 계산", "모든 도구", "AI 동영상", "AI 이미지", "아바타 및 음성",
    "가장 인기 있는 팩", "/ 크레딧", "Starter Pack 대비 {percent}% 할인", "표준 종량제 요금", "+{credits} 보너스",
    "최대", "장의 이미지", "또는", "동영상 {count}개", "이미지 {count}장", "아바타 영상 {count}개", "음성 {count}개",
    "AI 동영상 생성", "AI 이미지 생성", "아바타 및 음성 합성",
    "영상당 {credits} 크레딧", "FLUX Schnell · 이미지당 {credits} 크레딧", "HeyGen Video · {seconds}초 · 480p · 영상당 {credits} 크레딧", "또는 음성 {count}개 · {characters}자 (HeyGen Voice)",
    "{credits} 크레딧 구매", "Starter 구매", "Creator 구매", "Studio 구매", "Pro 구매",
    "모든 도구에서 사용:", "이미지", "동영상", "아바타", "오디오",
    "구매한 크레딧은 만료되지 않음", "결제 즉시 지급", "생성 실패 시 자동 환불",
    "현재 가장 합리적인 활성 모델 기준 계산(FLUX Schnell 1cr, HeyGen Video 15cr, HeyGen Voice 1cr).",
    "팩으로 돌아가기", "빠르고 안전한 충전", "추가 크레딧", "구매 후 예상 잔액", "할인 등급", "오늘 결제 금액", "안전한 결제 · 일회성 구매, 정기 결제 없음"
  ],
  es: [
    "Vista previa de producción:", "Estimador de uso de créditos", "Todas las herramientas", "Vídeo IA", "Imágenes IA", "Avatares y voz",
    "Más popular", "/ crédito", "{percent}% menos que Starter Pack", "Tarifa estándar por uso", "+{credits} de regalo",
    "Hasta", "imágenes", "O", "{count} vídeos", "{count} imágenes", "{count} clips de avatar", "{count} locuciones",
    "Generación de vídeo IA", "Generación de imágenes IA", "Avatares y síntesis de voz",
    "{credits} cr/vídeo", "FLUX Schnell · {credits} cr/imagen", "HeyGen Video · {seconds}s · 480p · {credits} cr/clip", "O {count} locuciones · {characters} caracteres (HeyGen Voice)",
    "Comprar {credits} créditos", "Comprar Starter", "Comprar Creator", "Comprar Studio", "Comprar Pro",
    "Para todas tus herramientas:", "Imagen", "Vídeo", "Avatar", "Audio",
    "Los créditos comprados no caducan", "Entrega instantánea", "Reembolso automático si falla",
    "Calculado con nuestros modelos activos más económicos (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
    "Volver a los packs", "Recarga rápida y segura", "Créditos añadidos", "Saldo estimado tras la compra", "Nivel de descuento", "Total a pagar hoy", "Pago seguro · Compra única, sin cargos recurrentes"
  ],
  it: [
    "Anteprima della produzione:", "Stima dell’uso dei crediti", "Tutti gli strumenti", "Video IA", "Immagini IA", "Avatar e voce",
    "Più popolare", "/ credito", "{percent}% in meno di Starter Pack", "Tariffa standard a consumo", "+{credits} in omaggio",
    "Fino a", "immagini", "Oppure", "{count} video", "{count} immagini", "{count} clip avatar", "{count} voci fuori campo",
    "Generazione video IA", "Generazione immagini IA", "Avatar e sintesi vocale",
    "{credits} cr/video", "FLUX Schnell · {credits} cr/immagine", "HeyGen Video · {seconds}s · 480p · {credits} cr/clip", "Oppure {count} voci fuori campo · {characters} caratteri (HeyGen Voice)",
    "Acquista {credits} crediti", "Acquista Starter", "Acquista Creator", "Acquista Studio", "Acquista Pro",
    "Per tutti i tuoi strumenti:", "Immagine", "Video", "Avatar", "Audio",
    "I crediti acquistati non scadono", "Accredito immediato", "Rimborso automatico in caso di errore",
    "Calcolato sui nostri modelli attivi più convenienti (FLUX Schnell 1 cr, HeyGen Video 15 cr, HeyGen Voice 1 cr).",
    "Torna ai pacchetti", "Ricarica rapida e sicura", "Crediti aggiunti", "Saldo stimato dopo l’acquisto", "Fascia di sconto", "Totale da pagare oggi", "Pagamento sicuro · Acquisto singolo, nessun costo ricorrente"
  ],
  ar: [
    "معاينة عدد النتائج:", "تقدير استخدام الأرصدة", "جميع الأدوات", "فيديو AI", "صور AI", "أفاتار وصوت",
    "الأكثر شعبية", "/ رصيد", "أقل بنسبة {percent}% من Starter Pack", "السعر القياسي حسب الاستخدام", "+{credits} مكافأة",
    "حتى", "صورة", "أو", "{count} فيديو", "{count} صورة", "{count} مقطع أفاتار", "{count} تعليق صوتي",
    "إنشاء فيديو بالذكاء الاصطناعي", "إنشاء صور بالذكاء الاصطناعي", "أفاتار وتحويل النص إلى كلام",
    "{credits} رصيد لكل فيديو", "FLUX Schnell · {credits} رصيد لكل صورة", "HeyGen Video · {seconds} ثوانٍ · 480p · {credits} رصيد", "أو {count} تعليق صوتي · {characters} حرفًا (HeyGen Voice)",
    "شراء {credits} رصيد", "شراء Starter", "شراء Creator", "شراء Studio", "شراء Pro",
    "تعمل مع جميع الأدوات:", "صور", "فيديو", "أفاتار", "صوت",
    "الأرصدة المشتراة لا تنتهي صلاحيتها", "شحن فوري للرصيد", "استرداد تلقائي عند فشل الإنشاء",
    "محسوبة وفق أكثر النماذج النشطة توفيرًا (FLUX Schnell 1 رصيد، HeyGen Video 15 رصيدًا، HeyGen Voice 1 رصيد).",
    "العودة إلى الباقات", "شحن سريع وآمن", "الأرصدة المضافة", "الرصيد المتوقع بعد الشراء", "فئة الخصم", "المبلغ المستحق اليوم", "دفع آمن · دفعة واحدة، دون رسوم متكررة"
  ]
};
const paymentMethodLabel:Record<Locale,string> = {
  en:"Choose a payment method", "zh-CN":"选择支付方式", "zh-TW":"選擇付款方式", "pt-BR":"Escolha uma forma de pagamento", ru:"Выберите способ оплаты", vi:"Chọn phương thức thanh toán", de:"Zahlungsmethode wählen", fr:"Choisissez un moyen de paiement", ja:"お支払い方法を選択", th:"เลือกวิธีชำระเงิน", nl:"Kies een betaalmethode", he:"בחירת אמצעי תשלום", ko:"결제 수단 선택", es:"Elige un método de pago", it:"Scegli un metodo de pagamento", ar:"اختر طريقة الدفع"
};
export const creditShopDesignMessages = Object.fromEntries((Object.keys({en:[],...copy}) as Locale[]).map((locale):[Locale,Record<string,string>] => {
  const keys=Object.keys(english),values=locale==="en"?Object.values(english):copy[locale];
  if(values.length!==keys.length)throw new Error(`Credit shop design copy is incomplete: ${locale}`);
  return [locale,{...Object.fromEntries(keys.map((key,index)=>[`creditShop.${key}`,values[index]])),"creditShop.chooseMethod":paymentMethodLabel[locale]}];
})) as Record<Locale,Record<string,string>>;
