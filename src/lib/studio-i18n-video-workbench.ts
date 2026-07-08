import type { Locale } from "../i18n/routing";

type StudioMessages = Record<string, string>;

const en: StudioMessages = {
  "studio.videoWorkbench.textHeroDescription": "Describe the scene, camera motion, style and final use, then generate video with clear credit cost.",
  "studio.videoWorkbench.imageHeroDescription": "Upload a reference image, describe how it should move, then generate video with clear credit cost.",
  "studio.videoWorkbench.promptStudio": "Video Prompt Studio",
  "studio.videoWorkbench.promptStudioDescription": "Describe scene, subject, motion, camera and mood.",
  "studio.videoWorkbench.motionStudio": "Motion Studio",
  "studio.videoWorkbench.motionStudioDescription": "Add a source image and describe the movement you want.",
  "studio.videoWorkbench.ready": "Ready to generate",
  "studio.videoWorkbench.waitingPrompt": "Add a prompt",
  "studio.videoWorkbench.waitingImage": "Add image and prompt",
  "studio.videoWorkbench.referenceImage": "Reference image",
  "studio.videoWorkbench.referenceHint": "Upload or paste one image to animate into video.",
  "studio.videoWorkbench.emptyReference": "Add one reference image to guide the video motion.",
  "studio.videoWorkbench.yourPrompt": "Your video prompt",
  "studio.videoWorkbench.motionPrompt": "Motion prompt",
  "studio.videoWorkbench.promptTip": "Tip: include subject, action, camera, lighting and style.",
  "studio.videoWorkbench.motionTip": "Tip: describe motion, camera path, pace and final mood.",
  "studio.videoWorkbench.hintCostBody": "Credits update with model, duration, resolution and audio settings.",
  "studio.videoWorkbench.hintPromptTitle": "Prompt drives motion",
  "studio.videoWorkbench.hintPromptBody": "Clear action and camera direction produce more predictable video.",
  "studio.videoWorkbench.hintReferenceTitle": "Reference anchors the scene",
  "studio.videoWorkbench.hintReferenceBody": "A clear source image helps preserve subject and composition.",
  "studio.videoWorkbench.hintOutputTitle": "Video-ready output",
  "studio.videoWorkbench.hintOutputBody": "Use duration, aspect ratio, resolution and audio controls before generating."
};

const zhCN: StudioMessages = {
  "studio.videoWorkbench.textHeroDescription": "描述场景、镜头运动、风格和最终用途，并在生成前清楚看到积分成本。",
  "studio.videoWorkbench.imageHeroDescription": "上传参考图，描述它应该如何运动，并在生成前清楚看到积分成本。",
  "studio.videoWorkbench.promptStudio": "视频提示词工作台",
  "studio.videoWorkbench.promptStudioDescription": "描述场景、主体、动作、镜头和氛围。",
  "studio.videoWorkbench.motionStudio": "动态视频工作台",
  "studio.videoWorkbench.motionStudioDescription": "添加源图片，并描述你想要的运动效果。",
  "studio.videoWorkbench.ready": "可以生成",
  "studio.videoWorkbench.waitingPrompt": "请输入提示词",
  "studio.videoWorkbench.waitingImage": "请添加图片和提示词",
  "studio.videoWorkbench.referenceImage": "参考图片",
  "studio.videoWorkbench.referenceHint": "上传或粘贴一张图片，将它驱动成视频。",
  "studio.videoWorkbench.emptyReference": "请添加一张参考图来指导视频运动。",
  "studio.videoWorkbench.yourPrompt": "视频提示词",
  "studio.videoWorkbench.motionPrompt": "运动提示词",
  "studio.videoWorkbench.promptTip": "提示：写清主体、动作、镜头、光线和风格。",
  "studio.videoWorkbench.motionTip": "提示：描述运动、镜头路径、节奏和最终氛围。",
  "studio.videoWorkbench.hintCostBody": "积分会根据模型、时长、清晰度和音频设置自动更新。",
  "studio.videoWorkbench.hintPromptTitle": "提示词驱动运动",
  "studio.videoWorkbench.hintPromptBody": "清晰的动作和镜头方向能让视频结果更稳定。",
  "studio.videoWorkbench.hintReferenceTitle": "参考图固定画面",
  "studio.videoWorkbench.hintReferenceBody": "清晰源图有助于保留主体和构图。",
  "studio.videoWorkbench.hintOutputTitle": "视频输出设置",
  "studio.videoWorkbench.hintOutputBody": "生成前可以调整时长、比例、清晰度和音频。"
};

