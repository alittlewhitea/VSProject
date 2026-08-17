import type { Locale } from "../i18n/routing";

type Messages = Record<string, string>;

const en: Messages = {
  "studio.cost.estimatedValue": "Approx. membership value {amount}",
  "studio.cost.afterGeneration": "After this: {credits} credits · about {count} more",
  "studio.cost.valueDisclaimer": "Estimated from membership credit value; no extra charge",
  "studio.cost.insufficientTitle": "You're {credits} credits short",
  "studio.cost.insufficientBody": "This generation needs {required} credits. Your current balance is {balance}.",
  "studio.cost.required": "This generation",
  "studio.cost.balance": "Current balance",
  "studio.cost.shortfall": "Credits needed",
  "studio.cost.recommendedCapacity": "{plan} includes {credits} credits — about {count} similar generations."
};

export const studioCostMessages: Record<Locale, Messages> = {
  en,
  "zh-CN": {
    "studio.cost.estimatedValue": "会员积分价值约 {amount}",
    "studio.cost.afterGeneration": "生成后剩余 {credits} 积分 · 约还能生成 {count} 次",
    "studio.cost.valueDisclaimer": "按会员套餐积分价值估算，不会额外扣款",
    "studio.cost.insufficientTitle": "还差 {credits} 积分即可生成",
    "studio.cost.insufficientBody": "本次需要 {required} 积分，你当前有 {balance} 积分。",
    "studio.cost.required": "本次生成",
    "studio.cost.balance": "当前余额",
    "studio.cost.shortfall": "积分缺口",
    "studio.cost.recommendedCapacity": "{plan} 含 {credits} 积分，约可完成 {count} 次同类生成。"
  },
  "zh-TW": {
    "studio.cost.estimatedValue": "會員點數價值約 {amount}",
    "studio.cost.afterGeneration": "生成後剩餘 {credits} 點 · 約還能生成 {count} 次",
    "studio.cost.valueDisclaimer": "依會員方案點數價值估算，不會額外收費",
    "studio.cost.insufficientTitle": "還差 {credits} 點即可生成",
    "studio.cost.insufficientBody": "本次需要 {required} 點，你目前有 {balance} 點。",
    "studio.cost.required": "本次生成",
    "studio.cost.balance": "目前餘額",
    "studio.cost.shortfall": "點數缺口",
    "studio.cost.recommendedCapacity": "{plan} 含 {credits} 點，約可完成 {count} 次同類生成。"
  },
  "pt-BR": {
    "studio.cost.estimatedValue": "Valor aproximado no plano: {amount}",
    "studio.cost.afterGeneration": "Depois: {credits} créditos · cerca de mais {count}",
    "studio.cost.valueDisclaimer": "Estimativa pelo valor dos créditos do plano; sem cobrança extra",
    "studio.cost.insufficientTitle": "Faltam {credits} créditos",
    "studio.cost.insufficientBody": "Esta geração requer {required} créditos. Seu saldo é {balance}.",
    "studio.cost.required": "Esta geração",
    "studio.cost.balance": "Saldo atual",
    "studio.cost.shortfall": "Créditos faltantes",
    "studio.cost.recommendedCapacity": "{plan} inclui {credits} créditos — cerca de {count} gerações semelhantes."
  },
  ru: {
    "studio.cost.estimatedValue": "Примерная стоимость в подписке: {amount}",
    "studio.cost.afterGeneration": "Останется {credits} кредитов · ещё около {count} генераций",
    "studio.cost.valueDisclaimer": "Расчёт по стоимости кредитов подписки; без доплаты",
    "studio.cost.insufficientTitle": "Не хватает {credits} кредитов",
    "studio.cost.insufficientBody": "Нужно {required} кредитов. Текущий баланс: {balance}.",
    "studio.cost.required": "Эта генерация",
    "studio.cost.balance": "Текущий баланс",
    "studio.cost.shortfall": "Не хватает",
    "studio.cost.recommendedCapacity": "{plan}: {credits} кредитов — около {count} таких генераций."
  },
  vi: {
    "studio.cost.estimatedValue": "Giá trị gói ước tính {amount}",
    "studio.cost.afterGeneration": "Còn {credits} tín dụng · khoảng {count} lượt nữa",
    "studio.cost.valueDisclaimer": "Ước tính theo giá trị tín dụng gói; không tính thêm phí",
    "studio.cost.insufficientTitle": "Bạn còn thiếu {credits} tín dụng",
    "studio.cost.insufficientBody": "Lượt này cần {required} tín dụng. Số dư hiện tại là {balance}.",
    "studio.cost.required": "Lượt tạo này",
    "studio.cost.balance": "Số dư hiện tại",
    "studio.cost.shortfall": "Còn thiếu",
    "studio.cost.recommendedCapacity": "{plan} có {credits} tín dụng — khoảng {count} lượt tương tự."
  },
  de: {
    "studio.cost.estimatedValue": "Geschätzter Mitgliedswert {amount}",
    "studio.cost.afterGeneration": "Danach: {credits} Credits · etwa {count} weitere",
    "studio.cost.valueDisclaimer": "Nach Mitgliedschaftswert geschätzt; keine Zusatzkosten",
    "studio.cost.insufficientTitle": "Dir fehlen {credits} Credits",
    "studio.cost.insufficientBody": "Diese Generierung benötigt {required} Credits. Dein Guthaben: {balance}.",
    "studio.cost.required": "Diese Generierung",
    "studio.cost.balance": "Aktuelles Guthaben",
    "studio.cost.shortfall": "Fehlende Credits",
    "studio.cost.recommendedCapacity": "{plan} enthält {credits} Credits — etwa {count} ähnliche Generierungen."
  },
  fr: {
    "studio.cost.estimatedValue": "Valeur membre estimée {amount}",
    "studio.cost.afterGeneration": "Après : {credits} crédits · environ {count} de plus",
    "studio.cost.valueDisclaimer": "Estimation selon la valeur des crédits du forfait, sans frais supplémentaires",
    "studio.cost.insufficientTitle": "Il vous manque {credits} crédits",
    "studio.cost.insufficientBody": "Cette génération nécessite {required} crédits. Votre solde est de {balance}.",
    "studio.cost.required": "Cette génération",
    "studio.cost.balance": "Solde actuel",
    "studio.cost.shortfall": "Crédits manquants",
    "studio.cost.recommendedCapacity": "{plan} inclut {credits} crédits — environ {count} générations similaires."
  },
  ja: {
    "studio.cost.estimatedValue": "会員クレジット換算 約{amount}",
    "studio.cost.afterGeneration": "生成後 {credits} クレジット · あと約 {count} 回",
    "studio.cost.valueDisclaimer": "会員クレジット価値による目安です。追加請求はありません",
    "studio.cost.insufficientTitle": "あと {credits} クレジット必要です",
    "studio.cost.insufficientBody": "今回は {required} クレジット必要です。現在の残高は {balance} です。",
    "studio.cost.required": "今回の生成",
    "studio.cost.balance": "現在の残高",
    "studio.cost.shortfall": "不足分",
    "studio.cost.recommendedCapacity": "{plan} は {credits} クレジット付きで、同様の生成を約 {count} 回行えます。"
  },
  th: {
    "studio.cost.estimatedValue": "มูลค่าสมาชิกโดยประมาณ {amount}",
    "studio.cost.afterGeneration": "หลังสร้างเหลือ {credits} เครดิต · อีกประมาณ {count} ครั้ง",
    "studio.cost.valueDisclaimer": "ประเมินจากมูลค่าเครดิตสมาชิก ไม่มีค่าใช้จ่ายเพิ่ม",
    "studio.cost.insufficientTitle": "ขาดอีก {credits} เครดิต",
    "studio.cost.insufficientBody": "การสร้างนี้ใช้ {required} เครดิต ยอดปัจจุบันคือ {balance}",
    "studio.cost.required": "การสร้างครั้งนี้",
    "studio.cost.balance": "ยอดปัจจุบัน",
    "studio.cost.shortfall": "เครดิตที่ขาด",
    "studio.cost.recommendedCapacity": "{plan} มี {credits} เครดิต — สร้างแบบเดียวกันได้ประมาณ {count} ครั้ง"
  },
  nl: {
    "studio.cost.estimatedValue": "Geschatte lidmaatschapswaarde {amount}",
    "studio.cost.afterGeneration": "Daarna: {credits} credits · nog circa {count}",
    "studio.cost.valueDisclaimer": "Geschat op basis van lidmaatschapscredits; geen extra kosten",
    "studio.cost.insufficientTitle": "Je komt {credits} credits tekort",
    "studio.cost.insufficientBody": "Deze generatie vereist {required} credits. Je saldo is {balance}.",
    "studio.cost.required": "Deze generatie",
    "studio.cost.balance": "Huidig saldo",
    "studio.cost.shortfall": "Tekort",
    "studio.cost.recommendedCapacity": "{plan} bevat {credits} credits — circa {count} vergelijkbare generaties."
  },
  he: {
    "studio.cost.estimatedValue": "ערך חברות משוער {amount}",
    "studio.cost.afterGeneration": "לאחר מכן: {credits} קרדיטים · עוד כ־{count}",
    "studio.cost.valueDisclaimer": "הערכה לפי ערך קרדיטים במנוי; ללא חיוב נוסף",
    "studio.cost.insufficientTitle": "חסרים לך {credits} קרדיטים",
    "studio.cost.insufficientBody": "היצירה דורשת {required} קרדיטים. היתרה שלך היא {balance}.",
    "studio.cost.required": "היצירה הזו",
    "studio.cost.balance": "יתרה נוכחית",
    "studio.cost.shortfall": "קרדיטים חסרים",
    "studio.cost.recommendedCapacity": "{plan} כולל {credits} קרדיטים — כ־{count} יצירות דומות."
  },
  ko: {
    "studio.cost.estimatedValue": "멤버십 환산 가치 약 {amount}",
    "studio.cost.afterGeneration": "생성 후 {credits} 크레딧 · 약 {count}회 더 가능",
    "studio.cost.valueDisclaimer": "멤버십 크레딧 가치 기준 예상치이며 추가 결제되지 않습니다",
    "studio.cost.insufficientTitle": "{credits} 크레딧이 부족합니다",
    "studio.cost.insufficientBody": "이번 생성에는 {required} 크레딧이 필요합니다. 현재 잔액은 {balance}입니다.",
    "studio.cost.required": "이번 생성",
    "studio.cost.balance": "현재 잔액",
    "studio.cost.shortfall": "부족 크레딧",
    "studio.cost.recommendedCapacity": "{plan}에는 {credits} 크레딧이 포함되어 비슷한 생성을 약 {count}회 할 수 있습니다."
  },
  es: {
    "studio.cost.estimatedValue": "Valor estimado de membresía {amount}",
    "studio.cost.afterGeneration": "Después: {credits} créditos · unas {count} más",
    "studio.cost.valueDisclaimer": "Estimado según el valor de créditos del plan; sin cargo adicional",
    "studio.cost.insufficientTitle": "Te faltan {credits} créditos",
    "studio.cost.insufficientBody": "Esta generación requiere {required} créditos. Tu saldo es {balance}.",
    "studio.cost.required": "Esta generación",
    "studio.cost.balance": "Saldo actual",
    "studio.cost.shortfall": "Créditos faltantes",
    "studio.cost.recommendedCapacity": "{plan} incluye {credits} créditos — unas {count} generaciones similares."
  },
  it: {
    "studio.cost.estimatedValue": "Valore abbonamento stimato {amount}",
    "studio.cost.afterGeneration": "Dopo: {credits} crediti · circa altre {count}",
    "studio.cost.valueDisclaimer": "Stima sul valore dei crediti del piano; nessun addebito extra",
    "studio.cost.insufficientTitle": "Ti mancano {credits} crediti",
    "studio.cost.insufficientBody": "Questa generazione richiede {required} crediti. Il saldo è {balance}.",
    "studio.cost.required": "Questa generazione",
    "studio.cost.balance": "Saldo attuale",
    "studio.cost.shortfall": "Crediti mancanti",
    "studio.cost.recommendedCapacity": "{plan} include {credits} crediti — circa {count} generazioni simili."
  },
  ar: {
    "studio.cost.estimatedValue": "قيمة العضوية التقديرية {amount}",
    "studio.cost.afterGeneration": "بعدها: {credits} رصيد · نحو {count} مرات أخرى",
    "studio.cost.valueDisclaimer": "تقدير حسب قيمة رصيد العضوية؛ بلا رسوم إضافية",
    "studio.cost.insufficientTitle": "ينقصك {credits} رصيد",
    "studio.cost.insufficientBody": "يتطلب هذا الإنشاء {required} رصيدًا. رصيدك الحالي {balance}.",
    "studio.cost.required": "هذا الإنشاء",
    "studio.cost.balance": "الرصيد الحالي",
    "studio.cost.shortfall": "الرصيد الناقص",
    "studio.cost.recommendedCapacity": "تتضمن {plan} عدد {credits} من الرصيد — نحو {count} عمليات إنشاء مماثلة."
  }
};
