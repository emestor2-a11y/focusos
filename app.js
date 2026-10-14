(() => {
  const SUBJECTS = ["Математика", "Русский язык", "Информатика", "Физика"];
  const STORAGE_KEY = "focusos-ege-sessions-v1";
  const $ = id => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();

  let sessions = loadSessions();
  let startedAt = null;
  let ticker = null;

  function loadSessions() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }
  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function fmtTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return [h,m,s].map(n => String(n).padStart(2,"0")).join(":");
  }
  function fmtDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}м`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}ч ${m}м` : `${h}ч`;
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("ru-RU", {day:"numeric", month:"short"});
  }
  function total(list) { return list.reduce((sum, s) => sum + s.seconds, 0); }
  function todaySessions() { const key = dateKey(new Date()); return sessions.filter(s => dateKey(s.endedAt) === key); }
  function weekSessions() {
    const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate()-6);
    return sessions.filter(s => new Date(s.endedAt) >= cutoff);
  }
  function render() {
    $("today-total").textContent = fmtDuration(total(todaySessions()));
    $("week-total").textContent = fmtDuration(total(weekSessions()));
    $("all-total").textContent = fmtDuration(total(sessions));
    $("session-count").textContent = sessions.length;
    renderSubjectStats(); renderDayStats(); renderHistory(); renderLastSession();
    $("today-label").textContent = new Date().toLocaleDateString("ru-RU", {day:"numeric",month:"short"});
  }
  function renderSubjectStats() {
    const totals = Object.fromEntries(SUBJECTS.map(name => [name, total(sessions.filter(s => s.subject === name))]));
    const max = Math.max(1, ...Object.values(totals));
    $("subject-stats").innerHTML = SUBJECTS.map(name => `
      <div class="bar-item"><span class="bar-name">${name}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${totals[name]/max*100}%"></div></div>
      <span class="bar-value">${fmtDuration(totals[name])}</span></div>`).join("");
  }
  function renderDayStats() {
    const days = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      const key = dateKey(d), secs = total(sessions.filter(s => dateKey(s.endedAt) === key));
      days.push({name:d.toLocaleDateString("ru-RU",{weekday:"short"}).replace(".",""), mins:Math.floor(secs/60)});
    }
    const max = Math.max(1, ...days.map(d => d.mins));
    $("day-stats").innerHTML = days.map(d => `<div class="day-col"><span class="day-min">${d.mins || ""}</span><div class="day-bar-wrap"><div class="day-bar" style="height:${Math.max(d.mins ? 5 : 2, d.mins/max*78)}px"></div></div><span class="day-name">${d.name}</span></div>`).join("");
  }
  function renderHistory() {
    $("history-list").innerHTML = sessions.slice().reverse().slice(0,30).map(s => `
      <div class="history-row"><div><div class="history-subject"><span class="subject-dot"></span><span class="session-name">${escapeHtml(s.subject)}</span></div><div class="session-date">${fmtDate(s.endedAt)} · ${new Date(s.endedAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></div><span class="session-duration">${fmtDuration(s.seconds)}</span></div>`).join("");
  }
  function renderLastSession() {
    const s = sessions[sessions.length-1];
    $("last-session").innerHTML = s
      ? `<div class="session-row"><div><div class="session-name">${escapeHtml(s.subject)}</div><div class="session-date">${fmtDate(s.endedAt)}</div></div><span class="session-duration">${fmtDuration(s.seconds)}</span></div>`
      : "Пока нет сессий. Первая начинается с кнопки выше.";
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function updateClock() {
    const seconds = startedAt ? Math.floor((Date.now()-startedAt)/1000) : 0;
    $("timer-display").textContent = fmtTime(seconds);
  }
  function start() {
    if (startedAt) return;
    startedAt = Date.now();
    $("subject-select").disabled = true;
    $("start-btn").disabled = true;
    $("finish-btn").disabled = false;
    $("timer-status").textContent = "Идёт занятие";
    $("timer-caption").textContent = "Продолжай в том же духе";
    $("live-dot").classList.add("running");
    $("subject-hint").textContent = "Предмет закреплён на время сессии";
    ticker = setInterval(updateClock, 250);
    updateClock();
    tg?.HapticFeedback?.impactOccurred("light");
  }
  function finish() {
    if (!startedAt) return;
    const seconds = Math.floor((Date.now()-startedAt)/1000);
    const endedAt = new Date().toISOString();
    if (seconds > 0) sessions.push({subject:$("subject-select").value, seconds, startedAt:new Date(startedAt).toISOString(), endedAt});
    persist();
    clearInterval(ticker); ticker = null; startedAt = null;
    $("timer-display").textContent = "00:00:00";
    $("subject-select").disabled = false;
    $("start-btn").disabled = false;
    $("finish-btn").disabled = true;
    $("timer-status").textContent = "Сессия завершена";
    $("timer-caption").textContent = "Хорошая работа";
    $("live-dot").classList.remove("running");
    $("subject-hint").textContent = "Выбери предмет и начинай сессию";
    render();
    tg?.HapticFeedback?.notificationOccurred("success");
  }

  $("start-btn").addEventListener("click", start);
  $("finish-btn").addEventListener("click", finish);
  $("subject-select").addEventListener("change", () => {
    $("subject-hint").textContent = `Сейчас выбран предмет: ${$("subject-select").value}`;
  });
  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("selected", b === button));
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === button.dataset.page));
    window.scrollTo({top:0, behavior:"smooth"});
  }));
  $("clear-btn").addEventListener("click", () => {
    if (!sessions.length) return;
    if (confirm("Удалить всю историю занятий на этом устройстве?")) {
      sessions = []; persist(); render();
    }
  });
  render();
})();