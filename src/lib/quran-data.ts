export type Surah = {
  nomor: number
  nama: string
  arab: string
  ayat: number
}

/** 114 surah Al-Qur'an (nama Latin + Arab, jumlah ayat versi Hafs) */
export const SURAHS: Surah[] = [
  { nomor: 1, nama: "Al-Fatihah", arab: "الفاتحة", ayat: 7 },
  { nomor: 2, nama: "Al-Baqarah", arab: "البقرة", ayat: 286 },
  { nomor: 3, nama: "Ali 'Imran", arab: "آل عمران", ayat: 200 },
  { nomor: 4, nama: "An-Nisa'", arab: "النساء", ayat: 176 },
  { nomor: 5, nama: "Al-Ma'idah", arab: "المائدة", ayat: 120 },
  { nomor: 6, nama: "Al-An'am", arab: "الأنعام", ayat: 165 },
  { nomor: 7, nama: "Al-A'raf", arab: "الأعراف", ayat: 206 },
  { nomor: 8, nama: "Al-Anfal", arab: "الأنفال", ayat: 75 },
  { nomor: 9, nama: "At-Taubah", arab: "التوبة", ayat: 129 },
  { nomor: 10, nama: "Yunus", arab: "يونس", ayat: 109 },
  { nomor: 11, nama: "Hud", arab: "هود", ayat: 123 },
  { nomor: 12, nama: "Yusuf", arab: "يوسف", ayat: 111 },
  { nomor: 13, nama: "Ar-Ra'd", arab: "الرعد", ayat: 43 },
  { nomor: 14, nama: "Ibrahim", arab: "ابراهيم", ayat: 52 },
  { nomor: 15, nama: "Al-Hijr", arab: "الحجر", ayat: 99 },
  { nomor: 16, nama: "An-Nahl", arab: "النحل", ayat: 128 },
  { nomor: 17, nama: "Al-Isra'", arab: "الإسراء", ayat: 111 },
  { nomor: 18, nama: "Al-Kahf", arab: "الكهف", ayat: 110 },
  { nomor: 19, nama: "Maryam", arab: "مريم", ayat: 98 },
  { nomor: 20, nama: "Ta-Ha", arab: "طه", ayat: 135 },
  { nomor: 21, nama: "Al-Anbiya'", arab: "الأنبياء", ayat: 112 },
  { nomor: 22, nama: "Al-Hajj", arab: "الحج", ayat: 78 },
  { nomor: 23, nama: "Al-Mu'minun", arab: "المؤمنون", ayat: 118 },
  { nomor: 24, nama: "An-Nur", arab: "النور", ayat: 64 },
  { nomor: 25, nama: "Al-Furqan", arab: "الفرقان", ayat: 77 },
  { nomor: 26, nama: "Asy-Syu'ara'", arab: "الشعراء", ayat: 227 },
  { nomor: 27, nama: "An-Naml", arab: "النمل", ayat: 93 },
  { nomor: 28, nama: "Al-Qasas", arab: "القصص", ayat: 88 },
  { nomor: 29, nama: "Al-'Ankabut", arab: "العنكبوت", ayat: 69 },
  { nomor: 30, nama: "Ar-Rum", arab: "الروم", ayat: 60 },
  { nomor: 31, nama: "Luqman", arab: "لقمان", ayat: 34 },
  { nomor: 32, nama: "As-Sajdah", arab: "السجدة", ayat: 30 },
  { nomor: 33, nama: "Al-Ahzab", arab: "الأحزاب", ayat: 73 },
  { nomor: 34, nama: "Saba'", arab: "سبأ", ayat: 54 },
  { nomor: 35, nama: "Fatir", arab: "فاطر", ayat: 45 },
  { nomor: 36, nama: "Yasin", arab: "يس", ayat: 83 },
  { nomor: 37, nama: "As-Saffat", arab: "الصافات", ayat: 182 },
  { nomor: 38, nama: "Sad", arab: "ص", ayat: 88 },
  { nomor: 39, nama: "Az-Zumar", arab: "الزمر", ayat: 75 },
  { nomor: 40, nama: "Gafir", arab: "غافر", ayat: 85 },
  { nomor: 41, nama: "Fussilat", arab: "فصلت", ayat: 54 },
  { nomor: 42, nama: "Asy-Syura", arab: "الشورى", ayat: 53 },
  { nomor: 43, nama: "Az-Zukhruf", arab: "الزخرف", ayat: 89 },
  { nomor: 44, nama: "Ad-Dukhan", arab: "الدخان", ayat: 59 },
  { nomor: 45, nama: "Al-Jasiyah", arab: "الجاثية", ayat: 37 },
  { nomor: 46, nama: "Al-Ahqaf", arab: "الأحقاف", ayat: 35 },
  { nomor: 47, nama: "Muhammad", arab: "محمد", ayat: 38 },
  { nomor: 48, nama: "Al-Fath", arab: "الفتح", ayat: 29 },
  { nomor: 49, nama: "Al-Hujurat", arab: "الحجرات", ayat: 18 },
  { nomor: 50, nama: "Qaf", arab: "ق", ayat: 45 },
  { nomor: 51, nama: "Az-Zariyat", arab: "الذاريات", ayat: 60 },
  { nomor: 52, nama: "At-Tur", arab: "الطور", ayat: 49 },
  { nomor: 53, nama: "An-Najm", arab: "النجم", ayat: 62 },
  { nomor: 54, nama: "Al-Qamar", arab: "القمر", ayat: 55 },
  { nomor: 55, nama: "Ar-Rahman", arab: "الرحمن", ayat: 78 },
  { nomor: 56, nama: "Al-Waqi'ah", arab: "الواقعة", ayat: 96 },
  { nomor: 57, nama: "Al-Hadid", arab: "الحديد", ayat: 29 },
  { nomor: 58, nama: "Al-Mujadilah", arab: "المجادلة", ayat: 22 },
  { nomor: 59, nama: "Al-Hasyr", arab: "الحشر", ayat: 24 },
  { nomor: 60, nama: "Al-Mumtahanah", arab: "الممتحنة", ayat: 13 },
  { nomor: 61, nama: "As-Saff", arab: "الصف", ayat: 14 },
  { nomor: 62, nama: "Al-Jumu'ah", arab: "الجمعة", ayat: 11 },
  { nomor: 63, nama: "Al-Munafiqun", arab: "المنافقون", ayat: 11 },
  { nomor: 64, nama: "At-Taghabun", arab: "التغابن", ayat: 18 },
  { nomor: 65, nama: "At-Talaq", arab: "الطلاق", ayat: 12 },
  { nomor: 66, nama: "At-Tahrim", arab: "التحريم", ayat: 12 },
  { nomor: 67, nama: "Al-Mulk", arab: "الملك", ayat: 30 },
  { nomor: 68, nama: "Al-Qalam", arab: "القلم", ayat: 52 },
  { nomor: 69, nama: "Al-Haqqah", arab: "الحاقة", ayat: 52 },
  { nomor: 70, nama: "Al-Ma'arij", arab: "المعارج", ayat: 44 },
  { nomor: 71, nama: "Nuh", arab: "نوح", ayat: 28 },
  { nomor: 72, nama: "Al-Jinn", arab: "الجن", ayat: 28 },
  { nomor: 73, nama: "Al-Muzzammil", arab: "المزمل", ayat: 20 },
  { nomor: 74, nama: "Al-Muddassir", arab: "المدثر", ayat: 56 },
  { nomor: 75, nama: "Al-Qiyamah", arab: "القيامة", ayat: 40 },
  { nomor: 76, nama: "Al-Insan", arab: "الانسان", ayat: 31 },
  { nomor: 77, nama: "Al-Mursalat", arab: "المرسلات", ayat: 50 },
  { nomor: 78, nama: "An-Naba'", arab: "النبأ", ayat: 40 },
  { nomor: 79, nama: "An-Nazi'at", arab: "النازعات", ayat: 46 },
  { nomor: 80, nama: "'Abasa", arab: "عبس", ayat: 42 },
  { nomor: 81, nama: "At-Takwir", arab: "التكوير", ayat: 29 },
  { nomor: 82, nama: "Al-Infitar", arab: "الإنفطار", ayat: 19 },
  { nomor: 83, nama: "Al-Mutaffifin", arab: "المطففين", ayat: 36 },
  { nomor: 84, nama: "Al-Insyiqaq", arab: "الإنشقاق", ayat: 25 },
  { nomor: 85, nama: "Al-Buruj", arab: "البروج", ayat: 22 },
  { nomor: 86, nama: "At-Tariq", arab: "الطارق", ayat: 17 },
  { nomor: 87, nama: "Al-A'la", arab: "الأعلى", ayat: 19 },
  { nomor: 88, nama: "Al-Gasyiyah", arab: "الغاشية", ayat: 26 },
  { nomor: 89, nama: "Al-Fajr", arab: "الفجر", ayat: 30 },
  { nomor: 90, nama: "Al-Balad", arab: "البلد", ayat: 20 },
  { nomor: 91, nama: "Asy-Syams", arab: "الشمس", ayat: 15 },
  { nomor: 92, nama: "Al-Lail", arab: "الليل", ayat: 21 },
  { nomor: 93, nama: "Ad-Duha", arab: "الضحى", ayat: 11 },
  { nomor: 94, nama: "Al-Insyirah", arab: "الشرح", ayat: 8 },
  { nomor: 95, nama: "At-Tin", arab: "التين", ayat: 8 },
  { nomor: 96, nama: "Al-'Alaq", arab: "العلق", ayat: 19 },
  { nomor: 97, nama: "Al-Qadr", arab: "القدر", ayat: 5 },
  { nomor: 98, nama: "Al-Bayyinah", arab: "البينة", ayat: 8 },
  { nomor: 99, nama: "Az-Zalzalah", arab: "الزلزلة", ayat: 8 },
  { nomor: 100, nama: "Al-'Adiyat", arab: "العاديات", ayat: 11 },
  { nomor: 101, nama: "Al-Qari'ah", arab: "القارعة", ayat: 11 },
  { nomor: 102, nama: "At-Takatsur", arab: "التكاثر", ayat: 8 },
  { nomor: 103, nama: "Al-'Asr", arab: "العصر", ayat: 3 },
  { nomor: 104, nama: "Al-Humazah", arab: "الهمزة", ayat: 9 },
  { nomor: 105, nama: "Al-Fil", arab: "الفيل", ayat: 5 },
  { nomor: 106, nama: "Quraisy", arab: "قريش", ayat: 4 },
  { nomor: 107, nama: "Al-Ma'un", arab: "الماعون", ayat: 7 },
  { nomor: 108, nama: "Al-Kautsar", arab: "الكوثر", ayat: 3 },
  { nomor: 109, nama: "Al-Kafirun", arab: "الكافرون", ayat: 6 },
  { nomor: 110, nama: "An-Nasr", arab: "النصر", ayat: 3 },
  { nomor: 111, nama: "Al-Lahab", arab: "اللهب", ayat: 5 },
  { nomor: 112, nama: "Al-Ikhlas", arab: "الإخلاص", ayat: 4 },
  { nomor: 113, nama: "Al-Falaq", arab: "الفلق", ayat: 5 },
  { nomor: 114, nama: "An-Nas", arab: "الناس", ayat: 6 },
]

