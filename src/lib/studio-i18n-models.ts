import type { Locale } from "../i18n/routing";

type Messages = Record<string, string>;

export const studioModelMessages: Partial<Record<Locale, Messages>> = {
  en: {
    "studio.model.flux-image": "FLUX Schnell is ideal for fast visual drafts. Use GPT Image 2 when exact text, counting, or strict layouts matter.",
    "studio.model.flux-dev": "FLUX Dev creates more refined compositions when you want higher-quality drafts.",
    "studio.model.chatgpt-image": "GPT Image 2 follows detailed text and layout instructions well and supports preset output sizes.",
    "studio.model.topaz-image": "Topaz enhances an uploaded image with upscaling, clarity, and face refinement.",
    "studio.model.kling-avatar-standard": "Kling Avatar Standard creates a talking video from one avatar image and an ElevenLabs script.",
    "studio.model.kling-avatar-pro": "Kling Avatar Pro is the premium avatar model. DreamFace generates the ElevenLabs voice first.",
    "studio.model.grok-video": "Grok Imagine Video supports text and image input, 1-15 second clips, ratio controls, and 480p or 720p output.",
    "studio.model.seedance-video": "Seedance 2 supports text and image input, 480p-1080p, 4-15 second clips, and optional synchronized audio.",
    "studio.model.kling-video": "Kling v3 Pro creates 3-15 second cinematic videos from text or images, with optional native audio.",
    "studio.model.veo-video": "Veo 3.1 creates 4, 6, or 8 second prompt-led videos up to 4K, with optional audio.",
    "studio.model.elevenlabs-tts": "ElevenLabs Eleven v3 turns scripts into MP3 voiceovers. Credit use scales with character count.",
    "studio.model.default": "Describe the subject, style, composition, movement, and constraints clearly for better results."
  },
  "zh-CN": {
    "studio.model.flux-image": "FLUX Schnell 适合快速生成视觉草稿。需要精确文字、数量或严格排版时，建议使用 GPT Image 2。",
    "studio.model.flux-dev": "FLUX Dev 更适合需要精细构图和较高草稿质量的创作。",
    "studio.model.chatgpt-image": "GPT Image 2 能较好地理解详细文字和排版指令，并支持预设输出尺寸。",
    "studio.model.topaz-image": "Topaz 可对上传图片进行放大、清晰度增强和人脸优化。",
    "studio.model.kling-avatar-standard": "Kling Avatar Standard 使用一张头像图片和 ElevenLabs 文稿生成口播视频。",
    "studio.model.kling-avatar-pro": "Kling Avatar Pro 是高级头像模型，DreamFace 会先生成 ElevenLabs 配音。",
    "studio.model.grok-video": "Grok Imagine Video 支持文字和图片输入，可生成 1-15 秒视频，并控制画面比例和 480p/720p 分辨率。",
    "studio.model.seedance-video": "Seedance 2 支持文字和图片输入、480p-1080p、4-15 秒视频及可选同步音频。",
    "studio.model.kling-video": "Kling v3 Pro 可根据文字或图片生成 3-15 秒电影感视频，并支持可选原生音频。",
    "studio.model.veo-video": "Veo 3.1 可生成 4、6 或 8 秒提示词视频，最高支持 4K，并可选生成音频。",
    "studio.model.elevenlabs-tts": "ElevenLabs Eleven v3 可将文稿转成 MP3 配音，积分消耗随字符数变化。",
    "studio.model.default": "请清楚描述主体、风格、构图、运动和限制条件，以获得更准确的结果。"
  },
  "pt-BR": {
    "studio.model.flux-image": "O FLUX Schnell é ideal para rascunhos visuais rápidos. Use o GPT Image 2 quando texto exato, contagem ou layout rígido forem importantes.",
    "studio.model.flux-dev": "O FLUX Dev cria composições mais refinadas para rascunhos de maior qualidade.",
    "studio.model.chatgpt-image": "O GPT Image 2 segue bem instruções detalhadas de texto e layout e aceita tamanhos de saída predefinidos.",
    "studio.model.topaz-image": "O Topaz amplia a imagem enviada e melhora a nitidez e os rostos.",
    "studio.model.kling-avatar-standard": "O Kling Avatar Standard cria um vídeo falado com uma imagem de avatar e um roteiro do ElevenLabs.",
    "studio.model.kling-avatar-pro": "O Kling Avatar Pro é o modelo premium de avatar. O DreamFace gera primeiro a voz do ElevenLabs.",
    "studio.model.grok-video": "O Grok Imagine Video aceita texto e imagem, cria clipes de 1 a 15 segundos e oferece controle de proporção e saída em 480p ou 720p.",
    "studio.model.seedance-video": "O Seedance 2 aceita texto e imagem, resolução de 480p a 1080p, clipes de 4 a 15 segundos e áudio sincronizado opcional.",
    "studio.model.kling-video": "O Kling v3 Pro cria vídeos cinematográficos de 3 a 15 segundos a partir de texto ou imagem, com áudio nativo opcional.",
    "studio.model.veo-video": "O Veo 3.1 cria vídeos de 4, 6 ou 8 segundos orientados por prompt, em até 4K e com áudio opcional.",
    "studio.model.elevenlabs-tts": "O ElevenLabs Eleven v3 transforma roteiros em locuções MP3. O uso de créditos varia conforme o número de caracteres.",
    "studio.model.default": "Descreva com clareza o assunto, o estilo, a composição, o movimento e as restrições para obter resultados melhores."
  },
  ru: {
    "studio.model.flux-image": "FLUX Schnell подходит для быстрых визуальных черновиков. Для точного текста, подсчёта объектов и строгой компоновки используйте GPT Image 2.",
    "studio.model.flux-dev": "FLUX Dev создаёт более проработанные композиции, когда нужен черновик повышенного качества.",
    "studio.model.chatgpt-image": "GPT Image 2 хорошо следует подробным инструкциям по тексту и компоновке и поддерживает готовые размеры изображения.",
    "studio.model.topaz-image": "Topaz увеличивает загруженное изображение, повышает чёткость и улучшает лица.",
    "studio.model.kling-avatar-standard": "Kling Avatar Standard создаёт говорящее видео из одного изображения аватара и сценария ElevenLabs.",
    "studio.model.kling-avatar-pro": "Kling Avatar Pro — премиальная модель аватара. DreamFace сначала создаёт озвучку ElevenLabs.",
    "studio.model.grok-video": "Grok Imagine Video принимает текст и изображения, создаёт ролики длительностью 1–15 секунд и поддерживает выбор формата и разрешения 480p или 720p.",
    "studio.model.seedance-video": "Seedance 2 принимает текст и изображения, поддерживает 480p–1080p, ролики длительностью 4–15 секунд и синхронный звук.",
    "studio.model.kling-video": "Kling v3 Pro создаёт кинематографичные ролики длительностью 3–15 секунд из текста или изображения, с дополнительным нативным звуком.",
    "studio.model.veo-video": "Veo 3.1 создаёт ролики длительностью 4, 6 или 8 секунд по описанию, вплоть до 4K и с дополнительным звуком.",
    "studio.model.elevenlabs-tts": "ElevenLabs Eleven v3 превращает сценарий в MP3-озвучку. Расход кредитов зависит от количества символов.",
    "studio.model.default": "Чётко опишите объект, стиль, композицию, движение и ограничения, чтобы получить более точный результат."
  },
  vi: {
    "studio.model.flux-image": "FLUX Schnell phù hợp để tạo bản nháp hình ảnh nhanh. Hãy dùng GPT Image 2 khi cần chữ chính xác, đếm đối tượng hoặc bố cục nghiêm ngặt.",
    "studio.model.flux-dev": "FLUX Dev tạo bố cục tinh chỉnh hơn khi bạn cần bản nháp chất lượng cao.",
    "studio.model.chatgpt-image": "GPT Image 2 làm theo tốt các yêu cầu chi tiết về chữ và bố cục, đồng thời hỗ trợ kích thước đầu ra đặt sẵn.",
    "studio.model.topaz-image": "Topaz phóng lớn ảnh tải lên, tăng độ rõ nét và cải thiện khuôn mặt.",
    "studio.model.kling-avatar-standard": "Kling Avatar Standard tạo video nhân vật nói từ một ảnh đại diện và kịch bản ElevenLabs.",
    "studio.model.kling-avatar-pro": "Kling Avatar Pro là mô hình nhân vật cao cấp. DreamFace sẽ tạo giọng ElevenLabs trước.",
    "studio.model.grok-video": "Grok Imagine Video hỗ trợ văn bản và hình ảnh, video 1-15 giây, tùy chọn tỷ lệ và đầu ra 480p hoặc 720p.",
    "studio.model.seedance-video": "Seedance 2 hỗ trợ văn bản và hình ảnh, độ phân giải 480p-1080p, video 4-15 giây và âm thanh đồng bộ tùy chọn.",
    "studio.model.kling-video": "Kling v3 Pro tạo video điện ảnh 3-15 giây từ văn bản hoặc hình ảnh, kèm âm thanh gốc tùy chọn.",
    "studio.model.veo-video": "Veo 3.1 tạo video 4, 6 hoặc 8 giây theo prompt, hỗ trợ đến 4K và âm thanh tùy chọn.",
    "studio.model.elevenlabs-tts": "ElevenLabs Eleven v3 chuyển kịch bản thành giọng đọc MP3. Số credit sử dụng thay đổi theo số ký tự.",
    "studio.model.default": "Hãy mô tả rõ chủ thể, phong cách, bố cục, chuyển động và giới hạn để có kết quả tốt hơn."
  }
};
