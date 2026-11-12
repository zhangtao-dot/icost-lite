/* ============================================================
   iCost Lite · 极简记账
   纯前端 · localStorage 持久化 · 无依赖
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  const KEY = 'icost_lite_v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const storage = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 隐私模式降级 */ } }
  };

  const money = n => (Math.round((n + Number.EPSILON) * 100) / 100)
    .toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return `${y}年${m}月`;
  }

  function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(y, m - 1, d).getDay()];
    const t = todayISO();
    if (iso === t) return `今天 · ${m}月${d}日 ${wd}`;
    if (iso === addDays(t, -1)) return `昨天 · ${m}月${d}日 ${wd}`;
    return `${m}月${d}日 ${wd}`;
  }

  function shortAmt(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
  }

  /* ---------------- 默认分类 ---------------- */
  const DEFAULT_CATS = [
    // 支出
    { name: '餐饮', icon: '🍜', type: 'expense', color: '#FF9F43' },
    { name: '交通', icon: '🚌', type: 'expense', color: '#4FC3F7' },
    { name: '购物', icon: '🛍️', type: 'expense', color: '#F06292' },
    { name: '娱乐', icon: '🎮', type: 'expense', color: '#9575CD' },
    { name: '居住', icon: '🏠', type: 'expense', color: '#FFB74D' },
    { name: '通讯', icon: '📱', type: 'expense', color: '#4DB6AC' },
    { name: '医疗', icon: '💊', type: 'expense', color: '#EF5350' },
    { name: '学习', icon: '📚', type: 'expense', color: '#5C6BC0' },
    { name: '人情', icon: '🎁', type: 'expense', color: '#EC407A' },
    { name: '宠物', icon: '🐱', type: 'expense', color: '#8D6E63' },
    { name: '运动', icon: '🏃', type: 'expense', color: '#26A69A' },
    { name: '旅行', icon: '✈️', type: 'expense', color: '#29B6F6' },
    { name: '美容', icon: '💅', type: 'expense', color: '#BA68C8' },
    { name: '其他', icon: '📌', type: 'expense', color: '#90A4AE' },
    // 收入
    { name: '工资', icon: '💰', type: 'income', color: '#12B76A' },
    { name: '奖金', icon: '🎉', type: 'income', color: '#FFC53D' },
    { name: '理财', icon: '📈', type: 'income', color: '#26A69A' },
    { name: '兼职', icon: '💼', type: 'income', color: '#4FC3F7' },
    { name: '红包', icon: '🧧', type: 'income', color: '#EF5350' },
    { name: '退款', icon: '↩️', type: 'income', color: '#90A4AE' },
    { name: '其他', icon: '💵', type: 'income', color: '#8D6E63' }
  ];

  const DEFAULT_ACCOUNTS = [
    { name: '现金', icon: '💵', init: 0 },
    { name: '微信', icon: '💚', init: 0 },
    { name: '支付宝', icon: '🔷', init: 0 },
    { name: '银行卡', icon: '💳', init: 0 }
  ];

  const EMOJIS = ['🍜', '🍔', '☕', '🍺', '🚌', '🚕', '⛽', '🚇', '🛍️', '👕', '👟', '🎮', '🎬', '🎵', '🏠', '💡', '📱', '💊', '📚', '🎁', '🐱', '🐶', '🏃', '✈️', '💅', '💇', '🧾', '💳', '💰', '🎉', '📈', '💼', '🧧', '↩️', '💵', '🎯', '🔧', '🎨', '🧸', '📌'];

  /* ---------------- 状态 ---------------- */
  let db = null;
  const state = {
    month: todayISO().slice(0, 7),
    tab: 'home',
    chartType: 'expense',
    bookId: null,
    sheet: {
      open: false, type: 'expense', amount: '0', catId: null,
      accountId: null, toAccountId: null, date: todayISO(), note: '', editingId: null
    }
  };

  /* ---------------- 数据层 ---------------- */
  function newBook(name, icon) {
    return { id: uid(), name, icon: icon || '📒', budget: 0 };
  }

  function seed() {
    const t = todayISO();
    const b = newBook('日常账本', '📒');
    b.budget = 6000;
    const data = {
      version: 1,
      books: [b],
      accounts: DEFAULT_ACCOUNTS.map(a => ({ id: uid(), ...a })),
      cats: [],
      records: []
    };
    data.cats = DEFAULT_CATS.map(c => ({ id: uid(), ...c }));
    const cid = n => data.cats.find(c => c.name === n && c.type === (['工资', '其他'].includes(n) ? 'income' : 'expense'))?.id
      || data.cats.find(c => c.name === n)?.id;
    const acc = n => data.accounts.find(a => a.name === n).id;

    const mk = (type, amount, catName, accName, date, note, time) => ({
      id: uid(), bookId: b.id, type, amount,
      catId: type === 'transfer' ? null : cid(catName),
      accId: acc(accName), toId: null,
      date, time: time || '12:00', note: note || ''
    });

    data.records = [
      mk('expense', 28.5, '餐饮', '微信', t, '咖啡 + 早餐', '08:42'),
      mk('expense', 4, '交通', '支付宝', t, '地铁', '09:05'),
      mk('expense', 32, '餐饮', '微信', addDays(t, -1), '午饭', '12:30'),
      mk('expense', 268, '购物', '银行卡', addDays(t, -1), '外套', '19:20'),
      mk('expense', 15, '交通', '支付宝', addDays(t, -2), '打车', '21:10'),
      mk('income', 12000, '工资', '银行卡', t.slice(0, 7) + '-01', '10月工资', '10:00')
    ];
    return data;
  }

  function load() {
    let d = storage.get();
    if (!d || !d.books || !d.books.length) {
      d = seed();
      storage.set(d);
    }
    // 兼容补全
    d.cats = d.cats || [];
    d.accounts = d.accounts || [];
    d.records = d.records || [];
    db = d;
    state.bookId = d.books[0].id;
  }

  const save = () => storage.set(db);

  const activeBook = () => db.books.find(b => b.id === state.bookId) || db.books[0];
  const catById = id => db.cats.find(c => c.id === id);
  const accById = id => db.accounts.find(a => a.id === id);
  const catOf = id => catById(id) || { name: '未分类', icon: '📌', color: '#90A4AE' };
  const accOf = id => accById(id) || { name: '未知账户', icon: '💳' };

  function recordsOf(bookId, month) {
    return db.records
      .filter(r => r.bookId === bookId && (!month || r.date.slice(0, 7) === month))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }

  function monthStat(list) {
    let exp = 0, inc = 0;
    list.forEach(r => {
      if (r.type === 'expense') exp += r.amount;
      else if (r.type === 'income') inc += r.amount;
    });
    return { exp, inc, count: list.length };
  }

  function accountBalance(accId) {
    const a = accById(accId);
    let bal = a ? (a.init || 0) : 0;
    db.records.forEach(r => {
      if (r.type === 'expense' && r.accId === accId) bal -= r.amount;
      else if (r.type === 'income' && r.accId === accId) bal += r.amount;
      else if (r.type === 'transfer') {
        if (r.accId === accId) bal -= r.amount;
        if (r.toId === accId) bal += r.amount;
      }
    });
    return bal;
  }

  function netWorth() {
    return db.accounts.reduce((s, a) => s + accountBalance(a.id), 0);
  }

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
  }

  /* ---------------- 弹窗 ---------------- */
  let modalActs = [];
  function openModal(opts) {
    $('#modalTitle').textContent = opts.title || '';
    const subEl = $('#modalSub');
    subEl.textContent = opts.sub || '';
    subEl.style.display = opts.sub ? 'block' : 'none';
    $('#modalBody').innerHTML = opts.body || '';
    $('#modalBody').style.display = opts.body ? 'block' : 'none';

    const acts = $('#modalActs');
    acts.innerHTML = '';
    modalActs = opts.acts || [{ text: '好', primary: true, onClick: null }];
    modalActs.forEach((a, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : '');
      btn.textContent = a.text;
      btn.style.height = '40px';
      btn.addEventListener('click', () => {
        const keep = a.onClick ? a.onClick() : undefined;
        if (keep !== false) closeModal();
      });
      acts.appendChild(btn);
    });
    $('#modalMask').classList.add('show');
    if (opts.onMount) opts.onMount($('#modalBody'), $('#modal'));
  }
  function closeModal() {
    $('#modalMask').classList.remove('show');
  }

  /* ---------------- 渲染：明细 ---------------- */
  function renderHome() {
    const b = activeBook();
    $('#bookName').textContent = b.name;
    $('#monthLabel').textContent = monthLabel(state.month);

    const list = recordsOf(b.id, state.month);
    const st = monthStat(list);

    $('#sumExpense').textContent = money(st.exp);
    $('#sumIncome').textContent = '¥' + money(st.inc);
    const bal = st.inc - st.exp;
    $('#sumBalance').textContent = (bal < 0 ? '-¥' : '¥') + money(Math.abs(bal));
    $('#sumCount').textContent = st.count;

    // 预算
    const budget = b.budget || 0;
    const bar = $('#budgetBar');
    if (budget > 0) {
      const pct = Math.min(100, (st.exp / budget) * 100);
      bar.style.width = pct + '%';
      bar.classList.toggle('over', st.exp > budget);
      $('#budgetLabel').textContent = `预算 ¥${money(budget)} · 已用 ${Math.round((st.exp / budget) * 100)}%`;
      const left = budget - st.exp;
      $('#budgetLeft').textContent = left >= 0 ? `剩 ¥${money(left)}` : `超支 ¥${money(-left)}`;
    } else {
      bar.style.width = '0%';
      bar.classList.remove('over');
      $('#budgetLabel').textContent = '预算未设置';
      $('#budgetLeft').textContent = '';
    }

    // 分组
    const wrap = $('#recordList');
    if (!list.length) {
      wrap.innerHTML = `<div class="empty"><div class="e-ico">🧾</div>这个月还没有记录<br>点击下方「记一笔」开始吧</div>`;
      return;
    }
    const groups = new Map();
    list.forEach(r => {
      if (!groups.has(r.date)) groups.set(r.date, []);
      groups.get(r.date).push(r);
    });

    let html = '';
    groups.forEach((rows, date) => {
      const dayStat = monthStat(rows);
      let sums = '';
      if (dayStat.exp > 0) sums += `<i>支 ¥${money(dayStat.exp)}</i>`;
      if (dayStat.inc > 0) sums += `<i style="color:var(--income)">收 ¥${money(dayStat.inc)}</i>`;
      html += `<div class="day-head"><span>${dayLabel(date)}</span><span class="d-sum">${sums}</span></div>`;
      html += `<div class="rec-list">`;
      rows.forEach(r => { html += recordHTML(r); });
      html += `</div>`;
    });
    wrap.innerHTML = html;
  }

  function recordHTML(r) {
    let icon, iconColor, title, sub, amt, cls;
    if (r.type === 'transfer') {
      icon = '🔄'; iconColor = '#9AA0A6';
      title = `${accOf(r.accId).name} → ${accOf(r.toId).name}`;
      sub = r.note || '转账';
      amt = '¥' + money(r.amount); cls = 'trans';
    } else {
      const c = catOf(r.catId);
      icon = c.icon; iconColor = c.color || '#90A4AE';
      title = r.note ? r.note : c.name;
      sub = r.note ? `${c.name} · ${accOf(r.accId).name}` : accOf(r.accId).name;
      amt = (r.type === 'expense' ? '-' : '+') + '¥' + money(r.amount);
      cls = r.type === 'expense' ? 'exp' : 'inc';
    }
    return `<div class="rec" data-id="${r.id}">
      <div class="ico" style="background:${iconColor}24">${icon}</div>
      <div class="info"><div class="n">${esc(title)}</div><div class="m">${r.time} · ${esc(sub)}</div></div>
      <div class="amt ${cls}">${amt}</div>
    </div>`;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* ---------------- 渲染：图表 ---------------- */
  function renderChart() {
    const list = recordsOf(activeBook().id, state.month);
    const type = state.chartType;
    const rows = list.filter(r => r.type === type);
    if ($('#cMonthLabel')) $('#cMonthLabel').textContent = monthLabel(state.month);

    // 聚合
    const map = new Map();
    rows.forEach(r => {
      const k = r.catId || 'none';
      map.set(k, (map.get(k) || 0) + r.amount);
    });
    let arr = Array.from(map.entries())
      .map(([id, v]) => ({ cat: catOf(id), v }))
      .sort((a, b) => b.v - a.v);
    const total = arr.reduce((s, x) => s + x.v, 0);

    // 环形图
    const donut = $('#donut');
    const R = 52, SW = 17, CIR = 2 * Math.PI * R;
    let segs = '';
    if (total > 0) {
      let acc = 0;
      arr.forEach(x => {
        const len = (x.v / total) * CIR;
        const gap = arr.length > 1 ? Math.min(2.5, len * 0.06) : 0;
        segs += `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${x.cat.color || '#ccc'}"
          stroke-width="${SW}" stroke-linecap="round"
          stroke-dasharray="${Math.max(0.5, len - gap)} ${CIR}" stroke-dashoffset="${-acc}"></circle>`;
        acc += len;
      });
    } else {
      segs = `<circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--line)" stroke-width="${SW}"></circle>`;
    }
    donut.innerHTML = `<svg width="132" height="132" viewBox="0 0 132 132">${segs}</svg>
      <div class="mid"><div class="t">${type === 'expense' ? '总支出' : '总收入'}</div>
      <div class="v">¥${total >= 10000 ? shortAmt(total) : money(total)}</div></div>`;

    // 图例
    const legendItems = arr.slice(0, 5);
    if (arr.length > 5) {
      const rest = arr.slice(5).reduce((s, x) => s + x.v, 0);
      legendItems.push({ cat: { name: '其他分类', color: '#C9CCD1' }, v: rest });
    }
    $('#legend').innerHTML = legendItems.length
      ? legendItems.map(x => `<div class="li">
          <span class="dot" style="background:${x.cat.color || '#ccc'}"></span>
          <span class="nm">${esc(x.cat.name)}</span>
          <span class="pc">${total > 0 ? Math.round((x.v / total) * 100) : 0}%</span>
        </div>`).join('')
      : `<div style="font-size:12.5px;color:var(--text-3)">暂无数据</div>`;

    // 排行
    const rank = $('#rankCard');
    if (!arr.length) {
      rank.innerHTML = `<div class="empty" style="padding:26px 0">本月暂无${type === 'expense' ? '支出' : '收入'}记录</div>`;
    } else {
      const max = arr[0].v || 1;
      rank.innerHTML = arr.slice(0, 8).map((x, i) => `
        <div class="rank-row">
          <div class="ico" style="background:${x.cat.color}24">${x.cat.icon}</div>
          <div class="body">
            <div class="line1"><span>${esc(x.cat.name)}</span>
              <span>¥${money(x.v)} <span class="p">${Math.round((x.v / total) * 100)}%</span></span></div>
            <div class="bar"><i style="width:${(x.v / max) * 100}%;background:${x.cat.color}"></i></div>
          </div>
        </div>`).join('');
    }

    // 趋势（近 6 个月）
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(state.month, -i));
    const data = months.map(m => {
      const l = db.records.filter(r => r.bookId === state.bookId && r.date.slice(0, 7) === m);
      const s = monthStat(l);
      return { m, exp: s.exp, inc: s.inc };
    });
    const maxV = Math.max(1, ...data.map(d => Math.max(d.exp, d.inc)));
    $('#trend').innerHTML = data.map(d => `
      <div class="col ${d.m === state.month ? 'now' : ''}">
        <div class="bars">
          <i class="e" style="height:${(d.exp / maxV) * 100}%"></i>
          <i class="i" style="height:${(d.inc / maxV) * 100}%"></i>
        </div>
        <span class="lb">${Number(d.m.slice(5))}月</span>
      </div>`).join('');
    const sum6 = data.reduce((s, d) => s + d.exp, 0);
    $('#trendSum').textContent = `半年支出 ¥${money(sum6)}`;

    // 日历
    const [y, mo] = state.month.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const startWd = first.getDay();
    const days = new Date(y, mo, 0).getDate();
    const prevDays = new Date(y, mo - 1, 0).getDate();
    const byDay = new Map();
    list.forEach(r => {
      if (r.type !== 'expense') return;
      const d = Number(r.date.slice(8, 10));
      byDay.set(d, (byDay.get(d) || 0) + r.amount);
    });
    const maxDay = Math.max(1, ...Array.from(byDay.values()));
    let cells = ['日', '一', '二', '三', '四', '五', '六'].map(w => `<div class="wd">${w}</div>`).join('');
    for (let i = startWd - 1; i >= 0; i--) {
      cells += `<div class="cell mute"><span class="d">${prevDays - i}</span></div>`;
    }
    for (let d = 1; d <= days; d++) {
      const iso = `${state.month}-${pad(d)}`;
      const v = byDay.get(d) || 0;
      const ratio = v / maxDay;
      const lv = v === 0 ? '' : ratio > 0.66 ? 'lv3' : ratio > 0.33 ? 'lv2' : 'lv1';
      const today = iso === todayISO() ? 'today' : '';
      cells += `<div class="cell ${lv} ${today}">
        <span class="d">${d}</span>
        ${v > 0 ? `<span class="a e">${shortAmt(v)}</span>` : ''}
      </div>`;
    }
    const tail = (7 - ((startWd + days) % 7)) % 7;
    for (let i = 1; i <= tail; i++) cells += `<div class="cell mute"><span class="d">${i}</span></div>`;
    $('#calendar').innerHTML = cells;
    $('#calMonth').textContent = monthLabel(state.month);
  }

  /* ---------------- 渲染：账本 ---------------- */
  function renderBooks() {
    const cur = activeBook();
    $('#bookList').innerHTML = db.books.map(b => {
      const st = monthStat(recordsOf(b.id, state.month));
      return `<button class="book-chip ${b.id === cur.id ? 'on' : ''}" data-book="${b.id}">
        <div class="bi">${b.icon}</div>
        <div class="bn">${esc(b.name)}</div>
        <div class="bs">支出 ¥${money(st.exp)}</div>
      </button>`;
    }).join('');

    const st = monthStat(recordsOf(cur.id, state.month));
    const bal = st.inc - st.exp;
    const budget = cur.budget || 0;
    const pct = budget > 0 ? Math.min(100, (st.exp / budget) * 100) : 0;
    $('#bookOverview').innerHTML = `
      <div style="display:flex;gap:14px;text-align:center">
        <div style="flex:1"><div style="font-size:11.5px;color:var(--text-3);font-weight:600">支出</div>
          <div style="font-size:17px;font-weight:700;margin-top:4px;letter-spacing:-.4px">¥${money(st.exp)}</div></div>
        <div style="width:1px;background:var(--line)"></div>
        <div style="flex:1"><div style="font-size:11.5px;color:var(--text-3);font-weight:600">收入</div>
          <div style="font-size:17px;font-weight:700;margin-top:4px;color:var(--income);letter-spacing:-.4px">¥${money(st.inc)}</div></div>
        <div style="width:1px;background:var(--line)"></div>
        <div style="flex:1"><div style="font-size:11.5px;color:var(--text-3);font-weight:600">结余</div>
          <div style="font-size:17px;font-weight:700;margin-top:4px;letter-spacing:-.4px">${bal < 0 ? '-' : ''}¥${money(Math.abs(bal))}</div></div>
      </div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12.5px;color:var(--text-2);font-weight:600">净资产</span>
        <span style="font-size:18px;font-weight:700;letter-spacing:-.4px">¥${money(netWorth())}</span>
      </div>`;

    $('#budgetCard').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div>
          <div style="font-size:12px;color:var(--text-3);font-weight:600">本月预算</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:-.6px;margin-top:2px">${budget > 0 ? '¥' + money(budget) : '未设置'}</div>
        </div>
        <button class="btn sm" data-act="set-budget">${budget > 0 ? '修改' : '设置'}</button>
      </div>
      ${budget > 0 ? `
      <div class="budget-bar" style="margin-top:12px;background:var(--line);height:8px">
        <i style="width:${pct}%;background:${st.exp > budget ? 'var(--danger)' : 'var(--primary)'}"></i>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-3);margin-top:7px;font-weight:600">
        <span>已用 ¥${money(st.exp)}</span>
        <span>${st.exp > budget ? '超支 ¥' + money(st.exp - budget) : '剩余 ¥' + money(budget - st.exp)}</span>
      </div>` : `<div style="font-size:12px;color:var(--text-3);margin-top:8px">设置预算后可在首页查看使用进度</div>`}`;

    const accs = db.accounts;
    $('#accountList').innerHTML = accs.length ? accs.map(a => {
      const b = accountBalance(a.id);
      return `<div class="li-row" data-acc="${a.id}">
        <div class="ico" style="background:var(--card-2)">${a.icon}</div>
        <div class="tx"><div class="a">${esc(a.name)}</div>
          <div class="b">初始 ¥${money(a.init || 0)}</div></div>
        <div class="rv" style="color:${b < 0 ? 'var(--danger)' : 'var(--text)'}">¥${money(b)}</div>
      </div>`;
    }).join('') + `<div class="li-row" data-act="add-account" style="justify-content:center;color:var(--text-3);font-size:13px;font-weight:600">＋ 添加账户</div>`
      : `<div class="empty" style="padding:24px 0">还没有账户</div>`;
  }

  /* ---------------- 渲染：我的 ---------------- */
  function renderMine() {
    $('#totalRecords').textContent = db.records.length;
    const days = new Set(db.records.map(r => r.date)).size;
    $('#totalDays').textContent = days;
    $('#themeState').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '深色' : '浅色';
  }

  function renderAll() {
    renderHome();
    if (state.tab === 'chart') renderChart();
    if (state.tab === 'books') renderBooks();
    if (state.tab === 'mine') renderMine();
  }

  /* ---------------- 记账面板 ---------------- */
  function openSheet(rec) {
    const s = state.sheet;
    s.open = true;
    s.editingId = rec ? rec.id : null;
    s.type = rec ? rec.type : 'expense';
    s.amount = rec ? String(rec.amount) : '0';
    s.catId = rec ? rec.catId : null;
    s.accId = rec ? rec.accId : (db.accounts[0] ? db.accounts[0].id : null);
    s.toId = rec ? rec.toId : (db.accounts[1] ? db.accounts[1].id : null);
    s.date = rec ? rec.date : todayISO();
    s.note = rec ? rec.note : '';

    $('#noteInput').value = s.note;
    $('#dateText').textContent = s.date === todayISO() ? '今天' : s.date.slice(5).replace('-', '/');
    $('#accountText').textContent = accOf(s.accId).name;
    $$('#typeSeg button').forEach(b => b.classList.toggle('on', b.dataset.type === s.type));

    renderCatGrid();
    renderAmount();
    $('#sheet').classList.add('show');
    $('#sheetMask').classList.add('show');
  }

  function closeSheet() {
    state.sheet.open = false;
    $('#sheet').classList.remove('show');
    $('#sheetMask').classList.remove('show');
    $('#noteInput').blur();
  }

  function renderCatGrid() {
    const s = state.sheet;
    let items = [];
    if (s.type === 'transfer') {
      items = db.accounts.map(a => ({
        id: a.id, name: a.name, icon: a.icon, color: '#9AA0A6', isAcc: true
      }));
      s.catId = null;
      if (!s.toId || s.toId === s.accId) {
        const other = db.accounts.find(a => a.id !== s.accId);
        s.toId = other ? other.id : null;
      }
    } else {
      items = db.cats.filter(c => c.type === s.type);
      if (!s.catId || !items.some(i => i.id === s.catId)) {
        s.catId = items.length ? items[0].id : null;
      }
    }
    const selectedId = s.type === 'transfer' ? s.toId : s.catId;
    $('#catGrid').innerHTML = items.map(c => `
      <button class="cat-item ${c.id === selectedId ? 'on' : ''}" data-cid="${c.id}">
        <span class="ci" style="background:${c.color}24">${c.icon}</span>
        <span class="cn">${esc(c.name)}</span>
      </button>`).join('') || `<div class="empty" style="grid-column:1/-1;padding:26px 0">暂无分类，可在「我的」中添加</div>`;
  }

  function renderAmount() {
    const el = $('#amountVal');
    const v = state.sheet.amount || '0';
    el.textContent = v;
    el.classList.toggle('zero', v === '0' || v === '');
  }

  function keyInput(k) {
    const s = state.sheet;
    let v = s.amount || '0';
    if (k === 'ok') { saveRecord(); return; }
    if (k === 'back') {
      v = v.length > 1 ? v.slice(0, -1) : '0';
      if (v === '') v = '0';
    } else if (k === '.') {
      if (!v.includes('.')) v += '.';
    } else if (k === '00') {
      if (v !== '0') {
        const dec = v.split('.')[1];
        if (!dec) { if (v.replace('.', '').length < 8) v += '00'; }
        else if (dec.length < 2) v += dec.length === 0 ? '00' : '0';
      }
    } else {
      const dec = v.split('.');
      if (dec[1] !== undefined) {
        if (dec[1].length >= 2) { renderAmount(); return; }
      } else if (v.replace('.', '').length >= 8) { renderAmount(); return; }
      v = v === '0' ? k : v + k;
    }
    s.amount = v;
    renderAmount();
  }

  function saveRecord() {
    const s = state.sheet;
    const amount = parseFloat(s.amount);
    if (!amount || amount <= 0) { toast('请输入金额'); return; }

    if (s.type === 'transfer') {
      if (!s.toId || s.toId === s.accId) { toast('请选择不同的转入账户'); return; }
    } else if (!s.catId) { toast('请选择分类'); return; }

    if (s.editingId) {
      const r = db.records.find(x => x.id === s.editingId);
      if (r) {
        Object.assign(r, {
          type: s.type, amount,
          catId: s.type === 'transfer' ? null : s.catId,
          accId: s.accId, toId: s.type === 'transfer' ? s.toId : null,
          date: s.date, note: $('#noteInput').value.trim()
        });
      }
      toast('已保存修改');
    } else {
      db.records.push({
        id: uid(), bookId: state.bookId, type: s.type, amount,
        catId: s.type === 'transfer' ? null : s.catId,
        accId: s.accId, toId: s.type === 'transfer' ? s.toId : null,
        date: s.date, time: s.date === todayISO() ? nowTime() : '12:00',
        note: $('#noteInput').value.trim()
      });
      toast(`已记录 ¥${money(amount)}`);
    }
    save();
    closeSheet();
    if (s.date.slice(0, 7) !== state.month) state.month = s.date.slice(0, 7);
    renderAll();
  }

  /* ---------------- 记录操作 ---------------- */
  function openRecordMenu(id) {
    const r = db.records.find(x => x.id === id);
    if (!r) return;
    const c = r.type === 'transfer' ? { name: '转账', icon: '🔄', color: '#9AA0A6' } : catOf(r.catId);
    openModal({
      title: `${c.icon} ${r.note || c.name}`,
      sub: `${r.date} ${r.time} · ${r.type === 'transfer' ? accOf(r.accId).name + ' → ' + accOf(r.toId).name : accOf(r.accId).name + ' · ' + c.name}`,
      body: `<div style="text-align:center;font-size:30px;font-weight:700;letter-spacing:-1px;padding:4px 0 6px">
        ${r.type === 'expense' ? '-' : r.type === 'income' ? '+' : ''}¥${money(r.amount)}</div>`,
      acts: [
        { text: '编辑', onClick: () => { setTimeout(() => openSheet(r), 180); } },
        {
          text: '删除', danger: true, onClick: () => {
            setTimeout(() => {
              openModal({
                title: '删除这条记录？',
                sub: '删除后不可恢复',
                acts: [
                  { text: '取消' },
                  {
                    text: '删除', danger: true, onClick: () => {
                      db.records = db.records.filter(x => x.id !== id);
                      save(); renderAll(); toast('已删除');
                    }
                  }
                ]
              });
            }, 180);
          }
        }
      ]
    });
  }

  /* ---------------- 分类 / 账户管理 ---------------- */
  function openCategoryManager() {
    openModal({
      title: '分类管理',
      sub: '点击可删除分类，记录会保留',
      body: `<div id="cmBody"></div>`,
      acts: [{ text: '关闭' }],
      onMount: body => renderCatManager(body)
    });
  }

  function renderCatManager(bodyEl) {
    const groups = [
      { t: '支出分类', type: 'expense' },
      { t: '收入分类', type: 'income' }
    ];
    let html = '';
    groups.forEach(g => {
      html += `<div style="font-size:11.5px;font-weight:650;color:var(--text-3);margin:10px 0 4px">${g.t}</div><div class="cat-manage">`;
      db.cats.filter(c => c.type === g.type).forEach(c => {
        html += `<div class="cm-row">
          <span class="ci" style="background:${c.color}24">${c.icon}</span>
          <span class="nm">${esc(c.name)}</span>
          <button class="del-btn" data-del-cat="${c.id}">删除</button>
        </div>`;
      });
      html += `</div>`;
    });
    html += `<button class="btn ghost" id="addCatBtn" style="margin-top:14px;height:40px">＋ 新建分类</button>`;
    bodyEl.innerHTML = html;

    bodyEl.onclick = e => {
      const del = e.target.closest('[data-del-cat]');
      if (del) {
        const id = del.dataset.delCat;
        db.cats = db.cats.filter(c => c.id !== id);
        save(); renderCatManager(bodyEl); renderAll(); toast('已删除分类');
        return;
      }
      if (e.target.closest('#addCatBtn')) openNewCatForm(bodyEl);
    };
  }

  function openNewCatForm(bodyEl) {
    const picked = { icon: '🍜', type: 'expense', color: '#FF9F43' };
    bodyEl.innerHTML = `
      <div class="field"><label>名称</label>
        <input class="input" id="ncName" placeholder="例如：早餐" maxlength="6" /></div>
      <div class="field"><label>类型</label>
        <div class="seg" id="ncType" style="width:100%;box-shadow:none;background:var(--card-2)">
          <button class="on" data-t="expense" style="flex:1">支出</button>
          <button data-t="income" style="flex:1">收入</button>
        </div></div>
      <div class="field"><label>图标</label><div class="emoji-pick" id="ncEmoji"></div></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn" id="ncBack" style="height:40px">返回</button>
        <button class="btn primary" id="ncSave" style="height:40px">添加</button>
      </div>`;

    const emojiWrap = $('#ncEmoji', bodyEl);
    const drawEmoji = () => {
      emojiWrap.innerHTML = EMOJIS.map(e =>
        `<button data-e="${e}" class="${e === picked.icon ? 'on' : ''}">${e}</button>`).join('');
    };
    drawEmoji();

    $$('#ncType button', bodyEl).forEach(b => {
      b.onclick = () => {
        $$('#ncType button', bodyEl).forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        picked.type = b.dataset.t;
      };
    });
    emojiWrap.onclick = e => {
      const b = e.target.closest('[data-e]');
      if (!b) return;
      picked.icon = b.dataset.e;
      drawEmoji();
    };
    $('#ncBack', bodyEl).onclick = () => renderCatManager(bodyEl);
    $('#ncSave', bodyEl).onclick = () => {
      const name = $('#ncName', bodyEl).value.trim();
      if (!name) { toast('请输入分类名称'); return; }
      if (db.cats.some(c => c.name === name && c.type === picked.type)) { toast('该分类已存在'); return; }
      const palette = ['#FF9F43', '#4FC3F7', '#F06292', '#9575CD', '#FFB74D', '#4DB6AC', '#EF5350', '#5C6BC0'];
      db.cats.push({ id: uid(), name, icon: picked.icon, type: picked.type, color: palette[db.cats.length % palette.length] });
      save(); renderCatManager(bodyEl); renderAll(); toast('已添加');
    };
    setTimeout(() => $('#ncName', bodyEl) && $('#ncName', bodyEl).focus(), 60);
  }

  function openAccountModal() {
    openModal({
      title: '账户管理',
      sub: '账户余额跨账本统一计算',
      body: `<div id="amBody"></div>`,
      acts: [{ text: '关闭' }],
      onMount: body => renderAccManager(body)
    });
  }

  function renderAccManager(bodyEl) {
    bodyEl.innerHTML = `<div class="cat-manage">` + (db.accounts.map(a => `
      <div class="cm-row">
        <span class="ci" style="background:var(--card-2)">${a.icon}</span>
        <span class="nm">${esc(a.name)}</span>
        <span style="font-size:12.5px;color:var(--text-2);font-weight:600">¥${money(accountBalance(a.id))}</span>
        ${db.accounts.length > 1 ? `<button class="del-btn" data-del-acc="${a.id}">删除</button>` : ''}
      </div>`).join('') || '<div class="empty" style="padding:16px 0">还没有账户</div>')
      + `</div>
      <div class="field" style="margin-top:14px"><label>新增账户</label>
        <input class="input" id="naName" placeholder="账户名称，如 招商银行" maxlength="10" /></div>
      <div class="field"><label>初始余额</label>
        <input class="input" id="naInit" type="number" inputmode="decimal" placeholder="0.00" /></div>
      <button class="btn primary" id="naSave" style="height:40px">添加账户</button>`;

    bodyEl.onclick = e => {
      const del = e.target.closest('[data-del-acc]');
      if (del) {
        const id = del.dataset.delAcc;
        db.accounts = db.accounts.filter(a => a.id !== id);
        db.records = db.records.filter(r => r.accId !== id && r.toId !== id);
        save(); renderAccManager(bodyEl); renderAll(); toast('已删除账户及相关记录');
      }
    };
    $('#naSave', bodyEl).onclick = () => {
      const name = $('#naName', bodyEl).value.trim();
      if (!name) { toast('请输入账户名称'); return; }
      const init = parseFloat($('#naInit', bodyEl).value) || 0;
      const icons = ['💳', '💵', '🏦', '📱', '💚', '🔷'];
      db.accounts.push({ id: uid(), name, icon: icons[db.accounts.length % icons.length], init });
      save(); renderAccManager(bodyEl); renderAll(); toast('已添加');
    };
  }

  /* ---------------- 预算 / 账本 ---------------- */
  function openBudgetModal() {
    const b = activeBook();
    openModal({
      title: '月度预算',
      sub: `为「${b.name}」设置每月支出上限`,
      body: `<div class="field"><label>预算金额（元）</label>
        <input class="input" id="bgInput" type="number" inputmode="decimal" placeholder="0" value="${b.budget || ''}" /></div>`,
      acts: [{ text: '取消' }, {
        text: '保存', primary: true, onClick: () => {
          const v = parseFloat($('#bgInput').value) || 0;
          b.budget = Math.max(0, v);
          save(); renderAll(); toast(v > 0 ? '预算已设置' : '已取消预算');
        }
      }],
      onMount: () => setTimeout(() => $('#bgInput') && $('#bgInput').focus(), 80)
    });
  }

  function openNewBookModal() {
    let icon = '📒';
    const icons = ['📒', '🏠', '✈️', '💼', '🎓', '🐱', '🍽️', '🎁'];
    openModal({
      title: '新建账本',
      sub: '为不同场景建立独立账本，例如旅行、装修',
      body: `<div class="field"><label>账本名称</label>
          <input class="input" id="nbName" placeholder="例如：日本旅行" maxlength="10" /></div>
        <div class="field"><label>图标</label><div class="emoji-pick" id="nbIcon">
          ${icons.map(i => `<button data-i="${i}" class="${i === icon ? 'on' : ''}">${i}</button>`).join('')}
        </div></div>`,
      acts: [{ text: '取消' }, {
        text: '创建', primary: true, onClick: () => {
          const name = $('#nbName').value.trim();
          if (!name) { toast('请输入账本名称'); return false; }
          const nb = newBook(name, icon);
          db.books.push(nb);
          state.bookId = nb.id;
          save(); renderAll(); renderBooks(); toast('账本已创建');
        }
      }],
      onMount: body => {
        $('#nbIcon', body).onclick = e => {
          const b = e.target.closest('[data-i]');
          if (!b) return;
          icon = b.dataset.i;
          $$('#nbIcon button', body).forEach(x => x.classList.toggle('on', x === b));
        };
        setTimeout(() => $('#nbName') && $('#nbName').focus(), 80);
      }
    });
  }

  /* ---------------- 导入导出 ---------------- */
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportJSON() {
    const payload = JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2);
    download(`icost-backup-${todayISO()}.json`, payload, 'application/json');
    toast('备份已导出');
  }

  function exportCSV() {
    const head = ['日期', '时间', '类型', '分类', '金额', '账户', '转入账户', '备注', '账本'];
    const rows = db.records
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(r => [
        r.date, r.time,
        r.type === 'expense' ? '支出' : r.type === 'income' ? '收入' : '转账',
        r.type === 'transfer' ? '转账' : catOf(r.catId).name,
        r.amount.toFixed(2),
        accOf(r.accId).name,
        r.toId ? accOf(r.toId).name : '',
        r.note || '',
        (db.books.find(b => b.id === r.bookId) || {}).name || ''
      ]);
    const csv = '\ufeff' + [head, ...rows]
      .map(line => line.map(v => {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\r\n');
    download(`icost-账单-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV 已导出');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        if (!d.books || !Array.isArray(d.records)) throw new Error('格式不正确');
        openModal({
          title: '导入备份',
          sub: `将覆盖当前所有数据（${d.records.length} 条记录）`,
          acts: [{ text: '取消' }, {
            text: '导入', primary: true, onClick: () => {
              db = {
                version: 1,
                books: d.books,
                accounts: d.accounts || [],
                cats: d.cats || DEFAULT_CATS.map(c => ({ id: uid(), ...c })),
                records: d.records || []
              };
              state.bookId = db.books[0].id;
              save(); renderAll(); renderBooks(); toast('导入成功');
            }
          }]
        });
      } catch (err) {
        toast('文件格式不正确');
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- 事件绑定 ---------------- */
  function switchTab(tab) {
    state.tab = tab;
    $$('.page').forEach(p => {
      const on = p.id === 'page-' + tab;
      p.classList.toggle('active', on);
      if (on) p.scrollTop = 0;
    });
    $$('.tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'chart') renderChart();
    if (tab === 'books') renderBooks();
    if (tab === 'mine') renderMine();
  }

  function bind() {
    // 导航
    $$('.tab[data-tab]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('#addBtn').addEventListener('click', () => openSheet(null));

    // 月份切换
    const prev = () => { state.month = shiftMonth(state.month, -1); renderAll(); };
    const next = () => { state.month = shiftMonth(state.month, 1); renderAll(); };
    $('#prevMonth').onclick = prev;
    $('#nextMonth').onclick = next;
    const cPrev = $('#cPrev'), cNext = $('#cNext');
    if (cPrev) cPrev.onclick = prev;
    if (cNext) cNext.onclick = next;

    // 账本切换（首页 pill -> 账本页）
    $('#bookSwitcher').onclick = () => { switchTab('books'); renderBooks(); };

    // 记账面板
    $('#sheetClose').onclick = closeSheet;
    $('#sheetMask').onclick = closeSheet;
    $('#amountDel').onclick = () => keyInput('back');
    $('#keypad').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b) keyInput(b.dataset.k);
    });
    $('#typeSeg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      state.sheet.type = b.dataset.type;
      $$('#typeSeg button').forEach(x => x.classList.toggle('on', x === b));
      renderCatGrid();
    });
    $('#catGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-cid]');
      if (!b) return;
      if (state.sheet.type === 'transfer') state.sheet.toId = b.dataset.cid;
      else state.sheet.catId = b.dataset.cid;
      renderCatGrid();
    });
    $('#metaDate').onclick = () => {
      openModal({
        title: '选择日期',
        body: `<input class="input" id="datePick" type="date" value="${state.sheet.date}" />`,
        acts: [{ text: '取消' }, {
          text: '确定', primary: true, onClick: () => {
            const v = $('#datePick').value;
            if (v) {
              state.sheet.date = v;
              $('#dateText').textContent = v === todayISO() ? '今天' : v.slice(5).replace('-', '/');
            }
          }
        }]
      });
    };
    $('#metaAccount').onclick = () => {
      const s = state.sheet;
      openModal({
        title: s.type === 'transfer' ? '选择转出账户' : '选择账户',
        body: `<div class="list" style="box-shadow:none">` + db.accounts.map(a => `
          <div class="li-row" data-pick-acc="${a.id}" style="${a.id === s.accId ? 'background:var(--primary-soft)' : ''}">
            <div class="ico" style="background:var(--card-2)">${a.icon}</div>
            <div class="tx"><div class="a">${esc(a.name)}</div></div>
            <div class="rv" style="font-size:12.5px;color:var(--text-3)">¥${money(accountBalance(a.id))}</div>
          </div>`).join('') + `</div>`,
        acts: [
          { text: '新建账户', onClick: () => { setTimeout(openAccountModal, 180); } },
          { text: '取消' }
        ],
        onMount: body => {
          body.onclick = e => {
            const row = e.target.closest('[data-pick-acc]');
            if (!row) return;
            s.accId = row.dataset.pickAcc;
            if (s.toId === s.accId) {
              const other = db.accounts.find(a => a.id !== s.accId);
              s.toId = other ? other.id : null;
            }
            $('#accountText').textContent = accOf(s.accId).name;
            renderCatGrid();
            closeModal();
          };
        }
      });
    };

    // 记录点击
    $('#recordList').addEventListener('click', e => {
      const row = e.target.closest('[data-id]');
      if (row) openRecordMenu(row.dataset.id);
    });

    // 图表类型
    $('#chartSeg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      state.chartType = b.dataset.type;
      $$('#chartSeg button').forEach(x => x.classList.toggle('on', x === b));
      renderChart();
    });

    // 账本页
    $('#bookList').addEventListener('click', e => {
      const b = e.target.closest('[data-book]');
      if (!b) return;
      state.bookId = b.dataset.book;
      renderAll(); renderBooks();
    });
    $('#newBookBtn').onclick = openNewBookModal;
    $('#page-books').addEventListener('click', e => {
      if (e.target.closest('[data-act="set-budget"]')) openBudgetModal();
      if (e.target.closest('[data-act="add-account"]')) openAccountModal();
      const acc = e.target.closest('[data-acc]');
      if (acc) toast(`${accOf(acc.dataset.acc).name} · 余额 ¥${money(accountBalance(acc.dataset.acc))}`);
    });

    // 我的页
    $('#page-mine').addEventListener('click', e => {
      const row = e.target.closest('[data-act]');
      if (!row) return;
      const act = row.dataset.act;
      if (act === 'categories') openCategoryManager();
      else if (act === 'accounts') openAccountModal();
      else if (act === 'budget') openBudgetModal();
      else if (act === 'install') openInstallGuide();
      else if (act === 'theme') toggleTheme();
      else if (act === 'export-json') exportJSON();
      else if (act === 'export-csv') exportCSV();
      else if (act === 'import') $('#fileInput').click();
      else if (act === 'reset') {
        openModal({
          title: '清空所有数据？',
          sub: '所有账本、记录与账户将被删除且无法恢复，建议先导出备份。',
          acts: [{ text: '取消' }, {
            text: '确认清空', danger: true, onClick: () => {
              db = seed();
              state.bookId = db.books[0].id;
              state.month = todayISO().slice(0, 7);
              save(); renderAll(); renderBooks(); toast('已重置');
            }
          }]
        });
      }
    });

    $('#fileInput').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (f) importJSON(f);
      e.target.value = '';
    });

    $('#modalMask').addEventListener('click', e => {
      if (e.target.id === 'modalMask') closeModal();
    });

    // 键盘快捷键（桌面端）
    document.addEventListener('keydown', e => {
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if (!state.sheet.open) {
        if (typing) return;
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openSheet(null); }
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (e.key === 'Escape') { if (typing) el.blur(); else closeSheet(); return; }
      if (typing) return;
      if (/^[0-9]$/.test(e.key)) keyInput(e.key);
      else if (e.key === '.') keyInput('.');
      else if (e.key === 'Backspace') { e.preventDefault(); keyInput('back'); }
      else if (e.key === 'Enter') { e.preventDefault(); keyInput('ok'); }
    });
  }

  /* ---------------- PWA 安装 ---------------- */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    const hint = $('#installHint');
    if (hint) hint.textContent = '点击立即安装到桌面';
  });

  function openInstallGuide() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) { toast('已经是从桌面图标打开啦'); return; }

    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(res => {
        if (res && res.outcome === 'accepted') toast('安装成功，请在桌面查看');
        deferredInstall = null;
      });
      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      openModal({
        title: '添加到主屏幕',
        sub: 'iOS 需要通过 Safari 浏览器手动添加：',
        body: `<div style="font-size:13.5px;line-height:2.1;color:var(--text-2)">
          1️⃣ 用 <b style="color:var(--text)">Safari</b> 打开本页<br>
          2️⃣ 点击底部「分享」按钮 <b style="color:var(--text)">⎋</b><br>
          3️⃣ 选择「<b style="color:var(--text)">添加到主屏幕</b>」<br>
          4️⃣ 点击「添加」，桌面即出现小恐龙图标 🦕</div>`,
        acts: [{ text: '知道了', primary: true }]
      });
    } else {
      openModal({
        title: '安装到手机桌面',
        sub: '在浏览器菜单中手动安装：',
        body: `<div style="font-size:13.5px;line-height:2.1;color:var(--text-2)">
          1️⃣ 点击浏览器右上角 <b style="color:var(--text)">⋮</b> 菜单<br>
          2️⃣ 选择「<b style="color:var(--text)">添加到主屏幕</b>」或「安装应用」<br>
          3️⃣ 确认后桌面即出现 App 图标 🦕</div>`,
        acts: [{ text: '知道了', primary: true }]
      });
    }
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0E0F11' : '#F4F5F7');
    try { localStorage.setItem('icost_theme', t); } catch (e) {}
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    renderMine();
    toast(next === 'dark' ? '已切换深色模式' : '已切换浅色模式');
  }

  /* ---------------- 启动 ---------------- */
  let booted = false;
  function init() {
    if (booted) return;
    booted = true;
    let t = 'light';
    try {
      t = localStorage.getItem('icost_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {}
    applyTheme(t);

    load();
    bind();
    renderAll();

    // Service Worker（离线缓存，PWA 安装前提）
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
