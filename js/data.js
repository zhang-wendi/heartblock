/* ============================================================
 * HEARTBLOCK — data.js
 * 角色档案 / 多语言 / 形状库 / 经济参数
 * ============================================================ */

'use strict';

/* ---------- 角色档案（20 人，顺序解锁） ---------- */
const GIRLS = [
  { id: 1,  name: 'Priya Sharma',   nameHi: 'प्रिया शर्मा',   age: 26, cost: 5,  en: 'Loves early mornings and old ghazals.',      hi: 'सुबह की चाय और पुराने ग़ज़ल पसंद हैं।' },
  { id: 2,  name: 'Ananya Iyer',    nameHi: 'अनन्या अय्यर',    age: 24, cost: 5,  en: 'Bharatanatyam dancer on weekends.',          hi: 'वीकेंड पर भरतनाट्यम करती हूं।' },
  { id: 3,  name: 'Kavya Reddy',   nameHi: 'काव्या रेड्डी',   age: 27, cost: 8,  en: 'Building my own design studio.',             hi: 'अपना डिज़ाइन स्टूडियो बना रही हूं।' },
  { id: 4,  name: 'Neha Gupta',    nameHi: 'नेहा गुप्ता',     age: 23, cost: 8,  en: 'Flower power over everything.',              hi: 'फूलों से भरी दुनिया मेरी पसंद है।' },
  { id: 5,  name: 'Pooja Nair',    nameHi: 'पूजा नायर',       age: 25, cost: 8,  en: 'Coffee, books and rainy evenings.',           hi: 'कॉफ़ी, किताबें और बारिश की शाम।' },
  { id: 6,  name: 'Riya Malhotra', nameHi: 'रिया मल्होत्रा',   age: 24, cost: 10, en: 'Will judge you by your book choice.',        hi: 'किताब से इंसान पहचान लेती हूं।' },
  { id: 7,  name: 'Aisha Khan',    nameHi: 'आयशा खान',        age: 26, cost: 10, en: 'Stargazing every clear night.',              hi: 'हर साफ़ रात तारे गिनती हूं।' },
  { id: 8,  name: 'Meera Joshi',   nameHi: 'मीरा जोशी',       age: 28, cost: 12, en: 'Art curator and chai addict.',               hi: 'आर्ट क्यूरेटर और चाय की दीवानी।' },
  { id: 9,  name: 'Anjali Rao',    nameHi: 'अंजलि राव',       age: 22, cost: 12, en: 'Final year, infinite dreams.',                hi: 'अंतिम वर्ष, अनगिनत सपने।' },
  { id: 10, name: 'Diya Mehta',    nameHi: 'दीया मेहता',      age: 25, cost: 12, en: 'Food is my love language.',                  hi: 'खाना बनाना मेरी भाषा है।' },
  { id: 11, name: 'Ishita Verma',  nameHi: 'इशिता वर्मा',      age: 27, cost: 10, en: 'Yoga at sunrise, every day.',                 hi: 'हर दिन सूर्योदय पर योग।' },
  { id: 12, name: 'Naina Kapoor',  nameHi: 'नैना कपूर',       age: 23, cost: 10, en: 'Bargaining is my superpower.',                hi: 'मोलभाव करना मेरी कला है।' },
  { id: 13, name: 'Tara Singh',   nameHi: 'तारा सिंह',        age: 26, cost: 15, en: 'Pilot by day, dreamer by night.',             hi: 'दिन में पायलट, रात में सपने।' },
  { id: 14, name: 'Zara Ali',     nameHi: 'ज़ारा अली',        age: 24, cost: 15, en: 'Jazz nights and velvet dresses.',             hi: 'जैज़ नाइट्स और वेलवेट ड्रेस।' },
  { id: 15, name: 'Kiara Das',    nameHi: 'कियारा दास',       age: 25, cost: 15, en: 'Writing poetry no one reads.',               hi: 'ऐसी कविताएं जो किसी ने नहीं पढ़ीं।' },
  { id: 16, name: 'Aditi Chauhan', nameHi: 'अदिति चौहान',     age: 28, cost: 18, en: 'Twice bridesmaid, never the bride.',          hi: 'दो बार ब्राइड्समेड, दुल्हन अभी नहीं।' },
  { id: 17, name: 'Sana Sheikh',  nameHi: 'साना शेख',        age: 23, cost: 18, en: 'Henna stains and happy hearts.',             hi: 'मेहंदी और खुशियां।' },
  { id: 18, name: 'Roshni Patel', nameHi: 'रौशनी पटेल',      age: 26, cost: 18, en: 'Event planner with a glitter obsession.',      hi: 'इवेंट प्लानर, ग्लिटर पसंद है।' },
  { id: 19, name: 'Simran Kaur',  nameHi: 'सिमरन कौर',        age: 24, cost: 18, en: 'Waiting for my filmy moment.',                hi: 'अपनी फ़िल्मी मोमेंट का इंतज़ार।' },
  { id: 20, name: 'Meghna Bose',  nameHi: 'मेघना बोस',       age: 27, cost: 18, en: 'Dhak beats run in my veins.',                 hi: 'ढाक की थाप मेरी धड़कन है।' },
];

const girlImg = id => `assets/girls/girl_${String(id).padStart(3, '0')}.webp`;
const girlThumb = id => `assets/girls/girl_${String(id).padStart(3, '0')}_t.webp`;

