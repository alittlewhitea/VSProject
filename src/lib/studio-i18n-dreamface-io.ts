import type { Locale } from "../i18n/routing";

type Messages = Record<string, string>;

export const studioDreamfaceIoMessages: Partial<Record<Locale, Messages>> = {
  en: {
    "studio.generate.dailyFree": "Free today · {remaining}/6 units left",
    "studio.generate.dailyPaid": "{credits} credits · daily free allowance used",
    "studio.dreamfaceIo.qualityHint": "DreamFace IO is still being optimized. For more polished, consistent results, try one of our stronger video models.",
    "studio.status.dreamfaceIoQueued": "DreamFace IO task queued. Waiting for generation...",
    "studio.status.dreamfaceIoQueue": "DreamFace IO is preparing your video...",
    "studio.status.dreamfaceIoRunning": "DreamFace IO is generating your video...",
    "studio.status.dreamfaceIoCompleted": "DreamFace IO generation completed. Your result is now in Projects.",
    "studio.status.dreamfaceIoFailedRefund": "DreamFace IO could not complete this generation. Your allowance was returned automatically.",
    "studio.model.dreamface-io-video": "DreamFace IO is designed for frequent everyday video creation with a renewable daily free allowance."
  },
  "zh-CN": {
    "studio.generate.dailyFree": "今日免费 · 剩余 {remaining}/6 份额度",
    "studio.generate.dailyPaid": "{credits} 积分 · 今日免费额度已用完",
    "studio.dreamfaceIo.qualityHint": "DreamFace IO 仍在持续优化中；如需更精致、更稳定的效果，建议使用我们的其他更强视频模型。",
    "studio.status.dreamfaceIoQueued": "DreamFace IO 任务已提交，正在等待生成……",
    "studio.status.dreamfaceIoQueue": "DreamFace IO 正在准备你的视频……",
    "studio.status.dreamfaceIoRunning": "DreamFace IO 正在生成你的视频……",
    "studio.status.dreamfaceIoCompleted": "DreamFace IO 已生成完成，结果已保存到项目。",
    "studio.status.dreamfaceIoFailedRefund": "DreamFace IO 本次未能完成生成，额度已自动返还。",
    "studio.model.dreamface-io-video": "DreamFace IO 适合高频日常视频创作，并为符合条件的账户提供每日免费额度。"
  },
  "pt-BR": {
    "studio.generate.dailyFree": "Grátis hoje · {remaining}/6 unidades restantes",
    "studio.generate.dailyPaid": "{credits} créditos · cota grátis diária esgotada",
    "studio.dreamfaceIo.qualityHint": "O DreamFace IO ainda está sendo otimizado. Para resultados mais refinados e consistentes, experimente um de nossos modelos de vídeo mais avançados.",
    "studio.status.dreamfaceIoQueued": "Tarefa do DreamFace IO na fila. Aguardando a geração...",
    "studio.status.dreamfaceIoQueue": "O DreamFace IO está preparando seu vídeo...",
    "studio.status.dreamfaceIoRunning": "O DreamFace IO está gerando seu vídeo...",
    "studio.status.dreamfaceIoCompleted": "Geração concluída pelo DreamFace IO. O resultado está em Projetos.",
    "studio.status.dreamfaceIoFailedRefund": "O DreamFace IO não concluiu esta geração. Sua cota foi devolvida automaticamente.",
    "studio.model.dreamface-io-video": "O DreamFace IO foi criado para vídeos frequentes do dia a dia e oferece uma cota grátis renovada diariamente."
  },
  ru: {
    "studio.generate.dailyFree": "Сегодня бесплатно · осталось {remaining}/6 единиц",
    "studio.generate.dailyPaid": "{credits} кредитов · дневной бесплатный лимит исчерпан",
    "studio.dreamfaceIo.qualityHint": "DreamFace IO всё ещё оптимизируется. Для более качественных и стабильных результатов попробуйте одну из наших более мощных видеомоделей.",
    "studio.status.dreamfaceIoQueued": "Задача DreamFace IO поставлена в очередь...",
    "studio.status.dreamfaceIoQueue": "DreamFace IO подготавливает видео...",
    "studio.status.dreamfaceIoRunning": "DreamFace IO создаёт видео...",
    "studio.status.dreamfaceIoCompleted": "Видео DreamFace IO готово и сохранено в проектах.",
    "studio.status.dreamfaceIoFailedRefund": "DreamFace IO не удалось завершить генерацию. Лимит автоматически возвращён.",
    "studio.model.dreamface-io-video": "DreamFace IO предназначен для частого повседневного создания видео и включает обновляемый ежедневный бесплатный лимит."
  },
  vi: {
    "studio.generate.dailyFree": "Miễn phí hôm nay · còn {remaining}/6 lượt",
    "studio.generate.dailyPaid": "{credits} credit · đã dùng hết lượt miễn phí hôm nay",
    "studio.dreamfaceIo.qualityHint": "DreamFace IO vẫn đang được tối ưu. Để có kết quả trau chuốt và ổn định hơn, hãy thử một trong các model video mạnh hơn của chúng tôi.",
    "studio.status.dreamfaceIoQueued": "Tác vụ DreamFace IO đã vào hàng đợi...",
    "studio.status.dreamfaceIoQueue": "DreamFace IO đang chuẩn bị video...",
    "studio.status.dreamfaceIoRunning": "DreamFace IO đang tạo video...",
    "studio.status.dreamfaceIoCompleted": "DreamFace IO đã tạo xong. Kết quả được lưu trong Dự án.",
    "studio.status.dreamfaceIoFailedRefund": "DreamFace IO không thể hoàn tất. Lượt sử dụng đã được tự động hoàn lại.",
    "studio.model.dreamface-io-video": "DreamFace IO phù hợp để tạo video thường xuyên và có lượt miễn phí được làm mới mỗi ngày."
  },
  de: {
    "studio.generate.dailyFree": "Heute kostenlos · {remaining}/6 Einheiten übrig",
    "studio.generate.dailyPaid": "{credits} Credits · tägliches Freikontingent verbraucht",
    "studio.dreamfaceIo.qualityHint": "DreamFace IO wird noch optimiert. Für ausgereiftere und konsistentere Ergebnisse empfehlen wir eines unserer leistungsstärkeren Videomodelle.",
    "studio.status.dreamfaceIoQueued": "DreamFace IO wurde eingereiht. Die Generierung startet gleich...",
    "studio.status.dreamfaceIoQueue": "DreamFace IO bereitet dein Video vor...",
    "studio.status.dreamfaceIoRunning": "DreamFace IO erstellt dein Video...",
    "studio.status.dreamfaceIoCompleted": "DreamFace IO ist fertig. Das Ergebnis wurde in Projekten gespeichert.",
    "studio.status.dreamfaceIoFailedRefund": "DreamFace IO konnte die Generierung nicht abschließen. Dein Kontingent wurde automatisch zurückgegeben.",
    "studio.model.dreamface-io-video": "DreamFace IO eignet sich für häufige alltägliche Videoerstellung und bietet ein täglich erneuertes Freikontingent."
  },
  fr: {
    "studio.generate.dailyFree": "Gratuit aujourd'hui · {remaining}/6 unités restantes",
    "studio.generate.dailyPaid": "{credits} crédits · quota gratuit quotidien épuisé",
    "studio.dreamfaceIo.qualityHint": "DreamFace IO est encore en cours d’optimisation. Pour des résultats plus soignés et cohérents, essayez l’un de nos modèles vidéo plus performants.",
    "studio.status.dreamfaceIoQueued": "La tâche DreamFace IO est en attente de génération...",
    "studio.status.dreamfaceIoQueue": "DreamFace IO prépare votre vidéo...",
    "studio.status.dreamfaceIoRunning": "DreamFace IO génère votre vidéo...",
    "studio.status.dreamfaceIoCompleted": "La génération DreamFace IO est terminée. Le résultat est dans Projets.",
    "studio.status.dreamfaceIoFailedRefund": "DreamFace IO n'a pas pu terminer cette génération. Votre quota a été rétabli automatiquement.",
    "studio.model.dreamface-io-video": "DreamFace IO est conçu pour la création vidéo fréquente et propose un quota gratuit renouvelé chaque jour."
  }
};
