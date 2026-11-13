(function () {
  'use strict';
  var D = window.DW, info = D.info;
  var DAYS = ['월', '화', '수', '목', '금', '토'];
  var KIND = {
    '5세': { cls: 'five', name: '5세 특별반', short: '5세반' },
    '유아': { cls: 'baby', name: '유아 정규반', short: '유아반' },
    '초등': { cls: 'elem', name: '초등 정규반', short: '초등반' },
    '신규': { cls: 'new', name: '신규반', short: '신규반' }
  };
  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 설명 문장이 끝날 때마다 줄을 나눠 읽기 쉽게 (…요. / …다. / …! / …? 뒤에 줄바꿈)
  var SENT_SEL = '.sec-sub, .why p, .prog > p, .extra span, .rule > p, .ad-intro p, .ti p, .sp-desc, .consult-side .sub, .notice span, .qa p, .tt-caution, .tt-wait, .care-pill, .kid-notice ul + p, .ad-tag';
  function splitSentences(el) {
    el.innerHTML = el.innerHTML.replace(/<br class="sb">/g, ' ').replace(/([^\s\d.][.!?])(<\/b>)?\s+(?=[가-힣A-Za-z0-9(<])/g, '$1$2<br class="sb">');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(s) { var p = s.split('-'); return +p[1] + '월 ' + +p[2] + '일'; }
  function won(n) { return n.toLocaleString('ko-KR'); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // 남은 자리 → 상태
  // wait: 대기 인원 — 대기자가 남은 자리를 먼저 채운다고 보고 계산
  // 남은 자리 = 정원 − 등록 인원 (대기 인원은 마감된 반에 따로 표시)
  function seat(cap, cur, wait) {
    wait = wait || 0;
    var left = cap - cur;
    if (left <= 0) return { k: 'full', left: 0, wait: wait, txt: '마감 · 대기 접수' };
    if (left === 1) return { k: 'few', left: 1, txt: '1자리 남음' };
    return { k: 'open', left: left, txt: left + '자리 남음' };
  }
  var form = $('consultForm'), msg = $('formMsg'), who = 'kids', wishes = [];

  /* ---------- 방문 통계: GA4 · Clarity · 네이버 애널리틱스 (data.js의 analytics에 ID가 있을 때만) ---------- */
  var AN = D.analytics || {};
  // 자동 프로그램(검색엔진 · 미리보기 · 테스트 브라우저)은 통계에서 제외 — 실제 손님 숫자만 남김
  var IS_BOT = (function () {
    try {
      var ua = navigator.userAgent || '';
      return navigator.webdriver === true ||
        /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|scrape|python|curl|wget|phantom|puppeteer|playwright|selenium|yeti|daumoa|facebookexternalhit|kakaotalk-scrap/i.test(ua) ||
        !navigator.languages || navigator.languages.length === 0;
    } catch (e) { return false; }
  })();
  if (IS_BOT) AN = {};
  function loadScript(src, onload) { var s = document.createElement('script'); s.async = true; s.src = src; if (onload) s.onload = onload; document.head.appendChild(s); }
  if (AN.ga4) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', AN.ga4);
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + AN.ga4);
  }
  if (AN.clarity) {
    (function (c, l, a, r, i) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; loadScript('https://www.clarity.ms/tag/' + i); })(window, document, 'clarity', 'script', AN.clarity);
  }
  if (AN.naverWa) {
    loadScript('https://wcs.pstatic.net/wcslog.js', function () { window.wcs_add = window.wcs_add || {}; wcs_add.wa = AN.naverWa; if (window.wcs) wcs_do(); });
  }
  // 주요 행동 기록 (GA4 이벤트 이름)
  function track(name, params) { try { if (window.gtag && AN.ga4) gtag('event', name, params || {}); } catch (e) { /* 통계 실패는 무시 */ } }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a, button'); if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) track('call_click', { place: a.id || a.className });
    else if (href.indexOf('sms:') === 0) track('sms_click');
    else if (/pf\.kakao/.test(href)) track('kakao_click', { place: a.id || a.className });
    else if (/instagram/.test(href)) track('instagram_click');
    else if (/blog\.naver/.test(href)) track('blog_click');
    else if (a.id === 'naverBtn') track('naver_booking_click');
    else if (a.id === 'mapGo') track('map_click');
    else if (a.hasAttribute('data-see')) track('see_timetable_click');
    else if (a.closest('.form-tabs')) track('consult_tab', { tab: a.dataset.who });
    else if (a.closest('#ttMode')) track('timetable_tab', { tab: a.dataset.mode });
    else if (a.classList.contains('cls')) track('timetable_class_click');
    else if (a.closest('#pTerm')) track('price_term', { term: a.dataset.m });
  });

  function badge(s) { return '<span class="badge ' + s.k + '"><i class="seat ' + s.k + '"></i>' + s.txt + '</span>'; }

  /* ---------- 기본 정보 채우기 ---------- */
  var telHref = 'tel:' + info.tel.replace(/[^0-9]/g, '');
  ['telBtn', 'dockTel', 'iTel'].forEach(function (id) { $(id).href = telHref; });
  $('iTel').textContent = info.tel;
  $('iAddr').textContent = info.address;
  $('iPark').textContent = info.parking;
  $('iHours').innerHTML = info.hours.map(function (h) {
    return '<li><b>' + esc(h[0]) + '</b> ' + esc(h[1]) + (h[2] ? '<small>' + esc(h[2]) + '</small>' : '') + '</li>';
  }).join('');
  $('fInfo').textContent = info.name + ' · ' + info.address + ' · ' + info.tel;
  if (info.kakao) { $('kakaoBtn').href = info.kakao; $('kakaoBtn').hidden = false; }
  if (info.instagram) { $('instaBtn').href = info.instagram; $('instaBtn').hidden = false; }
  [].forEach.call(document.querySelectorAll('[data-tel]'), function (x) { x.href = telHref; });
  [].forEach.call(document.querySelectorAll('[data-kakao]'), function (x) { if (info.kakao) x.href = info.kakao; else x.hidden = true; });
  if (info.instagram) $('iInsta').href = info.instagram; else $('iInsta').hidden = true;
  if (info.blog) $('iBlog').href = info.blog; else $('iBlog').hidden = true;
  if (info.kakao) $('iKakao').href = info.kakao; else $('iKakao').hidden = true;
  $('adultHours').innerHTML = info.adultHours.map(function (h) {
    return '<li><b>' + esc(h[0]) + '</b> ' + h.slice(1).map(esc).join(' · ') + '</li>';
  }).join('');
  var q = encodeURIComponent(info.address.split(',')[0]);
  $('mapFrame').src = 'https://maps.google.com/maps?q=' + q + '&hl=ko&z=17&output=embed';
  $('mapGo').href = info.naverPlace || 'https://map.naver.com/p/search/' + q;
  $('copyAddr').addEventListener('click', function () {
    var b = this;
    try { navigator.clipboard.writeText(info.address).then(function () { b.textContent = '복사됨'; }); } catch (e) { /* 복사 미지원 브라우저 */ }
  });

  /* ---------- 메뉴 ---------- */
  var menuBtn = $('menuBtn'), nav = $('nav');
  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); } });

  /* ---------- 시간표 (수조별 좌/우) ---------- */
  var ROOMS = [1, 2];
  var tt = { f: 'all', open: false, day: DAYS[(new Date().getDay() + 6) % 7] };
  if (!tt.day) tt.day = '월';
  // [요일, 시간, 수조, 반, 단계, 인원, (정원)] → 객체
  var CL = D.classes.map(function (r, i) {
    var k = KIND[r[3]], cap = r[7] || D.cap[r[3]];
    var s = r[3] === '신규' ? { k: 'new', left: cap, txt: D.newMin + '인부터 개설' } : seat(cap, r[5], r[6]);
    return { id: i, day: r[0], time: r[1], room: r[2], kind: r[3], cls: k.cls, name: k.name, short: k.short, level: r[4], s: s };
  });
  if (!D.showWait) { $('lgWait').hidden = true; $('ttWaitNote').hidden = true; }
  $('ttUpdated').textContent = fmtDate(D.updated) + ' 기준 여석';
  var TIMES = CL.map(function (c) { return c.time; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
  var STAMP = { full: '마감', few: '임박', open: '여유', new: '신규' };

  function visible(c) {
    var kindOk = tt.f === 'all' || c.kind === tt.f || c.kind === '신규';
    return kindOk && (!tt.open || (c.s.k !== 'full' && c.s.k !== 'new'));
  }
  function roomName(n) { var r = D.rooms[n]; return r.icon + ' ' + r.name; }
  function clsBtn(c) {
    // 아직 개설 전인 시간: 수업 카드가 아니라 '빈 칸'처럼 보이게
    if (c.s.k === 'new') {
      return '<button type="button" class="cls slot-empty" data-id="' + c.id + '" aria-label="' + esc(D.rooms[c.room].name + ' ' + c.day + '요일 ' + c.time + ', 현재 수업 없음. 5세, 유아 또는 초등 ' + D.newMin + '인 이상 신청 시 개설 가능. 누르면 상담 신청서에 추가') + '">' +
        '<span class="se-none">수업 없음</span><span class="se-plus">＋ 개설 가능</span><span class="se-min">' + D.newMin + '인부터</span></button>';
    }
    var w = D.showWait ? c.s.wait : 0;
    var seatTxt = c.s.k === 'full' ? (w ? '대기 ' + w + '명' : '대기 접수 가능') : c.s.k === 'few' ? '1자리 남음' : c.s.k === 'new' ? c.s.txt : c.s.left + '자리 남음';
    return '<button type="button" class="cls t-' + c.cls + ' st-' + c.s.k + (w >= 3 ? ' wait-many' : w ? ' wait-some' : '') + '" data-id="' + c.id + '" ' +
      'aria-label="' + esc(D.rooms[c.room].name + ' ' + c.day + '요일 ' + c.time + ' ' + c.name + (c.level ? ' ' + c.level : '') + ', ' + (c.s.k === 'full' ? '마감, ' + (w ? '현재 대기 ' + w + '명, ' : '') + '대기 접수 가능' : c.s.k === 'new' ? '신규 개설 가능, ' + c.s.txt : seatTxt) + ', 누르면 상담 신청서에 추가') + '">' +
      '<span class="stamp">' + STAMP[c.s.k] + '</span>' +
      '<span class="cn">' + esc(c.short) + '</span>' +
      (c.level ? '<span class="cl">' + esc(c.level) + '</span>' : '') +
      '<span class="cs">' + seatTxt + '</span></button>';
  }
  function cellFor(list, room, day, t) {
    return list.filter(function (c) { return c.room === room && c.day === day && c.time === t; }).map(clsBtn).join('');
  }
  function renderTT() {
    var list = CL.filter(visible);
    // PC: 수조마다 주간 표, 좌/우 배치
    $('ttPools').innerHTML = ROOMS.map(function (room) {
      var h = '<div class="pool pool-' + room + '"><div class="pool-head"><b>' + roomName(room) + '</b><small>' + D.rooms[room].sub + '</small></div>' +
        '<div class="pool-scroll"><table class="tt-grid"><thead><tr><th></th>' + DAYS.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>';
      TIMES.forEach(function (t) {
        h += '<tr><td class="time">' + t.replace(':00', '') + '<small>시</small></td>' + DAYS.map(function (d) { return '<td>' + cellFor(list, room, d, t) + '</td>'; }).join('') + '</tr>';
      });
      return h + '</tbody></table></div></div>';
    }).join('');
    // 모바일: 요일 탭 + 수조 2열
    $('ttDays').innerHTML = DAYS.map(function (d) {
      var n = list.filter(function (c) { return c.day === d && c.s.k !== 'full' && c.s.k !== 'new'; }).length;
      return '<button type="button" role="tab" aria-selected="' + (d === tt.day) + '" data-d="' + d + '">' + d + '<small>' + (n ? '빈자리 ' + n : '&nbsp;') + '</small></button>';
    }).join('');
    var times = TIMES.filter(function (t) { return list.some(function (c) { return c.day === tt.day && c.time === t; }); });
    $('ttList').innerHTML = times.length
      ? '<table class="tt-day"><thead><tr><th></th>' + ROOMS.map(function (r) { return '<th class="ph-' + r + '">' + roomName(r) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        times.map(function (t) { return '<tr><td class="time">' + t.replace(':00', '') + '<small>시</small></td>' + ROOMS.map(function (r) { return '<td>' + cellFor(list, r, tt.day, t) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'
      : '<p class="tt-empty">조건에 맞는 수업이 없어요. 대기 접수로 원하는 시간을 남겨주세요!</p>';
    markPicked();
  }
  $('ttFilter').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    tt.f = b.dataset.f;
    [].forEach.call(this.children, function (x) { x.setAttribute('aria-pressed', x === b); });
    renderTT();
  });
  $('ttOpenOnly').addEventListener('change', function () { tt.open = this.checked; renderTT(); });
  $('ttDays').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { tt.day = b.dataset.d; renderTT(); } });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.cls'); if (!b) return;
    var c = CL[+b.dataset.id];
    // 이미 담은 수업을 다시 누르면 빼기
    var had = wishes.findIndex(function (w) { return w.cid === c.id; });
    if (had >= 0) { wishes.splice(had, 1); renderWish(); toast('↩️ ' + c.day + ' ' + +c.time.slice(0, 2) + '시 ' + D.rooms[c.room].name + ' 수업을 뺐어요'); return; }
    setWho('kids');
    var g = childGroup();
    if (g && c.kind !== '신규' && !classFits(c.kind, g)) {
      goForm();
      return showErr(g === 'young' ? '만 48개월 미만은 정규반 신청이 어려워요. 개인 레슨으로 신청하시거나 수영장으로 문의해 주세요.'
        : '이 수업은 ' + c.name + '이에요. 입력한 생년월일 기준으로는 ' + GROUP[g].fit + ' 대상이라 신청할 수 없어요.');
    }
    setProg('kids', c.kind === '5세' ? '5세 특별 정규반' : '키즈정규반');
    addWish({ days: [c.day], time: c.time, freq: 1, label: D.rooms[c.room].name + ' ' + (c.s.k === 'new' ? '신규반 개설 희망' : c.name + (c.level ? '(' + c.level + ')' : '')),
      wait: c.s.k === 'full', isNew: c.s.k === 'new', cid: c.id });
    toast('✅ ' + c.day + ' ' + +c.time.slice(0, 2) + '시 ' + D.rooms[c.room].name + ' ' + (c.s.k === 'new' ? '신규반' : c.name) + (c.s.k === 'full' ? ' (대기)' : '') + ' 담았어요', true);
  });
  renderTT();

  /* ---------- 성인 · 개인레슨 시간표 ----------
     레슨 시작 가능 시간(privateHours) 중, 정규반 수업이나 이미 잡힌 레슨(privateBooked)이 없는
     수조 수를 칸마다 보여줌 */
  function freeRooms(day, h) {
    var t = hh(h);
    return ROOMS.filter(function (r) {
      var busyClass = CL.some(function (c) { return c.room === r && c.day === day && c.time === t; });
      var booked = (D.privateBooked[r] || []).indexOf(day + ' ' + h) >= 0;
      return !busyClass && !booked;
    }).length;
  }
  // 시간대 카드: 평일 오전 / 평일 저녁 / 토요일. 빈 시간을 하나하나 늘어놓지 않고,
  // 예약이 찬 시간만 보여주고 찬 비율로 '예약 가능 · 인기 시간대 · 마감 임박'을 표시
  var BANDS = [
    { key: 'am', icon: '🌅', name: '평일 오전', days: ['월', '화', '수', '목', '금'], hours: D.privateHours.weekday.filter(function (h) { return h < 14; }), tag: '출근 전 · 오전 시간에 여유 있게' },
    { key: 'pm', icon: '🌙', name: '평일 저녁', days: ['월', '화', '수', '목', '금'], hours: D.privateHours.weekday.filter(function (h) { return h > 18; }), tag: '퇴근 후 하루 마무리 운동' },
    { key: 'sat', icon: '🗓️', name: '토요일', days: ['토'], hours: D.privateHours.sat, tag: '주말 오전 · 그 외 시간은 강사와 협의', note: '토요일은 정규반과 개인 · 듀엣 레슨이 함께 운영돼요.' }
  ];
  function renderAdult() {
    $('adBands').innerHTML = BANDS.map(function (b) {
      var full = {}, nFull = 0, total = 0;
      b.days.forEach(function (d) { b.hours.forEach(function (h) { total++; if (!freeRooms(d, h)) { nFull++; (full[d] = full[d] || []).push(h); } }); });
      var r = nFull / total, st = r >= 0.35 ? ['hot', '마감 임박'] : r >= 0.15 ? ['busy', '인기 시간대'] : ['ok', '예약 가능'];
      var fullTxt = Object.keys(full).map(function (d) { return '<span class="ad-chip">' + d + ' ' + full[d].join('·') + '시</span>'; }).join('');
      return '<article class="ad-band ad-' + b.key + '">' +
        '<div class="ad-top"><span class="ad-ico" aria-hidden="true">' + b.icon + '</span><span class="ad-st ad-st-' + st[0] + '">' + st[1] + '</span></div>' +
        '<h3>' + b.name + '</h3>' +
        '<p class="ad-time">' + pad(b.hours[0]) + ':00 ~ ' + pad(b.hours[b.hours.length - 1]) + ':00 <small>시작</small></p>' +
        '<p class="ad-tag">' + b.tag + '</p>' +
        (b.note ? '<p class="ad-note">' + b.note + '</p>' : '') +
        '<div class="ad-full">' + (nFull ? '<b>예약이 찬 시간</b><div class="ad-chips">' + fullTxt + '</div>' : '<b>원하는 요일 · 시간을 골라 예약할 수 있어요</b>') + '</div>' +
        '<button type="button" class="btn ad-btn" data-band="' + b.key + '">이 시간대로 상담 신청</button>' +
        '</article>';
    }).join('');
  }
  $('adUpdated').textContent = fmtDate(D.updated) + ' 기준 예약 현황';
  $('adBands').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-band]'); if (!btn) return;
    var b = BANDS.filter(function (x) { return x.key === btn.dataset.band; })[0];
    setProg(who === 'kids' ? 'kids' : 'adult', '개인');
    addWish({ text: '개인레슨 · ' + b.name + ' (' + pad(b.hours[0]) + '~' + pad(b.hours[b.hours.length - 1]) + '시 시작) 희망' });
    goForm();
  });
  renderAdult();
  var SUB = { kids: $('ttSub').innerHTML, adult: '성인 레슨과 키즈 개인 · 듀엣 · 트리오 레슨은 아래 시간대 중 원하는 요일 · 시간에 예약해요. 시간대를 고르면 상담 신청서에 바로 담겨요.' };
  $('ttMode').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var m = b.dataset.mode;
    [].forEach.call(this.children, function (x) { x.setAttribute('aria-selected', x === b); });
    $('ttKidsPane').hidden = m !== 'kids'; $('ttAdultPane').hidden = m !== 'adult';
    $('ttSub').innerHTML = SUB[m]; splitSentences($('ttSub'));
    if (m === 'adult') setWho('adult');
  });

  /* ---------- 방학특강 (이벤트) ---------- */
  var sp = D.special, td = today();
  var spOn = sp && sp.show && td >= sp.from && td <= sp.to;
  // 공개 예정: 일정 · 여석 · 신청은 숨기고 안내만 (팝업 없음)
  if (spOn && sp.mode === 'soon') {
    $('special').hidden = false; $('navSp').hidden = false; $('spRibbon').hidden = false;
    $('spRibbonTag').textContent = sp.badge;
    $('spRibbonTxt').textContent = sp.badge + ' · ' + sp.soonText;
    $('spBadge').textContent = sp.badge;
    $('spTitle').textContent = sp.badge + ', ' + sp.soonText;
    $('spDesc').textContent = sp.soonDesc;
    $('spSoonText').textContent = sp.soonText;
    $('spSoon').hidden = false;
    ['spPrice', 'spApply', 'spNoteBox', 'spFeats'].forEach(function (id) { $(id).hidden = true; });
    spOn = false;
  }
  if (spOn) {
    function md(d) { var p = d.split('-'); return +p[1] + '/' + +p[2]; }
    function daysTo(d) { return Math.round((new Date(d + 'T00:00:00') - new Date(td + 'T00:00:00')) / 864e5); }
    // 등록 시기별 가격: 지난 것 · 지금 적용 중 · 예정
    var tiers = sp.tiers.map(function (t) {
      var st = td < t.from ? 'soon' : (t.to && td > t.to) ? 'past' : 'now';
      return Object.assign({ st: st }, t);
    });
    var cur = tiers.filter(function (t) { return t.st === 'now'; })[0], next = tiers.filter(function (t) { return t.st === 'soon'; })[0];
    var deal = cur || next;
    function dealLine(t) {
      if (!t) return '';
      if (t.st === 'now') return t.name + ' 회당 ' + won(t.per) + '원' + (t.to ? ' · ' + md(t.to) + '까지' + (daysTo(t.to) <= 3 ? ' (D-' + daysTo(t.to) + ')' : '') : '');
      return t.name + ' 회당 ' + won(t.per) + '원 · ' + (daysTo(t.from) === 1 ? '내일' : md(t.from)) + '부터';
    }

    $('special').hidden = false; $('navSp').hidden = false; $('spRibbon').hidden = false; $('progSpLbl').hidden = false;
    $('spRibbonTag').textContent = '❄️ ' + sp.badge;
    $('spRibbonTxt').textContent = dealLine(deal);
    $('spBadge').textContent = $('spmBadge').textContent = '❄️ ' + sp.badge;
    $('spTitle').textContent = $('spmTitle').textContent = sp.title;
    $('spDesc').textContent = sp.desc;
    if (sp.flyers && sp.flyers.length) {
      $('spFlyers').hidden = false;
      $('spFlyers').innerHTML = sp.flyers.map(function (f) { return '<a class="sp-flyer" href="' + esc(f.src) + '" target="_blank" rel="noopener"><img src="' + esc(f.src) + '" alt="' + esc(f.alt) + '" loading="lazy" width="1080" height="1080"><span>🔍 크게 보기</span></a>'; }).join('');
    }
    var roundsHtml = sp.rounds.map(function (r, i) {
      return '<div class="sp-round r' + (i + 1) + '"><b>' + esc(r.name) + '</b><span class="rd">' + esc(r.dates) + '</span><span class="rc">총 ' + r.count + '회 · ' + esc(r.days) + '</span>' + (r.note ? '<small>※ ' + esc(r.note) + '</small>' : '') + '</div>';
    }).join('');
    $('spRounds').innerHTML = roundsHtml;
    $('spmRounds').innerHTML = sp.rounds.map(function (r) { return '<li><b>' + esc(r.name) + '</b> ' + esc(r.dates) + ' · ' + r.count + '회</li>'; }).join('');
    $('spFeats').innerHTML = sp.features.map(function (f) { return '<li><span class="fi" aria-hidden="true">' + f[0] + '</span><b>' + esc(f[1]) + '</b><small>' + esc(f[2]) + '</small></li>'; }).join('');
    $('spBothNote').textContent = '📢 ' + sp.bothNote;
    $('spTiers').innerHTML = tiers.map(function (t, i) {
      var stTxt = t.st === 'now' ? '✅ 지금 적용 중' + (t.to ? ' · ' + md(t.to) + '까지' : '') : t.st === 'past' ? '마감' : (daysTo(t.from) === 1 ? '내일부터' : md(t.from) + '부터');
      return '<div class="tier t' + (i + 1) + ' st-' + t.st + '">' + (t.tag ? '<span class="tier-tag">' + esc(t.tag) + '</span>' : '') +
        '<h4>' + esc(t.name) + '</h4><p class="tier-when">' + md(t.from) + (t.to ? ' ~ ' + md(t.to) : '부터 ' + esc(t.sub || '')) + '</p>' +
        '<p class="tier-st">' + stTxt + '</p>' +
        '<p class="tier-per">회당 <b>' + won(t.per) + '</b>원</p>' +
        '<dl><dt>1차 (17회)</dt><dd>' + won(t.r1) + '원</dd><dt>2차 (18회)</dt><dd>' + won(t.r2) + '원</dd></dl>' +
        '<div class="tier-both">1 · 2차 동시 등록<b>' + won(t.both) + '원</b><small>2차 수강료 10% 할인 적용</small></div></div>';
    }).join('');
    $('spmDeal').innerHTML = deal ? '<p>' + (deal.st === 'now' ? '지금 등록하면' : (daysTo(deal.from) === 1 ? '내일부터' : md(deal.from) + '부터')) + ' <b>' + esc(deal.name) + '</b></p><strong>회당 ' + won(deal.per) + '원</strong><small>' + esc(sp.bothNote) + '</small>' : '';
    $('spUpdated').textContent = '(' + fmtDate(sp.updated) + ' 기준 여석)';
    $('spNote').innerHTML = [].concat(sp.note).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

    // 차수별 여석: r1 = 1차 신청, r2 = 2차 신청 (1·2차 모두 신청한 아이는 둘 다에 포함)
    var spSlots = [];   // 버튼 번호 → { part, pool }
    sp.parts.forEach(function (pt) { pt.pools.forEach(function (pl) { spSlots.push({ part: pt, pool: pl }); }); });
    function spRound() { return (document.querySelector('input[name="spRound"]:checked') || {}).value || '1차'; }
    function poolSeat(pl, round) {
      var r1 = pl.r1 || 0, r2 = pl.r2 || 0;
      return seat(pl.cap, round === '1차' ? r1 : round === '2차' ? r2 : Math.max(r1, r2));
    }
    function chip(label, left, on) {
      var k = left <= 0 ? 'full' : left === 1 ? 'few' : 'open';
      return '<span class="rs rs-' + k + (on ? ' on' : '') + '"><em>' + label + '</em>' + (left <= 0 ? '마감' : left + '자리') + '</span>';
    }
    function renderSp() {
      var round = spRound(), n = 0, tot = { r1: 0, r2: 0 };
      var rooms = [1, 2];
      $('spList').innerHTML = sp.parts.map(function (pt) {
        return '<div class="sp-part"><div class="sp-when"><b>' + esc(pt.name) + '</b><span>' + esc(pt.time) + '</span></div>' +
          rooms.map(function (room) {
            var r = D.rooms[room], pl = pt.pools.filter(function (x) { return x.room === room; })[0];
            if (!pl) return '<div class="sp-item pool-' + room + ' is-none"><span class="sp-pool">' + r.icon + ' ' + esc(r.name) + '</span><span class="tg">이 시간에는 수업이 없어요</span></div>';
            var idx = spSlots.findIndex(function (x) { return x.pool === pl; });
            var l1 = pl.cap - (pl.r1 || 0), l2 = pl.cap - (pl.r2 || 0), s = poolSeat(pl, round);
            tot.r1 += Math.max(l1, 0); tot.r2 += Math.max(l2, 0);
            return '<div class="sp-item pool-' + room + (s.k === 'full' ? ' is-full' : '') + '"><span class="sp-pool">' + r.icon + ' ' + esc(r.name) + '</span>' +
              '<span class="tg">' + esc(pl.target || sp.target) + ' · 최대 ' + pl.cap + '명' + (pl.note ? ' · ' + esc(pl.note) : '') + '</span>' +
              '<span class="rs-row">' + chip('1차', l1, round !== '2차') + chip('2차', l2, round !== '1차') + '</span>' +
              '<button type="button" class="mini" data-sp="' + idx + '">' + (s.k === 'full' ? round + ' 대기 접수' : round + ' 신청하기') + '</button></div>';
          }).join('') + '</div>';
      }).join('');
      $('spSum').innerHTML = '지금 남은 자리 <b class="r1">1차 ' + tot.r1 + '자리</b> <b class="r2">2차 ' + tot.r2 + '자리</b> <small>' + (round === '1·2차 동시' ? '1·2차 동시는 두 차수 모두 자리가 있어야 해요' : '선택한 차수 기준으로 신청 버튼이 바뀌어요') + '</small>';
    }
    renderSp();
    [].forEach.call(document.querySelectorAll('input[name="spRound"]'), function (r) { r.addEventListener('change', renderSp); });
    $('spList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sp]'); if (!b) return;
      var x = spSlots[+b.dataset.sp], round = spRound(), full = poolSeat(x.pool, round).k === 'full';
      var a = childAge();
      if (a && !spFits(a)) { setWho('kids'); showPicked('겨울방학 특강은 초등학생 전용이에요. (7세는 신청할 수 있어요) 입력한 생년월일을 확인해 주세요.'); goForm(); return; }
      setProg('kids', '겨울방학 특강'); autoProg = false;
      addWish({ special: true, wait: full, round: round, slot: x.part.name + '(' + x.part.time + ') ' + D.rooms[x.pool.room].name, deal: deal ? deal.name : '',
        text: sp.badge + ' ' + round + ' · ' + x.part.name + '(' + x.part.time + ') ' + D.rooms[x.pool.room].name + (deal ? ' · ' + deal.name + ' 가격' : '') });
      track('special_apply_click', { round: round, time: x.part.name, pool: x.pool.room });
      toast('✅ 겨울특강 ' + round + ' · ' + x.part.name + ' ' + D.rooms[x.pool.room].name + (full ? ' (대기)' : '') + ' 담았어요', true);
    });
    // 팝업 (하루 1회)
    var modal = $('spModal');
    function closeModal() { modal.hidden = true; }
    if (sp.popup && store('dw_sp_hide') !== td) setTimeout(function () { modal.hidden = false; track('special_popup_view'); }, 700);
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
    $('spmToday').addEventListener('click', function () { store('dw_sp_hide', td); closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }


  /* ---------- 가격 (1개월 / 3개월 10% 할인 보기) ---------- */
  var term = 1;
  function renderPrice() {
    var cols = D.priceCols.length;
    // 1개월권 / 3개월권 모두 같은 서식: 제목 · 열 제목(주 n회, 총 횟수) · 금액 정렬
    var h = '<table class="ptable"><thead><tr><th class="pt-h">' + term + '개월권 <small>(1인 기준)</small></th>' +
      D.priceCols.map(function (n) { return '<th>주 ' + n + '회<small>(' + (n * 4 * term) + '회)</small></th>'; }).join('') + '</tr></thead>';
    D.prices.forEach(function (sec) {
      var calc = term === 3 && sec.m3;
      h += '<tbody><tr class="pt-sec"><th colspan="' + (cols + 1) + '">' + esc(sec.title) + (sec.sub ? ' <small>(' + esc(sec.sub) + ')</small>' : '') + '</th></tr>';
      sec.rows.forEach(function (r) {
        var vals = r.slice(1), isTerm = vals.length === cols && calc;
        h += '<tr><td>' + esc(r[0]) + '</td>' + (vals.length === cols
          ? vals.map(function (v) { return '<td>' + won(isTerm ? Math.round(v * 3 * 0.9) : v) + '</td>'; }).join('')
          : '<td colspan="' + cols + '">' + won(vals[0]) + '</td>') + '</tr>';
      });
      h += '</tbody>';
    });
    $('pBody').innerHTML = h + '</table>' + '<p class="pt-tip">' + (term === 3 ? '3개월권 = 1개월 금액 × 3 × 0.9 (10% 할인) · 셔틀 · 자유수영은 기간과 관계없이 같은 금액이에요.' : '3개월권으로 등록하면 10% 추가 할인돼요.') + '</p>';
  }
  $('pTerm').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    term = +b.dataset.m;
    [].forEach.call(this.children, function (x) { x.setAttribute('aria-selected', x === b); });
    renderPrice();
  });
  $('pExtra').innerHTML = '<h3>기간과 상관없는 1회 요금</h3>' + D.extraPrices.map(function (x) {
    return '<div class="px-item"><span class="px-ico" aria-hidden="true">' + x.icon + '</span><div class="px-txt"><b>' + esc(x.name) + ' <small>(' + esc(x.unit) + ')</small></b><span>' + esc(x.desc) + '</span></div><strong>' + won(x.price) + '원</strong></div>';
  }).join('');
  $('pNotes').innerHTML = D.priceNotes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
  renderPrice();

  /* ==========================================================
     대기 접수 · 상담 신청
     - 휴대폰: 문자 앱을 열고 서식에 맞춘 내용을 자동 입력
     - PC: QR 코드 → 휴대폰으로 찍으면 같은 문자가 작성됨
     ========================================================== */
  var IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  if (!IS_MOBILE) {
    $('consultSub').textContent = '아래 내용을 채우고 버튼을 누르면 QR 코드가 나와요. 휴대폰 카메라로 찍으면 접수 문자가 바로 작성됩니다.'; splitSentences($('consultSub'));
    $('submitBtn').textContent = '접수 내용 만들기';
  }

  function setWho(w) {
    // 자유수영 · 대관 탭: 레슨 신청 항목 대신 전용 안내/문의 표시
    [].forEach.call(form.querySelectorAll('.form-tabs button'), function (b) { b.setAttribute('aria-selected', b.dataset.who === w); });
    $('freePane').hidden = w !== 'free'; $('rentPane').hidden = w !== 'rent';
    var lesson = w === 'kids' || w === 'adult';
    $('lessonFields').hidden = !lesson;
    $('agreeRow').hidden = $('submitBtn').hidden = w === 'free';
    $('submitBtn').textContent = w === 'rent' ? (IS_MOBILE ? '대관 문의 문자 보내기' : '대관 문의 내용 만들기') : (IS_MOBILE ? '접수 문자 보내기' : '접수 내용 만들기');
    msg.hidden = true;
    if (!lesson) { who = w; return; }
    who = w;
    [].forEach.call(form.querySelectorAll('.only-kids'), function (el) { el.hidden = w !== 'kids'; });
    [].forEach.call(form.querySelectorAll('.only-adult'), function (el) { el.hidden = w !== 'adult'; });
    $('progKids').hidden = w !== 'kids'; $('progAdult').hidden = w !== 'adult';
    $('regularBox').hidden = !(w === 'kids' && wantsRegular());
    lockRegular(childAge());
    onProgChange();
  }
  form.querySelector('.form-tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setWho(b.dataset.who); });
  function wantsRegular() { return !!$('progKids').querySelector('input[data-regular]:checked, input[data-mode="special"]:checked'); }
  // 겨울특강 모드: 특강 표에서 고른 시간을 신청서 맨 위에 보여주고, 필요 없는 항목(요일·시간 고르기 · 개월수 · 셔틀)은 숨김
  function isSp() { return who === 'kids' && progMode() === 'special'; }
  function goForm() { var t = $('spPicked').hidden ? form : $('spPicked'); setTimeout(function () { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }
  function showPicked(err) {
    var box = $('spPicked'), sp = isSp();
    $('fWish').hidden = $('fMonths').hidden = sp;
    if (who === 'kids') $('fShuttle').hidden = sp;
    $('memoNo').textContent = sp ? '4' : '7';
    $('regularTxt').textContent = sp ? '수준별 반편성을 위해 알려주세요 (선택)' : '정규반 신청 시 반 배정을 위해 알려주세요';
    var picks = [];
    wishes.forEach(function (w, i) { if (sp ? w.special : w.cid != null) picks.push({ w: w, i: i }); });
    var on = !!err || (who === 'kids' && (sp || picks.length > 0));
    box.hidden = !on;
    if (!on) return;
    var list = picks.map(function (x) {
      var w = x.w, tag = w.special ? esc(w.round) : esc(w.days.join('/') + ' ' + +w.time.slice(0, 2) + '시');
      var name = w.special ? esc(w.slot) + (w.deal ? '<small>' + esc(w.deal) + ' 가격</small>' : '') : esc(w.label);
      var st = w.wait ? '<em class="spp-w">대기 접수</em>' : w.isNew ? '<em class="spp-n">신규반 희망</em>' : '<em class="spp-ok">신청</em>';
      return '<li><span class="spp-r">' + tag + '</span><span class="spp-t">' + name + '</span>' + st + '<button type="button" class="x" data-i="' + x.i + '" aria-label="삭제">×</button></li>';
    }).join('');
    var back = sp ? '#special' : '#timetable';
    box.innerHTML = '<p class="spp-head">' + (sp ? '❄️ 겨울방학 수영특강 신청서' : '🧺 시간표에서 고른 수업') + '</p>' +
      (err ? '<p class="spp-err">' + esc(err) + '</p>'
        : list ? '<ul class="spp-list">' + list + '</ul><p class="spp-next">✍️ 이제 아래 <b>아이 이름 · 생년월일 · 성별 · 연락처</b>만 적고 보내주세요.' + (sp ? '' : ' 주 횟수는 4번에서 바꿀 수 있어요.') + '</p>'
        : '<p class="spp-next">위 겨울특강 표에서 <b>차수 · 시간 · 수조</b>를 골라주세요.</p>') +
      '<a class="link-btn" href="' + back + '">' + (list ? '＋ 다른 시간 더 고르기' : '📅 시간표 보러 가기') + '</a>';
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }
  // 담기 알림 + 아래쪽 '담은 수업' 바 (신청서가 보이면 숨김)
  var toastT;
  function toast(t, withGo) {
    var el = $('toast'); el.innerHTML = '<span>' + esc(t) + '</span>' + (withGo ? '<small>더 고르거나 아래 버튼으로 신청서를 써 주세요</small>' : '');
    el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2600);
  }
  var formSeen = false;
  function cartUpdate() {
    var n = wishes.length, dm = document.querySelector('.dock-main');
    dm.innerHTML = n ? '🧺 ' + n + '개 담음 · 신청서' : '✉️ 대기 접수';
    dm.classList.toggle('has', n > 0);
    $('cartBar').hidden = !n || formSeen;
    $('cartN').textContent = n;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { formSeen = es[0].isIntersecting; cartUpdate(); }, { threshold: .15 }).observe(form);
  [$('cartGo'), document.querySelector('.dock-main')].forEach(function (b) { b.addEventListener('click', function (e) { if (!wishes.length) return; e.preventDefault(); showPicked(); goForm(); }); });
  $('spPicked').addEventListener('click', function (e) { var b = e.target.closest('.x'); if (b) { wishes.splice(+b.dataset.i, 1); renderWish(); } });
  $('progKids').addEventListener('change', function () { $('regularBox').hidden = !wantsRegular(); onProgChange(); });
  $('progAdult').addEventListener('change', onProgChange);
  function setProg(w, value) {
    if (who !== w) setWho(w);
    var r = (w === 'kids' ? $('progKids') : $('progAdult')).querySelector('input[value="' + value + '"]');
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'shuttle') $('k-pickup').hidden = !$('shY').checked;
  });

  // 희망 시간: 정각만, 고른 프로그램과 요일에 맞는 시간만 보여줌
  //  정규반(5세 · 키즈) → regularHours, 개인 · 듀엣 · 트리오 → privateHours, 미선택 · 체험 · 대관 → 둘 다
  function progMode() {
    var r = (who === 'kids' ? $('progKids') : $('progAdult')).querySelector('input:checked');
    return r ? r.dataset.mode : 'any';
  }
  function union(a, b) { return a.concat(b).filter(function (h, i, x) { return x.indexOf(h) === i; }).sort(function (p, q) { return p - q; }); }
  function hoursFor(mode, day) {
    var key = day === '토' ? 'sat' : 'weekday';
    if (mode === 'regular') return D.regularHours[key];
    if (mode === 'private') return D.privateHours[key];
    return union(D.regularHours[key], D.privateHours[key]);
  }
  function allowedHours(mode, days) {
    if (!days.length) days = ['월'];
    return days.map(function (d) { return hoursFor(mode, d); }).reduce(function (acc, hs) { return acc.filter(function (h) { return hs.indexOf(h) >= 0; }); });
  }
  function hh(h) { return pad(h) + ':00'; }
  var HINT = {
    regular: '정규반(5세 특별반 · 키즈 정규반)은 평일 14~18시, 토요일 09~13시에 시작해요.',
    private: '개인 · 듀엣 · 트리오는 평일 06~13시 · 19~21시, 토요일 09~13시에 시작해요. (토요일 그 외 시간은 강사와 협의)',
    special: '겨울방학 특강 시간은 위 겨울특강 표에서 골라요.',
    any: '희망 프로그램을 먼저 고르면 그 프로그램이 가능한 시간만 보여드려요.'
  };
  function selectedDays() { return [].slice.call($('wDays').querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
  // 요일 · 시간별 여석 상태 (시간 목록과 아래 안내에 표시)
  //  정규반: 고른 반(5세 / 유아·초등)의 수업 중 가장 여유 있는 반 기준 · 개인레슨: 빈 수조 유무
  var ST_ICON = { open: '🟢', few: '🟠', full: '🔴', new: '⚪', none: '⚪' };
  function progValue() { var r = (who === 'kids' ? $('progKids') : $('progAdult')).querySelector('input:checked'); return r ? r.value : ''; }
  // 생년월일 → 유아 / 초등 자동 구분 (한국 학년 기준: 3월 새 학년, 나이는 학년도 기준 세는 나이)
  var GROUP = {
    five:  { label: '5세', fit: '5세 특별반', kinds: ['5세'] },          // 만 48개월 이상 5세는 안전을 위해 5세 특별반만
    baby:  { label: '유아', fit: '유아 정규반', kinds: ['유아'] },
    elem:  { label: '초등', fit: '초등 정규반', kinds: ['초등'] },
    young: { label: '유아', fit: '개인 레슨', kinds: [] },
    teen:  { label: '중학생 이상', fit: '개인 레슨', kinds: [] }
  };
  function childAge() {
    var v = $('k-birth').value; if (!/^\d{4}-\d\d-\d\d$/.test(v)) return null;
    var now = new Date(), sy = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1, by = +v.slice(0, 4);
    var age = sy - by + 1, grade = sy - by - 6;
    // 개월 수: 만 48개월 이상이어야 5세(5세 특별반)로 봄
    var bm = +v.slice(5, 7), bd = +v.slice(8, 10);
    var months = (now.getFullYear() - by) * 12 + (now.getMonth() + 1 - bm) - (now.getDate() < bd ? 1 : 0);
    var g = grade >= 7 ? 'teen' : grade >= 1 ? 'elem' : age >= 6 ? 'baby' : months >= 48 ? 'five' : 'young';
    var from = new Date(by, bm - 1 + 48, bd);
    return { g: g, age: age, grade: grade, months: months, near: g === 'young' && months >= 48 - D.preFiveMonths, from: from.getFullYear() + '년 ' + (from.getMonth() + 1) + '월 ' + from.getDate() + '일' };
  }
  // 겨울특강: 초등학생 전용, 단 7세(내년 초등 입학)는 신청 가능
  function spFits(a) { return a.g === 'elem' || (a.g === 'baby' && a.age >= 7); }
  function childGroup() { var a = who === 'kids' && childAge(); return a ? a.g : null; }
  function classFits(kind, g) { return GROUP[g].kinds.indexOf(kind) >= 0; }
  function ageText(a) {
    if (!a) return '';
    if (a.g === 'elem') return '초등 ' + a.grade + '학년';
    if (a.g === 'teen') return '중학생 이상';
    if (a.g === 'five') return '5세 (만 ' + a.months + '개월)';
    if (a.g === 'young') return '만 ' + a.months + '개월';
    return a.age + '세 유아';
  }
  function matchClasses(day, h) {
    var five = progValue() === '5세 특별 정규반', g = childGroup();
    var kinds = five ? ['5세'] : ['유아', '초등'];
    if (g) kinds = kinds.filter(function (k) { return classFits(k, g); });
    if (!kinds.length) return [];
    return CL.filter(function (c) {
      return c.day === day && c.time === hh(h) && (c.kind === '신규' || kinds.indexOf(c.kind) >= 0);
    });
  }
  function onBirthChange() {
    var a = childAge(), out = $('kAgeOut');
    if (!a) { out.className = 'age-out'; out.textContent = '입력하면 유아 · 초등을 자동으로 구분해 맞는 반만 보여드려요'; }
    else {
      out.className = 'age-out on g-' + a.g;
      out.textContent = a.g === 'young' ? ageText(a) + ' · 정규반은 ' + a.from + '(만 48개월)부터 신청할 수 있어요'
        : ageText(a) + ' · ' + GROUP[a.g].fit + ' 대상' + (a.g === 'teen' ? '으로 상담드려요' : '이에요');
      // 나이에 맞는 정규반으로 자동 전환 (5세 → 5세 특별반, 6세 이상 → 키즈 정규반)
    }
    lockRegular(a);
    // 맞지 않는 희망 시간(다른 연령 반, 초등 전용 특강)은 정리
    var before = wishes.length;
    if (a) wishes = wishes.filter(function (w) {
      if (w.special) return spFits(a);
      if (w.cid != null) { var c = CL[w.cid]; return GROUP[a.g].kinds.length && (c.kind === '신규' || classFits(c.kind, a.g)); }
      return true;
    });
    renderTimeOpts();
    if (wishes.length !== before) { renderWish(); $('wHint').textContent = '입력한 생년월일과 맞지 않는 희망 시간 ' + (before - wishes.length) + '개를 지웠어요.'; }
  }
  // 만 48개월 미만: 정규반(키즈 정규반 · 5세 특별반) 선택을 막고 안내 배너 표시
  // 생년월일에 맞지 않는 정규반 버튼은 잠금
  //  5세 → 키즈 정규반 잠금 · 6세 이상(유아·초등) → 5세 특별반 잠금 · 48개월 미만/중학생 이상 → 둘 다 잠금
  var autoProg = false;   // 프로그램이 자동으로 바뀐 상태인지
  $('progKids').addEventListener('click', function (e) { var l = e.target.closest('label'); if (l && !l.querySelector('input').disabled) autoProg = false; });
  var PROG_NOTE = {
    five: '5세(만 48개월 이상)는 안전을 위해 5세 특별반만 선택할 수 있어요.',
    baby: '6세 이상은 키즈 정규반(최대 4명)으로 신청해요. 5세 특별반은 5세 친구들 반이에요.',
    elem: '초등학생은 키즈 정규반(최대 4명)으로 신청해요.',
    young: '만 48개월 미만은 개인 · 듀엣 · 트리오 레슨으로 신청해 주세요.',
    teen: '중학생 이상은 개인 · 듀엣 · 트리오 레슨으로 신청해 주세요.'
  };
  function lockRegular(a) {
    var g = who === 'kids' && a ? a.g : null;
    [].forEach.call($('progKids').querySelectorAll('input[data-regular]'), function (r) {
      var kind = r.value === '5세 특별 정규반' ? '5세' : 'kids';
      var off = !!g && (GROUP[g].kinds.length === 0 || (kind === '5세' ? g !== 'five' : g === 'five'));
      r.disabled = off; r.parentNode.classList.toggle('off', off);
      r.parentNode.title = off ? PROG_NOTE[g] : '';
    });
    var spR = $('progKids').querySelector('input[data-mode="special"]'), spOff = !!g && !spFits(a);
    spR.disabled = spOff; spR.parentNode.classList.toggle('off', spOff); spR.parentNode.title = spOff ? '겨울방학 특강은 초등학생 전용이에요 (7세 가능)' : '';
    // 잠긴 버튼이 선택돼 있었다면 맞는 프로그램으로 옮김
    var cur = $('progKids').querySelector('input:checked');
    var fit = g === 'five' ? '5세 특별 정규반' : (g === 'baby' || g === 'elem') ? '키즈정규반' : '개인';
    // 잠긴 버튼이 선택돼 있거나, 이전에 자동으로 바꾼 선택이면 나이에 맞게 다시 맞춤 (보호자가 직접 고른 건 유지)
    if (g && cur && (cur.disabled || (autoProg && cur.value !== fit))) { setProg('kids', fit); autoProg = true; }
    $('progNote').textContent = g ? PROG_NOTE[g] : '';
    $('progNote').hidden = !g;
    var young = g === 'young';
    $('kNotice').hidden = !young;
    if (young) {
      $('knNear').hidden = !a.near;
      $('knNear').querySelector('span').textContent = a.from;
    }
  }
  $('k-birth').max = today();
  $('k-birth').addEventListener('change', onBirthChange);
  $('k-birth').addEventListener('input', onBirthChange);
  function slotStatus(day, h) {
    var mode = progMode();
    if (mode === 'private') {
      return freeRooms(day, h) ? { k: 'open', txt: '예약 가능' } : { k: 'full', txt: '마감 · 대기' };
    }
    if (mode !== 'regular') return null;
    var g = childGroup(); if (g && !GROUP[g].kinds.length) return null;   // 정규반 대상 나이가 아니면 여석 표시 없음
    var ms = matchClasses(day, h);
    var open = ms.filter(function (c) { return c.s.k === 'open' || c.s.k === 'few'; });
    if (open.length) {
      var left = Math.max.apply(null, open.map(function (c) { return c.s.left; }));
      return left === 1 ? { k: 'few', txt: '1자리 남음' } : { k: 'open', txt: left + '자리 남음' };
    }
    if (ms.some(function (c) { return c.s.k === 'new'; })) return { k: 'new', txt: '개설 가능 (' + D.newMin + '인~)' };
    if (ms.length) {
      var w = ms.reduce(function (a, c) { return a + (c.s.wait || 0); }, 0);
      return { k: 'full', txt: '마감 · 대기' + (D.showWait && w ? ' ' + w + '명' : '') };
    }
    return { k: 'none', txt: '반 없음 · 상담' };
  }
  function optLabel(days, h) {
    if (!days.length) return hh(h);
    var sts = days.map(function (d) { return slotStatus(d, h); });
    if (!sts[0]) return hh(h);
    var same = sts.every(function (s) { return s.txt === sts[0].txt; });
    return hh(h) + '   ' + (same ? ST_ICON[sts[0].k] + ' ' + sts[0].txt
      : sts.map(function (s, i) { return days[i] + ' ' + ST_ICON[s.k] + s.txt; }).join(' / '));
  }
  function renderStatus() {
    var days = selectedDays(), t = $('wTime').value, box = $('wStatus'), mode = progMode();
    var g = childGroup();
    if (!days.length || !/^\d\d:00$/.test(t) || mode === 'any' || (mode === 'regular' && g && !GROUP[g].kinds.length)) { box.hidden = true; return; }
    var h = +t.slice(0, 2);
    box.innerHTML = days.map(function (d) {
      if (mode === 'private') {
        var s = slotStatus(d, h);
        return '<div class="ws-row"><b>' + d + ' ' + t + '</b>' + badge(s.k === 'full' ? { k: 'full', txt: '예약 마감 · 대기 접수' } : { k: 'open', txt: '예약 가능' }) + '</div>';
      }
      var ms = matchClasses(d, h);
      if (!ms.length) return '<div class="ws-row"><b>' + d + ' ' + t + '</b><span class="ws-none">이 시간에는 해당 반이 없어요 · 상담 시 안내드려요</span></div>';
      return '<div class="ws-row"><b>' + d + ' ' + t + '</b><span class="ws-list">' + ms.map(function (c) {
        var s = c.s.k === 'new' ? { k: 'new', txt: '수업 없음 · ' + D.newMin + '인부터 개설' }
          : c.s.k === 'full' ? { k: 'full', txt: '마감 · 대기' + (D.showWait && c.s.wait ? ' ' + c.s.wait + '명' : ' 접수') } : c.s;
        return '<span class="ws-item">' + esc(D.rooms[c.room].name) + ' · ' + (c.kind === '신규' ? '신규반' : esc(c.short) + (c.level ? '(' + esc(c.level) + ')' : '')) + ' ' + badge(s) + '</span>';
      }).join('') + '</span></div>';
    }).join('');
    box.hidden = false;
  }
  function renderTimeOpts() {
    var days = selectedDays(), hs = allowedHours(progMode(), days), cur = $('wTime').value;
    var mixed = days.indexOf('토') >= 0 && days.some(function (d) { return d !== '토'; });
    $('wTime').innerHTML = hs.length
      ? '<option value="">' + (days.length ? '시간 선택' : '요일을 먼저 고르면 여석이 보여요') + '</option>' + hs.map(function (h) { return '<option value="' + hh(h) + '"' + (hh(h) === cur ? ' selected' : '') + '>' + optLabel(days, h) + '</option>'; }).join('') + '<option value="시간 무관"' + (cur === '시간 무관' ? ' selected' : '') + '>시간 무관</option>'
      : '<option value="">평일과 토요일은 시간이 달라요 · 따로 추가해 주세요</option>';
    $('wTime').disabled = !hs.length;
    $('wHint').textContent = HINT[progMode()] + (mixed && hs.length ? ' 평일과 토요일에 모두 가능한 시간만 보여요.' : '');
    var g = childGroup(), pv = progValue();
    if (g && progMode() === 'regular') {
      if (g === 'young') $('wHint').textContent = '정규반은 만 48개월(5세)부터 등록할 수 있어요. 그 전에는 개인 · 듀엣 · 트리오 레슨을 선택해 주세요.';
      else if (!GROUP[g].kinds.length) $('wHint').textContent = '입력한 생년월일 기준으로는 정규반 대상이 아니에요. 개인 · 듀엣 · 트리오 레슨으로 상담해 주세요.';
      else if (pv === '키즈정규반' && g === 'five') $('wHint').textContent = '5세(만 48개월 이상)는 안전을 위해 5세 특별반으로만 등록해요. 5세 특별반(최대 3명)을 선택해 주세요.';
      else if (pv === '5세 특별 정규반' && g !== 'five') $('wHint').textContent = '5세 특별반은 5세(만 48개월 이상) 친구들 대상이에요. 키즈 정규반(최대 4명)을 선택해 주세요.';
      else $('wHint').textContent = ageText(childAge()) + ' 기준 ' + (pv === '5세 특별 정규반' ? '5세 특별반' : GROUP[g].label + ' 정규반') + ' 여석만 보여드려요. ' + HINT.regular;
    }
    renderStatus();
  }
  $('wTime').addEventListener('change', renderStatus);
  // '시간표 보기' 버튼: 고른 대상 · 프로그램에 맞는 시간표 탭을 열고 이동
  [].forEach.call(document.querySelectorAll('[data-see]'), function (b) {
    b.addEventListener('click', function () {
      var mode = who === 'adult' || progMode() === 'private' ? 'adult' : 'kids';
      var tab = $('ttMode').querySelector('[data-mode="' + mode + '"]');
      if (tab.getAttribute('aria-selected') !== 'true') tab.click();
      $('timetable').scrollIntoView({ behavior: 'smooth' });
    });
  });
  // 프로그램이 바뀌면 맞지 않는 희망 시간은 정리
  function onProgChange() {
    var mode = progMode(), before = wishes.length;
    wishes = wishes.filter(function (w) {
      if (mode === 'special') return !!w.special;
      if (w.special) return false;
      if (w.text || w.time === '시간 무관') return true;
      var h = +w.time.slice(0, 2);
      return w.days.every(function (d) { return hoursFor(mode, d).indexOf(h) >= 0; });
    });
    renderTimeOpts(); showPicked();
    if (wishes.length !== before) { renderWish(); $('wHint').textContent = '선택한 프로그램과 맞지 않는 희망 시간 ' + (before - wishes.length) + '개를 지웠어요. ' + HINT[mode]; }
  }
  $('wDays').addEventListener('change', renderTimeOpts);
  function wishText(w) {
    return w.text || (w.days.join('/') + ' ' + w.time + (w.label ? ' ' + w.label : ''));
  }
  function addWish(w) {
    var key = wishText(w);
    if (wishes.some(function (x) { return wishText(x) === key; })) { flashList(); return; }
    wishes.push(w); renderWish(); flashList();
  }
  function flashList() { var l = $('wishList'); l.style.outline = '3px solid var(--coral)'; l.style.borderRadius = '12px'; setTimeout(function () { l.style.outline = ''; }, 900); }
  function renderWish() {
    var l = $('wishList');
    if (!wishes.length) { l.innerHTML = '<li class="empty">시간표에서 수업을 누르거나, 위에서 요일·시간을 골라 추가하세요.</li>'; markPicked(); return; }
    l.innerHTML = wishes.map(function (w, i) {
      var freq = w.text ? '' : '<select class="freq" data-i="' + i + '" aria-label="주 수업 횟수">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (n === w.freq ? ' selected' : '') + '>주 ' + n + '회</option>'; }).join('') + '</select>';
      return '<li><span class="wl">' + (i + 1) + '순위 · ' + esc(wishText(w)) + (w.wait ? ' <small>(대기)</small>' : w.isNew ? ' <small>(신규반)</small>' : '') + '</span>' + freq + '<button type="button" class="x" data-i="' + i + '" aria-label="삭제">×</button></li>';
    }).join('');
    markPicked(); showPicked(); cartUpdate();
  }
  function markPicked() {
    var ids = wishes.map(function (w) { return w.cid; });
    [].forEach.call(document.querySelectorAll('.cls'), function (b) { b.classList.toggle('picked', ids.indexOf(+b.dataset.id) >= 0); });
  }
  $('wishList').addEventListener('click', function (e) { var b = e.target.closest('.x'); if (b) { wishes.splice(+b.dataset.i, 1); renderWish(); } });
  $('wishList').addEventListener('change', function (e) { if (e.target.classList.contains('freq')) wishes[+e.target.dataset.i].freq = +e.target.value; });
  $('wAdd').addEventListener('click', function () {
    var days = [].slice.call($('wDays').querySelectorAll('input:checked')).map(function (i) { return i.value; });
    var time = $('wTime').value;
    if (!days.length || !time) { showErr('희망 요일과 시간을 골라주세요.'); return; }
    var cg = childGroup(); if (cg && progMode() === 'regular' && !GROUP[cg].kinds.length) { showErr('만 48개월 미만은 정규반 신청이 어려워요. 개인 레슨을 선택해 주세요.'); return; }
    msg.hidden = true;
    var sts = /^\d\d:00$/.test(time) ? days.map(function (d) { return slotStatus(d, +time.slice(0, 2)); }) : [];
    var allFull = sts.length && sts.every(function (s) { return s && s.k === 'full'; });
    var allNew = sts.length && sts.every(function (s) { return s && s.k === 'new'; });
    addWish({ days: days, time: time, freq: Math.min(days.length, 5), wait: allFull, isNew: allNew });
    [].forEach.call($('wDays').querySelectorAll('input'), function (i) { i.checked = false; }); $('wTime').value = ''; renderTimeOpts();
  });
  renderTimeOpts();

  function val(id) { return $(id).value.trim(); }
  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function progs() { return [].slice.call((who === 'kids' ? $('progKids') : $('progAdult')).querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
  function showErr(t) { msg.hidden = false; msg.className = 'form-msg err'; msg.textContent = t; track('form_error', { who: who, reason: t.slice(0, 40), last_field: fLast || '없음' }); }

  /* ---------- 신청서 이탈 기록 (GA4) ----------
     form_field   : 칸을 처음 채울 때 1번씩 (어디까지 썼는지)
     form_error   : 접수 버튼을 눌렀는데 빠진 칸 안내가 뜬 경우 (reason = 안내 문구)
     form_abandon : 쓰다가 접수 없이 나간 경우 (last_field = 마지막으로 채운 칸, filled = 채운 칸 수)
     ※ 입력한 내용(이름 · 번호 등)은 절대 보내지 않고 칸 이름만 보냅니다. */
  var FIELD_NAME = {
    'k-name': '아동 이름', 'k-birth': '아동 생년월일', 'k-gender': '아동 성별', 'k-exp': '강습 경험', 'k-level': '현재 진도', 'k-pickup': '픽업 장소',
    'a-name': '성인 성함', 'a-birth': '성인 생년월일', 'a-gender': '성인 성별', 'a-exp': '성인 강습 경험', 'a-level': '성인 진도',
    'f-phone': '연락처', 'progK': '희망 프로그램', 'progA': '희망 프로그램', 'wDays': '희망 요일', 'wTime': '희망 시간', 'wFreq': '주 횟수',
    'months': '개월수', 'shuttle': '셔틀', 'f-memo': '요청 사항', 'f-agree': '개인정보 동의',
    'r-name': '대관 성함', 'r-phone': '대관 연락처', 'r-date': '대관 날짜', 'r-time': '대관 시간', 'r-people': '대관 인원', 'r-purpose': '대관 목적', 'r-memo': '대관 요청'
  };
  var fSeen = {}, fCount = 0, fLast = '', fSent = false, fDone = false;
  function fieldOf(el) {
    var key = el.type === 'radio' ? el.name : el.id;
    if (!key) { var box = el.closest('[id]'); key = box && box !== form ? box.id : ''; }
    return FIELD_NAME[key] || key || '기타';
  }
  form.addEventListener('change', function (e) {
    var el = e.target; if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    if (el.type !== 'checkbox' && el.type !== 'radio' && !String(el.value).trim()) return;
    var f = fieldOf(el); fLast = f;
    if (fSeen[f]) return; fSeen[f] = 1; fCount++;
    track('form_field', { who: who, field: f, step: fCount });
  });
  function formAbandon() {
    if (fSent || fDone || !fCount) return; fSent = true;
    track('form_abandon', { who: who, last_field: fLast, filled: fCount, transport_type: 'beacon' });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') formAbandon(); });
  window.addEventListener('pagehide', formAbandon);

  function rentBody() {
    return '[다이나믹웨이브 불당점 대관 문의]\n' +
      '1. 신청자 / 연락처 : ' + val('r-name') + ' / ' + val('r-phone') + '\n' +
      '2. 희망 날짜 · 시간 : ' + val('r-date').replace(/-/g, '.') + ' ' + ($('r-time').value || '시간 협의') + '\n' +
      '3. 예상 인원 : ' + (val('r-people') || '-') + '\n' +
      '4. 이용 목적 : ' + (radio('r-purpose') || '-') + '\n' +
      '5. 요청 사항 : ' + (val('r-memo') || '없음');
  }
  function buildBody() {
    var p = progs().join(', ') || '상담 후 결정';
    var w = wishes.length ? wishes.map(function (x) { return '\n - ' + wishText(x) + (x.text ? '' : ' 주 ' + x.freq + '회') + (x.wait ? ' (대기 접수)' : x.isNew ? ' (현재 수업 없음 · ' + D.newMin + '인 이상 시 개설)' : ''); }).join('') : ' 상담 후 결정';
    var memo = val('f-memo') || '없음';
    if (isSp()) {
      var sw = wishes.filter(function (x) { return x.special; }).map(function (x) { return '\n - ' + x.round + ' · ' + x.slot + (x.deal ? ' · ' + x.deal + ' 가격' : '') + (x.wait ? ' (대기 접수)' : ''); }).join('');
      return '[다이나믹웨이브 불당점 겨울방학 수영특강 신청]\n' +
        '1. 아동명 / 생년월일 / 성별 : ' + val('k-name') + ' / ' + (val('k-birth') ? val('k-birth').replace(/-/g, '.') + ' (' + ageText(childAge()) + ')' : '-') + ' / ' + (radio('k-gender') || '-') + '\n' +
        '2. 보호자 연락처 : ' + val('f-phone') + '\n' +
        '3. 신청 특강 :' + (sw || ' 상담 후 결정') + '\n' +
        '4. 기타 요청 사항 : ' + memo +
        '\n※ 수영 강습 경험 : ' + (radio('k-exp') || '-') + ' / 현재 진도 : ' + (val('k-level') || '-');
    }
    if (who === 'kids') {
      var shuttle = radio('shuttle') === '이용' ? '이용 (픽업 장소: ' + (val('k-pickup') || '상담 시 안내') + ')' : '미이용';
      var b = '[다이나믹웨이브 불당점 대기접수 · 유아/어린이]\n' +
        '1. 아동명 / 생년월일 / 성별 : ' + val('k-name') + ' / ' + (val('k-birth') ? val('k-birth').replace(/-/g, '.') + ' (' + ageText(childAge()) + ')' : '-') + ' / ' + (radio('k-gender') || '-') + '\n' +
        '2. 보호자 연락처 : ' + val('f-phone') + '\n' +
        '3. 희망 프로그램 : ' + p + '\n' +
        '4. 희망 요일·시간·주 횟수 :' + w + '\n' +
        '5. 선호 개월수 : ' + radio('months') + '\n' +
        '6. 셔틀 이용 : ' + shuttle + '\n' +
        '7. 기타 요청 사항 : ' + memo;
      if (wantsRegular()) b += '\n※ 정규반 · 수영 강습 경험 : ' + (radio('k-exp') || '-') + ' / 현재 진도 : ' + (val('k-level') || '-');
      return b;
    }
    return '[다이나믹웨이브 불당점 대기접수 · 성인]\n' +
      '1. 성함 / 생년월일 / 성별 : ' + val('a-name') + ' / ' + (val('a-birth') || '-') + ' / ' + (radio('a-gender') || '-') + '\n' +
      '2. 연락처 : ' + val('f-phone') + '\n' +
      '3. 희망 프로그램 : ' + p + '\n' +
      '4. 희망 요일·시간·주 횟수 :' + w + '\n' +
      '5. 선호 개월수 : ' + radio('months') + '\n' +
      '6. 강습 경험 · 진도 : ' + (radio('a-exp') || '-') + ' / ' + (val('a-level') || '-') + '\n' +
      '7. 기타 요청 사항 : ' + memo;
  }

  function copyText(btn, text, pre) {
    function fallback() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = '선택됨 · Ctrl+C로 복사'; }
    try { navigator.clipboard.writeText(text).then(function () { btn.textContent = '복사됨'; }, fallback); } catch (err) { fallback(); }
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (who === 'free') return;
    var rent = who === 'rent';
    var name = rent ? val('r-name') : who === 'kids' ? val('k-name') : val('a-name'), phone = rent ? val('r-phone') : val('f-phone');
    if (rent && !name) return showErr('신청자 성함을 입력해 주세요.');
    if (!name) return showErr(who === 'kids' ? '아동 이름을 입력해 주세요.' : '성함을 입력해 주세요.');
    if (who === 'kids' && !radio('k-gender')) return showErr('아이 성별을 선택해 주세요.');
    if (isSp() && !wishes.some(function (w) { return w.special; })) { showPicked(); goForm(); return showErr('겨울특강 표에서 신청할 차수 · 시간을 골라주세요.'); }
    if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone)) return showErr('연락처를 확인해 주세요. 예: 010-1234-5678');
    if (!$('f-agree').checked) return showErr('개인정보 수집 · 이용에 동의해 주세요.');
    if (rent && !val('r-date')) return showErr('희망 날짜를 골라주세요.');
    var body = rent ? rentBody() : buildBody(), href = 'sms:' + info.sms + '?&body=' + encodeURIComponent(body);
    msg.hidden = false; msg.className = 'form-msg'; fDone = true;
    track(rent ? 'rental_submit' : 'consult_submit', { who: who, program: rent ? '대관' : (progs().join(',') || '미선택'), method: IS_MOBILE ? 'sms' : 'qr' });
    if (IS_MOBILE) {
      msg.innerHTML = '<b>문자 앱이 열리지 않으면 아래 내용을 ' + esc(info.tel) + '로 보내주세요.</b><pre id="smsText">' + esc(body) + '</pre>' +
        '<div class="sms-actions"><a class="btn btn-main" href="' + href + '">문자 앱 열기</a><button class="mini" type="button" id="smsCopy">내용 복사</button></div>';
      window.location.href = href;
    } else {
      msg.innerHTML = '<div class="qr-row"><div class="qr" id="smsQR" aria-label="문자 작성용 QR 코드"></div><div class="qr-help"><b>휴대폰 카메라로 QR을 찍어주세요</b>' +
        '<span>접수 내용이 담긴 문자가 ' + esc(info.tel) + '로 바로 작성됩니다. 보내기만 누르시면 돼요.</span><span>또는 아래 내용을 복사해 문자 · 카카오톡으로 보내주세요.</span></div></div>' +
        '<pre id="smsText">' + esc(body) + '</pre><div class="sms-actions"><button class="mini" type="button" id="smsCopy">내용 복사</button><span>전화 상담 <b>' + esc(info.tel) + '</b></span></div>';
      var box = $('smsQR');
      try {
        qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
        var q = qrcode(0, 'L'); q.addData('SMSTO:' + info.sms + ':' + body, 'Byte'); q.make();
        box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      } catch (err) { box.hidden = true; }
    }
    $('smsCopy').addEventListener('click', function () { copyText(this, body, $('smsText')); });
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  // 자유수영 · 대관 탭 준비
  $('naverBtn').href = info.naverBooking || 'https://map.naver.com/p/search/' + encodeURIComponent('다이나믹웨이브 불당점');
  $('r-date').min = today();
  $('r-time').innerHTML = '<option value="">시간 협의</option>' + union(D.privateHours.weekday, D.privateHours.sat).map(function (h) { return '<option>' + hh(h) + '</option>'; }).join('');
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-open]'); if (!a) return;
    e.preventDefault(); setWho(a.dataset.open); $('consult').scrollIntoView({ behavior: 'smooth' });
  });
  [].forEach.call(document.querySelectorAll(SENT_SEL), splitSentences);
})();
