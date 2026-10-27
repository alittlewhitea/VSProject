export type LandingLocale = "es" | "pt-BR";
export type LandingKind = "text-image" | "image-video";
type Entry = { title:string; description:string; eyebrow:string; heading:string; intro:string; cta:string; price:string; notice:string; how:string; steps:[string,string][]; ideasTitle:string; ideas:string; example:string; pricingTitle:string; pricing:string; faqIntro:string; faqs:[string,string][]; };
const data:Record<LandingLocale,Record<LandingKind,Entry>> = {
 es: {
  "text-image": {
   title:"Generador de imágenes con IA a partir de texto | DreamFace", description:"Crea imágenes con inteligencia artificial a partir de una descripción. Elige un modelo y consulta el coste en créditos antes de generar.", eyebrow:"Texto a imagen con IA", heading:"Convierte tus ideas en imágenes con IA", intro:"Describe lo que imaginas y crea imágenes a partir de tus palabras. Explora escenas realistas, ilustraciones y conceptos visuales.", cta:"Crear una imagen con IA", price:"Ver paquetes de créditos", notice:"Consulta el coste estimado en Studio antes de generar.", how:"Cómo crear una imagen a partir de texto", steps:[["Describe tu idea","Escribe el sujeto, el entorno, el estilo y la iluminación que buscas."],["Elige el modelo y los ajustes","Selecciona un modelo y configura las opciones de tamaño o calidad disponibles."],["Genera y mejora","Revisa los créditos estimados y ajusta tu descripción para explorar otros resultados."]], ideasTitle:"Crea imágenes a partir de una idea", ideas:"Explora conceptos de producto, ilustraciones y contenido para redes sociales. Describe la composición y la iluminación para orientar al modelo.", example:"Ejemplo: «Una taza de cerámica sobre una mesa de madera, luz suave de mañana y fotografía editorial de producto».", pricingTitle:"Modelos, ajustes y créditos", pricing:"Elige entre los modelos de texto a imagen disponibles en Studio. El tamaño, la calidad y el coste dependen del modelo y los ajustes.", faqIntro:"Respuestas sobre modelos, descripciones, créditos y uso de imágenes.", faqs:[
    ["¿Cómo crear una imagen con IA a partir de texto?","Abre Texto a imagen en Studio, describe la imagen, selecciona un modelo y revisa los créditos estimados antes de generar."],
    ["¿Qué es un generador de imágenes con IA?","Es una herramienta que crea imágenes a partir de una descripción escrita, incluidos el sujeto, el entorno y el estilo deseados."],
    ["¿Puedo probarlo gratis?","Los créditos de prueba dependen de los requisitos de registro y pueden cambiar. Consulta tu saldo y el coste estimado en Studio."],
    ["¿Cuánto cuesta generar una imagen?","El coste depende del modelo y sus ajustes. Studio muestra una estimación antes de generar y DreamFace ofrece paquetes de créditos de pago único."],
    ["¿Qué debo escribir en el prompt?","Incluye el sujeto, el entorno, la composición, los colores y la iluminación. Una descripción concreta ayuda a orientar el resultado."],
    ["¿Qué modelos de imágenes están disponibles?","Studio ofrece opciones como GPT Image, Nano Banana y FLUX. La disponibilidad y las funciones pueden cambiar."],
    ["¿Puedo crear fotos realistas o ilustraciones?","Sí. Describe el estilo deseado; el resultado depende del modelo y de la descripción."],
    ["¿Puedo elegir el tamaño o la proporción?","Las opciones de tamaño, proporción y calidad dependen del modelo seleccionado. Consulta los controles en Studio."],
    ["¿Puedo crear imágenes para redes sociales?","Puedes crear conceptos para publicaciones y marketing. Revisa la composición, el resultado y las condiciones de uso antes de publicar."],
    ["¿La IA puede generar texto dentro de una imagen?","Algunos modelos pueden hacerlo, pero la ortografía y la legibilidad no están garantizadas. Revisa el resultado antes de usarlo."],
    ["¿Puedo editar una imagen generada?","Studio también ofrece flujos de imagen a imagen con modelos compatibles. Las opciones dependen del modelo."],
    ["¿Por qué el resultado no coincide con mi descripción?","Los resultados pueden variar o contener errores. Prueba una descripción más clara, cambia la composición o elige otro modelo."],
    ["¿Puedo usar las imágenes comercialmente?","Consulta los términos de DreamFace, los del modelo y los derechos de los materiales utilizados antes del uso comercial."],
    ["¿Necesito una suscripción?","DreamFace ofrece paquetes de créditos de pago único sin renovación automática. Comprueba tu saldo antes de crear."]
   ]
  },
  "image-video": {
   title:"Imagen a vídeo con IA | Anima tus fotos | DreamFace", description:"Convierte una foto o ilustración en vídeo con IA. Sube una imagen, describe el movimiento y revisa el coste antes de generar.", eyebrow:"Imagen a vídeo con IA", heading:"Convierte una imagen en vídeo con IA", intro:"Da movimiento a fotos, ilustraciones e imágenes de producto. Sube una imagen, describe el movimiento y crea un vídeo corto.", cta:"Crear vídeo desde una imagen", price:"Ver paquetes de créditos", notice:"Consulta el coste estimado en Studio antes de generar.", how:"Cómo animar una imagen", steps:[["Sube una imagen","Abre Imagen a vídeo en Studio y añade la imagen que deseas animar."],["Describe el movimiento","Indica qué debe moverse, el movimiento de cámara y el ambiente."],["Elige los ajustes y genera","Selecciona modelo, duración y resolución disponibles; revisa los créditos antes de empezar."]], ideasTitle:"Crea vídeos con tus imágenes", ideas:"Prueba movimientos para una imagen de producto, una ilustración o un retrato. Describe movimientos concretos para orientar el resultado.", example:"Ejemplo: «La cámara se acerca lentamente al producto mientras cambia la luz del fondo».", pricingTitle:"Modelos, ajustes y créditos", pricing:"HeyGen Video admite clips de 5 a 15 segundos con audio generado y resoluciones de 480p a 2K. Otros modelos tienen ajustes distintos; revisa el coste en Studio.", faqIntro:"Respuestas sobre animación de fotos, modelos, créditos y resultados.", faqs:[
    ["¿Cómo convertir una foto en vídeo con IA?","Abre Imagen a vídeo en Studio, sube una foto, describe el movimiento, elige el modelo y revisa los créditos antes de generar."],
    ["¿Qué es la IA de imagen a vídeo?","Genera un vídeo corto a partir de una imagen fija y una descripción del movimiento. El resultado varía según el modelo."],
    ["¿Puedo probarlo gratis?","Los créditos de prueba dependen de los requisitos de registro. Consulta tu saldo y el coste estimado en Studio."],
    ["¿Cuánto cuesta crear un vídeo?","El coste depende del modelo, la duración y la resolución. Studio muestra una estimación antes de generar; hay paquetes de pago único."],
    ["¿Qué formatos de imagen se admiten?","La carga de imágenes en Studio acepta JPEG, PNG y WebP. Consulta los límites disponibles en Studio."],
    ["¿Cuánto puede durar un vídeo?","Depende del modelo. HeyGen Video admite clips de 5 a 15 segundos; consulta las opciones del modelo seleccionado."],
    ["¿Puedo crear vídeos en HD o 2K?","HeyGen Video admite 480p, 768p, 1080p y 2K. Las resoluciones y los créditos necesarios varían según el modelo."],
    ["¿Los vídeos incluyen sonido?","Depende del modelo. HeyGen Video genera sonido; otros modelos pueden ofrecer opciones diferentes."],
    ["¿Cómo escribir un buen prompt?","Describe el movimiento del sujeto, la cámara y el ambiente; por ejemplo, un acercamiento lento al producto con luz suave."],
    ["¿Puedo animar un retrato o una foto antigua?","Sí, puedes describir movimientos sutiles. El resultado puede variar y debes contar con los derechos y permisos necesarios."],
    ["¿Puedo animar productos o ilustraciones?","Sí. Sube la imagen y describe el movimiento. El modelo puede modificar detalles en el resultado."],
    ["¿Puedo crear vídeos verticales?","Usa una imagen vertical y un modelo compatible. Las proporciones dependen del modelo; algunos siguen la imagen original."],
    ["¿En qué se diferencia de texto a vídeo?","Imagen a vídeo parte de una imagen de referencia; texto a vídeo parte de una descripción escrita."],
    ["¿Por qué cambia la imagen original?","La IA genera nuevos fotogramas y puede alterar caras, objetos o fondos. Prueba una imagen clara o un movimiento más simple."],
    ["¿Cuánto tarda la generación?","Depende del modelo, los ajustes y la cola del proveedor. Studio muestra el estado; no hay un tiempo garantizado."],
    ["¿Puedo usar el vídeo comercialmente?","Revisa los términos de DreamFace y del modelo, y obtén los permisos necesarios para los materiales de origen."]
   ]
  }
 },
 "pt-BR": {
  "text-image": {
   title:"Gerador de imagens com IA a partir de texto | DreamFace", description:"Crie imagens com inteligência artificial a partir de uma descrição. Escolha um modelo e confira o custo em créditos antes de gerar.", eyebrow:"Texto para imagem com IA", heading:"Transforme suas ideias em imagens com IA", intro:"Descreva sua ideia e crie imagens a partir de palavras. Explore cenas realistas, ilustrações e conceitos visuais.", cta:"Criar imagem com IA", price:"Ver pacotes de créditos", notice:"Confira o custo estimado no Studio antes de gerar.", how:"Como criar uma imagem a partir de texto", steps:[["Descreva sua ideia","Informe o assunto, o cenário, o estilo e a iluminação desejados."],["Escolha o modelo e os ajustes","Selecione um modelo e ajuste as opções disponíveis de tamanho ou qualidade."],["Gere e refine","Confira os créditos estimados e ajuste a descrição para explorar outros resultados."]], ideasTitle:"Crie imagens a partir de uma ideia", ideas:"Explore conceitos de produto, ilustrações e imagens para redes sociais. Descreva a composição e a iluminação para orientar o modelo.", example:"Exemplo: «Uma xícara de cerâmica sobre uma mesa de madeira, luz suave da manhã e fotografia editorial de produto».", pricingTitle:"Modelos, ajustes e créditos", pricing:"Escolha um dos modelos de texto para imagem disponíveis no Studio. Tamanho, qualidade e custo dependem do modelo e dos ajustes.", faqIntro:"Respostas sobre modelos, descrições, créditos e uso de imagens.", faqs:[
   ["Como criar uma imagem com IA a partir de texto?","Abra Texto para imagem no Studio, descreva a imagem, selecione um modelo e confira os créditos estimados antes de gerar."],
   ["O que é um gerador de imagens com IA?","É uma ferramenta que cria imagens a partir de uma descrição escrita, incluindo assunto, cenário e estilo desejados."],
   ["Posso experimentar grátis?","Os créditos de teste dependem da elegibilidade no cadastro e podem mudar. Confira seu saldo e o custo estimado no Studio."],
   ["Quanto custa gerar uma imagem?","O custo depende do modelo e dos ajustes. O Studio mostra uma estimativa e a DreamFace oferece pacotes de créditos de compra única."],
   ["O que escrever no prompt?","Inclua assunto, cenário, composição, cores e iluminação. Uma descrição específica ajuda a orientar o resultado."],
   ["Quais modelos de imagem estão disponíveis?","O Studio oferece opções como GPT Image, Nano Banana e FLUX. A disponibilidade e os recursos podem mudar."],
   ["Posso criar fotos realistas ou ilustrações?","Sim. Descreva o estilo desejado; os resultados dependem do modelo e do prompt."],
   ["Posso escolher o tamanho ou a proporção?","As opções de tamanho, proporção e qualidade dependem do modelo selecionado. Confira os controles no Studio."],
   ["Posso criar imagens para redes sociais?","Você pode criar conceitos para posts e marketing. Revise a composição, o resultado e os termos de uso antes de publicar."],
   ["A IA pode gerar texto dentro da imagem?","Alguns modelos conseguem, mas ortografia e legibilidade não são garantidas. Revise o resultado antes de usar."],
   ["Posso editar uma imagem gerada?","O Studio também oferece fluxos de imagem para imagem com modelos compatíveis. As opções dependem do modelo."],
   ["Por que a imagem ficou diferente do prompt?","Os resultados podem variar ou conter erros. Experimente uma descrição mais clara, altere a composição ou escolha outro modelo."],
   ["Posso usar as imagens comercialmente?","Confira os termos da DreamFace e do modelo, além dos direitos sobre os materiais usados, antes do uso comercial."],
   ["Preciso de uma assinatura?","A DreamFace oferece pacotes de créditos de compra única, sem renovação automática. Confira seu saldo antes de criar."]
   ]
  },
  "image-video": {
   title:"Imagem para vídeo com IA | Anime suas fotos | DreamFace", description:"Transforme uma foto ou ilustração em vídeo com IA. Envie uma imagem, descreva o movimento e confira o custo antes de gerar.", eyebrow:"Imagem para vídeo com IA", heading:"Transforme uma imagem em vídeo com IA", intro:"Dê movimento a fotos, ilustrações e imagens de produtos. Envie uma imagem, descreva o movimento e crie um vídeo curto.", cta:"Criar vídeo a partir de imagem", price:"Ver pacotes de créditos", notice:"Confira o custo estimado no Studio antes de gerar.", how:"Como animar uma imagem", steps:[["Envie uma imagem","Abra Imagem para vídeo no Studio e adicione a imagem que deseja animar."],["Descreva o movimento","Informe o que deve se mover, o movimento da câmera e a atmosfera."],["Escolha os ajustes e gere","Selecione modelo, duração e resolução disponíveis; confira os créditos antes de começar."]], ideasTitle:"Crie vídeos com suas imagens", ideas:"Explore movimento em imagens de produtos, ilustrações ou retratos. Descreva movimentos específicos para orientar o resultado.", example:"Exemplo: «A câmera se aproxima lentamente do produto enquanto a luz muda suavemente no fundo».", pricingTitle:"Modelos, ajustes e créditos", pricing:"O HeyGen Video permite clipes de 5 a 15 segundos com áudio gerado e resoluções de 480p a 2K. Outros modelos têm ajustes próprios; confira o custo no Studio.", faqIntro:"Respostas sobre animação de fotos, modelos, créditos e resultados.", faqs:[
   ["Como transformar uma foto em vídeo com IA?","Abra Imagem para vídeo no Studio, envie uma foto, descreva o movimento, escolha o modelo e confira os créditos antes de gerar."],
   ["O que é IA de imagem para vídeo?","Ela gera um vídeo curto a partir de uma imagem estática e de uma descrição de movimento. O resultado varia conforme o modelo."],
   ["Posso experimentar grátis?","Os créditos de teste dependem da elegibilidade no cadastro. Confira seu saldo e o custo estimado no Studio."],
   ["Quanto custa criar um vídeo?","O custo depende do modelo, da duração e da resolução. O Studio mostra uma estimativa; há pacotes de compra única."],
   ["Quais formatos de imagem são aceitos?","O upload de imagens no Studio aceita JPEG, PNG e WebP. Confira os limites disponíveis no Studio."],
   ["Qual é a duração do vídeo?","Depende do modelo. O HeyGen Video permite clipes de 5 a 15 segundos; consulte as opções do modelo escolhido."],
   ["Posso criar vídeos em HD ou 2K?","O HeyGen Video aceita 480p, 768p, 1080p e 2K. Resoluções e créditos necessários variam conforme o modelo."],
   ["Os vídeos incluem som?","Depende do modelo. O HeyGen Video gera som; outros modelos podem oferecer opções diferentes."],
   ["Como escrever um bom prompt?","Descreva o movimento do assunto, a câmera e a atmosfera; por exemplo, uma aproximação lenta do produto com luz suave."],
   ["Posso animar um retrato ou foto antiga?","Sim, você pode descrever movimentos sutis. Os resultados variam e você deve ter os direitos e as permissões necessários."],
   ["Posso animar produtos ou ilustrações?","Sim. Envie a imagem e descreva o movimento. O modelo pode alterar detalhes no resultado."],
   ["Posso criar vídeos verticais?","Use uma imagem vertical e um modelo compatível. As proporções dependem do modelo; alguns seguem a imagem original."],
   ["Qual a diferença entre imagem para vídeo e texto para vídeo?","Imagem para vídeo começa com uma imagem de referência; texto para vídeo começa com uma descrição escrita."],
   ["Por que o vídeo muda a imagem original?","A IA gera novos quadros e pode alterar rostos, objetos ou fundos. Experimente uma imagem clara ou movimentos mais simples."],
   ["Quanto tempo leva para gerar?","Depende do modelo, dos ajustes e da fila do fornecedor. O Studio mostra o status; não há prazo garantido."],
   ["Posso usar o vídeo comercialmente?","Confira os termos da DreamFace e do modelo e obtenha as permissões necessárias para os materiais de origem."]
   ]
  }
 }
};
export function getLandingData(locale:LandingLocale,kind:LandingKind) { return data[locale][kind]; }
export function landingPath(kind:LandingKind) { return kind === "text-image" ? "/image/text-to-image" : "/video/image-to-video"; }
