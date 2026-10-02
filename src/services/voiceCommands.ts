import type { Lang } from '../i18n';

/** Locales used by the device speech recogniser. */
export const VOICE_LOCALES: Record<Lang, string> = {
  en: 'en-SG',
  zh: 'zh-CN',
  ms: 'ms-MY',
  ta: 'ta-IN',
};

/**
 * The phrase is deliberately language-specific. Recognition engines often
 * return a mixture of punctuation, spaces, and (for Chinese) Arabic digits, so
 * matching happens against a compact, punctuation-free form.
 */
const WAKE_PHRASES: Record<Lang, string[]> = {
  en: ['one two three one two three', '123 123', '123123'],
  zh: ['一二三 一二三', '一二三一二三', '123 123', '123123'],
  ms: ['satu dua tiga satu dua tiga', '123 123', '123123'],
  ta: ['ஒன்று இரண்டு மூன்று ஒன்று இரண்டு மூன்று'],
};

export type VoiceIntent =
  | { type: 'navigate'; target: 'home' | 'search' | 'report' | 'community' | 'chatbot' }
  | { type: 'home'; target: 'message' | 'voice' }
  | { type: 'media'; target: 'imageLibrary' | 'camera' | 'audioUpload' | 'audioRecord' | 'video' }
  | { type: 'action'; target: 'startAnalyzing' | 'acceptPrivacyConsent' | 'submitReport' | 'sendCommunity' | 'enterCommunity' | 'exitCommunity' | 'callHelpline' | 'runSearch' | 'showNextResults' | 'showPreviousResults' | 'showOlderMessages' | 'toggleAboutScam' | 'toggleHowToHandle' | 'readCommunityGuidance' | 'nextCommunityRoom' | 'previousCommunityRoom' | 'playAnalysisAudio' }
  | { type: 'settings'; target: 'languageEn' | 'languageZh' | 'languageMs' | 'languageTa' | 'textBigger' | 'textSmaller' | 'textDefault' }
  | { type: 'session'; target: 'stop' | 'cancel' | 'repeat' | 'help' | 'confirm' }
  | { type: 'search'; target: 'verified' | 'all' | 'clear' }
  | null;

export type VoiceActionTarget = Extract<Exclude<VoiceIntent, null>, { type: 'action' }>['target'];

/**
 * Confirmation is reserved for actions with an external or consequential
 * side effect. Navigation, display controls, playback, room entry/exit, and
 * analysis are already explicit commands (and analysis still has its privacy
 * consent step), so asking “Shall I continue?” there only adds friction.
 */
export function requiresVoiceConfirmation(target: VoiceActionTarget): boolean {
  return target === 'submitReport' || target === 'sendCommunity' || target === 'callHelpline';
}

type Pattern = { target: VoiceIntent; phrases: string[] };

/**
 * Short, deterministic commands are safer than sending every utterance to the
 * chatbot. The aliases intentionally include natural phrases such as “I want
 * to upload a picture”, which helps users who do not speak in button labels.
 */
