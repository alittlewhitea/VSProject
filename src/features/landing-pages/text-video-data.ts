export type TextVideoLocale = "en" | "es" | "pt-BR";
type Copy = {
  title: string; description: string; eyebrow: string; heading: string; intro: string;
  create: string; pricing: string; note: string; preview: string; previewNote: string;
  examples: string; examplesIntro: string; concept: string; prompt: string;
  scenes: [string, string][]; how: string; steps: [string, string][];
  models: string; modelCopy: string; credits: string; faq: string; faqIntro: string;
  faqs: [string, string][];
};

export const textVideoCopy: Record<TextVideoLocale, Copy> = {
  en: {
    title: "Text to Video AI Generator | Create Videos from Prompts | DreamFace",
    description: "Turn a text prompt into an AI video. Explore scene ideas, choose a video model and review the credit cost in DreamFace Studio before generating.",
    eyebrow: "Text to video AI", heading: "Your words. A scene in motion.",
    intro: "Describe a scene, set the mood and explore what happens next. Create short AI videos from text with the model and settings that fit your idea.",
    create: "Create a video", pricing: "View credit packs", note: "Review estimated credits in Studio before generating.",
    preview: "A little direction. A new perspective.", previewNote: "Video examples coming soon. Explore the prompt ideas below.",
    examples: "Start with a scene worth imagining", examplesIntro: "Explore these prompt ideas for products, cinematic scenes, illustrations and nature. They are creative starting points, not previews of generated results.",
    concept: "Prompt idea", prompt: "Prompt", scenes: [["Product in the spotlight", "Explore a product concept with controlled camera movement and soft lighting."], ["A cinematic moment", "Describe atmosphere, camera direction and a small moment of action."], ["An illustrated world", "Bring an imagined character and a visual style into a short scene."], ["Nature in motion", "Explore light, landscapes and subtle movement."]],
    how: "From an idea to a video in three steps", steps: [["Describe the scene", "Write the subject, movement, camera direction and atmosphere you want."], ["Choose a model", "Select an available model, duration, resolution and supported audio options."], ["Generate and refine", "Review the estimated credits, generate your clip and refine the prompt for another result."]],
    models: "Choose how your scene takes shape", modelCopy: "Studio offers text-to-video models including HeyGen Video, MiniMax H3, Grok, Kling and other available options. Controls, output and availability vary by model. Check the live Studio catalog before purchasing.",
    credits: "DreamFace offers one-time credit packs without automatic renewal. Generation cost depends on the model, duration, resolution and other settings. Trial credits depend on signup eligibility; review the Studio estimate before generating.",
    faq: "Frequently asked questions", faqIntro: "Answers about prompts, models, video settings and credits.",
    faqs: [
      ["How do I turn text into a video with AI?", "Open Text to Video in Studio, describe a scene, choose an available model and settings, and review the estimated credits before generating."],
      ["What is a text-to-video AI generator?", "It creates a short video from a written description. Your prompt guides the subject, motion, style and camera direction; the model generates the frames."],
      ["Can I try text to video for free?", "Trial credits depend on signup eligibility and may change. Check your balance and estimated cost in Studio. DreamFace offers one-time credit packs if you need more credits."],
      ["How much does it cost to generate a video?", "The credit cost depends on the model, duration, resolution and supported options. Studio displays an estimate before you generate; different models do not have the same rate."],
      ["Do I need a subscription?", "DreamFace offers one-time credit packs without automatic renewal. Check your account balance and the current generation estimate before creating."],
      ["What should I write in a video prompt?", "Describe the subject, its movement, the setting, camera direction and mood. Start with one clear action rather than many scene changes."],
      ["How long can an AI video be?", "Available durations depend on the selected model. For example, HeyGen Video supports 5–15 seconds. Check the controls in Studio for other models."],
      ["Can I generate HD or 2K video?", "Resolution options depend on the model. HeyGen Video supports 480p, 768p, 1080p and 2K. Higher resolutions may require more credits."],
      ["Can AI videos include sound?", "Some models generate audio with the video or provide an audio option. HeyGen Video includes generated sound. Review the selected model’s controls."],
      ["Which text-to-video model should I choose?", "Compare the available models by supported duration, resolution, audio options and credit estimate. Try a short clip first to see whether it fits your scene."],
      ["Can I make vertical videos for social media?", "Choose a model with a portrait aspect-ratio option, such as 9:16, where available. Check the selected model’s settings before generating."],
      ["Do I need to upload an image?", "Text to video starts from a written prompt and does not require an image. Use Image to Video if you want an existing picture to guide the scene."],
      ["Can I create animated or cinematic videos?", "You can describe illustrated, animated or cinematic styles in the prompt. Results and available controls depend on the model."],
      ["How long does generation take?", "It varies with the model, settings and provider queue. Studio displays task status; there is no guaranteed completion time."],
      ["Why did the video differ from my prompt?", "AI results can vary and may contain artifacts or miss details. Simplify the scene, describe one motion clearly or try another available model."],
      ["Can I use generated videos commercially?", "Review DreamFace’s terms, the model’s applicable terms and any rights in your source material before commercial use. Obtain the necessary permissions."]
    ]
  },
  es: {
    title: "Generador de vídeos con IA a partir de texto | DreamFace", description: "Convierte una descripción en vídeo con IA. Explora ideas, elige un modelo y revisa el coste en créditos antes de generar en DreamFace Studio.",
    eyebrow: "Texto a vídeo con IA", heading: "Tus palabras. Una escena en movimiento.", intro: "Describe una escena, define el ambiente y explora lo que sucede después. Crea vídeos cortos con IA a partir de texto.",
    create: "Crear un vídeo", pricing: "Ver paquetes de créditos", note: "Consulta los créditos estimados en Studio antes de generar.",
    preview: "Una idea. Una nueva perspectiva.", previewNote: "Próximamente, ejemplos en vídeo. Explora las ideas de abajo.", examples: "Empieza con una escena que quieras imaginar", examplesIntro: "Explora ideas para productos, cine, ilustraciones y naturaleza. Son puntos de partida creativos, no vistas previas de resultados generados.",
    concept: "Idea de prompt", prompt: "Prompt", scenes: [["El producto como protagonista", "Explora un concepto de producto con movimiento de cámara y luz suave."], ["Un momento cinematográfico", "Describe el ambiente, la cámara y una acción sencilla."], ["Un mundo ilustrado", "Imagina un personaje y un estilo visual para una escena corta."], ["Naturaleza en movimiento", "Explora paisajes, luz y movimientos sutiles."]],
    how: "De una idea a un vídeo en tres pasos", steps: [["Describe la escena", "Indica el sujeto, el movimiento, la cámara y el ambiente."], ["Elige un modelo", "Selecciona modelo, duración, resolución y opciones de audio disponibles."], ["Genera y mejora", "Revisa los créditos estimados y ajusta la descripción para explorar otro resultado."]],
    models: "Elige cómo toma forma tu escena", modelCopy: "Studio ofrece modelos como HeyGen Video, MiniMax H3, Grok y Kling, entre otras opciones disponibles. Los controles y resultados dependen del modelo. Consulta el catálogo actual antes de comprar.", credits: "DreamFace ofrece paquetes de créditos de pago único, sin renovación automática. El coste depende del modelo y los ajustes. Los créditos de prueba dependen de los requisitos de registro; consulta la estimación en Studio.",
    faq: "Preguntas frecuentes", faqIntro: "Respuestas sobre prompts, modelos, ajustes de vídeo y créditos.",
    faqs: [
      ["¿Cómo convertir texto en vídeo con IA?", "Abre Texto a vídeo en Studio, describe una escena, elige un modelo y sus ajustes y revisa los créditos estimados antes de generar."],
      ["¿Qué es un generador de texto a vídeo?", "Crea un vídeo corto a partir de una descripción escrita. El prompt orienta el sujeto, el movimiento, el estilo y la cámara."],
      ["¿Puedo probarlo gratis?", "Los créditos de prueba dependen de los requisitos de registro y pueden cambiar. Consulta tu saldo y el coste en Studio; hay paquetes de pago único si necesitas más créditos."],
      ["¿Cuánto cuesta generar un vídeo?", "Depende del modelo, la duración, la resolución y las opciones. Studio muestra una estimación antes de generar."],
      ["¿Necesito una suscripción?", "DreamFace ofrece paquetes de créditos de pago único sin renovación automática. Revisa tu saldo y la estimación actual antes de crear."],
      ["¿Qué debo escribir en el prompt?", "Describe el sujeto, el movimiento, el entorno, la cámara y el ambiente. Empieza con una acción clara en lugar de muchos cambios de escena."],
      ["¿Cuánto puede durar un vídeo?", "Depende del modelo. HeyGen Video admite entre 5 y 15 segundos; consulta las opciones de otros modelos en Studio."],
      ["¿Puedo generar vídeos en HD o 2K?", "HeyGen Video admite 480p, 768p, 1080p y 2K. Las opciones dependen del modelo y una resolución mayor puede consumir más créditos."],
      ["¿Los vídeos pueden incluir sonido?", "Algunos modelos generan audio o incluyen una opción de sonido. HeyGen Video genera sonido; revisa los controles disponibles."],
      ["¿Qué modelo debo elegir?", "Compara duración, resolución, audio y créditos estimados. Prueba un clip corto para comprobar si se adapta a tu escena."],
      ["¿Puedo crear vídeos verticales?", "Elige un modelo con una proporción vertical, como 9:16, cuando esté disponible. Consulta los ajustes antes de generar."],
      ["¿Tengo que subir una imagen?", "No. Texto a vídeo parte de una descripción. Usa Imagen a vídeo si quieres partir de una imagen existente."],
      ["¿Puedo crear animación o escenas cinematográficas?", "Puedes describir esos estilos en el prompt. Los resultados y controles dependen del modelo."],
      ["¿Cuánto tarda la generación?", "Depende del modelo, los ajustes y la cola del proveedor. Studio muestra el estado; no hay un plazo garantizado."],
      ["¿Por qué el vídeo es diferente de mi descripción?", "Los resultados pueden variar o contener errores. Simplifica la escena, describe un movimiento claro o prueba otro modelo."],
      ["¿Puedo usar los vídeos comercialmente?", "Consulta los términos de DreamFace y del modelo y los derechos de tus materiales antes del uso comercial. Obtén los permisos necesarios."]
    ]
  },
  "pt-BR": {
    title: "Gerador de vídeos com IA a partir de texto | DreamFace", description: "Transforme uma descrição em vídeo com IA. Explore ideias, escolha um modelo e confira o custo em créditos antes de gerar no DreamFace Studio.",
    eyebrow: "Texto para vídeo com IA", heading: "Suas palavras. Uma cena em movimento.", intro: "Descreva uma cena, defina a atmosfera e explore o que acontece depois. Crie vídeos curtos com IA a partir de texto.", create: "Criar um vídeo", pricing: "Ver pacotes de créditos", note: "Confira os créditos estimados no Studio antes de gerar.",
    preview: "Uma ideia. Uma nova perspectiva.", previewNote: "Exemplos em vídeo em breve. Explore as ideias abaixo.", examples: "Comece com uma cena que você quer imaginar", examplesIntro: "Explore ideias de produtos, cinema, ilustrações e natureza. São pontos de partida criativos, não prévias de resultados gerados.", concept: "Ideia de prompt", prompt: "Prompt", scenes: [["O produto em destaque", "Explore um conceito de produto com movimento de câmera e luz suave."], ["Um momento cinematográfico", "Descreva a atmosfera, a câmera e uma ação simples."], ["Um mundo ilustrado", "Imagine um personagem e um estilo visual para uma cena curta."], ["Natureza em movimento", "Explore paisagens, luz e movimentos sutis."]],
    how: "Da ideia ao vídeo em três passos", steps: [["Descreva a cena", "Informe o assunto, o movimento, a câmera e a atmosfera."], ["Escolha um modelo", "Selecione modelo, duração, resolução e opções de áudio disponíveis."], ["Gere e refine", "Confira os créditos estimados e ajuste a descrição para explorar outro resultado."]],
    models: "Escolha como sua cena ganha forma", modelCopy: "O Studio oferece modelos como HeyGen Video, MiniMax H3, Grok e Kling, entre outras opções disponíveis. Controles e resultados dependem do modelo. Confira o catálogo atual antes de comprar.", credits: "A DreamFace oferece pacotes de créditos de compra única, sem renovação automática. O custo depende do modelo e dos ajustes. Os créditos de teste dependem da elegibilidade no cadastro; confira a estimativa no Studio.", faq: "Perguntas frequentes", faqIntro: "Respostas sobre prompts, modelos, ajustes de vídeo e créditos.",
    faqs: [
      ["Como transformar texto em vídeo com IA?", "Abra Texto para vídeo no Studio, descreva uma cena, escolha um modelo e os ajustes e confira os créditos estimados antes de gerar."],
      ["O que é um gerador de texto para vídeo?", "Ele cria um vídeo curto a partir de uma descrição escrita. O prompt orienta o assunto, o movimento, o estilo e a câmera."],
      ["Posso experimentar grátis?", "Os créditos de teste dependem da elegibilidade no cadastro e podem mudar. Confira seu saldo e o custo no Studio; há pacotes de compra única se precisar de mais créditos."],
      ["Quanto custa gerar um vídeo?", "Depende do modelo, da duração, da resolução e das opções. O Studio mostra uma estimativa antes de gerar."],
      ["Preciso de uma assinatura?", "A DreamFace oferece pacotes de créditos de compra única, sem renovação automática. Confira seu saldo e a estimativa atual antes de criar."],
      ["O que escrever no prompt?", "Descreva o assunto, o movimento, o cenário, a câmera e a atmosfera. Comece com uma ação clara em vez de muitas mudanças de cena."],
      ["Qual é a duração do vídeo?", "Depende do modelo. O HeyGen Video permite de 5 a 15 segundos; confira as opções dos outros modelos no Studio."],
      ["Posso gerar vídeos em HD ou 2K?", "O HeyGen Video aceita 480p, 768p, 1080p e 2K. As opções dependem do modelo; uma resolução maior pode consumir mais créditos."],
      ["Os vídeos podem ter som?", "Alguns modelos geram áudio ou oferecem uma opção de som. O HeyGen Video gera som; confira os controles disponíveis."],
      ["Qual modelo devo escolher?", "Compare duração, resolução, áudio e créditos estimados. Teste um clipe curto para verificar se ele combina com sua cena."],
      ["Posso criar vídeos verticais?", "Escolha um modelo com proporção vertical, como 9:16, quando disponível. Confira os ajustes antes de gerar."],
      ["Preciso enviar uma imagem?", "Não. Texto para vídeo começa com uma descrição. Use Imagem para vídeo se quiser partir de uma imagem existente."],
      ["Posso criar animações ou cenas cinematográficas?", "Você pode descrever esses estilos no prompt. Os resultados e controles dependem do modelo."],
      ["Quanto tempo leva para gerar?", "Depende do modelo, dos ajustes e da fila do fornecedor. O Studio mostra o status; não há prazo garantido."],
      ["Por que o vídeo ficou diferente da descrição?", "Os resultados podem variar ou conter erros. Simplifique a cena, descreva um movimento claro ou teste outro modelo."],
      ["Posso usar os vídeos comercialmente?", "Confira os termos da DreamFace e do modelo e os direitos dos materiais antes do uso comercial. Obtenha as permissões necessárias."]
    ]
  }
};
