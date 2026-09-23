import React, { createContext, useContext, useMemo, useState } from 'react';

/** Supported languages per the wireframe ("4 local languages"). */
export type Lang = 'en' | 'zh' | 'ms' | 'ta';
export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
  { code: 'ms', label: 'BM' },
  { code: 'ta', label: 'தமிழ்' },
];

/**
 * English is the source of truth. Every other dictionary is typed as
 * `Record<TranslationKey, string>`, so omitting a key is a COMPILE ERROR rather
 * than a silent fallback to English. The dictionaries used to be partial, which
 * is why screens kept showing English after switching language.
 */
const en = {
  'app.name': 'ScamNoMore',

  'tab.home': 'Home',
  'tab.search': 'Search',
  'tab.report': 'Report',
  'tab.community': 'Community',

  'chatbot.title': 'Chatbot',
  'chatbot.greeting':
    'Hi! I’m the ScamNoMore assistant. Ask me anything about scams, or describe a message/call and I’ll help you spot red flags.',
  'chatbot.placeholder': 'Ask about a scam…',
  'chatbot.send': 'Send',
  'chatbot.askByVoice': 'Ask by voice',
  'chatbot.recording': 'Recording… tap again to stop',
  'chatbot.noSpeech': 'No speech detected. Please try again, or type your question.',
  'chatbot.typing': 'Assistant is typing…',
  'chatbot.error': 'I had trouble responding. Please try again.',

  'home.prompt': 'Please select what to analyze:',
  'home.text.group': 'Text (eg. message, email, advertisement)',
  'home.takePicture': 'Take picture',
  'home.uploadImage': 'Upload image file',
  'home.voice.group': 'Voice (phonecall, self recount)',
  'home.uploadAudio': 'Upload audio file',
  'home.sayWhat': 'Say what happened',
  'home.video.group': 'Video',
  'home.uploadVideo': 'Upload video file',
  'home.cautionTitle': 'Never share confidential details',
  'home.caution':
    'Do not share OTPs, your NRIC, passwords, Singpass logins or full card numbers with anyone — including in the screenshots, recordings and videos you upload here. Real banks and government agencies will never ask you for them.',

  'analyze.startAnalyzing': 'Start analyzing',
  'analyze.reanalyze': 'Re-analyze edited text',
  // Idle label only. Once recording starts the button switches to
  // analyze.stopRecording, so naming both states here would be redundant.
  'analyze.startRecording': 'Start voice recording',
  'analyze.stopRecording': 'Stop recording',
  'analyze.transcribed': 'Transcribed text (editable):',
  'analyze.transcribing': 'Transcribing…',
  'analyze.result': 'Analysis result',
  'analyze.probability': 'Scam probability',
  // Formats are the ones the analysis pipeline genuinely accepts; the size is
  // the limit actually enforced (see MAX_MEDIA_BYTES in services/api.ts).
  'analyze.imageLimits': 'PNG, JPG, WEBP or GIF · up to {size} MB',
  'analyze.audioLimits': 'MP3, M4A, WAV or WEBM · up to {size} MB',
  'analyze.videoLimits': 'MP4, MOV or WEBM · up to {size} MB',
  'analyze.translating': 'Translating the result…',
  'analyze.why': 'Why',
  'analyze.whatToDo': 'What to do',
  'analyze.likelyCategory': 'Likely category',
  'analyze.selectImage': 'Select an image of the suspicious email / message.',
  'analyze.selected': 'Selected: {name}',
  'analyze.noImage': 'No image selected or permission denied.',
  'analyze.noAudio': 'No file selected or permission denied.',
  'analyze.noVideo': 'No video selected or permission denied.',
  'analyze.micDenied': 'Microphone permission denied.',
  'analyze.micError': 'Could not access the microphone.',
  'analyze.failed': 'Analysis failed. Please try again.',
  'analyze.transcribeFailed': 'Transcription failed.',
  'analyze.orTypeBelow': 'You can also type what happened below.',
  'analyze.noSpeech.reason':
    'No speech could be detected in the audio, so there was nothing to analyse.',
  'analyze.noSpeech.video':
    'This check reads the video’s spoken audio. A silent video cannot be assessed this way.',
  'analyze.noSpeech.voice': 'The recording appears to be silent or too quiet to transcribe.',
  'analyze.noSpeech.adviceVideo':
    'Try a clip that contains speech, or screenshot the video and use the image check instead. If unsure about an offer, call 1799.',
  'analyze.noSpeech.adviceVoice':
    'Please record again and speak clearly, or type what happened instead. If unsure, call 1799.',

  'risk.safe': 'Very low risk',
  'risk.low': 'Low risk',
  'risk.medium': 'Possible scam',
  'risk.high': 'Likely scam',
  'risk.critical': 'Almost certainly a scam',

  'search.title': 'Search',
  'search.period': 'Time period',
  'search.from': 'From (YYYY-MM-DD)',
  'search.to': 'To (YYYY-MM-DD)',
  'search.keywords': 'Keywords (optional)',
  'search.keywordsPlaceholder': 'e.g. PayNow, Carousell, OTP',
  'search.verifiedOnly': 'Show verified cases only',
  'search.go': 'Go statistics for your search',
  'search.results': 'Results',
  'search.byTown': 'Statistics by Town',
  'search.topTypes': 'Top scam types',
  'search.matchingCases': 'Matching cases',
  'search.casesFound': '{count} case(s) found',
  'search.showingFirst': 'Showing first {shown} of {total}. Refine your search to narrow down.',
  'search.setFilters': 'Set your filters and tap “{action}”.',
  'search.noResults': 'No matching cases. Try widening your search.',

  'report.title': 'Report an incident',
  'report.date': 'Date of Incident',
  'report.datePlaceholder': 'YYYY-MM-DD',
  'report.description': 'Incident description (max 200 words)',
  'report.descriptionPlaceholder':
    'Describe what happened (key info like amount, platform, contact)…',
  'report.town': 'Town',
  'report.scamType': 'Scam Type',
  'report.submit': 'Submit incident report',
  'report.selectTown': 'Select a town',
  'report.selectType': 'Select a scam type',
  'report.totalCases': 'Total cases in database: {count}',
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
  'community.roomSuffix': 'chat room',
  'community.liveSession': 'Live chat session',
  'community.etiquette': 'Please maintain basic chat etiquette. Thanks.',
  'community.typeMessage': 'Type a message…',
  'community.send': 'Send',
  'community.you': 'You',
  'community.seed.ecom.a':
    'I saw this video on YouTube about a powerful veggie cleaner selling at 60% discount. Does anyone know if it’s real?',
  'community.seed.ecom.b': 'I have seen this too. Apparently, it’s a scam…',
  'community.seed.ecom.c':
    'Seller asked me to PayNow first and then blocked me. Don’t pay before meetup.',
  'community.seed.phish.a': 'Got an SMS saying my bank account is locked with a link. Looks legit?',
  'community.seed.phish.b':
    'Banks never send links to unlock accounts. Delete it and call the bank directly.',
  'community.seed.job.a':
    'A Telegram recruiter offered $80/task, just need to pay a small deposit first.',
  'community.seed.job.b': 'Classic job scam. Real jobs never ask you to pay upfront.',
  'community.seed.generic.a':
    'Anyone experienced a {type} recently? Sharing to warn others.',
  'community.seed.generic.b':
    'Stay alert and verify everything. Report to the police if you lost money.',

  'backend.title': 'Backend not configured',
  'backend.body':
    'Analysis and the chatbot need the OpenAI backend. Start it with “npm start” in the backend folder, then set “apiBaseUrl” in app.json (expo.extra) to your server URL and reload. See docs/SETUP.md.',

  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'common.home': 'Home',
  'common.wordsLeft': 'words left',
};

