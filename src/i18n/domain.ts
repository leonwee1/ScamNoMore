// Type-only import: keeps this module free of any React dependency so the
// tables can be loaded and verified on their own.
import type { Lang } from './index';

/**
 * Translations for DATA values, as opposed to UI chrome.
 *
 * The bundled dataset stores English values (scam type, town, keywords). Those
 * English strings stay canonical everywhere in the data layer — search filters,
 * `scamStore.addReport`, the Community room keys and the scam-type enum the
 * model returns all depend on them. Translation happens at RENDER time only, so
 * switching language never changes what is stored or matched.
 *
 * Every field is a closed set in the 5000-row dataset (14 scam types, 40 towns,
 * 92 keywords), which is what makes a lookup table viable here.
 */

/**
 * A value's translations. `ms` is optional because a great many Singapore place
 * names are already Malay (Bukit Merah, Pasir Ris, Tanjong Pagar, Telok
 * Blangah), so inventing a different Malay form would be wrong. When `ms` is
 * absent the original English value is shown, which is the correct result.
 */
interface Translations {
  zh: string;
  ms?: string;
  ta: string;
}

/** The 14 scam categories used by the dataset and the analysis model. */
const SCAM_TYPES: Record<string, Translations> = {
  'E-commerce Scam': { zh: '电子商务诈骗', ms: 'Penipuan E-dagang', ta: 'மின்வணிக மோசடி' },
  'Fake Friend Call Scam': {
    zh: '假冒朋友来电诈骗',
    ms: 'Penipuan Panggilan Rakan Palsu',
    ta: 'போலி நண்பர் அழைப்பு மோசடி',
  },
  'Government Officials Impersonation Scam': {
    zh: '冒充政府官员诈骗',
    ms: 'Penipuan Menyamar Pegawai Kerajaan',
    ta: 'அரசு அதிகாரி வேடமிடும் மோசடி',
  },
  'Inheritance Scam': { zh: '遗产诈骗', ms: 'Penipuan Warisan', ta: 'சொத்துரிமை மோசடி' },
  'Investment Scam': { zh: '投资诈骗', ms: 'Penipuan Pelaburan', ta: 'முதலீட்டு மோசடி' },
  'Job Scam': { zh: '求职诈骗', ms: 'Penipuan Pekerjaan', ta: 'வேலை மோசடி' },
  'Loan Scam': { zh: '贷款诈骗', ms: 'Penipuan Pinjaman', ta: 'கடன் மோசடி' },
  'Lottery Scam': { zh: '中奖诈骗', ms: 'Penipuan Loteri', ta: 'லாட்டரி மோசடி' },
  Others: { zh: '其他', ms: 'Lain-lain', ta: 'மற்றவை' },
  'Phishing Scam': { zh: '网络钓鱼诈骗', ms: 'Penipuan Pancingan Data', ta: 'ஃபிஷிங் மோசடி' },
  'Rental Scam': { zh: '租房诈骗', ms: 'Penipuan Penyewaan', ta: 'வாடகை மோசடி' },
  'Romance Scam': { zh: '恋爱诈骗', ms: 'Penipuan Cinta', ta: 'காதல் மோசடி' },
  'Social Media Impersonation': {
    zh: '社交媒体假冒',
    ms: 'Penyamaran Media Sosial',
    ta: 'சமூக ஊடக வேடமிடல்',
  },
  'Tech Support Scam': {
    zh: '技术支持诈骗',
    ms: 'Penipuan Sokongan Teknikal',
    ta: 'தொழில்நுட்ப உதவி மோசடி',
  },
};

/**
 * The 40 towns in the dataset. Chinese uses the established Singapore names
 * (宏茂桥, 义顺, 大巴窑); Tamil transliterates. Malay is mostly omitted on
 * purpose — see the note on `Translations`.
 */
