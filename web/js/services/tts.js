export const TTS = {
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.8;
    const zh = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
    if (zh) u.voice = zh;
    speechSynthesis.speak(u);
  }
};

if ('speechSynthesis' in window) speechSynthesis.getVoices();
