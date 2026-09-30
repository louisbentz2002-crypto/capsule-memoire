function setPlaying(button, playing) {
  if (!button) return;
  button.classList.toggle('is-playing', playing);
  button.setAttribute('aria-pressed', String(playing));
  button.setAttribute('aria-label', playing ? 'Mettre en pause' : 'Lire cet exemple');
}
function mediaError() {
  document.getElementById('mediaStatus').textContent = 'La lecture est indisponible. Réessayez ou vérifiez votre connexion.';
}
const audios = {};
['orig', 'clone'].forEach(id => {
  const audio = document.getElementById('vaudio-' + id);
  const bars = document.getElementById('vbars-' + id);
  const button = document.querySelector('#vc-' + id + ' .cm-play-btn');
  if (!audio || !bars) return;
  audios[id] = audio;
  bars.replaceChildren();
  for (let i = 0; i < 36; i++) {
    const bar = document.createElement('div'); bar.className = 'vbar'; bar.style.height = (18 + (i * 17 % 64)) + '%'; bars.append(bar);
  }
  const format = time => Number.isFinite(time) ? Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0') : '0:00';
  const update = () => {
    const percent = audio.duration ? audio.currentTime / audio.duration * 100 : 0;
    document.getElementById('vprog-' + id).style.width = percent + '%';
    document.getElementById('vcur-' + id).textContent = format(audio.currentTime);
    document.getElementById('vdur-' + id).textContent = format(audio.duration);
    [...bars.children].forEach((bar, i) => bar.classList.toggle('played', i < percent / 100 * 36));
    seek.value = String(percent);
  };
  const seek = document.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '100'; seek.step = '0.1'; seek.value = '0';
  seek.setAttribute('aria-label', id === 'orig' ? 'Position dans l’enregistrement original' : 'Position dans la création vocale');
  seek.style.width = '100%';
  bars.parentElement.append(seek);
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 100 * audio.duration; });
  audio.addEventListener('timeupdate', update); audio.addEventListener('loadedmetadata', update);
  audio.addEventListener('play', () => setPlaying(button, true)); audio.addEventListener('pause', () => setPlaying(button, false));
  audio.addEventListener('ended', () => { audio.currentTime = 0; update(); setPlaying(button, false); });
  audio.addEventListener('error', () => { setPlaying(button, false); mediaError(); });
  setPlaying(button, false);
});
window.voiceToggle = async id => {
  const audio = audios[id]; if (!audio) return;
  if (!audio.paused) { audio.pause(); return; }
  Object.values(audios).forEach(other => { if (other !== audio) other.pause(); });
  try { await audio.play(); } catch { mediaError(); }
};
window.voiceSeek = (id, event) => {
  const audio = audios[id]; if (!audio || !Number.isFinite(audio.duration)) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  audio.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * audio.duration;
};
[0, 1].forEach(i => {
  const video = document.getElementById('pvid-' + i); if (!video) return;
  const update = () => {
    setPlaying(document.getElementById('pbtn-' + i), !video.paused);
    document.getElementById('pthumb-' + i).style.display = video.paused ? 'flex' : 'none';
  };
  ['play', 'pause', 'ended'].forEach(name => video.addEventListener(name, update));
  video.addEventListener('error', mediaError); update();
});
window.portraitToggle = async i => {
  const video = document.getElementById('pvid-' + i); if (!video) return;
  if (!video.paused) { video.pause(); return; }
  [0, 1].forEach(other => { if (other !== i) document.getElementById('pvid-' + other)?.pause(); });
  if (!video.getAttribute('src')) { video.src = `assets/videos/portrait-parle-${i + 1}.mp4`; video.load(); }
  try { await video.play(); } catch { mediaError(); }
};
document.querySelectorAll('[data-voice]').forEach(button => button.addEventListener('click', () => window.voiceToggle(button.dataset.voice)));
document.querySelectorAll('[data-voice-seek]').forEach(bar => bar.addEventListener('click', event => window.voiceSeek(bar.dataset.voiceSeek, event)));
document.querySelectorAll('[data-portrait]').forEach(button => button.addEventListener('click', () => window.portraitToggle(Number(button.dataset.portrait))));