const TOWNS: Record<string, Translations> = {
  'Ang Mo Kio': { zh: '宏茂桥', ta: 'அங் மோ கியோ' },
  Balestier: { zh: '马里士他', ta: 'பாலஸ்டியர்' },
  Bedok: { zh: '勿洛', ta: 'பேடோக்' },
  Bishan: { zh: '碧山', ta: 'பீஷான்' },
  'Boon Lay': { zh: '文礼', ta: 'பூன் லே' },
  Bugis: { zh: '武吉士', ta: 'புகிஸ்' },
  'Bukit Merah': { zh: '武吉美拉', ta: 'புக்கிட் மேரா' },
  'Bukit Timah': { zh: '武吉知马', ta: 'புக்கிட் திமா' },
  Changi: { zh: '樟宜', ta: 'சாங்கி' },
  Chinatown: { zh: '牛车水', ms: 'Kawasan Cina', ta: 'சைனாடவுன்' },
  Clementi: { zh: '金文泰', ta: 'கிளெமெண்டி' },
  'Dhoby Ghaut': { zh: '多美歌', ta: 'டோபி காட்' },
  Geylang: { zh: '芽笼', ta: 'கேலாங்' },
  'Holland Village': { zh: '荷兰村', ta: 'ஹாலண்ட் வில்லேஜ்' },
  Hougang: { zh: '后港', ta: 'ஹவ்காங்' },
  'Jurong East': { zh: '裕廊东', ms: 'Jurong Timur', ta: 'ஜூரோங் கிழக்கு' },
  'Jurong West': { zh: '裕廊西', ms: 'Jurong Barat', ta: 'ஜூரோங் மேற்கு' },
  Kallang: { zh: '加冷', ta: 'காலாங்' },
  Katong: { zh: '加东', ta: 'காத்தோங்' },
  'Marina Bay': { zh: '滨海湾', ta: 'மரீனா பே' },
  Newton: { zh: '纽顿', ta: 'நியூட்டன்' },
  Novena: { zh: '诺维娜', ta: 'நொவீனா' },
  Orchard: { zh: '乌节', ta: 'ஆர்ச்சர்ட்' },
  Others: { zh: '其他', ms: 'Lain-lain', ta: 'மற்றவை' },
  Outram: { zh: '欧南', ta: 'அவுட்ரம்' },
  'Pasir Ris': { zh: '巴西立', ta: 'பாசிர் ரிஸ்' },
  'Paya Lebar': { zh: '巴耶利峇', ta: 'பாயா லேபார்' },
  Punggol: { zh: '榜鹅', ta: 'புங்கோல்' },
  Queenstown: { zh: '女皇镇', ta: 'குயின்ஸ்டவுன்' },
  'Raffles Place': { zh: '莱佛士坊', ta: 'ராஃபிள்ஸ் பிளேஸ்' },
  Redhill: { zh: '红山', ta: 'ரெட்ஹில்' },
  Sengkang: { zh: '盛港', ta: 'செங்காங்' },
  Serangoon: { zh: '实龙岗', ta: 'செராங்கூன்' },
  Somerset: { zh: '索美塞', ta: 'சோமர்செட்' },
  Tampines: { zh: '淡滨尼', ta: 'தம்பினிஸ்' },
  'Tanjong Pagar': { zh: '丹戎巴葛', ta: 'தஞ்சோங் பகார்' },
  'Telok Blangah': { zh: '直落布兰雅', ta: 'தெலோக் பிளாங்கா' },
  'Toa Payoh': { zh: '大巴窑', ta: 'தோ பாயோ' },
  Woodlands: { zh: '兀兰', ta: 'வுட்லண்ட்ஸ்' },
  Yishun: { zh: '义顺', ta: 'யிஷூன்' },
};

/**
 * Dataset keywords.
 *
 * Brand, product and agency names are deliberately ABSENT and therefore render
 * unchanged: DBS, OCBC, UOB, PayNow, Singpass, CPF, IRAS, ICA, MOH, SPF,
 * Carousell, Shopee, Lazada, WhatsApp, Telegram, Facebook, Instagram, LinkedIn,
 * Tinder, Apple, Microsoft, iPhone, Bitcoin, USDT, MetaTrader, Western Union,
 * Cashmart, Credit 21, OTP. Translating a proper noun would make the evidence
 * harder to recognise, not easier.
 */
