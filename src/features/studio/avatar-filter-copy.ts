import type { Locale } from "../../i18n/routing";

const keys = ["community","favorites","filters","gender","age","ethnicity","woman","man","youngAdult","middleAged","elderly","white","asian","southAsian","latino","middleEastern","black","reset","done","unavailable"] as const;
const words: Record<Locale, string[]> = {
  en:["Community","Favorites","Filters","Gender","Age","Ethnicity","Woman","Man","Young Adult","Middle Aged","Elderly","White","Asian","South Asian","Latino","Middle Eastern","Black","Reset","Done","Some filters are unavailable because this catalog does not provide the corresponding information."],
  "zh-CN":["社区","收藏","筛选","性别","年龄","族裔","女性","男性","青年","中年","老年","白人","亚洲人","南亚人","拉丁裔","中东裔","黑人","重置","完成","部分筛选暂不可用：当前人物库未提供对应信息。"],
  "zh-TW":["社群","收藏","篩選","性別","年齡","族裔","女性","男性","青年","中年","老年","白人","亞洲人","南亞人","拉丁裔","中東裔","黑人","重設","完成","部分篩選暫不可用：目前人物庫未提供對應資訊。"],
  "pt-BR":["Comunidade","Favoritos","Filtros","Gênero","Idade","Etnia","Mulher","Homem","Jovem adulto","Meia-idade","Idoso","Branco","Asiático","Sul-asiático","Latino","Oriente Médio","Negro","Redefinir","Concluir","Alguns filtros estão indisponíveis porque o catálogo não fornece essas informações."],
  es:["Comunidad","Favoritos","Filtros","Género","Edad","Etnia","Mujer","Hombre","Adulto joven","Mediana edad","Mayor","Blanco","Asiático","Surasiático","Latino","Oriente Medio","Negro","Restablecer","Listo","Algunos filtros no están disponibles porque el catálogo no proporciona esa información."],
  fr:["Communauté","Favoris","Filtres","Genre","Âge","Origine ethnique","Femme","Homme","Jeune adulte","Âge moyen","Senior","Blanc","Asiatique","Asiatique du Sud","Latino","Moyen-Orient","Noir","Réinitialiser","Terminé","Certains filtres sont indisponibles car le catalogue ne fournit pas ces informations."],
  de:["Community","Favoriten","Filter","Geschlecht","Alter","Ethnische Herkunft","Frau","Mann","Junge Erwachsene","Mittleres Alter","Senioren","Weiß","Asiatisch","Südasiatisch","Lateinamerikanisch","Nahöstlich","Schwarz","Zurücksetzen","Fertig","Einige Filter sind nicht verfügbar, da der Katalog diese Angaben nicht bereitstellt."],
  ja:["コミュニティ","お気に入り","フィルター","性別","年齢","民族的背景","女性","男性","若年成人","中年","高齢者","白人","アジア系","南アジア系","ラテン系","中東系","黒人","リセット","完了","カタログに情報がないため、一部のフィルターは利用できません。"],
  ko:["커뮤니티","즐겨찾기","필터","성별","연령","민족적 배경","여성","남성","청년","중년","고령","백인","아시아계","남아시아계","라틴계","중동계","흑인","초기화","완료","카탈로그에서 해당 정보를 제공하지 않아 일부 필터를 사용할 수 없습니다."],
  ru:["Сообщество","Избранное","Фильтры","Пол","Возраст","Этническая принадлежность","Женщина","Мужчина","Молодые взрослые","Средний возраст","Пожилые","Белые","Азиаты","Южная Азия","Латиноамериканцы","Ближний Восток","Чернокожие","Сбросить","Готово","Некоторые фильтры недоступны: каталог не предоставляет соответствующие сведения."],
  vi:["Cộng đồng","Yêu thích","Bộ lọc","Giới tính","Độ tuổi","Dân tộc","Nữ","Nam","Thanh niên","Trung niên","Cao tuổi","Da trắng","Châu Á","Nam Á","Latino","Trung Đông","Da đen","Đặt lại","Xong","Một số bộ lọc chưa khả dụng vì danh mục không cung cấp thông tin tương ứng."],
  th:["ชุมชน","รายการโปรด","ตัวกรอง","เพศ","อายุ","ชาติพันธุ์","หญิง","ชาย","วัยหนุ่มสาว","วัยกลางคน","ผู้สูงอายุ","ผิวขาว","เอเชีย","เอเชียใต้","ลาติน","ตะวันออกกลาง","ผิวดำ","รีเซ็ต","เสร็จสิ้น","ตัวกรองบางรายการยังใช้ไม่ได้ เนื่องจากแคตตาล็อกไม่มีข้อมูลที่เกี่ยวข้อง"],
  nl:["Community","Favorieten","Filters","Geslacht","Leeftijd","Etniciteit","Vrouw","Man","Jongvolwassene","Middelbare leeftijd","Oudere","Wit","Aziatisch","Zuid-Aziatisch","Latino","Midden-Oosters","Zwart","Herstellen","Gereed","Sommige filters zijn niet beschikbaar omdat de catalogus deze informatie niet bevat."],
  he:["קהילה","מועדפים","סינון","מגדר","גיל","מוצא אתני","אישה","גבר","צעירים","גיל העמידה","מבוגרים","לבן","אסיאתי","דרום אסיאתי","לטיני","מזרח תיכוני","שחור","איפוס","סיום","חלק מהמסננים אינם זמינים מכיוון שהקטלוג אינו מספק את המידע המתאים."],
  it:["Community","Preferiti","Filtri","Genere","Età","Etnia","Donna","Uomo","Giovane adulto","Mezza età","Anziano","Bianco","Asiatico","Sudasiatico","Latino","Medio Oriente","Nero","Reimposta","Fine","Alcuni filtri non sono disponibili perché il catalogo non fornisce le informazioni corrispondenti."],
  ar:["المجتمع","المفضلة","تصفية","الجنس","العمر","الأصل العرقي","امرأة","رجل","شاب بالغ","متوسط العمر","كبير السن","أبيض","آسيوي","جنوب آسيوي","لاتيني","شرق أوسطي","أسود","إعادة ضبط","تم","بعض خيارات التصفية غير متاحة لأن المكتبة لا توفر المعلومات المقابلة."]
};

export function avatarFilterCopy(locale: Locale) {
  return Object.fromEntries(keys.map((key, index) => [key, words[locale][index]])) as Record<typeof keys[number], string>;
}
