/** Presentation copy only; task states and errors are owned by existing APIs. */
export function formatStudioTaskDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
const missingVideo: Record<string, string> = {
  en: "No playable video is available for this task. Open the project to view its details.",
  "zh-CN": "该任务暂无可播放的视频，可打开项目查看详情。",
  "zh-TW": "此任務暫無可播放的影片，可開啟專案查看詳細資料。",
  es: "Esta tarea no tiene un vídeo reproducible. Abre el proyecto para ver los detalles.",
  "pt-BR": "Esta tarefa não tem um vídeo disponível para reprodução. Abra o projeto para ver os detalhes.",
  fr: "Aucune vidéo n’est disponible pour cette tâche. Ouvrez le projet pour consulter les détails.",
  de: "Für diese Aufgabe ist kein abspielbares Video verfügbar. Öffne das Projekt für Details.",
  ja: "このタスクには再生できる動画がありません。プロジェクトを開いて詳細を確認してください。",
  ko: "이 작업에는 재생 가능한 동영상이 없습니다. 프로젝트를 열어 세부 정보를 확인하세요.",
  ar: "لا يتوفر فيديو قابل للتشغيل لهذه المهمة. افتح المشروع للاطلاع على التفاصيل.",
  he: "אין סרטון שניתן להפעיל עבור משימה זו. אפשר לפתוח את הפרויקט לצפייה בפרטים.",
  it: "Non è disponibile un video riproducibile per questa attività. Apri il progetto per i dettagli.",
  nl: "Voor deze taak is geen afspeelbare video beschikbaar. Open het project voor meer informatie.",
  ru: "Для этой задачи нет доступного видео. Откройте проект, чтобы посмотреть подробности.",
  th: "งานนี้ยังไม่มีวิดีโอที่เล่นได้ เปิดโปรเจกต์เพื่อดูรายละเอียด",
  vi: "Tác vụ này chưa có video có thể phát. Mở dự án để xem chi tiết."
};
export function missingVideoCopy(locale: string) { return missingVideo[locale] || missingVideo.en; }

const missingOutput: Record<string, string> = {
  en: "No output is available for this task. Open the project to view its details.",
  "zh-CN": "该任务暂无可预览的结果，可打开项目查看详情。",
  "zh-TW": "此任務暫無可預覽的結果，可開啟專案查看詳細資料。",
  es: "Esta tarea no tiene un resultado disponible. Abre el proyecto para ver los detalles.",
  "pt-BR": "Esta tarefa não tem um resultado disponível. Abra o projeto para ver os detalhes.",
  fr: "Aucun résultat n’est disponible pour cette tâche. Ouvrez le projet pour consulter les détails.",
  de: "Für diese Aufgabe ist kein Ergebnis verfügbar. Öffne das Projekt für Details.",
  ja: "このタスクにはプレビューできる結果がありません。プロジェクトを開いて詳細を確認してください。",
  ko: "이 작업에는 미리 볼 수 있는 결과가 없습니다. 프로젝트를 열어 세부 정보를 확인하세요.",
  ar: "لا تتوفر نتيجة لهذه المهمة. افتح المشروع للاطلاع على التفاصيل.",
  he: "אין תוצאה זמינה למשימה זו. אפשר לפתוח את הפרויקט לצפייה בפרטים.",
  it: "Non è disponibile un risultato per questa attività. Apri il progetto per i dettagli.",
  nl: "Voor deze taak is geen resultaat beschikbaar. Open het project voor meer informatie.",
  ru: "Для этой задачи нет доступного результата. Откройте проект, чтобы посмотреть подробности.",
  th: "งานนี้ยังไม่มีผลลัพธ์ให้ดูตัวอย่าง เปิดโปรเจกต์เพื่อดูรายละเอียด",
  vi: "Tác vụ này chưa có kết quả để xem trước. Mở dự án để xem chi tiết."
};
export function missingOutputCopy(locale: string) { return missingOutput[locale] || missingOutput.en; }
