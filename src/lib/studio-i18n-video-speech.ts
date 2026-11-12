import type { Locale } from "../i18n/routing";

const copy: Record<Locale, [string, string]> = {
  en: ["Dialogue needs about {required}s including pauses; selected clip: {selected}s. Increase the duration or shorten the dialogue.", "Dialogue needs about {required}s including pauses, beyond the {max}s clip limit. Shorten the dialogue before generating."],
  "zh-CN": ["台词含停顿预计需 {required} 秒，当前视频为 {selected} 秒。请增加时长或缩短台词。", "台词含停顿预计需 {required} 秒，超过单段视频 {max} 秒上限。请先缩短台词再生成。"],
  "zh-TW": ["台詞含停頓預計需 {required} 秒，目前影片為 {selected} 秒。請增加時長或縮短台詞。", "台詞含停頓預計需 {required} 秒，超過單段影片 {max} 秒上限。請先縮短台詞再生成。"],
  "pt-BR": ["A fala com pausas precisa de cerca de {required}s; vídeo selecionado: {selected}s. Aumente a duração ou encurte a fala.", "A fala com pausas precisa de cerca de {required}s, acima do limite de {max}s. Encurte a fala antes de gerar."],
  ru: ["Речь с паузами занимает около {required} с; выбрано {selected} с. Увеличьте длительность или сократите текст.", "Речь с паузами занимает около {required} с, превышая лимит {max} с. Сократите текст перед генерацией."],
  vi: ["Lời thoại có khoảng nghỉ cần khoảng {required} giây; video đã chọn: {selected} giây. Tăng thời lượng hoặc rút ngắn lời thoại.", "Lời thoại có khoảng nghỉ cần khoảng {required} giây, vượt giới hạn {max} giây. Hãy rút ngắn lời thoại trước khi tạo."],
  de: ["Der Dialog mit Pausen benötigt etwa {required}s; gewählt sind {selected}s. Verlängere das Video oder kürze den Dialog.", "Der Dialog mit Pausen benötigt etwa {required}s und überschreitet das Limit von {max}s. Kürze den Dialog vor dem Generieren."],
  fr: ["Le dialogue avec pauses nécessite environ {required}s ; durée choisie : {selected}s. Allongez la durée ou raccourcissez le dialogue.", "Le dialogue avec pauses nécessite environ {required}s, au-delà de la limite de {max}s. Raccourcissez-le avant de générer."],
  ja: ["間を含む台詞は約 {required} 秒必要ですが、選択した動画は {selected} 秒です。時間を延ばすか台詞を短くしてください。", "間を含む台詞は約 {required} 秒必要で、上限の {max} 秒を超えています。生成前に台詞を短くしてください。"],
  th: ["บทพูดรวมช่วงหยุดใช้เวลาประมาณ {required} วินาที แต่วิดีโอที่เลือกยาว {selected} วินาที โปรดเพิ่มเวลาหรือลดบทพูด", "บทพูดรวมช่วงหยุดใช้เวลาประมาณ {required} วินาที เกินขีดจำกัด {max} วินาที โปรดลดบทพูดก่อนสร้าง"],
  nl: ["De dialoog met pauzes duurt ongeveer {required}s; gekozen video: {selected}s. Verleng de duur of verkort de dialoog.", "De dialoog met pauzes duurt ongeveer {required}s, boven de limiet van {max}s. Verkort de dialoog voordat je genereert."],
  he: ["הדיבור כולל הפסקות דורש כ־{required} שניות; נבחרו {selected} שניות. האריכו את הסרטון או קצרו את הטקסט.", "הדיבור כולל הפסקות דורש כ־{required} שניות, מעבר למגבלה של {max} שניות. קצרו את הטקסט לפני היצירה."],
  ko: ["쉼을 포함한 대사는 약 {required}초가 필요하지만 선택한 영상은 {selected}초입니다. 길이를 늘리거나 대사를 줄여 주세요.", "쉼을 포함한 대사는 약 {required}초로 {max}초 제한을 초과합니다. 생성 전에 대사를 줄여 주세요."],
  es: ["El diálogo con pausas necesita unos {required}s; duración elegida: {selected}s. Amplía la duración o acorta el diálogo.", "El diálogo con pausas necesita unos {required}s, por encima del límite de {max}s. Acórtalo antes de generar."],
  it: ["Il dialogo con pause richiede circa {required}s; durata scelta: {selected}s. Aumenta la durata o accorcia il dialogo.", "Il dialogo con pause richiede circa {required}s, oltre il limite di {max}s. Accorcialo prima di generare."],
  ar: ["يحتاج الحوار مع الوقفات إلى نحو {required} ثانية؛ المدة المختارة {selected} ثانية. زِد المدة أو اختصر الحوار.", "يحتاج الحوار مع الوقفات إلى نحو {required} ثانية، متجاوزًا حد {max} ثانية. اختصر الحوار قبل الإنشاء."]
};

export const studioVideoSpeechMessages = Object.fromEntries(Object.entries(copy).map(([locale, [duration, limit]]) => [locale, {
  "studio.videoSpeech.duration": duration,
  "studio.videoSpeech.limit": limit
}]));