/** Titik awal setiap juz (surah:ayat) */
export const JUZ_STARTS: { juz: number; surah: number; ayat: number }[] = [
  { juz: 1, surah: 1, ayat: 1 },
  { juz: 2, surah: 2, ayat: 142 },
  { juz: 3, surah: 2, ayat: 203 },
  { juz: 4, surah: 3, ayat: 93 },
  { juz: 5, surah: 4, ayat: 24 },
  { juz: 6, surah: 4, ayat: 148 },
  { juz: 7, surah: 5, ayat: 82 },
  { juz: 8, surah: 6, ayat: 111 },
  { juz: 9, surah: 7, ayat: 88 },
  { juz: 10, surah: 8, ayat: 41 },
  { juz: 11, surah: 9, ayat: 93 },
  { juz: 12, surah: 11, ayat: 6 },
  { juz: 13, surah: 12, ayat: 53 },
  { juz: 14, surah: 15, ayat: 1 },
  { juz: 15, surah: 17, ayat: 1 },
  { juz: 16, surah: 18, ayat: 75 },
  { juz: 17, surah: 21, ayat: 1 },
  { juz: 18, surah: 23, ayat: 1 },
  { juz: 19, surah: 25, ayat: 21 },
  { juz: 20, surah: 27, ayat: 56 },
  { juz: 21, surah: 29, ayat: 46 },
  { juz: 22, surah: 33, ayat: 31 },
  { juz: 23, surah: 36, ayat: 28 },
  { juz: 24, surah: 39, ayat: 32 },
  { juz: 25, surah: 41, ayat: 47 },
  { juz: 26, surah: 46, ayat: 1 },
  { juz: 27, surah: 51, ayat: 31 },
  { juz: 28, surah: 58, ayat: 1 },
  { juz: 29, surah: 67, ayat: 1 },
  { juz: 30, surah: 78, ayat: 1 },
]