/* ---------- UI 多语言 ---------- */
const I18N = {
  en: {
    tagline: 'Match blocks. Clear lines. Unlock her world.',
    tabPlay: 'Play', tabFeed: 'Feed', tabGallery: 'Gallery',
    score: 'SCORE', best: 'BEST', sessionHearts: 'HEARTS WON',
    gameOver: 'Game Over', playAgain: 'Play Again',
    finalScore: 'Score', heartsEarned: 'Hearts earned',
    newBest: 'New best!',
    combo: 'COMBO',
    hintTitle: 'How to play',
    hintBody: 'Drag a block onto the board. Fill a full row or column to clear it. No gravity — pure strategy.',
    hintGo: 'Got it',
    feedNext: 'NEXT UP', feedLocked: 'Locked', feedDone: 'All 20 unlocked — more girls coming soon 🌸',
    unlock: 'Unlock', unlockFor: 'Unlock for', needMore: 'Not enough hearts — play to earn more!',
    heartsBalance: 'Your hearts', confirm: 'Confirm', cancel: 'Cancel',
    unlockedTitle: 'Unlocked!', galleryEmpty: 'No photos yet. Unlock your first girl in the Feed!',
    galleryCount: 'photo(s) unlocked', tapToView: 'Tap to view',
    settings: 'Settings', language: 'Language', sound: 'Sound', reset: 'Reset progress',
    resetConfirm: 'Delete ALL progress? This cannot be undone.', yes: 'Yes, reset', no: 'Keep it',
    credits: 'HEARTBLOCK v0.1 · MVP · Art generated by AI',
    comingSoon: 'coming soon',
  },
  hi: {
    tagline: 'ब्लॉक जोड़ें। लाइन मिटाएं। उनकी दुनिया खोलें।',
    tabPlay: 'खेलें', tabFeed: 'फ़ीड', tabGallery: 'गैलरी',
    score: 'स्कोर', best: 'सर्वश्रेष्ठ', sessionHearts: 'जीते दिल',
    gameOver: 'खेल समाप्त', playAgain: 'फिर से खेलें',
    finalScore: 'स्कोर', heartsEarned: 'कमाए दिल',
    newBest: 'नया रिकॉर्ड!',
    combo: 'कॉम्बो',
    hintTitle: 'कैसे खेलें',
    hintBody: 'ब्लॉक को बोर्ड पर खींचें। कोई पूरी पंक्ति या कॉलम भरते ही वह मिट जाती है। कोई गुरुत्व नहीं — सिर्फ़ रणनीति।',
    hintGo: 'समझ गई',
    feedNext: 'अगली', feedLocked: 'लॉक', feedDone: 'सभी 20 अनलॉक — और लड़कियां जल्द आ रही हैं 🌸',
    unlock: 'अनलॉक करें', unlockFor: 'अनलॉक करें', needMore: 'दिल कम हैं — और कमाने के लिए खेलें!',
    heartsBalance: 'आपके दिल', confirm: 'पक्का', cancel: 'रद्द करें',
    unlockedTitle: 'अनलॉक हो गया!', galleryEmpty: 'अभी कोई फ़ोटो नहीं। पहली लड़की को फ़ीड में अनलॉक करें!',
    galleryCount: 'फ़ोटो अनलॉक', tapToView: 'देखने के लिए टैप करें',
    settings: 'सेटिंग्स', language: 'भाषा', sound: 'ध्वनि', reset: 'प्रगति रीसेट',
    resetConfirm: 'पूरी प्रगति मिटा दें? यह वापस नहीं आएगी।', yes: 'हाँ, रीसेट', no: 'रखना',
    credits: 'HEARTBLOCK v0.1 · MVP · चित्र AI द्वारा बनाए',
    comingSoon: 'जल्द आ रहा है',
  },
};

/* ---------- 方块形状库（cells: [x,y] 相对坐标） ---------- */
const SHAPES = [
  { c: [[0, 0]], w: 14 },
  { c: [[0, 0], [1, 0]], w: 10 }, { c: [[0, 0], [0, 1]], w: 10 },
  { c: [[0, 0], [1, 0], [2, 0]], w: 8 }, { c: [[0, 0], [0, 1], [0, 2]], w: 8 },
  { c: [[0, 0], [1, 0], [2, 0], [3, 0]], w: 5 }, { c: [[0, 0], [0, 1], [0, 2], [0, 3]], w: 5 },
  { c: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], w: 2 }, { c: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], w: 2 },
  { c: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 8 },                              // 2x2
  { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], w: 2 }, // 3x3
  { c: [[0, 0], [1, 0], [0, 1]], w: 7 }, { c: [[0, 0], [1, 0], [1, 1]], w: 7 },   // L3 四向
  { c: [[0, 0], [0, 1], [1, 1]], w: 7 }, { c: [[1, 0], [0, 1], [1, 1]], w: 7 },
  { c: [[0, 0], [0, 1], [0, 2], [1, 2]], w: 3 }, { c: [[1, 0], [1, 1], [1, 2], [0, 2]], w: 3 }, // L5 四向
  { c: [[0, 0], [0, 1], [0, 2], [1, 0]], w: 3 }, { c: [[0, 0], [1, 0], [1, 1], [1, 2]], w: 3 },
];

/* ---------- 宝石配色 ---------- */
const BLOCK_COLORS = ['#ff5c8a', '#ffb648', '#35d0ba', '#a78bfa', '#ff7a59'];

/* ---------- 经济参数（调参入口） ---------- */
const ECON = {
  boardSize: 8,
  clearBase: 10,      // 每消除行/列基础分
  crossBonus: 50,     // 十字消除奖励
  comboCap: 3,        // 连击倍数上限
  heartPer: 500,      // 每 N 分 = 1 心
  starterHearts: 5,   // 初始心数（够解锁第一位）
};