/** Every translation key. Adding one to `en` requires adding it everywhere. */
export type TranslationKey = keyof typeof en;
type Dict = Record<TranslationKey, string>;

const zh: Dict = {
  'app.name': 'ScamNoMore',

  'tab.home': '主页',
  'tab.search': '搜索',
  'tab.report': '举报',
  'tab.community': '社区',

  'chatbot.title': '聊天机器人',
  'chatbot.greeting':
    '您好！我是 ScamNoMore 助手。您可以询问任何关于诈骗的问题，或描述收到的信息／来电，我会帮您识别可疑之处。',
  'chatbot.placeholder': '询问关于诈骗的问题…',
  'chatbot.send': '发送',
  'chatbot.askByVoice': '语音提问',
  'chatbot.recording': '正在录音…再次点击以停止',
  'chatbot.noSpeech': '未检测到语音。请再试一次，或输入您的问题。',
  'chatbot.typing': '助手正在输入…',
  'chatbot.error': '回应时出现问题，请再试一次。',

  'home.prompt': '请选择要分析的内容：',
  'home.text.group': '文字（如短信、电邮、广告）',
  'home.takePicture': '拍照',
  'home.uploadImage': '上传图片',
  'home.voice.group': '语音（来电、自述经过）',
  'home.uploadAudio': '上传音频',
  'home.sayWhat': '讲述经过',
  'home.video.group': '视频',
  'home.uploadVideo': '上传视频',
  'home.cautionTitle': '切勿透露机密资料',
  'home.caution':
    '请勿向任何人透露一次性密码（OTP）、身份证号码、密码、Singpass 登录资料或完整的信用卡号码，包括您在此上传的截图、录音和视频。真正的银行与政府机构绝不会向您索取这些资料。',

  'analyze.startAnalyzing': '开始分析',
  'analyze.reanalyze': '重新分析修改后的文字',
  'analyze.startRecording': '开始录音',
  'analyze.stopRecording': '停止录音',
  'analyze.transcribed': '转写文字（可编辑）：',
  'analyze.transcribing': '正在转写…',
  'analyze.result': '分析结果',
  'analyze.probability': '诈骗概率',
  'analyze.imageLimits': 'PNG、JPG、WEBP 或 GIF · 最大 {size} MB',
  'analyze.audioLimits': 'MP3、M4A、WAV 或 WEBM · 最大 {size} MB',
  'analyze.videoLimits': 'MP4、MOV 或 WEBM · 最大 {size} MB',
  'analyze.translating': '正在翻译结果…',
  'analyze.why': '原因',
  'analyze.whatToDo': '建议做法',
  'analyze.likelyCategory': '可能类别',
  'analyze.selectImage': '请选择可疑电邮／信息的图片。',
  'analyze.selected': '已选择：{name}',
  'analyze.noImage': '未选择图片，或权限被拒绝。',
  'analyze.noAudio': '未选择文件，或权限被拒绝。',
  'analyze.noVideo': '未选择视频，或权限被拒绝。',
  'analyze.micDenied': '麦克风权限被拒绝。',
  'analyze.micError': '无法使用麦克风。',
  'analyze.failed': '分析失败，请再试一次。',
  'analyze.transcribeFailed': '转写失败。',
  'analyze.orTypeBelow': '您也可以在下方输入经过。',
  'analyze.noSpeech.reason': '音频中未检测到语音，因此没有可分析的内容。',
  'analyze.noSpeech.video': '此项检查分析视频中的语音。无声视频无法以这种方式评估。',
  'analyze.noSpeech.voice': '录音似乎没有声音，或音量太低无法转写。',
  'analyze.noSpeech.adviceVideo':
    '请改用含语音的片段，或将视频截图后使用图片检查。若对某项优惠有疑虑，请致电 1799。',
  'analyze.noSpeech.adviceVoice':
    '请重新录音并清楚说话，或改为输入文字说明经过。如有疑虑，请致电 1799。',

  'risk.safe': '风险极低',
  'risk.low': '风险较低',
  'risk.medium': '可能是诈骗',
  'risk.high': '很可能是诈骗',
  'risk.critical': '几乎确定是诈骗',

  'search.title': '搜索',
  'search.period': '时间范围',
  'search.from': '起始日期（YYYY-MM-DD）',
  'search.to': '结束日期（YYYY-MM-DD）',
  'search.keywords': '关键词（选填）',
  'search.keywordsPlaceholder': '例如：PayNow、Carousell、OTP',
  'search.verifiedOnly': '仅显示已核实案例',
  'search.go': '查看搜索统计',
  'search.results': '搜索结果',
  'search.byTown': '按区域统计',
  'search.topTypes': '主要诈骗类型',
  'search.matchingCases': '符合的案例',
  'search.casesFound': '找到 {count} 起案例',
  'search.showingFirst': '显示 {total} 起中的前 {shown} 起。请缩小搜索范围。',
  'search.setFilters': '设定筛选条件后，点击“{action}”。',
  'search.noResults': '没有符合的案例。请尝试扩大搜索范围。',

  'report.title': '举报事件',
  'report.date': '事发日期',
  'report.datePlaceholder': 'YYYY-MM-DD',
  'report.description': '事件描述（最多 200 字）',
  'report.descriptionPlaceholder': '请描述经过（金额、平台、联络方式等关键信息）…',
  'report.town': '区域',
  'report.scamType': '诈骗类型',
  'report.submit': '提交举报',
  'report.selectTown': '请选择区域',
  'report.selectType': '请选择诈骗类型',
  'report.totalCases': '数据库中的案例总数：{count}',
  'report.thankYou': '感谢您举报此事件。您的举报将帮助更多人防范诈骗。',
  'report.comfort':
    '如果您是诈骗受害者，建议您到最近的邻里警岗报警。诈骗集团会使用各种手段行骗，请不要责怪自己。如果您需要有人倾谈，请致电 1799 热线进行保密谈话。',
  'report.another': '再提交一份举报',

  'community.title': '社区',
  'community.pickRoom': '请选择要加入的聊天室。',
  'community.enter': '进入聊天室',
  'community.exit': '退出聊天室',
  'community.youAreIn': '您目前在',
  'community.roomSuffix': '聊天室',
  'community.liveSession': '实时聊天',
  'community.etiquette': '请保持基本的聊天礼仪，谢谢。',
  'community.typeMessage': '输入信息…',
  'community.send': '发送',
  'community.you': '我',
  'community.seed.ecom.a':
    '我在 YouTube 看到一个强力洗菜机的视频，打折 60%。有人知道是真的吗？',
  'community.seed.ecom.b': '我也看过。听说是骗局…',
  'community.seed.ecom.c': '卖家叫我先用 PayNow 付款，然后就把我拉黑了。见面前千万别付钱。',
  'community.seed.phish.a': '我收到短信说我的银行账户被锁，还附上链接。看起来像真的？',
  'community.seed.phish.b': '银行绝不会发链接让您解锁账户。请删除并直接致电银行。',
  'community.seed.job.a': '一名 Telegram 招聘者说每项任务 80 元，只需先付一小笔押金。',
  'community.seed.job.b': '典型的求职骗局。真正的工作绝不会要求您先付钱。',
  'community.seed.generic.a': '最近有人遇到{type}吗？分享出来提醒大家。',
  'community.seed.generic.b': '请保持警惕并核实一切。如果损失金钱，请向警方报案。',

  'backend.title': '后端尚未设置',
  'backend.body':
    '分析与聊天机器人需要 OpenAI 后端。请在 backend 文件夹运行“npm start”，然后在 app.json（expo.extra）中将“apiBaseUrl”设为您的服务器网址并重新载入。详见 docs/SETUP.md。',

  'common.cancel': '取消',
  'common.ok': '确定',
  'common.home': '主页',
  'common.wordsLeft': '字剩余',
};