const TOTAL_AYAT = SURAHS.reduce((total, s) => total + s.ayat, 0) // 6236

/** indeks ayat global (1..6236) dari pasangan surah:ayat */
function globalIndex(surah: number, ayat: number): number {
  let base = 0
  for (let i = 0; i < surah - 1; i++) base += SURAHS[i].ayat
  return base + ayat
}

const JUZ_RANGES = JUZ_STARTS.map((j, i) => {
  const start = globalIndex(j.surah, j.ayat)
  const end =
    i < JUZ_STARTS.length - 1
      ? globalIndex(JUZ_STARTS[i + 1].surah, JUZ_STARTS[i + 1].ayat) - 1
      : TOTAL_AYAT
  return { juz: j.juz, start, end }
})

/** Daftar surah yang beririsan dengan juz tertentu (urut nomor surah) */
export function getSurahsByJuz(juz: number): Surah[] {
  const range = JUZ_RANGES.find((r) => r.juz === juz)
  if (!range) return []
  return SURAHS.filter((s, idx) => {
    const sStart = globalIndex(idx + 1, 1)
    const sEnd = sStart + s.ayat - 1
    return sStart <= range.end && sEnd >= range.start
  })
}

/** Opsi juz untuk tipe C & D (urutan khusus dari user) */
export const JUZ_OPTIONS_C_D = [30, 29, 28, 27, 1]