const KEYWORDS: Record<string, Translations> = {
  'AI trading': { zh: 'AI 交易', ms: 'perdagangan AI', ta: 'AI வர்த்தகம்' },
  IC: { zh: '身份证', ms: 'kad pengenalan', ta: 'அடையாள அட்டை' },
  'SMS spoof': { zh: '短信伪装', ms: 'penyamaran SMS', ta: 'SMS போலி' },
  'advance payment': { zh: '预付款', ms: 'bayaran pendahuluan', ta: 'முன்பணம்' },
  alert: { zh: '警报', ms: 'makluman', ta: 'எச்சரிக்கை' },
  'bank transfer': { zh: '银行转账', ms: 'pemindahan bank', ta: 'வங்கி பணப்பரிமாற்றம்' },
  'banking credentials': { zh: '银行登录资料', ms: 'butiran bank', ta: 'வங்கி அனுமதிச் சான்றுகள்' },
  'clone account': { zh: '克隆账户', ms: 'akaun klon', ta: 'நகல் கணக்கு' },
  'commission task': { zh: '佣金任务', ms: 'tugasan komisen', ta: 'கமிஷன் பணி' },
  'concert tickets': { zh: '演唱会门票', ms: 'tiket konsert', ta: 'இசை நிகழ்ச்சி டிக்கெட்' },
  'credit card': { zh: '信用卡', ms: 'kad kredit', ta: 'கடன் அட்டை' },
  crypto: { zh: '加密货币', ms: 'kripto', ta: 'கிரிப்டோ' },
  'customs fee': { zh: '关税费', ms: 'bayaran kastam', ta: 'சுங்க கட்டணம்' },
  'data entry': { zh: '数据输入', ms: 'kemasukan data', ta: 'தரவு உள்ளீடு' },
  'dating app': { zh: '交友软件', ms: 'aplikasi temu janji', ta: 'டேட்டிங் செயலி' },
  daughter: { zh: '女儿', ms: 'anak perempuan', ta: 'மகள்' },
  deposit: { zh: '押金', ms: 'deposit', ta: 'முன்பணம்' },
  electronics: { zh: '电子产品', ms: 'barangan elektronik', ta: 'மின்னணு பொருட்கள்' },
  emergency: { zh: '紧急情况', ms: 'kecemasan', ta: 'அவசரநிலை' },
  estate: { zh: '遗产', ms: 'harta pusaka', ta: 'சொத்து' },
  'fake account': { zh: '假账户', ms: 'akaun palsu', ta: 'போலி கணக்கு' },
  'fake arrest': { zh: '假逮捕', ms: 'tangkapan palsu', ta: 'போலி கைது' },
  'fake link': { zh: '假链接', ms: 'pautan palsu', ta: 'போலி இணைப்பு' },
  'fake listing': { zh: '虚假商品信息', ms: 'senarai palsu', ta: 'போலி விளம்பரம்' },
  'fake prize': { zh: '虚假奖品', ms: 'hadiah palsu', ta: 'போலி பரிசு' },
  'fake recruiter': { zh: '假招聘者', ms: 'perekrut palsu', ta: 'போலி ஆட்சேர்ப்பாளர்' },
  'fake seller': { zh: '假卖家', ms: 'penjual palsu', ta: 'போலி விற்பனையாளர்' },
  'fake warrant': { zh: '假逮捕令', ms: 'waran palsu', ta: 'போலி கைது ஆணை' },
  forex: { zh: '外汇', ms: 'forex', ta: 'அன்னியச் செலாவணி' },
  fraud: { zh: '欺诈', ms: 'penipuan', ta: 'மோசடி' },
  friend: { zh: '朋友', ms: 'rakan', ta: 'நண்பர்' },
  gold: { zh: '黄金', ms: 'emas', ta: 'தங்கம்' },
  grandson: { zh: '孙子', ms: 'cucu lelaki', ta: 'பேரன்' },
  'guaranteed returns': { zh: '保证回报', ms: 'pulangan dijamin', ta: 'உறுதியான வருவாய்' },
  'hospital fees': { zh: '医院费用', ms: 'bayaran hospital', ta: 'மருத்துவமனை கட்டணம்' },
  'identity theft': { zh: '身份盗用', ms: 'kecurian identiti', ta: 'அடையாள திருட்டு' },
  'insurance fee': { zh: '保险费', ms: 'bayaran insurans', ta: 'காப்பீட்டு கட்டணம்' },
  jackpot: { zh: '头奖', ms: 'jackpot', ta: 'ஜாக்பாட்' },
  lawyer: { zh: '律师', ms: 'peguam', ta: 'வழக்கறிஞர்' },
  'licensed moneylender': {
    zh: '持牌放贷人',
    ms: 'pemberi pinjaman berlesen',
    ta: 'உரிமம் பெற்ற கடன் வழங்குபவர்',
  },
  'love scam': { zh: '恋爱诈骗', ms: 'penipuan cinta', ta: 'காதல் மோசடி' },
  'lucky draw': { zh: '幸运抽奖', ms: 'cabutan bertuah', ta: 'அதிர்ஷ்ட குலுக்கல்' },
  military: { zh: '军人', ms: 'tentera', ta: 'இராணுவம்' },
  'mining pool': { zh: '挖矿池', ms: 'kolam perlombongan', ta: 'மைனிங் பூல்' },
  'non-delivery': { zh: '未送货', ms: 'tidak dihantar', ta: 'பொருள் வழங்கப்படவில்லை' },
  overseas: { zh: '海外', ms: 'luar negara', ta: 'வெளிநாடு' },
  'phishing email': { zh: '钓鱼邮件', ms: 'e-mel pancingan', ta: 'ஃபிஷிங் மின்னஞ்சல்' },
  'pop-up': { zh: '弹出窗口', ms: 'tetingkap timbul', ta: 'பாப்-அப்' },
  'processing fee': { zh: '手续费', ms: 'bayaran pemprosesan', ta: 'செயலாக்க கட்டணம்' },
  'referral bonus': { zh: '推荐奖金', ms: 'bonus rujukan', ta: 'பரிந்துரை ஊக்கத்தொகை' },
  relative: { zh: '亲戚', ms: 'saudara', ta: 'உறவினர்' },
  'remote access': { zh: '远程访问', ms: 'akses jauh', ta: 'தொலை அணுகல்' },
  'room rental': { zh: '房间租赁', ms: 'sewa bilik', ta: 'அறை வாடகை' },
  'scam call': { zh: '诈骗电话', ms: 'panggilan penipuan', ta: 'மோசடி அழைப்பு' },
  spam: { zh: '垃圾信息', ms: 'spam', ta: 'ஸ்பேம்' },
  staking: { zh: '质押', ms: 'staking', ta: 'ஸ்டேக்கிங்' },
  suspicious: { zh: '可疑', ms: 'mencurigakan', ta: 'சந்தேகத்திற்குரிய' },
  'system alert': { zh: '系统警报', ms: 'makluman sistem', ta: 'அமைப்பு எச்சரிக்கை' },
  'training fee': { zh: '培训费', ms: 'bayaran latihan', ta: 'பயிற்சி கட்டணம்' },
  unknown: { zh: '未知', ms: 'tidak diketahui', ta: 'தெரியாதது' },
  'upfront fee': { zh: '预付费用', ms: 'bayaran awal', ta: 'முன்கூட்டிய கட்டணம்' },
  virus: { zh: '病毒', ms: 'virus', ta: 'வைரஸ்' },
  'voice call': { zh: '语音通话', ms: 'panggilan suara', ta: 'குரல் அழைப்பு' },
};

/**
 * Look a value up in a table. Falls back to the original English on any miss,
 * which covers English itself, untranslated proper nouns, and values typed in
 * by users through the Report screen.
 */
function lookup(table: Record<string, Translations>, value: string, lang: Lang): string {
  if (lang === 'en') return value;
  const entry = table[value];
  if (!entry) return value;
  return entry[lang] ?? value;
}

export const translateScamType = (value: string, lang: Lang): string =>
  lookup(SCAM_TYPES, value, lang);

export const translateTown = (value: string, lang: Lang): string => lookup(TOWNS, value, lang);

export const translateKeyword = (value: string, lang: Lang): string =>
  lookup(KEYWORDS, value, lang);

/**
 * Translate a scam type that may carry the " Scam" suffix stripped for display
 * (the Search screen shortens labels that way).
 */
export function translateScamTypeShort(value: string, lang: Lang): string {
  const full = translateScamType(value, lang);
  // Only the English labels read better without the redundant word "Scam";
  // the other languages already read naturally in full.
  return lang === 'en' ? full.replace(' Scam', '') : full;
}

/** Exposed for tests and coverage checks. */
export const _tables = { SCAM_TYPES, TOWNS, KEYWORDS };