const ms: Dict = {
  'app.name': 'ScamNoMore',

  'tab.home': 'Utama',
  'tab.search': 'Cari',
  'tab.report': 'Lapor',
  'tab.community': 'Komuniti',

  'chatbot.title': 'Bot Sembang',
  'chatbot.greeting':
    'Hai! Saya pembantu ScamNoMore. Tanya apa sahaja tentang penipuan, atau terangkan mesej/panggilan yang anda terima dan saya akan bantu anda mengenal pasti tanda bahaya.',
  'chatbot.placeholder': 'Tanya tentang penipuan…',
  'chatbot.send': 'Hantar',
  'chatbot.askByVoice': 'Tanya dengan suara',
  'chatbot.recording': 'Merakam… tekan lagi untuk berhenti',
  'chatbot.noSpeech': 'Tiada pertuturan dikesan. Cuba lagi, atau taip soalan anda.',
  'chatbot.typing': 'Pembantu sedang menaip…',
  'chatbot.error': 'Saya menghadapi masalah untuk menjawab. Sila cuba lagi.',

  'home.prompt': 'Sila pilih apa untuk dianalisis:',
  'home.text.group': 'Teks (cth. mesej, e-mel, iklan)',
  'home.takePicture': 'Ambil gambar',
  'home.uploadImage': 'Muat naik imej',
  'home.voice.group': 'Suara (panggilan telefon, cerita sendiri)',
  'home.uploadAudio': 'Muat naik audio',
  'home.sayWhat': 'Ceritakan apa berlaku',
  'home.video.group': 'Video',
  'home.uploadVideo': 'Muat naik video',
  'home.cautionTitle': 'Jangan kongsi maklumat sulit',
  'home.caution':
    'Jangan kongsi OTP, nombor NRIC, kata laluan, butiran Singpass atau nombor kad penuh dengan sesiapa — termasuk dalam tangkapan skrin, rakaman dan video yang anda muat naik di sini. Bank dan agensi kerajaan yang sah tidak akan meminta maklumat tersebut.',

  'analyze.startAnalyzing': 'Mula analisis',
  'analyze.reanalyze': 'Analisis semula teks yang diedit',
  'analyze.startRecording': 'Mula rakaman suara',
  'analyze.stopRecording': 'Henti rakaman',
  'analyze.transcribed': 'Teks transkripsi (boleh diedit):',
  'analyze.transcribing': 'Sedang mentranskripsi…',
  'analyze.result': 'Keputusan analisis',
  'analyze.probability': 'Kebarangkalian penipuan',
  'analyze.imageLimits': 'PNG, JPG, WEBP atau GIF · sehingga {size} MB',
  'analyze.audioLimits': 'MP3, M4A, WAV atau WEBM · sehingga {size} MB',
  'analyze.videoLimits': 'MP4, MOV atau WEBM · sehingga {size} MB',
  'analyze.translating': 'Menterjemah keputusan…',
  'analyze.why': 'Sebab',
  'analyze.whatToDo': 'Apa perlu dibuat',
  'analyze.likelyCategory': 'Kategori berkemungkinan',
  'analyze.selectImage': 'Pilih imej e-mel / mesej yang mencurigakan.',
  'analyze.selected': 'Dipilih: {name}',
  'analyze.noImage': 'Tiada imej dipilih atau kebenaran ditolak.',
  'analyze.noAudio': 'Tiada fail dipilih atau kebenaran ditolak.',
  'analyze.noVideo': 'Tiada video dipilih atau kebenaran ditolak.',
  'analyze.micDenied': 'Kebenaran mikrofon ditolak.',
  'analyze.micError': 'Tidak dapat mengakses mikrofon.',
  'analyze.failed': 'Analisis gagal. Sila cuba lagi.',
  'analyze.transcribeFailed': 'Transkripsi gagal.',
  'analyze.orTypeBelow': 'Anda juga boleh menaip apa yang berlaku di bawah.',
  'analyze.noSpeech.reason':
    'Tiada pertuturan dapat dikesan dalam audio, jadi tiada apa untuk dianalisis.',
  'analyze.noSpeech.video':
    'Pemeriksaan ini membaca audio pertuturan video. Video tanpa bunyi tidak dapat dinilai dengan cara ini.',
  'analyze.noSpeech.voice':
    'Rakaman ini kelihatan sunyi atau terlalu perlahan untuk ditranskripsi.',
  'analyze.noSpeech.adviceVideo':
    'Cuba klip yang mengandungi pertuturan, atau tangkap skrin video itu dan guna pemeriksaan imej. Jika tidak pasti tentang sesuatu tawaran, hubungi 1799.',
  'analyze.noSpeech.adviceVoice':
    'Sila rakam semula dan bercakap dengan jelas, atau taip apa yang berlaku. Jika tidak pasti, hubungi 1799.',

  'risk.safe': 'Risiko sangat rendah',
  'risk.low': 'Risiko rendah',
  'risk.medium': 'Mungkin penipuan',
  'risk.high': 'Berkemungkinan besar penipuan',
  'risk.critical': 'Hampir pasti penipuan',

  'search.title': 'Cari',
  'search.period': 'Tempoh masa',
  'search.from': 'Dari (YYYY-MM-DD)',
  'search.to': 'Hingga (YYYY-MM-DD)',
  'search.keywords': 'Kata kunci (pilihan)',
  'search.keywordsPlaceholder': 'cth. PayNow, Carousell, OTP',
  'search.verifiedOnly': 'Tunjuk kes disahkan sahaja',
  'search.go': 'Lihat statistik carian',
  'search.results': 'Keputusan',
  'search.byTown': 'Statistik mengikut Bandar',
  'search.topTypes': 'Jenis penipuan utama',
  'search.matchingCases': 'Kes yang sepadan',
  'search.casesFound': '{count} kes ditemui',
  'search.showingFirst':
    'Menunjukkan {shown} pertama daripada {total}. Perincikan carian anda.',
  'search.setFilters': 'Tetapkan penapis anda dan tekan “{action}”.',
  'search.noResults': 'Tiada kes sepadan. Cuba luaskan carian anda.',

  'report.title': 'Laporkan insiden',
  'report.date': 'Tarikh Insiden',
  'report.datePlaceholder': 'YYYY-MM-DD',
  'report.description': 'Penerangan insiden (maksimum 200 perkataan)',
  'report.descriptionPlaceholder':
    'Terangkan apa yang berlaku (maklumat penting seperti jumlah, platform, kenalan)…',
  'report.town': 'Bandar',
  'report.scamType': 'Jenis Penipuan',
  'report.submit': 'Hantar laporan insiden',
  'report.selectTown': 'Pilih bandar',
  'report.selectType': 'Pilih jenis penipuan',
  'report.totalCases': 'Jumlah kes dalam pangkalan data: {count}',
  'report.thankYou':
    'Terima kasih kerana melaporkan insiden ini. Laporan anda akan membantu lebih ramai orang melindungi diri daripada penipuan.',
  'report.comfort':
    'Jika anda mangsa penipuan, anda dinasihatkan membuat laporan polis di balai polis kejiranan terdekat. Penipu menggunakan berbagai taktik untuk memperdaya orang. Jangan salahkan diri anda kerana terpedaya. Jika anda perlu berbual dengan seseorang, hubungi Talian 1799 untuk perbualan sulit.',
  'report.another': 'Hantar laporan lain',

  'community.title': 'Komuniti',
  'community.pickRoom': 'Sila pilih bilik sembang untuk disertai.',
  'community.enter': 'Masuk bilik sembang',
  'community.exit': 'Keluar bilik sembang',
  'community.youAreIn': 'Anda berada dalam',
  'community.roomSuffix': 'bilik sembang',
  'community.liveSession': 'Sesi sembang langsung',
  'community.etiquette': 'Sila jaga etika sembang asas. Terima kasih.',
  'community.typeMessage': 'Taip mesej…',
  'community.send': 'Hantar',
  'community.you': 'Anda',
  'community.seed.ecom.a':
    'Saya nampak video di YouTube tentang pencuci sayur berkuasa dengan diskaun 60%. Ada sesiapa tahu ia betul?',
  'community.seed.ecom.b': 'Saya pun pernah lihat. Nampaknya ia penipuan…',
  'community.seed.ecom.c':
    'Penjual minta saya PayNow dahulu kemudian blok saya. Jangan bayar sebelum berjumpa.',
  'community.seed.phish.a':
    'Dapat SMS kata akaun bank saya dikunci, dengan pautan. Nampak sah?',
  'community.seed.phish.b':
    'Bank tidak pernah hantar pautan untuk buka akaun. Hapuskan dan hubungi bank terus.',
  'community.seed.job.a':
    'Seorang perekrut Telegram tawar $80/tugasan, hanya perlu bayar deposit kecil dahulu.',
  'community.seed.job.b':
    'Penipuan kerja klasik. Kerja sebenar tidak pernah minta anda bayar dahulu.',
  'community.seed.generic.a':
    'Ada sesiapa mengalami {type} baru-baru ini? Kongsi untuk memberi peringatan.',
  'community.seed.generic.b':
    'Sentiasa berwaspada dan sahkan segalanya. Lapor kepada polis jika anda kehilangan wang.',

  'backend.title': 'Pelayan belakang belum ditetapkan',
  'backend.body':
    'Analisis dan bot sembang memerlukan pelayan OpenAI. Jalankan “npm start” dalam folder backend, kemudian tetapkan “apiBaseUrl” dalam app.json (expo.extra) kepada URL pelayan anda dan muat semula. Lihat docs/SETUP.md.',

  'common.cancel': 'Batal',
  'common.ok': 'OK',
  'common.home': 'Utama',
  'common.wordsLeft': 'perkataan berbaki',
};

