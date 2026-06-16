import type { Locale } from "../i18n/routing";

type Messages = Record<string, string>;

export const studioFalErrorMessages: Partial<Record<Locale, Messages>> = {
  en: {
    "studio.error.referenceSubjectNotVisible": "We could not find a clearly visible subject in the reference image. Please use a clearer image with the face or subject visible and try again."
  },
  "zh-CN": {
    "studio.error.referenceSubjectNotVisible": "参考图中没有识别到清晰可见的主体。请换一张脸部或主体更清楚的图片后再试。"
  },
  "pt-BR": {
    "studio.error.referenceSubjectNotVisible": "Não encontramos um assunto claramente visível na imagem de referência. Use uma imagem mais nítida, com o rosto ou assunto visível, e tente novamente."
  },
  ru: {
    "studio.error.referenceSubjectNotVisible": "Не удалось найти чётко видимый объект на референсном изображении. Используйте более ясное изображение с видимым лицом или объектом и попробуйте снова."
  },
  vi: {
    "studio.error.referenceSubjectNotVisible": "Không tìm thấy chủ thể rõ ràng trong ảnh tham chiếu. Hãy dùng ảnh rõ hơn, có khuôn mặt hoặc chủ thể dễ nhìn, rồi thử lại."
  },
  de: {
    "studio.error.referenceSubjectNotVisible": "Im Referenzbild wurde kein klar erkennbares Motiv gefunden. Bitte verwende ein klareres Bild mit sichtbarem Gesicht oder Motiv und versuche es erneut."
  },
  fr: {
    "studio.error.referenceSubjectNotVisible": "Aucun sujet clairement visible n'a été détecté dans l'image de référence. Utilisez une image plus nette avec le visage ou le sujet visible, puis réessayez."
  }
};