const PATTERNS: Record<Lang, Pattern[]> = {
  en: [
    { target: { type: 'session', target: 'stop' }, phrases: ['stop listening', 'cancel voice commands', "that's all", 'that is all'] },
    { target: { type: 'session', target: 'cancel' }, phrases: ['cancel', 'no'] },
    { target: { type: 'session', target: 'confirm' }, phrases: ['yes', 'continue', 'confirm', 'okay', 'ok'] },
    { target: { type: 'session', target: 'repeat' }, phrases: ['repeat that', 'say that again', 'repeat'] },
    { target: { type: 'session', target: 'help' }, phrases: ['what can i say', 'help', 'show voice commands'] },
    { target: { type: 'navigate', target: 'home' }, phrases: ['go home', 'open home', 'home', 'home page', 'go to home', 'go to the home page', 'take me home'] },
    { target: { type: 'navigate', target: 'search' }, phrases: ['open search', 'search cases', 'search', 'go search', 'go to search', 'go to the search page', 'search page', 'find cases', 'look up cases'] },
    { target: { type: 'navigate', target: 'report' }, phrases: ['open report', 'go report', 'go to report', 'go to the report page', 'take me to the report page', 'report an incident', 'report incident', 'report an incidence', 'report a scam', 'report scam', 'make a report', 'file a report'] },
    { target: { type: 'navigate', target: 'community' }, phrases: ['open community', 'go community', 'go to community', 'go to the community', 'community', 'community page'] },
    { target: { type: 'navigate', target: 'chatbot' }, phrases: ['ask hans', 'open ask hans', 'open chatbot', 'go chatbot'] },
    { target: { type: 'settings', target: 'languageEn' }, phrases: ['switch to english', 'change to english', 'use english'] },
    { target: { type: 'settings', target: 'languageZh' }, phrases: ['switch to chinese', 'change to chinese', 'use chinese'] },
    { target: { type: 'settings', target: 'languageMs' }, phrases: ['switch to malay', 'switch to bahasa melayu', 'change to malay', 'use malay'] },
    { target: { type: 'settings', target: 'languageTa' }, phrases: ['switch to tamil', 'change to tamil', 'use tamil'] },
    { target: { type: 'settings', target: 'textBigger' }, phrases: ['make text bigger', 'increase text size', 'larger text', 'bigger text'] },
    { target: { type: 'settings', target: 'textSmaller' }, phrases: ['make text smaller', 'decrease text size', 'smaller text'] },
    { target: { type: 'settings', target: 'textDefault' }, phrases: ['reset text size', 'normal text size', 'default text size'] },
    { target: { type: 'home', target: 'message' }, phrases: ['check a message', 'check message', 'check an email'] },
    { target: { type: 'home', target: 'voice' }, phrases: ['check a voice note', 'check voice note'] },
    { target: { type: 'media', target: 'imageLibrary' }, phrases: ['upload an image', 'upload image', 'upload a picture', 'upload a pic', 'upload a photo', 'i want to upload an image'] },
    { target: { type: 'media', target: 'camera' }, phrases: ['take a picture', 'take a photo', 'capture an image', 'take picture'] },
    { target: { type: 'media', target: 'audioUpload' }, phrases: ['upload audio', 'upload an audio file', 'upload a voice note'] },
    { target: { type: 'media', target: 'audioRecord' }, phrases: ['record a voice note', 'record audio', 'tell what happened', 'say what happened'] },
    { target: { type: 'media', target: 'video' }, phrases: ['upload a video', 'upload video', 'check a video', 'upload a clip'] },
    { target: { type: 'search', target: 'verified' }, phrases: ['show verified cases only', 'show verified cases'] },
    { target: { type: 'search', target: 'all' }, phrases: ['show all cases', 'include unverified cases'] },
    { target: { type: 'search', target: 'clear' }, phrases: ['clear search filters', 'clear filters'] },
    { target: { type: 'action', target: 'acceptPrivacyConsent' }, phrases: ['i understand and continue', 'i understand, and continue', 'understand and continue', 'understood, continue', 'continue with the analysis'] },
    { target: { type: 'action', target: 'startAnalyzing' }, phrases: ['start analyzing', 'start analysis', 'analyze this'] },
    { target: { type: 'action', target: 'submitReport' }, phrases: ['submit my report', 'submit the report', 'submit report'] },
    { target: { type: 'action', target: 'sendCommunity' }, phrases: ['send this message', 'send message'] },
    { target: { type: 'action', target: 'enterCommunity' }, phrases: ['enter the chat room', 'enter chat room', 'join the chat room'] },
    { target: { type: 'action', target: 'exitCommunity' }, phrases: ['exit the chat room', 'exit chat room', 'leave the chat room', 'leave chat room', 'leave community', 'exit community'] },
    { target: { type: 'action', target: 'callHelpline' }, phrases: ['call 1799', 'call the 1799 helpline'] },
    { target: { type: 'action', target: 'runSearch' }, phrases: ['run search', 'apply search', 'tap search'] },
    { target: { type: 'action', target: 'showNextResults' }, phrases: ['show next cases', 'next cases', 'show next results'] },
    { target: { type: 'action', target: 'showPreviousResults' }, phrases: ['show previous cases', 'previous cases', 'show previous results'] },
    { target: { type: 'action', target: 'showOlderMessages' }, phrases: ['show older messages', 'load earlier messages'] },
    { target: { type: 'action', target: 'toggleAboutScam' }, phrases: ['about this scam', 'show about this scam'] },
    { target: { type: 'action', target: 'toggleHowToHandle' }, phrases: ['how to handle it', 'show how to handle it'] },
    { target: { type: 'action', target: 'readCommunityGuidance' }, phrases: ['read this aloud', 'read the guidance aloud', 'speak this'] },
    { target: { type: 'action', target: 'nextCommunityRoom' }, phrases: ['next chat room', 'next scam type', 'move down the room list'] },
    { target: { type: 'action', target: 'previousCommunityRoom' }, phrases: ['previous chat room', 'previous scam type', 'move up the room list'] },
    { target: { type: 'action', target: 'playAnalysisAudio' }, phrases: ['play audio', 'play the audio', 'play sound', 'play the sound', 'read it aloud', 'read the analysis result aloud', 'read analysis result', 'play analysis result', 'speak the analysis result'] },
  ],
  zh: [
    { target: { type: 'session', target: 'stop' }, phrases: ['停止聆听', '停止监听', '取消语音指令', '就这样'] },
    { target: { type: 'session', target: 'cancel' }, phrases: ['取消', '不要'] },
    { target: { type: 'session', target: 'confirm' }, phrases: ['是', '继续', '确认', '好的', '好'] },
    { target: { type: 'session', target: 'repeat' }, phrases: ['再说一次', '重复'] },
    { target: { type: 'session', target: 'help' }, phrases: ['我可以说什么', '语音指令', '帮助'] },
    { target: { type: 'navigate', target: 'home' }, phrases: ['回到主页', '打开主页', '回首页', '打开首页', '主页', '首页'] },
    { target: { type: 'navigate', target: 'search' }, phrases: ['打开搜索', '开启搜索', '搜索案件', '打开搜索页面', '搜索', '查找案件'] },
    { target: { type: 'navigate', target: 'report' }, phrases: ['打开举报', '举报诈骗', '举报事件', '打开报告', '报告诈骗'] },
    { target: { type: 'navigate', target: 'community' }, phrases: ['打开社区', '进入社区', '社区'] },
    { target: { type: 'navigate', target: 'chatbot' }, phrases: ['询问汉斯', '打开汉斯', '打开聊天助手', '问汉斯'] },
    { target: { type: 'settings', target: 'languageEn' }, phrases: ['切换英语', '改用英语'] },
    { target: { type: 'settings', target: 'languageZh' }, phrases: ['切换中文', '改用中文'] },
    { target: { type: 'settings', target: 'languageMs' }, phrases: ['切换马来语', '改用马来语'] },
    { target: { type: 'settings', target: 'languageTa' }, phrases: ['切换泰米尔语', '改用泰米尔语'] },
    { target: { type: 'settings', target: 'textBigger' }, phrases: ['放大文字', '增大字体', '文字大一点'] },
    { target: { type: 'settings', target: 'textSmaller' }, phrases: ['缩小文字', '减小字体', '文字小一点'] },
    { target: { type: 'settings', target: 'textDefault' }, phrases: ['恢复默认字体', '重置文字大小', '正常字体'] },
    { target: { type: 'home', target: 'message' }, phrases: ['检查信息', '检查短信'] },
    { target: { type: 'home', target: 'voice' }, phrases: ['检查语音', '检查语音笔记'] },
    { target: { type: 'media', target: 'imageLibrary' }, phrases: ['上传图片', '上传照片', '上传一张图片', '我想上传图片', '选择图片'] },
    { target: { type: 'media', target: 'camera' }, phrases: ['拍照', '拍一张照片', '拍张照片', '照相'] },
    { target: { type: 'media', target: 'audioUpload' }, phrases: ['上传音频', '上传语音', '选择音频'] },
    { target: { type: 'media', target: 'audioRecord' }, phrases: ['录音', '录制语音', '讲述经过', '开始录音'] },
    { target: { type: 'media', target: 'video' }, phrases: ['上传视频', '检查视频', '选择视频'] },
    { target: { type: 'search', target: 'verified' }, phrases: ['只显示已验证案件', '显示已验证案件'] },
    { target: { type: 'search', target: 'all' }, phrases: ['显示所有案件'] },
    { target: { type: 'search', target: 'clear' }, phrases: ['清除搜索筛选', '清除筛选'] },
    { target: { type: 'action', target: 'acceptPrivacyConsent' }, phrases: ['我了解并继续', '我明白并继续', '了解并继续', '继续分析'] },
    { target: { type: 'action', target: 'startAnalyzing' }, phrases: ['开始分析', '分析这个'] },
    { target: { type: 'action', target: 'submitReport' }, phrases: ['提交举报', '提交报告'] },
    { target: { type: 'action', target: 'sendCommunity' }, phrases: ['发送这条消息', '发送消息'] },
    { target: { type: 'action', target: 'enterCommunity' }, phrases: ['进入聊天室', '加入聊天室'] },
    { target: { type: 'action', target: 'exitCommunity' }, phrases: ['退出聊天室', '离开聊天室'] },
    { target: { type: 'action', target: 'callHelpline' }, phrases: ['拨打1799', '拨打1799热线'] },
    { target: { type: 'action', target: 'runSearch' }, phrases: ['开始搜索', '应用搜索'] },
    { target: { type: 'action', target: 'showNextResults' }, phrases: ['下一页案件', '显示下一批案件'] },
    { target: { type: 'action', target: 'showPreviousResults' }, phrases: ['上一页案件', '显示上一批案件'] },
    { target: { type: 'action', target: 'showOlderMessages' }, phrases: ['显示较早消息', '加载较早消息'] },
    { target: { type: 'action', target: 'toggleAboutScam' }, phrases: ['关于这个诈骗', '显示诈骗详情'] },
    { target: { type: 'action', target: 'toggleHowToHandle' }, phrases: ['如何处理', '显示处理方法'] },
    { target: { type: 'action', target: 'readCommunityGuidance' }, phrases: ['大声读出来', '朗读这些内容'] },
    { target: { type: 'action', target: 'nextCommunityRoom' }, phrases: ['下一个聊天室', '下一个诈骗类型'] },
    { target: { type: 'action', target: 'previousCommunityRoom' }, phrases: ['上一个聊天室', '上一个诈骗类型'] },
    { target: { type: 'action', target: 'playAnalysisAudio' }, phrases: ['播放音频', '播放分析结果', '朗读分析结果', '读出分析结果'] },
  ],
  ms: [
    { target: { type: 'session', target: 'stop' }, phrases: ['berhenti mendengar', 'hentikan arahan suara', 'itu sahaja'] },
    { target: { type: 'session', target: 'cancel' }, phrases: ['batal', 'tidak'] },
    { target: { type: 'session', target: 'confirm' }, phrases: ['ya', 'teruskan', 'sahkan', 'baik'] },
    { target: { type: 'session', target: 'repeat' }, phrases: ['ulang semula', 'ulang'] },
    { target: { type: 'session', target: 'help' }, phrases: ['apa yang boleh saya katakan', 'arahan suara', 'bantuan'] },
    { target: { type: 'navigate', target: 'home' }, phrases: ['pergi ke halaman utama', 'buka halaman utama'] },
    { target: { type: 'navigate', target: 'search' }, phrases: ['buka carian', 'cari kes'] },
    { target: { type: 'navigate', target: 'report' }, phrases: ['buka laporan', 'lapor penipuan', 'lapor kejadian'] },
    { target: { type: 'navigate', target: 'community' }, phrases: ['buka komuniti', 'pergi ke komuniti'] },
    { target: { type: 'navigate', target: 'chatbot' }, phrases: ['tanya hans', 'buka hans', 'buka chatbot'] },
    { target: { type: 'settings', target: 'languageEn' }, phrases: ['tukar ke bahasa inggeris', 'guna bahasa inggeris'] },
    { target: { type: 'settings', target: 'languageZh' }, phrases: ['tukar ke bahasa cina', 'guna bahasa cina'] },
    { target: { type: 'settings', target: 'languageMs' }, phrases: ['tukar ke bahasa melayu', 'guna bahasa melayu'] },
    { target: { type: 'settings', target: 'languageTa' }, phrases: ['tukar ke bahasa tamil', 'guna bahasa tamil'] },
    { target: { type: 'settings', target: 'textBigger' }, phrases: ['besarkan teks', 'besarkan tulisan'] },
    { target: { type: 'settings', target: 'textSmaller' }, phrases: ['kecilkan teks', 'kecilkan tulisan'] },
    { target: { type: 'settings', target: 'textDefault' }, phrases: ['tetapkan saiz teks asal', 'saiz teks biasa'] },
    { target: { type: 'home', target: 'message' }, phrases: ['semak mesej', 'periksa mesej'] },
    { target: { type: 'home', target: 'voice' }, phrases: ['semak nota suara', 'periksa nota suara'] },
    { target: { type: 'media', target: 'imageLibrary' }, phrases: ['muat naik gambar', 'muat naik foto', 'saya mahu muat naik gambar'] },
    { target: { type: 'media', target: 'camera' }, phrases: ['ambil gambar', 'ambil foto'] },
    { target: { type: 'media', target: 'audioUpload' }, phrases: ['muat naik audio', 'muat naik nota suara'] },
    { target: { type: 'media', target: 'audioRecord' }, phrases: ['rakam nota suara', 'rakam audio', 'ceritakan apa yang berlaku'] },
    { target: { type: 'media', target: 'video' }, phrases: ['muat naik video', 'semak video'] },
    { target: { type: 'search', target: 'verified' }, phrases: ['tunjukkan kes disahkan sahaja', 'tunjukkan kes disahkan'] },
    { target: { type: 'search', target: 'all' }, phrases: ['tunjukkan semua kes'] },
    { target: { type: 'search', target: 'clear' }, phrases: ['padam penapis carian', 'padam penapis'] },
    { target: { type: 'action', target: 'acceptPrivacyConsent' }, phrases: ['saya faham dan teruskan', 'faham dan teruskan', 'teruskan analisis'] },
    { target: { type: 'action', target: 'startAnalyzing' }, phrases: ['mula menganalisis', 'analisis ini'] },
    { target: { type: 'action', target: 'submitReport' }, phrases: ['hantar laporan saya', 'hantar laporan'] },
    { target: { type: 'action', target: 'sendCommunity' }, phrases: ['hantar mesej ini', 'hantar mesej'] },
    { target: { type: 'action', target: 'enterCommunity' }, phrases: ['masuk bilik sembang', 'sertai bilik sembang'] },
    { target: { type: 'action', target: 'exitCommunity' }, phrases: ['keluar bilik sembang', 'tinggalkan bilik sembang'] },
    { target: { type: 'action', target: 'callHelpline' }, phrases: ['telefon 1799', 'telefon talian 1799'] },
  ],
  ta: [
    { target: { type: 'session', target: 'stop' }, phrases: ['கேட்பதை நிறுத்து', 'குரல் கட்டளைகளை ரத்து செய்', 'அவ்வளவுதான்'] },
    { target: { type: 'session', target: 'cancel' }, phrases: ['ரத்து செய்', 'வேண்டாம்'] },
    { target: { type: 'session', target: 'confirm' }, phrases: ['ஆம்', 'தொடரவும்', 'உறுதிப்படுத்து', 'சரி'] },
    { target: { type: 'session', target: 'repeat' }, phrases: ['மீண்டும் சொல்', 'மீண்டும்'] },
    { target: { type: 'session', target: 'help' }, phrases: ['நான் என்ன சொல்லலாம்', 'குரல் கட்டளைகள்', 'உதவி'] },
    { target: { type: 'navigate', target: 'home' }, phrases: ['முகப்புக்குச் செல்', 'முகப்பைத் திற'] },
    { target: { type: 'navigate', target: 'search' }, phrases: ['தேடலைத் திற', 'வழக்குகளைத் தேடு'] },
    { target: { type: 'navigate', target: 'report' }, phrases: ['புகாரைத் திற', 'மோசடியைப் புகார் செய்'] },
    { target: { type: 'navigate', target: 'community' }, phrases: ['சமூகத்தைத் திற', 'சமூகத்திற்குச் செல்'] },
    { target: { type: 'navigate', target: 'chatbot' }, phrases: ['ஹான்ஸிடம் கேள்', 'ஹான்ஸைத் திற'] },
    { target: { type: 'settings', target: 'languageEn' }, phrases: ['ஆங்கிலத்திற்கு மாறு'] },
    { target: { type: 'settings', target: 'languageZh' }, phrases: ['சீனத்திற்கு மாறு'] },
    { target: { type: 'settings', target: 'languageMs' }, phrases: ['மலாய் மொழிக்கு மாறு'] },
    { target: { type: 'settings', target: 'languageTa' }, phrases: ['தமிழுக்கு மாறு'] },
    { target: { type: 'settings', target: 'textBigger' }, phrases: ['எழுத்தை பெரிதாக்கு'] },
    { target: { type: 'settings', target: 'textSmaller' }, phrases: ['எழுத்தை சிறிதாக்கு'] },
    { target: { type: 'settings', target: 'textDefault' }, phrases: ['இயல்பான எழுத்து அளவு'] },
    { target: { type: 'home', target: 'message' }, phrases: ['செய்தியைச் சரிபார்'] },
    { target: { type: 'home', target: 'voice' }, phrases: ['குரல் குறிப்பைச் சரிபார்'] },
    { target: { type: 'media', target: 'imageLibrary' }, phrases: ['படத்தைப் பதிவேற்று', 'புகைப்படத்தைப் பதிவேற்று'] },
    { target: { type: 'media', target: 'camera' }, phrases: ['புகைப்படம் எடு', 'படம் எடு'] },
    { target: { type: 'media', target: 'audioUpload' }, phrases: ['ஆடியோவைப் பதிவேற்று', 'குரல் குறிப்பைப் பதிவேற்று'] },
    { target: { type: 'media', target: 'audioRecord' }, phrases: ['குரல் குறிப்பைப் பதிவு செய்', 'நடந்ததைச் சொல்'] },
    { target: { type: 'media', target: 'video' }, phrases: ['வீடியோவைப் பதிவேற்று', 'வீடியோவைச் சரிபார்'] },
    { target: { type: 'search', target: 'verified' }, phrases: ['சரிபார்க்கப்பட்ட வழக்குகளை மட்டும் காட்டு'] },
    { target: { type: 'search', target: 'all' }, phrases: ['அனைத்து வழக்குகளையும் காட்டு'] },
    { target: { type: 'search', target: 'clear' }, phrases: ['தேடல் வடிகட்டிகளை அழி', 'வடிகட்டிகளை அழி'] },
    { target: { type: 'action', target: 'acceptPrivacyConsent' }, phrases: ['நான் புரிந்துகொண்டு தொடர்கிறேன்', 'புரிந்துகொண்டு தொடர்கிறேன்', 'பகுப்பாய்வைத் தொடரு'] },
    { target: { type: 'action', target: 'startAnalyzing' }, phrases: ['பகுப்பாய்வைத் தொடங்கு', 'இதைப் பகுப்பாய்வு செய்'] },
    { target: { type: 'action', target: 'submitReport' }, phrases: ['எனது புகாரை அனுப்பு', 'புகாரை அனுப்பு'] },
    { target: { type: 'action', target: 'sendCommunity' }, phrases: ['இந்தச் செய்தியை அனுப்பு', 'செய்தியை அனுப்பு'] },
    { target: { type: 'action', target: 'enterCommunity' }, phrases: ['அரட்டை அறைக்குள் செல்', 'அரட்டை அறையில் சேரு'] },
    { target: { type: 'action', target: 'exitCommunity' }, phrases: ['அரட்டை அறையை விட்டு வெளியேறு'] },
    { target: { type: 'action', target: 'callHelpline' }, phrases: ['1799 ஐ அழை', '1799 உதவி எண்ணை அழை'] },
  ],
};