const ta: Dict = {
  'app.name': 'ScamNoMore',

  'tab.home': 'முகப்பு',
  'tab.search': 'தேடல்',
  'tab.report': 'புகார்',
  'tab.community': 'சமூகம்',

  'chatbot.title': 'அரட்டை பாட்',
  'chatbot.greeting':
    'வணக்கம்! நான் ScamNoMore உதவியாளர். மோசடிகள் பற்றி எதையும் கேளுங்கள், அல்லது உங்களுக்கு வந்த செய்தி／அழைப்பை விவரியுங்கள் — எச்சரிக்கை அறிகுறிகளை கண்டறிய உதவுவேன்.',
  'chatbot.placeholder': 'மோசடி பற்றி கேளுங்கள்…',
  'chatbot.send': 'அனுப்பு',
  'chatbot.askByVoice': 'குரலில் கேளுங்கள்',
  'chatbot.recording': 'பதிவு செய்கிறது… நிறுத்த மீண்டும் தட்டவும்',
  'chatbot.noSpeech': 'பேச்சு கண்டறியப்படவில்லை. மீண்டும் முயற்சிக்கவும், அல்லது கேள்வியைத் தட்டச்சு செய்யவும்.',
  'chatbot.typing': 'உதவியாளர் தட்டச்சு செய்கிறார்…',
  'chatbot.error': 'பதிலளிப்பதில் சிக்கல் ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.',

  'home.prompt': 'பகுப்பாய்வு செய்ய வேண்டியதைத் தேர்ந்தெடுக்கவும்:',
  'home.text.group': 'உரை (எ.கா. செய்தி, மின்னஞ்சல், விளம்பரம்)',
  'home.takePicture': 'படம் எடு',
  'home.uploadImage': 'படத்தை பதிவேற்று',
  'home.voice.group': 'குரல் (தொலைபேசி அழைப்பு, சொந்த விவரிப்பு)',
  'home.uploadAudio': 'ஆடியோ பதிவேற்று',
  'home.sayWhat': 'நடந்ததை சொல்',
  'home.video.group': 'வீடியோ',
  'home.uploadVideo': 'வீடியோ பதிவேற்று',
  'home.cautionTitle': 'ரகசியத் தகவல்களைப் பங்கிடாதீர்கள்',
  'home.caution':
    'OTP, உங்கள் NRIC எண், கடவுச்சொற்கள், Singpass விவரங்கள் அல்லது முழு அட்டை எண்களை யாருடனும் பங்கிட வேண்டாம் — இங்கு நீங்கள் பதிவேற்றும் திரைப்பிடிப்புகள், பதிவுகள் மற்றும் வீடியோக்களிலும் சேர்த்து. உண்மையான வங்கிகளும் அரசு நிறுவனங்களும் இவற்றை ஒருபோதும் கேட்க மாட்டார்கள்.',

  'analyze.startAnalyzing': 'பகுப்பாய்வைத் தொடங்கு',
  'analyze.reanalyze': 'திருத்திய உரையை மீண்டும் பகுப்பாய்வு செய்',
  'analyze.startRecording': 'குரல் பதிவைத் தொடங்கு',
  'analyze.stopRecording': 'பதிவை நிறுத்து',
  'analyze.transcribed': 'எழுத்துவடிவ உரை (திருத்தலாம்):',
  'analyze.transcribing': 'எழுத்துவடிவமாக்குகிறது…',
  'analyze.result': 'பகுப்பாய்வு முடிவு',
  'analyze.probability': 'மோசடி நிகழ்தகவு',
  'analyze.imageLimits': 'PNG, JPG, WEBP அல்லது GIF · அதிகபட்சம் {size} MB',
  'analyze.audioLimits': 'MP3, M4A, WAV அல்லது WEBM · அதிகபட்சம் {size} MB',
  'analyze.videoLimits': 'MP4, MOV அல்லது WEBM · அதிகபட்சம் {size} MB',
  'analyze.translating': 'முடிவை மொழிபெயர்க்கிறது…',
  'analyze.why': 'காரணம்',
  'analyze.whatToDo': 'என்ன செய்ய வேண்டும்',
  'analyze.likelyCategory': 'சாத்தியமான வகை',
  'analyze.selectImage': 'சந்தேகத்திற்குரிய மின்னஞ்சல் / செய்தியின் படத்தைத் தேர்ந்தெடுக்கவும்.',
  'analyze.selected': 'தேர்ந்தெடுக்கப்பட்டது: {name}',
  'analyze.noImage': 'படம் தேர்ந்தெடுக்கப்படவில்லை அல்லது அனுமதி மறுக்கப்பட்டது.',
  'analyze.noAudio': 'கோப்பு தேர்ந்தெடுக்கப்படவில்லை அல்லது அனுமதி மறுக்கப்பட்டது.',
  'analyze.noVideo': 'வீடியோ தேர்ந்தெடுக்கப்படவில்லை அல்லது அனுமதி மறுக்கப்பட்டது.',
  'analyze.micDenied': 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது.',
  'analyze.micError': 'மைக்ரோஃபோனை அணுக முடியவில்லை.',
  'analyze.failed': 'பகுப்பாய்வு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
  'analyze.transcribeFailed': 'எழுத்துவடிவமாக்கம் தோல்வியடைந்தது.',
  'analyze.orTypeBelow': 'நடந்ததை கீழே தட்டச்சு செய்யவும் செய்யலாம்.',
  'analyze.noSpeech.reason':
    'ஆடியோவில் பேச்சு கண்டறியப்படவில்லை, எனவே பகுப்பாய்வு செய்ய எதுவும் இல்லை.',
  'analyze.noSpeech.video':
    'இந்தச் சோதனை வீடியோவின் பேச்சு ஒலியைப் படிக்கிறது. ஒலியற்ற வீடியோவை இந்த வழியில் மதிப்பிட முடியாது.',
  'analyze.noSpeech.voice':
    'இந்தப் பதிவு ஒலியற்றதாக அல்லது மிகவும் மெதுவாக இருப்பதால் எழுத்துவடிவமாக்க முடியவில்லை.',
  'analyze.noSpeech.adviceVideo':
    'பேச்சு உள்ள பகுதியை முயற்சிக்கவும், அல்லது வீடியோவை ஸ்கிரீன்ஷாட் எடுத்து படச் சோதனையைப் பயன்படுத்தவும். ஏதேனும் சந்தேகம் இருந்தால் 1799 என்ற எண்ணை அழைக்கவும்.',
  'analyze.noSpeech.adviceVoice':
    'மீண்டும் தெளிவாகப் பேசி பதிவு செய்யவும், அல்லது நடந்ததை தட்டச்சு செய்யவும். சந்தேகம் இருந்தால் 1799 என்ற எண்ணை அழைக்கவும்.',

  'risk.safe': 'மிகக் குறைந்த ஆபத்து',
  'risk.low': 'குறைந்த ஆபத்து',
  'risk.medium': 'மோசடியாக இருக்கலாம்',
  'risk.high': 'மோசடியாக இருக்க வாய்ப்பு அதிகம்',
  'risk.critical': 'கிட்டத்தட்ட உறுதியாக மோசடி',

  'search.title': 'தேடல்',
  'search.period': 'கால அளவு',
  'search.from': 'முதல் (YYYY-MM-DD)',
  'search.to': 'வரை (YYYY-MM-DD)',
  'search.keywords': 'முக்கிய சொற்கள் (விரும்பினால்)',
  'search.keywordsPlaceholder': 'எ.கா. PayNow, Carousell, OTP',
  'search.verifiedOnly': 'சரிபார்க்கப்பட்டவை மட்டும்',
  'search.go': 'தேடல் புள்ளிவிவரம்',
  'search.results': 'முடிவுகள்',
  'search.byTown': 'நகரப் பகுதி வாரியான புள்ளிவிவரம்',
  'search.topTypes': 'முக்கிய மோசடி வகைகள்',
  'search.matchingCases': 'பொருந்தும் வழக்குகள்',
  'search.casesFound': '{count} வழக்குகள் கண்டறியப்பட்டன',
  'search.showingFirst':
    '{total} இல் முதல் {shown} காட்டப்படுகிறது. தேடலைச் சுருக்கவும்.',
  'search.setFilters': 'வடிகட்டிகளை அமைத்து “{action}” என்பதை அழுத்தவும்.',
  'search.noResults': 'பொருந்தும் வழக்குகள் இல்லை. தேடலை விரிவாக்கவும்.',

  'report.title': 'சம்பவத்தைப் புகாரளி',
  'report.date': 'சம்பவ தேதி',
  'report.datePlaceholder': 'YYYY-MM-DD',
  'report.description': 'சம்பவ விவரம் (அதிகபட்சம் 200 சொற்கள்)',
  'report.descriptionPlaceholder':
    'நடந்ததை விவரிக்கவும் (தொகை, தளம், தொடர்பு போன்ற முக்கிய தகவல்)…',
  'report.town': 'நகரப் பகுதி',
  'report.scamType': 'மோசடி வகை',
  'report.submit': 'சம்பவ புகாரை சமர்ப்பி',
  'report.selectTown': 'நகரப் பகுதியைத் தேர்ந்தெடுக்கவும்',
  'report.selectType': 'மோசடி வகையைத் தேர்ந்தெடுக்கவும்',
  'report.totalCases': 'தரவுத்தளத்தில் உள்ள மொத்த வழக்குகள்: {count}',
  'report.thankYou':
    'சம்பவத்தைப் புகாரளித்ததற்கு நன்றி. உங்கள் புகார் மேலும் பலரை மோசடிகளிலிருந்து பாதுகாக்க உதவும்.',
  'report.comfort':
    'நீங்கள் மோசடிக்கு பலியானவராக இருந்தால், அருகிலுள்ள அண்டை காவல் நிலையத்தில் புகார் அளிக்க அறிவுறுத்தப்படுகிறீர்கள். மோசடிக்காரர்கள் பலவிதமான உத்திகளைப் பயன்படுத்துகிறார்கள். ஏமாந்ததற்கு உங்களை நீங்களே குற்றம் சாட்ட வேண்டாம். யாருடனாவது பேச வேண்டும் என்றால், ரகசியமான உரையாடலுக்கு 1799 உதவி எண்ணை அழைக்கவும்.',
  'report.another': 'மற்றொரு புகாரை சமர்ப்பி',

  'community.title': 'சமூகம்',
  'community.pickRoom': 'சேர வேண்டிய அரட்டை அறையைத் தேர்ந்தெடுக்கவும்.',
  'community.enter': 'அறையில் நுழை',
  'community.exit': 'அறையிலிருந்து வெளியேறு',
  'community.youAreIn': 'நீங்கள் இருக்கும் இடம்',
  'community.roomSuffix': 'அரட்டை அறை',
  'community.liveSession': 'நேரடி அரட்டை அமர்வு',
  'community.etiquette': 'அடிப்படை அரட்டை பண்பை கடைப்பிடிக்கவும். நன்றி.',
  'community.typeMessage': 'செய்தியை தட்டச்சு செய்யவும்…',
  'community.send': 'அனுப்பு',
  'community.you': 'நீங்கள்',
  'community.seed.ecom.a':
    'YouTube இல் 60% தள்ளுபடியில் விற்கப்படும் சக்திவாய்ந்த காய்கறி சுத்திகரிப்பு கருவி பற்றிய வீடியோவைப் பார்த்தேன். இது உண்மையா என்று யாருக்காவது தெரியுமா?',
  'community.seed.ecom.b': 'நானும் இதைப் பார்த்தேன். இது மோசடி என்று தெரிகிறது…',
  'community.seed.ecom.c':
    'விற்பனையாளர் முதலில் PayNow செய்யச் சொன்னார், பிறகு என்னைத் தடுத்துவிட்டார். சந்திப்பதற்கு முன் பணம் செலுத்த வேண்டாம்.',
  'community.seed.phish.a':
    'எனது வங்கிக் கணக்கு முடக்கப்பட்டதாக இணைப்புடன் SMS வந்தது. உண்மையானது போல் தெரிகிறதா?',
  'community.seed.phish.b':
    'கணக்கைத் திறக்க வங்கிகள் ஒருபோதும் இணைப்பு அனுப்பாது. அதை நீக்கி வங்கியை நேரடியாக அழைக்கவும்.',
  'community.seed.job.a':
    'Telegram ஆட்சேர்ப்பாளர் ஒரு பணிக்கு $80 தருவதாகச் சொன்னார், முதலில் சிறிய முன்பணம் செலுத்த வேண்டும்.',
  'community.seed.job.b':
    'வழக்கமான வேலை மோசடி. உண்மையான வேலைகள் உங்களை முன்பணம் கேட்காது.',
  'community.seed.generic.a':
    'சமீபத்தில் யாருக்காவது {type} ஏற்பட்டதா? மற்றவர்களை எச்சரிக்க பங்கிடுங்கள்.',
  'community.seed.generic.b':
    'விழிப்புடன் இருங்கள், எல்லாவற்றையும் சரிபார்க்கவும். பணம் இழந்தால் காவல்துறையில் புகார் அளிக்கவும்.',

  'backend.title': 'பின்தளம் அமைக்கப்படவில்லை',
  'backend.body':
    'பகுப்பாய்வு மற்றும் அரட்டை பாட்டுக்கு OpenAI பின்தளம் தேவை. backend கோப்புறையில் “npm start” இயக்கி, பின்னர் app.json (expo.extra) இல் “apiBaseUrl” ஐ உங்கள் சேவையக URL ஆக அமைத்து மீண்டும் ஏற்றவும். docs/SETUP.md ஐப் பார்க்கவும்.',

  'common.cancel': 'ரத்து',
  'common.ok': 'சரி',
  'common.home': 'முகப்பு',
  'common.wordsLeft': 'சொற்கள் மீதம்',
};

const DICTS: Record<Lang, Dict> = { en, zh, ms, ta };

/** Values that can be substituted into a translated string. */
export type TranslationParams = Record<string, string | number>;

/** Replace `{placeholder}` tokens in a translated string. */
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

export interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a key, optionally substituting `{placeholder}` values. */
  t: (key: TranslationKey | string, params?: TranslationParams) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('en');
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang,
      t: (key: string, params?: TranslationParams) => {
        const dict = DICTS[lang] as Dict & Record<string, string | undefined>;
        const fallback = en as Dict & Record<string, string | undefined>;
        return interpolate(dict[key] ?? fallback[key] ?? key, params);
      },
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

/** Exposed for tests: the raw dictionaries. */
export const _dicts = DICTS;