export const studioVideoWorkbenchMessages: Partial<Record<Locale, StudioMessages>> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": {
    ...zhCN,
    "studio.videoWorkbench.textHeroDescription": "描述場景、鏡頭運動、風格和最終用途，並在生成前清楚看到點數成本。",
    "studio.videoWorkbench.imageHeroDescription": "上傳參考圖，描述它應該如何運動，並在生成前清楚看到點數成本。",
    "studio.videoWorkbench.promptStudio": "影片提示詞工作台",
    "studio.videoWorkbench.motionStudio": "動態影片工作台",
    "studio.videoWorkbench.ready": "可以生成",
    "studio.videoWorkbench.waitingPrompt": "請輸入提示詞",
    "studio.videoWorkbench.waitingImage": "請加入圖片和提示詞",
    "studio.videoWorkbench.referenceImage": "參考圖片"
  },
  "pt-BR": {
    ...en,
    "studio.videoWorkbench.textHeroDescription": "Descreva cena, câmera, estilo e uso final, e gere vídeo com custo claro.",
    "studio.videoWorkbench.imageHeroDescription": "Envie uma imagem de referência, descreva o movimento e gere vídeo com custo claro.",
    "studio.videoWorkbench.promptStudio": "Estúdio de prompt de vídeo",
    "studio.videoWorkbench.motionStudio": "Estúdio de movimento",
    "studio.videoWorkbench.ready": "Pronto para gerar",
    "studio.videoWorkbench.waitingPrompt": "Adicione um prompt",
    "studio.videoWorkbench.waitingImage": "Adicione imagem e prompt"
  },
  ru: {
    ...en,
    "studio.videoWorkbench.textHeroDescription": "Опишите сцену, камеру, стиль и назначение, затем создайте видео с понятной стоимостью.",
    "studio.videoWorkbench.imageHeroDescription": "Загрузите референс, опишите движение и создайте видео с понятной стоимостью.",
    "studio.videoWorkbench.promptStudio": "Студия видео-промпта",
    "studio.videoWorkbench.motionStudio": "Студия движения",
    "studio.videoWorkbench.ready": "Готово к генерации",
    "studio.videoWorkbench.waitingPrompt": "Добавьте промпт",
    "studio.videoWorkbench.waitingImage": "Добавьте изображение и промпт"
  },
  vi: {
    ...en,
    "studio.videoWorkbench.textHeroDescription": "Mô tả cảnh, camera, phong cách và mục đích rồi tạo video với chi phí rõ ràng.",
    "studio.videoWorkbench.imageHeroDescription": "Tải ảnh tham chiếu, mô tả chuyển động rồi tạo video với chi phí rõ ràng.",
    "studio.videoWorkbench.promptStudio": "Studio prompt video",
    "studio.videoWorkbench.motionStudio": "Studio chuyển động",
    "studio.videoWorkbench.ready": "Sẵn sàng tạo",
    "studio.videoWorkbench.waitingPrompt": "Thêm prompt",
    "studio.videoWorkbench.waitingImage": "Thêm ảnh và prompt"
  },
  de: { ...en, "studio.videoWorkbench.promptStudio": "Video Prompt Studio", "studio.videoWorkbench.motionStudio": "Motion Studio", "studio.videoWorkbench.ready": "Bereit zum Generieren", "studio.videoWorkbench.waitingPrompt": "Prompt hinzufügen", "studio.videoWorkbench.waitingImage": "Bild und Prompt hinzufügen" },
  fr: { ...en, "studio.videoWorkbench.promptStudio": "Studio de prompt vidéo", "studio.videoWorkbench.motionStudio": "Studio de mouvement", "studio.videoWorkbench.ready": "Prêt à générer", "studio.videoWorkbench.waitingPrompt": "Ajoutez un prompt", "studio.videoWorkbench.waitingImage": "Ajoutez image et prompt" },
  ja: { ...en, "studio.videoWorkbench.promptStudio": "動画プロンプトスタジオ", "studio.videoWorkbench.motionStudio": "モーションスタジオ", "studio.videoWorkbench.ready": "生成準備完了", "studio.videoWorkbench.waitingPrompt": "プロンプトを追加", "studio.videoWorkbench.waitingImage": "画像とプロンプトを追加" },
  th: { ...en, "studio.videoWorkbench.promptStudio": "สตูดิโอพรอมป์ตวิดีโอ", "studio.videoWorkbench.motionStudio": "สตูดิโอการเคลื่อนไหว", "studio.videoWorkbench.ready": "พร้อมสร้าง", "studio.videoWorkbench.waitingPrompt": "เพิ่มพรอมป์ต", "studio.videoWorkbench.waitingImage": "เพิ่มภาพและพรอมป์ต" },
  nl: { ...en, "studio.videoWorkbench.promptStudio": "Video promptstudio", "studio.videoWorkbench.motionStudio": "Motion studio", "studio.videoWorkbench.ready": "Klaar om te genereren", "studio.videoWorkbench.waitingPrompt": "Voeg een prompt toe", "studio.videoWorkbench.waitingImage": "Voeg afbeelding en prompt toe" },
  he: { ...en, "studio.videoWorkbench.promptStudio": "סטודיו פרומפט וידאו", "studio.videoWorkbench.motionStudio": "סטודיו תנועה", "studio.videoWorkbench.ready": "מוכן ליצירה", "studio.videoWorkbench.waitingPrompt": "הוסף פרומפט", "studio.videoWorkbench.waitingImage": "הוסף תמונה ופרומפט" },
  ko: { ...en, "studio.videoWorkbench.promptStudio": "비디오 프롬프트 스튜디오", "studio.videoWorkbench.motionStudio": "모션 스튜디오", "studio.videoWorkbench.ready": "생성 준비 완료", "studio.videoWorkbench.waitingPrompt": "프롬프트 추가", "studio.videoWorkbench.waitingImage": "이미지와 프롬프트 추가" },
  es: { ...en, "studio.videoWorkbench.promptStudio": "Estudio de prompt de video", "studio.videoWorkbench.motionStudio": "Estudio de movimiento", "studio.videoWorkbench.ready": "Listo para generar", "studio.videoWorkbench.waitingPrompt": "Añade un prompt", "studio.videoWorkbench.waitingImage": "Añade imagen y prompt" }
};