function compact(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    // Mandarin recognisers can return Traditional characters even when the
    // app requested zh-CN. Normalize the common UI words before matching.
    .replace(/[首頁頁開啟尋找查詢報舉詐騙訊息圖片照錄語音視訊進入離開國語換大縮選擇]/g, (char) => ({
      首: '首', 頁: '页', 開: '开', 啟: '启', 尋: '寻', 找: '找', 查: '查', 詢: '询', 報: '报', 舉: '举', 詐: '诈', 騙: '骗', 訊: '讯', 息: '息', 圖: '图', 片: '片', 照: '照', 錄: '录', 語: '语', 音: '音', 視: '视', 進: '进', 入: '入', 離: '离', 國: '国', 換: '换', 大: '大', 縮: '缩', 選: '选', 擇: '择',
    } as Record<string, string>)[char] ?? char)
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

/** Browsers sometimes transcribe Mandarin numerals as a mixture of Han
 * characters and Arabic digits. Normalize both forms before wake matching. */
function compactWake(value: string): string {
  return compact(value).replace(/[一壹]/g, '1').replace(/[二贰两]/g, '2').replace(/[三叁]/g, '3');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match Latin-language commands without treating a short command as a piece
 * of another word. In particular, “no” must not match Hans saying “now”.
 * CJK commands continue to use compact matching because they do not have
 * whitespace word boundaries.
 */
function phraseMatches(transcript: string, phrase: string): boolean {
  const trimmedPhrase = phrase.trim();
  if (/^[a-z0-9]+(?:[\s']+[a-z0-9]+)*$/i.test(trimmedPhrase)) {
    const expression = trimmedPhrase
      .toLocaleLowerCase()
      .split(/\s+/)
      .map(escapeRegExp)
      .join('\\s+');
    return new RegExp(`\\b${expression}\\b`, 'i').test(transcript.normalize('NFKC'));
  }
  return compact(transcript).includes(compact(phrase));
}

export function wakePhrases(lang: Lang): string[] {
  return WAKE_PHRASES[lang];
}

export function localeForVoice(lang: Lang): string {
  return VOICE_LOCALES[lang];
}

export function isWakePhrase(transcript: string, lang: Lang): boolean {
  const value = compactWake(transcript);
  return WAKE_PHRASES[lang].some((phrase) => value.includes(compactWake(phrase)));
}

export function parseVoiceCommand(transcript: string, lang: Lang): VoiceIntent {
  const patterns = PATTERNS[lang].slice().sort((a, b) => {
    const aLength = Math.max(...a.phrases.map((phrase) => compact(phrase).length));
    const bLength = Math.max(...b.phrases.map((phrase) => compact(phrase).length));
    return bLength - aLength;
  });
  return patterns.find(({ phrases }) => phrases.some((phrase) => phraseMatches(transcript, phrase)))?.target ?? null;
}

/** Extracts free-form speech after an explicit dictation prefix. */
export function extractDictation(transcript: string, lang: Lang): string | null {
  const prefixes: Record<Lang, string[]> = {
    en: ['input this message', 'type this message', 'enter this message', 'write this message', 'input message', 'type message'],
    zh: ['输入这条消息', '输入消息', '输入这段话', '请把这句话输入', '键入这条消息'],
    ms: ['masukkan mesej ini', 'taip mesej ini', 'tulis mesej ini'],
    ta: ['இந்த செய்தியை உள்ளிடு', 'இந்த செய்தியை தட்டச்சு செய்'],
  };
  const source = transcript.trim();
  const lower = source.toLocaleLowerCase();
  const prefix = prefixes[lang].find((candidate) => lower.includes(candidate.toLocaleLowerCase()));
  if (!prefix) return null;
  const start = lower.indexOf(prefix.toLocaleLowerCase()) + prefix.length;
  const value = source.slice(start).replace(/^[\s:：,，。.!！?？-]+/, '').trim();
  return value || null;
}

export function voiceCommandExamples(lang: Lang): string {
  const examples = {
    en: 'Say “go home”, “upload an image”, “take a picture”, or “open Search”.',
    zh: '您可以说“回到主页”、“上传图片”、“拍照”或“打开搜索”。',
    ms: 'Sebut “pergi ke halaman utama”, “muat naik gambar”, “ambil gambar”, atau “buka carian”.',
    ta: '“முகப்புக்குச் செல்”, “படத்தைப் பதிவேற்று”, “புகைப்படம் எடு” அல்லது “தேடலைத் திற” என்று சொல்லலாம்.',
  } as const;
  return examples[lang];
}

export function voiceCopy(lang: Lang): {
  listening: string;
  speaking: string;
  greeting: string;
  stopped: string;
  cancelled: string;
  unavailable: string;
  unknown: string;
  confirm: string;
} {
  const copy = {
    en: {
      listening: 'Listening',
      speaking: 'Hans is speaking',
      greeting: 'Hi! I’m Hans, the ScamNoMore assistant. I’m listening. Please say your voice command.',
      stopped: 'I’ll stop listening now. Say the wake phrase whenever you need me.',
      cancelled: 'Okay, I will not do that.',
      unavailable: 'Voice commands are not available on this device. You can still use the buttons.',
      unknown: 'I did not understand that command. Please try again.',
      confirm: 'Shall I continue?',
    },
    zh: {
      listening: '正在聆听',
      speaking: 'Hans 正在说话',
      greeting: '您好！我是 ScamNoMore 助手 Hans。我正在聆听，请说出您的语音指令。',
      stopped: '我现在停止聆听。需要我时，请说出唤醒短语。',
      cancelled: '好的，我不会这样做。',
      unavailable: '此设备无法使用语音指令。您仍然可以使用按钮。',
      unknown: '我不明白这个指令，请再试一次。',
      confirm: '要继续吗？',
    },
    ms: {
      listening: 'Sedang mendengar',
      speaking: 'Hans sedang bercakap',
      greeting: 'Hai! Saya Hans, pembantu ScamNoMore. Saya sedang mendengar. Sila sebut arahan suara anda.',
      stopped: 'Saya akan berhenti mendengar sekarang. Sebut frasa pengaktifan apabila anda perlukan saya.',
      cancelled: 'Baik, saya tidak akan meneruskannya.',
      unavailable: 'Arahan suara tidak tersedia pada peranti ini. Anda masih boleh menggunakan butang.',
      unknown: 'Saya tidak memahami arahan itu. Sila cuba lagi.',
      confirm: 'Teruskan?',
    },
    ta: {
      listening: 'கேட்கிறது',
      speaking: 'Hans பேசுகிறார்',
      greeting: 'வணக்கம்! நான் ScamNoMore உதவியாளர் Hans. நான் கேட்கிறேன். உங்கள் குரல் கட்டளையைச் சொல்லுங்கள்.',
      stopped: 'இப்போது கேட்பதை நிறுத்துகிறேன். தேவைப்படும்போது விழிப்பு சொற்றொடரைச் சொல்லுங்கள்.',
      cancelled: 'சரி, அதைச் செய்யமாட்டேன்.',
      unavailable: 'இந்த சாதனத்தில் குரல் கட்டளைகள் கிடைக்கவில்லை. நீங்கள் பொத்தான்களைப் பயன்படுத்தலாம்.',
      unknown: 'அந்தக் கட்டளை எனக்குப் புரியவில்லை. மீண்டும் முயற்சிக்கவும்.',
      confirm: 'தொடரவா?',
    },
  } as const;
  return copy[lang];
}
