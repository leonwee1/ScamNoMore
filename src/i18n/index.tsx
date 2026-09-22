import React, { createContext, useContext, useMemo, useState } from 'react';

/** Supported languages per the wireframe ("4 local languages"). */
export type Lang = 'en' | 'zh' | 'ms' | 'ta';
export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
  { code: 'ms', label: 'BM' },
  { code: 'ta', label: 'தமிழ்' },
];

type Dict = Record<string, string>;

const en: Dict = {
  'app.name': 'ScamNoMore',
  'tab.home': 'Home',
  'tab.search': 'Search',
  'tab.report': 'Report',
  'tab.community': 'Community',
  'chatbot.title': 'Chatbot',
  'home.prompt': 'Please select what to analyze:',
  'home.text.group': 'Text (eg. message, email, advertisement)',
  'home.takePicture': 'Take picture',
  'home.uploadImage': 'Upload image file',
  'home.voice.group': 'Voice (phonecall, self recount)',
  'home.uploadAudio': 'Upload audio file',
  'home.sayWhat': 'Say what happened',
  'home.video.group': 'Video',
  'home.uploadVideo': 'Upload video file',
  'analyze.startAnalyzing': 'Click to start analyzing',
  'analyze.startRecording': 'Click to start/stop voice recording',
  'analyze.transcribed': 'Transcribed text (editable):',
  'analyze.checkAnother': 'Check another',
  'analyze.result': 'Analysis result',
  'analyze.probability': 'Scam probability',
  'analyze.maxDuration': 'max duration 5 mins',
  'search.title': 'Search',
  'search.period': 'Time period',
  'search.keywords': 'Keywords (optional)',
  'search.verifiedOnly': 'Show verified cases only',
  'search.go': 'Go statistics for your search',
  'search.results': 'Results',
  'search.byTown': 'Statistics by Town',
  'search.noResults': 'No matching cases. Try widening your search.',
  'report.title': 'Report an incident',
  'report.date': 'Date of Incident',
  'report.description': 'Incident description (max 200 words)',
  'report.town': 'Town',
  'report.scamType': 'Scam Type',
  'report.submit': 'Submit incident report',
  'report.selectTown': 'Select a town',
  'report.selectType': 'Select a scam type',
  'report.thankYou':
    'Thank you for reporting the incident. Your reporting will help more people to safeguard themselves against scams.',
  'report.comfort':
    'If you are the scam victim, you are advised to make a police report at your nearest neighbourhood police station. Scams employ various tactics to trick people. Please do not blame yourself for falling for the scam. If you need someone to speak to, call the 1799 Helpline for a confidential chat.',
  'report.another': 'Submit another report',
  'community.title': 'Community',
  'community.pickRoom': 'Please select a chat room to join.',
  'community.enter': 'Enter chat room',
  'community.exit': 'Exit chat room',
  'community.youAreIn': 'You are in',
  'community.liveSession': 'Live chat session',
  'community.etiquette': 'Please maintain basic chat etiquette. Thanks.',
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'common.home': 'Home',
  'common.wordsLeft': 'words left',
};

// Partial translations for key UI strings; unlisted keys fall back to English.
const zh: Dict = {
  'tab.home': '主页', 'tab.search': '搜索', 'tab.report': '举报', 'tab.community': '社区',
  'chatbot.title': '聊天机器人', 'home.prompt': '请选择要分析的内容：',
  'home.takePicture': '拍照', 'home.uploadImage': '上传图片', 'home.uploadAudio': '上传音频',
  'home.sayWhat': '讲述经过', 'home.uploadVideo': '上传视频',
  'analyze.startAnalyzing': '点击开始分析', 'analyze.probability': '诈骗概率',
  'search.go': '查看搜索统计', 'search.verifiedOnly': '仅显示已核实案例',
  'report.submit': '提交举报', 'community.enter': '进入聊天室', 'community.exit': '退出聊天室',
  'common.ok': '确定', 'common.cancel': '取消', 'common.home': '主页',
};
const ms: Dict = {
  'tab.home': 'Utama', 'tab.search': 'Cari', 'tab.report': 'Lapor', 'tab.community': 'Komuniti',
  'chatbot.title': 'Bot Sembang', 'home.prompt': 'Sila pilih apa untuk dianalisis:',
  'home.takePicture': 'Ambil gambar', 'home.uploadImage': 'Muat naik imej', 'home.uploadAudio': 'Muat naik audio',
  'home.sayWhat': 'Ceritakan apa berlaku', 'home.uploadVideo': 'Muat naik video',
  'analyze.startAnalyzing': 'Klik untuk mula analisis', 'analyze.probability': 'Kebarangkalian penipuan',
  'search.go': 'Lihat statistik carian', 'search.verifiedOnly': 'Tunjuk kes disahkan sahaja',
  'report.submit': 'Hantar laporan', 'community.enter': 'Masuk bilik sembang', 'community.exit': 'Keluar bilik sembang',
  'common.ok': 'OK', 'common.cancel': 'Batal', 'common.home': 'Utama',
};
const ta: Dict = {
  'tab.home': 'முகப்பு', 'tab.search': 'தேடல்', 'tab.report': 'புகார்', 'tab.community': 'சமூகம்',
  'chatbot.title': 'அரட்டை பாட்', 'home.prompt': 'பகுப்பாய்வு செய்ய வேண்டியதைத் தேர்ந்தெடுக்கவும்:',
  'home.takePicture': 'படம் எடு', 'home.uploadImage': 'படத்தை பதிவேற்று', 'home.uploadAudio': 'ஆடியோ பதிவேற்று',
  'home.sayWhat': 'நடந்ததை சொல்', 'home.uploadVideo': 'வீடியோ பதிவேற்று',
  'analyze.startAnalyzing': 'பகுப்பாய்வைத் தொடங்க', 'analyze.probability': 'மோசடி நிகழ்தகவு',
  'search.go': 'தேடல் புள்ளிவிவரம்', 'search.verifiedOnly': 'சரிபார்க்கப்பட்டவை மட்டும்',
  'report.submit': 'புகாரை சமர்ப்பி', 'community.enter': 'அறையில் நுழை', 'community.exit': 'அறையிலிருந்து வெளியேறு',
  'common.ok': 'சரி', 'common.cancel': 'ரத்து', 'common.home': 'முகப்பு',
};

const DICTS: Record<Lang, Dict> = { en, zh, ms, ta };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof en | string) => string;
}
const Ctx = createContext<I18nCtx | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('en');
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang,
      t: (key: string) => DICTS[lang][key] ?? en[key] ?? key,
    }),
    [lang]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
