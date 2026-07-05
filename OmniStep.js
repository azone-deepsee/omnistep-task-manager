/**
 *  * OmniStep Core Engine - Final Evolution (Complete Version)
 * テンプレート機能 / 動的タイトル / カテゴリ統一 / 4月始まり同期タイムライン
 */

/** アプリ版（リリース時はここだけ上げる。Git のタグ v1.2.1 などと揃えると追いやすいです） */
const PBPM_APP_VERSION = "1.2.1";

let isInitialLoad = true;
let lastToggledTheme = null; // ★追加：最後にクリックされた親タスク名を記憶
let isDraggingNow = false; // ドラッグ中フラグ
let dependencyDrawTimer = null;

function clearDependencyLines() {
    // タイムライン依存線（SVG）を消して、遅延描画もキャンセル
    const wrapper = document.getElementById('timelineUnifiedWrapper');
    if (!wrapper) return;
    const old = wrapper.querySelector('svg.timeline-dependency-lines');
    if (old) old.remove();
    if (dependencyDrawTimer) {
        clearTimeout(dependencyDrawTimer);
        dependencyDrawTimer = null;
    }
}

// タイムライン：表示範囲（今日の月から N か月）
const LS_PBPM_TL_MONTH_RANGE = "pbpm_timeline_month_range";
let timelineMonthRange = (() => {
    const n = parseInt(localStorage.getItem(LS_PBPM_TL_MONTH_RANGE) || "12", 10);
    return [3, 6, 9, 12].includes(n) ? n : 12;
})();
let forcedCollapsedMonths = new Set(); // renderTimeline が再計算

function syncTimelineRangeButtons() {
    const group = document.querySelector(".timeline-range-group");
    if (!group) return;
    group.querySelectorAll(".range-btn").forEach((b) => {
        const m = parseInt(b.getAttribute("data-months") || "", 10);
        b.classList.toggle("is-active", m === timelineMonthRange);
    });
}

function setTimelineMonthRange(months) {
    const n = Number(months);
    if (![3, 6, 9, 12].includes(n)) return;
    timelineMonthRange = n;
    try {
        localStorage.setItem(LS_PBPM_TL_MONTH_RANGE, String(n));
    } catch {
        /* ignore */
    }
    syncTimelineRangeButtons();
    const timeEl = document.getElementById("timelineView");
    if (timeEl && timeEl.style.display !== "none") renderTimeline();
}

/** CSS :root の --accordion-row-duration-in / -out（秒）に合わせる。+25ms でアニメ終了後に再描画 */
const ACCORDION_ROW_ANIM_IN_MS = Math.round(0.3 * 1000) + 25;
const ACCORDION_ROW_ANIM_OUT_MS = Math.round(0.35 * 1000) + 25;

const statusList = ["未着手", "調査中", "進行中", "修正中", "完了"];
const TERMINAL_STATUSES = new Set(["完了", "中止"]);

function isTerminalTaskStatus(status) {
    return TERMINAL_STATUSES.has(status);
}

/** 子がすべて終端のとき、枝番最後の子のステータスで親の表示を決める（完了／中止） */
function resolveParentStatusFromChildren(subTasks) {
    if (!subTasks.length) return null;
    const sorted = [...subTasks].sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
    if (!sorted.every((t) => isTerminalTaskStatus(t.status))) return null;
    const last = sorted[sorted.length - 1];
    if (last.status === "完了") return "完了";
    if (last.status === "中止") return "中止";
    return null;
}

/** 子タスクの状態から親ステータスを更新（保存は呼び出し側） */
function applyParentStatusFromChildrenForFamily(familyKey) {
    const parent = tasks.find(
        (t) => !t.archived && getTaskFamilyKey(t) === familyKey && isParentTask(t) && !isExternalTask(t)
    );
    if (!parent) return false;
    const subTasks = tasks.filter(
        (t) => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t) && !isExternalTask(t)
    );
    if (!subTasks.length) return false;
    const resolved = resolveParentStatusFromChildren(subTasks);
    if (resolved) {
        if (parent.status === resolved) return false;
        parent.status = resolved;
        return true;
    }
    if (isTerminalTaskStatus(parent.status)) {
        parent.status = "進行中";
        return true;
    }
    return false;
}

/**
 * 版履歴（アプリ内蔵・表示の正）。リリース時に先頭へ追記。localStorage には依存しない。
 * releasedAt: "YYYY-MM-DD" または ISO。modifier: 担当者名（不明時は "—"）
 */
const PBPM_VERSION_HISTORY = [
    {
        ver: "1.2.1",
        content:
            "【実績】「実績更新」ボタン追加（起動時・進捗変更時も自動）。調査中・進行中・修正中の子タスク実績終了を今日まで伸ばし、納期超過分は実績を赤表示。計画ドラッグは実績データ・表示とも独立（ドラッグ中も実績は固定）。",
        releasedAt: "2026-05-20",
        modifier: "—",
    },
    {
        ver: "1.2.0",
        content:
            "【データ】年間日程マスターを日程2列化（開始・終了、単日／期間）＋休日フラグ。休日はタイムラインで日曜と同帯表示。CSVも終了日・休日列に対応。月見出し強調、遅れテーマの赤枠（一覧・タイムライン）、単日時の終了日欄グレーアウト。",
        releasedAt: "2026-05-20",
        modifier: "—",
    },
    {
        ver: "1.1.4",
        content:
            "タイムライン子バーのPDCA表示（B1）：計画は従来幅の破線枠、実績は下段の実線で重ね表示。実績修正OFF＝計画の移動・納期伸縮、ON＝実績のみ移動・終了日伸縮。",
        releasedAt: "2026-05-20",
        modifier: "—",
    },
    {
        ver: "1.1.3",
        content:
            "過去月の手動開閉を復活。親ステータスを子変更時に保存。タイムライン検索（テーマ単位）。外部CSV複数担当の取込・表示切替・タスクID表記（担当者番号）******。",
        releasedAt: "2026-06-01",
        modifier: "—",
    },
    {
        ver: "1.1.2",
        content:
            "タスク検索をテーマ単位で表示。検索語に一致するタスクを含むテーマの親行・子行をまとめて表示（アコーディオン閉じ時も子行を展開）。",
        releasedAt: "2026-05-20",
        modifier: "—",
    },
    {
        ver: "1.1.1",
        content:
            "不具合修正（連携一括・親中止・列レイアウト・版履歴幅）。中止表示・親ステータス・子並べ替えアニメ・テーマカレンダー色の改善。",
        releasedAt: "2026-05-20",
        modifier: "—",
    },
    {
        ver: "1.1.0",
        content:
            "一覧UI刷新（テーマ/課題統合・着手/納期列・中止・版履歴・アコーディオン一括・外部CSV絞込・タイムライン/カレンダー改善）。スクロールは画面全体に統一。",
        releasedAt: "2026-05-20",
        modifier: "—",
    },
    {
        ver: "1.0.0",
        content: "初版リリース。",
        releasedAt: "",
        modifier: "—",
    },
];

/** 外部CSV表示フィルタ: merged=自分+全外部 / external-all=外部のみ全担当 / それ以外=担当者ID */
let externalOwnerFilterMode = "merged";
let listAccordionBulkCollapsed = false;

/** テーマ色パレット（親行のカラーバーから選択） */
const THEME_ACCENT_PALETTE = [
    "#c62828", "#6a1b9a", "#283593", "#0277bd", "#00695c",
    "#2e7d32", "#f57f17", "#e65100", "#546e7a", "#37474f"
];

let themeColorPickerEl = null;

/** 枠1～6が空欄のときに使う既定名（従来の6カテゴリ） */
const DEFAULT_CATEGORY_SIX = ["日常業務", "イベント", "デジタル化", "生産管理", "教育", "その他"];
const CATEGORY_SLOT_COUNT = 10;
const LS_PBPM_CATEGORY_SLOTS = "pbpm_category_slots";

function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function escapeHtmlAttr(s) {
    return escapeHtml(s);
}

/** ヘルプON時ホバー用（「名前：説明」形式を想定） */
function helpAttr(text) {
    if (!text) return "";
    return ` data-help="${escapeHtmlAttr(text)}"`;
}

const LS_PBPM_HELP_HOVER = "pbpm_help_hover";
let helpHoverOn = false;
let helpHoverTooltipEl = null;
let helpHoverMoveBound = false;

function loadHelpHoverState() {
    try {
        helpHoverOn = localStorage.getItem(LS_PBPM_HELP_HOVER) === "1";
    } catch {
        helpHoverOn = false;
    }
}

function hideHelpHoverTooltip() {
    if (!helpHoverTooltipEl) return;
    helpHoverTooltipEl.style.display = "none";
    helpHoverTooltipEl.setAttribute("aria-hidden", "true");
}

function ensureHelpHoverTooltipEl() {
    if (!helpHoverTooltipEl) {
        helpHoverTooltipEl = document.getElementById("help-hover-tooltip");
        if (!helpHoverTooltipEl) {
            helpHoverTooltipEl = document.createElement("div");
            helpHoverTooltipEl.id = "help-hover-tooltip";
            helpHoverTooltipEl.className = "help-hover-tooltip";
            helpHoverTooltipEl.setAttribute("role", "tooltip");
            document.body.appendChild(helpHoverTooltipEl);
        }
    }
    return helpHoverTooltipEl;
}

function showHelpHoverTooltip(text, clientX, clientY) {
    const el = ensureHelpHoverTooltipEl();
    el.textContent = text;
    el.style.display = "block";
    el.setAttribute("aria-hidden", "false");
    const pad = 12;
    const offX = 14;
    const offY = 18;
    let x = clientX + offX;
    let y = clientY + offY;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 6) x = window.innerWidth - rect.width - 6;
    if (rect.bottom > window.innerHeight - 6) y = clientY - rect.height - 8;
    el.style.left = `${Math.max(6, x)}px`;
    el.style.top = `${Math.max(6, y)}px`;
}

function onDocumentMouseMoveHelpHover(e) {
    const truncTheme = e.target.closest(".theme-name--ellipsis-tip");
    if (truncTheme && truncTheme.scrollWidth > truncTheme.clientWidth + 1) {
        hideHelpHoverTooltip();
        return;
    }
    if (!helpHoverOn) return;
    let t = e.target.closest("[data-help]");
    if (!t) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        if (under) t = under.closest("[data-help]");
    }
    if (!t) {
        hideHelpHoverTooltip();
        return;
    }
    const dh = t.getAttribute("data-help");
    if (!dh) {
        hideHelpHoverTooltip();
        return;
    }
    showHelpHoverTooltip(dh, e.clientX, e.clientY);
}

let themeOverflowTooltipEl = null;
let themeOverflowMoveBound = false;

function hideThemeOverflowTooltip() {
    if (!themeOverflowTooltipEl) return;
    themeOverflowTooltipEl.style.display = "none";
    themeOverflowTooltipEl.setAttribute("aria-hidden", "true");
}

function ensureThemeOverflowTooltipEl() {
    if (!themeOverflowTooltipEl) {
        themeOverflowTooltipEl = document.getElementById("theme-overflow-tooltip");
        if (!themeOverflowTooltipEl) {
            themeOverflowTooltipEl = document.createElement("div");
            themeOverflowTooltipEl.id = "theme-overflow-tooltip";
            themeOverflowTooltipEl.className = "theme-overflow-tooltip";
            themeOverflowTooltipEl.setAttribute("role", "tooltip");
            themeOverflowTooltipEl.setAttribute("aria-hidden", "true");
            document.body.appendChild(themeOverflowTooltipEl);
        }
    }
    return themeOverflowTooltipEl;
}

function showThemeOverflowTooltip(text, clientX, clientY) {
    const el = ensureThemeOverflowTooltipEl();
    el.textContent = text;
    el.style.display = "block";
    el.setAttribute("aria-hidden", "false");
    const offX = 14;
    const offY = 20;
    let x = clientX + offX;
    let y = clientY + offY;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 6) x = window.innerWidth - rect.width - 6;
    if (rect.bottom > window.innerHeight - 6) y = clientY - rect.height - 8;
    el.style.left = `${Math.max(6, x)}px`;
    el.style.top = `${Math.max(6, y)}px`;
}

const ELLIPSIS_OVERFLOW_SELECTORS =
    ".theme-name--ellipsis-tip, .tl-child-detail--ellipsis-tip, .tl-parent-label--ellipsis-tip, .timeline-bar-label--ellipsis-tip, .timeline-bar--ellipsis-tip";

/** 省略表示中テキストの全文ホバー対象を root 内から探す */
function findEllipsisOverflowTarget(e, rootEl) {
    if (!rootEl) return null;
    let el = e.target.closest(ELLIPSIS_OVERFLOW_SELECTORS);
    if (!el) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        if (under && rootEl.contains(under)) el = under.closest(ELLIPSIS_OVERFLOW_SELECTORS);
    }
    return el || null;
}

function findListViewEllipsisOverflowTarget(e, listView) {
    return findEllipsisOverflowTarget(e, listView);
}

function findTimelineEllipsisOverflowTarget(e, timelineView) {
    return findEllipsisOverflowTarget(e, timelineView);
}

function onDocumentMouseMoveThemeOverflow(e) {
    const listView = document.getElementById("listView");
    const timelineView = document.getElementById("timelineView");
    const inList = listView && listView.style.display !== "none" && listView.contains(e.target);
    const inTimeline =
        timelineView && timelineView.style.display !== "none" && timelineView.contains(e.target);
    if (!inList && !inTimeline) {
        hideThemeOverflowTooltip();
        return;
    }
    const root = inList ? listView : timelineView;
    const nameEl = findEllipsisOverflowTarget(e, root);
    if (!nameEl || !document.body.contains(nameEl)) {
        hideThemeOverflowTooltip();
        return;
    }
    const labelWrap = nameEl.closest(".label-text");
    const truncated =
        nameEl.scrollWidth > nameEl.clientWidth + 1 ||
        nameEl.scrollHeight > nameEl.clientHeight + 1 ||
        (labelWrap && labelWrap.scrollHeight > labelWrap.clientHeight + 1);
    if (!truncated) {
        hideThemeOverflowTooltip();
        return;
    }
    const text = (nameEl.textContent || nameEl.innerText || "").trim();
    if (!text) {
        hideThemeOverflowTooltip();
        return;
    }
    showThemeOverflowTooltip(text, e.clientX, e.clientY);
}

function bindHelpHoverListeners() {
    if (helpHoverMoveBound) return;
    document.addEventListener("mousemove", onDocumentMouseMoveThemeOverflow, true);
    document.addEventListener("mousemove", onDocumentMouseMoveHelpHover, true);
    window.addEventListener(
        "scroll",
        () => {
            if (helpHoverOn) hideHelpHoverTooltip();
            hideThemeOverflowTooltip();
        },
        true
    );
    helpHoverMoveBound = true;
}

function applyHelpHoverToDocument() {
    document.documentElement.classList.toggle("help-hover-on", helpHoverOn);
    const btn = document.getElementById("helpHoverToggleBtn");
    if (btn) {
        btn.setAttribute("aria-pressed", helpHoverOn ? "true" : "false");
        btn.classList.toggle("help-hover-toggle--active", helpHoverOn);
    }
}

function toggleHelpHover() {
    helpHoverOn = !helpHoverOn;
    try {
        localStorage.setItem(LS_PBPM_HELP_HOVER, helpHoverOn ? "1" : "0");
    } catch {
        /* ignore */
    }
    if (!helpHoverOn) hideHelpHoverTooltip();
    hideThemeOverflowTooltip();
    applyHelpHoverToDocument();
    showToast(helpHoverOn ? "ヘルプ表示：ON（各所にホバーで説明）" : "ヘルプ表示：OFF");
}

function escapeJsSingleQuotedString(s) {
    return String(s)
        .replace(/[\u2028\u2029]/g, " ")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}

function createDefaultCategorySlots() {
    return Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => ({
        name: "",
        hidden: i >= 6
    }));
}

function loadCategorySlotsFromStorage() {
    try {
        const raw = localStorage.getItem(LS_PBPM_CATEGORY_SLOTS);
        if (!raw) return createDefaultCategorySlots();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return createDefaultCategorySlots();
        const out = [];
        for (let i = 0; i < CATEGORY_SLOT_COUNT; i++) {
            const defHidden = i >= 6;
            const s = parsed[i];
            if (s && typeof s === "object") {
                out.push({
                    name: typeof s.name === "string" ? s.name : "",
                    hidden: typeof s.hidden === "boolean" ? s.hidden : defHidden
                });
            } else {
                out.push({ name: "", hidden: defHidden });
            }
        }
        return out;
    } catch {
        return createDefaultCategorySlots();
    }
}

let categorySlots = loadCategorySlotsFromStorage();

function saveCategorySlotsToStorage() {
    localStorage.setItem(LS_PBPM_CATEGORY_SLOTS, JSON.stringify(categorySlots));
}

function resolveSlotLabel(index1Based) {
    const slot = categorySlots[index1Based - 1];
    if (!slot) {
        return index1Based <= 6 ? DEFAULT_CATEGORY_SIX[index1Based - 1] : `カテゴリ${index1Based}`;
    }
    const raw = String(slot.name || "").trim();
    if (raw) return raw;
    if (index1Based <= 6) return DEFAULT_CATEGORY_SIX[index1Based - 1];
    return `カテゴリ${index1Based}`;
}

function getVisibleResolvedCategoryLabels() {
    const out = [];
    for (let i = 1; i <= CATEGORY_SLOT_COUNT; i++) {
        if (categorySlots[i - 1].hidden) continue;
        out.push(resolveSlotLabel(i));
    }
    return out;
}

function getDefaultCategoryFallback() {
    const vis = getVisibleResolvedCategoryLabels();
    if (vis.length) return vis[0];
    return resolveSlotLabel(6);
}

function buildCategorySelectOptionsHtml(currentCategory) {
    const visible = getVisibleResolvedCategoryLabels();
    const seen = new Set();
    let html = "";
    visible.forEach((lab) => {
        if (seen.has(lab)) return;
        seen.add(lab);
        const sel = lab === currentCategory ? " selected" : "";
        html += `<option value="${escapeHtmlAttr(lab)}"${sel}>${escapeHtml(lab)}</option>`;
    });
    const cur = (currentCategory || "").trim();
    if (cur && !seen.has(cur)) {
        html += `<option value="${escapeHtmlAttr(cur)}" selected>${escapeHtml(cur)}</option>`;
    }
    if (html === "") {
        const fb = getDefaultCategoryFallback();
        return `<option value="${escapeHtmlAttr(fb)}" selected>${escapeHtml(fb)}</option>`;
    }
    return html;
}

function normalizeCurrentTabAfterCategoryChange() {
    if (currentTab === "すべて" || currentTab === "完了") return;
    const visible = new Set(getVisibleResolvedCategoryLabels());
    if (!visible.has(currentTab)) currentTab = "すべて";
}

function fillNewTaskCategorySelect() {
    const sel = document.getElementById("newCat");
    if (!sel) return;
    const labs = getVisibleResolvedCategoryLabels();
    const uniq = [];
    labs.forEach((l) => { if (!uniq.includes(l)) uniq.push(l); });
    if (uniq.length === 0) {
        const fb = getDefaultCategoryFallback();
        sel.innerHTML = `<option value="${escapeHtmlAttr(fb)}">${escapeHtml(fb)}</option>`;
        return;
    }
    sel.innerHTML = uniq.map((lab) => `<option value="${escapeHtmlAttr(lab)}">${escapeHtml(lab)}</option>`).join("");
}

function renderSettingsCategoryEditor() {
    const wrap = document.getElementById("settingsCategoryRows");
    if (!wrap) return;
    let html = "";
    for (let i = 1; i <= CATEGORY_SLOT_COUNT; i++) {
        const slot = categorySlots[i - 1];
        const vName = escapeHtmlAttr(slot.name || "");
        const chk = slot.hidden ? " checked" : "";
        html += `<div class="settings-cat-row">
      <label for="settingsCatName${i}" class="settings-cat-slot-num"${helpAttr(`枠${i}：カテゴリタブのスロット番号`)}>${i}</label>
      <input type="text" id="settingsCatName${i}" class="settings-cat-name-input" value="${vName}" placeholder="空欄＝デフォルト"${helpAttr(`カテゴリ名（枠${i}）：タブ表示名。空欄は既定のカテゴリ名を使います`)}>
      <label class="settings-cat-hide-label"${helpAttr(`非表示（枠${i}）：ONでタブと新規登録候補から隠します`)}><input type="checkbox" id="settingsCatHide${i}"${chk}> 非表示</label>
    </div>`;
    }
    wrap.innerHTML = html;
}

// 保存されたデータを取得、なければ空配列[]を入れる
let tasks = JSON.parse(localStorage.getItem('omniStepData')) || [];

function maxDateStr(a, b) {
    if (!a) return b || "";
    if (!b) return a || "";
    return a > b ? a : b; // "YYYY-MM-DD" なので辞書順比較でOK
}

function isIsoDateInOwnPeriod(task, iso) {
    if (!task || !iso) return true;
    const s = task.startDate || "";
    const e = task.deadline || "";
    if (s && iso < s) return false;
    if (e && iso > e) return false;
    return true;
}

function warnIfMarkersOutsideOwnPeriod(task) {
    if (!task || isParentTask(task)) return;
    const s = task.startDate || "";
    const e = task.deadline || "";
    if (!s && !e) return;
    const ms = task.msDate || "";
    const tar = String(getTargetDate(task) || "");
    const outMs = ms && !isIsoDateInOwnPeriod(task, ms);
    const outTar = tar && /^\d{4}-\d{2}-\d{2}$/.test(tar) && !isIsoDateInOwnPeriod(task, tar);
    if (outMs || outTar) {
        const parts = [];
        if (outMs) parts.push("◇");
        if (outTar) parts.push("★");
        showToast(`${parts.join("・")} が期間外です（期間内に調整してください）`);
    }
}

function syncFamilyCategory(familyKey, category) {
    let changed = false;
    tasks.forEach(t => {
        if (t.archived) return;
        if (getTaskFamilyKey(t) !== familyKey) return;
        if (t.category !== category) {
            t.category = category;
            changed = true;
        }
    });
    return changed;
}

function ensureFamilyCategoriesSyncedIfNeeded() {
    let changed = false;
    const families = new Set(tasks.filter(t => !t.archived && isParentTask(t)).map(t => getTaskFamilyKey(t)));
    families.forEach((family) => {
        const parent = tasks.find(t => !t.archived && getTaskFamilyKey(t) === family && isParentTask(t));
        if (!parent) return;
        if (syncFamilyCategory(family, parent.category || getDefaultCategoryFallback())) changed = true;
    });
    if (changed) save();
}

function ensureDependencyFieldsIfNeeded() {
    let changed = false;
    tasks.forEach((t) => {
        if (t.fFlag === undefined) {
            t.fFlag = false;
            changed = true;
        }
    });
    if (changed) save();
}

function getPrevChildTask(task) {
    const familyKey = getTaskFamilyKey(task);
    const children = tasks
        .filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t))
        .sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
    const idx = children.findIndex(t => String(t.id) === String(task.id));
    if (idx > 0) return children[idx - 1];
    return null;
}

function getDependencyPrevDeadlineMin(task) {
    if (!task || !task.fFlag) return "";
    const prev = getPrevChildTask(task);
    return prev?.deadline || "";
}

function canEnableDependencyForChild(task) {
    if (!task || isParentTask(task) || isExternalTask(task) || task.archived || isTerminalTaskStatus(task.status)) return false;
    if (getTaskBranchNo(task) === "010") return false;
    // 既に期間が入っている場合のみ、矛盾チェックでONを拒否
    const prevDeadline = getPrevChildTask(task)?.deadline || "";
    if (prevDeadline && task.startDate && prevDeadline > task.startDate) return false;
    return true;
}

function getMarkersMinMaxDate(task) {
    if (!task) return { min: null, max: null };
    const dates = [];
    const ms = task.msDate ? new Date(task.msDate) : null;
    if (ms && !isNaN(ms)) dates.push(ms);
    const tarIso = String(getTargetDate(task) || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(tarIso)) {
        const td = new Date(tarIso);
        if (!isNaN(td)) dates.push(td);
    }
    if (dates.length === 0) return { min: null, max: null };
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    min.setHours(0, 0, 0, 0);
    max.setHours(0, 0, 0, 0);
    return { min, max };
}

function addDaysToDateStr(dateStr, days) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    d.setDate(d.getDate() + (days || 0));
    return d.toISOString().split('T')[0];
}

/**
 * 親の着手日を基準に、編集可能な子タスクへ着手日・納期を1日ずつずらして一括設定する。
 * （完了・アーカイブ・外部CSVの子は対象外）
 */
function staggerChildDatesFromParentBase(parentTask, baseDateStr) {
    if (!parentTask || !baseDateStr || !isParentTask(parentTask) || isExternalTask(parentTask)) return false;
    const familyKey = getTaskFamilyKey(parentTask);
    const children = tasks
        .filter(
            (t) =>
                !t.archived &&
                getTaskFamilyKey(t) === familyKey &&
                !isParentTask(t) &&
                !isExternalTask(t) &&
                !isTerminalTaskStatus(t.status)
        )
        .sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
    if (children.length === 0) return false;
    children.forEach((child, idx) => {
        const d = addDaysToDateStr(baseDateStr, idx);
        child.startDate = d;
        child.deadline = d;
    });
    children.forEach((child) => pushNextDependentTasks(child));
    return true;
}

function diffDaysDateStr(a, b) {
    if (!a || !b) return 0;
    const da = new Date(a);
    const db = new Date(b);
    if (isNaN(da) || isNaN(db)) return 0;
    return Math.round((da - db) / (1000 * 60 * 60 * 24));
}

function pushNextDependentTasks(task) {
    // 同ファミリーの子タスクを枝番順に並べ、task以降で fFlag が立つものを「必要な分だけ」右へ押し出す
    if (!task) return;
    const familyKey = getTaskFamilyKey(task);
    const children = tasks
        .filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t))
        .sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));

    const idx = children.findIndex(t => String(t.id) === String(task.id));
    if (idx === -1) return;

    let prev = children[idx];
    for (let i = idx + 1; i < children.length; i++) {
        const cur = children[i];
        // 依存フラグは -020 以降のみ
        if (!cur.fFlag || getTaskBranchNo(cur) === "010") {
            prev = cur;
            continue;
        }

        const prevDeadline = prev.deadline || prev.startDate || "";
        if (!prevDeadline) {
            prev = cur;
            continue;
        }

        // cur の期間が未設定なら、最小限の「1日タスク」として押し出す
        if (!cur.startDate) cur.startDate = prevDeadline;
        if (!cur.deadline) cur.deadline = cur.startDate;

        if (cur.startDate < prevDeadline) {
            const shift = diffDaysDateStr(prevDeadline, cur.startDate);
            cur.startDate = addDaysToDateStr(cur.startDate, shift);
            cur.deadline = addDaysToDateStr(cur.deadline, shift);
        }
        prev = cur;
    }
}

function getPrimaryStep(task) {
    return task?.PrimaryStep ?? task?.content ?? "";
}

function setPrimaryStep(task, value) {
    task.PrimaryStep = value;
    task.content = value; // 互換維持
}

function getSecondaryStep(task) {
    return task?.SecondaryStep ?? task?.issue ?? "";
}

function setSecondaryStep(task, value) {
    task.SecondaryStep = value;
    task.issue = value; // 互換維持
}

function getFirstFlag(task) {
    return task?.FirstFlag ?? task?.factory ?? "";
}

function setFirstFlag(task, value) {
    task.FirstFlag = value;
    task.factory = value; // 互換維持
}

// イベント（ターゲット）は「名称」と「日付」を分離
// - TargetFlag: イベント名（マスター名称）
// - TargetDate: イベント日（マスター日程）
// 旧仕様互換:
// - eventName: イベント名
// - TargetFlag/target: イベント日（※旧）
function getTargetName(task) {
    return task?.TargetFlag ?? task?.eventName ?? "";
}

function setTargetName(task, value) {
    task.TargetFlag = value;
    task.eventName = value; // 互換維持（旧フィールド）
}

function getTargetDate(task) {
    return task?.TargetDate ?? task?.TargetFlagDate ?? task?.targetDate ?? task?.TargetFlag ?? task?.target ?? "";
}

function setTargetDate(task, value) {
    task.TargetDate = value;
    task.TargetFlagDate = value; // 万一の揺れ吸収
    task.targetDate = value;
    task.target = value; // 互換維持（旧フィールド）
}

function getTaskCode(task) {
    return task?.taskCode || "";
}

function getTaskFamilyKey(task) {
    const code = getTaskCode(task);
    if (code.includes("-")) return code.split("-")[0];
    const contentText = getPrimaryStep(task).trim();
    return contentText.split('：')[0];
}

function getTaskBranchNo(task) {
    const code = getTaskCode(task);
    if (code.includes("-")) return code.split("-")[1];
    return getPrimaryStep(task).trim().endsWith("：0") ? "000" : "010";
}

function normalizeThemeAccentHex(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
        const r = s[1],
            g = s[2],
            b = s[3];
        return (`#${r}${r}${g}${g}${b}${b}`).toLowerCase();
    }
    return "";
}

function findParentInPool(familyKey, pool) {
    const arr = pool || tasks;
    return arr.find((t) => !t.archived && getTaskFamilyKey(t) === familyKey && isParentTask(t));
}

/** テーマ（親）に保存されたアクセント色。未設定は空文字 */
function getThemeAccentForFamily(familyKey, pool) {
    const p = findParentInPool(familyKey, pool);
    return normalizeThemeAccentHex(p?.themeAccentColor);
}

function calendarInclusiveSpanDays(startIso, endIso) {
    if (!startIso || !endIso) return 0;
    const s = new Date(`${startIso}T12:00:00`);
    const e = new Date(`${endIso}T12:00:00`);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    return Math.floor((e - s) / 86400000) + 1;
}

/** 進捗状態を計画比較用のおおよその％に換算 */
function statusToPlanPercent(status) {
    const m = { 未着手: 0, 調査中: 10, 進行中: 45, 修正中: 75, 完了: 100, 中止: 100 };
    return m[status] ?? 0;
}

/**
 * 子タスクの「期間に対する進捗の遅れ／先行／期限内完了」の表示用シグナル
 * @returns {"risk"|"ahead"|"earlyDone"|null}
 */
function getChildScheduleSignal(task, todayMidnight) {
    if (!task || isParentTask(task) || task.archived || isExternalTask(task)) return null;
    if (task.status === "中止") return "cancelled";
    if (!task.startDate || !task.deadline) return null;

    const today0 = new Date(todayMidnight.getTime());
    today0.setHours(0, 0, 0, 0);
    const dl = new Date(`${task.deadline}T00:00:00`);
    dl.setHours(0, 0, 0, 0);
    const st = new Date(`${task.startDate}T00:00:00`);
    st.setHours(0, 0, 0, 0);

    if (isTerminalTaskStatus(task.status)) {
        const doneIso = String(task.progressUpdatedAt || "").trim();
        if (!doneIso || !task.deadline) return null;
        if (doneIso <= task.deadline) return "earlyDone";
        return null;
    }
    if (dl < today0) return null;
    if (today0 < st) return null;

    const totalDays = calendarInclusiveSpanDays(task.startDate, task.deadline);
    if (totalDays <= 0) return null;

    const todayIso = dateToIsoLocal(today0);
    const endClamp = todayIso <= task.deadline ? todayIso : task.deadline;
    const elapsedDays = calendarInclusiveSpanDays(task.startDate, endClamp);
    const expectedPct = Math.min(100, (elapsedDays / totalDays) * 100);
    const actualPct = statusToPlanPercent(task.status);
    const buffer = 6;

    if (elapsedDays >= 1 && actualPct + buffer < expectedPct) return "risk";
    if (actualPct > expectedPct + 14) return "ahead";
    return null;
}

/** 進捗シグナル用アイコン（色帯と区別。tl＝タイムライン左ラベル用／期限内完了はバーの✨のみのため省略可） */
function scheduleSignalIconHtml(sig, variant) {
    if (!sig) return "";
    if (sig === "cancelled") {
        const cls =
            variant === "tl" ? "schedule-signal-icon schedule-signal-icon--tl schedule-signal-icon--cancelled" : "schedule-signal-icon schedule-signal-icon--list schedule-signal-icon--cancelled";
        return `<span class="${cls}" title="${escapeHtmlAttr("中止：このタスクは中止されています")}">✕</span>`;
    }
    if (variant === "tl" && sig === "earlyDone") return "";
    const map = {
        risk: { ch: "⚠️", tip: "期間に対して進捗が遅れている可能性があります" },
        ahead: { ch: "🚀", tip: "計画より進捗が先行しています" },
        earlyDone: { ch: "✨", tip: "期限内に完了しました" }
    };
    const x = map[sig];
    if (!x) return "";
    const cls =
        variant === "tl" ? "schedule-signal-icon schedule-signal-icon--tl" : "schedule-signal-icon schedule-signal-icon--list";
    return `<span class="${cls}" title="${escapeHtmlAttr(x.tip)}">${x.ch}</span>`;
}

function hexToRgba(hex, alpha) {
    let h = String(hex || "").trim();
    if (!/^#[0-9A-Fa-f]{6}$/i.test(h)) h = "#4285f4";
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/** タイムラインPDCA：実行区間の終了日（子のみ）。未着手は null */
function getTimelinePdcaExecEndIso(task, todayMidnight) {
    if (!task || isParentTask(task)) return null;
    if (!task.startDate || !task.deadline) return null;
    if (task.status === "未着手") return null;
    if (isTerminalTaskStatus(task.status)) {
        const d = String(task.progressUpdatedAt || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= task.startDate && d <= task.deadline) return d;
        return task.deadline;
    }
    const t0 = new Date(todayMidnight.getTime());
    t0.setHours(0, 0, 0, 0);
    const todayIso = dateToIsoLocal(t0);
    const actStart = getPdcaActualStartForDisplay(task);
    if (!actStart || compareIsoDate(todayIso, actStart) < 0) return null;
    // 未完了：実績の終端は今日まで（納期超過分はタイムライン上で赤表示）
    return todayIso;
}

function addCalendarDaysIso(iso, deltaDays) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return iso;
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + deltaDays);
    return dateToIsoLocal(d);
}

function compareIsoDate(a, b) {
    if (!a || !b) return 0;
    return a < b ? -1 : a > b ? 1 : 0;
}

function maxIsoDate(a, b) {
    return compareIsoDate(a, b) >= 0 ? a : b;
}

function minIsoDate(a, b) {
    return compareIsoDate(a, b) <= 0 ? a : b;
}

/** 表示用：実績の着手（未設定時は計画着手） */
function getPdcaActualStartForDisplay(task) {
    if (!task || isParentTask(task) || task.status === "未着手") return null;
    const c = String(task.pdcaActualStart || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
    return task.startDate || null;
}

/** 表示用：実績の終了（未設定時は従来ロジック） */
function getPdcaActualEndForDisplay(task, todayMidnight) {
    if (!task || isParentTask(task) || task.status === "未着手") return null;
    const c = String(task.pdcaActualEnd || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
    return getTimelinePdcaExecEndIso(task, todayMidnight);
}

function timelinePixelSpanForRange(gridStartDate, dayWidth, getX, dStartIso, dEndIso) {
    const s = new Date(`${dStartIso}T12:00:00`);
    const e = new Date(`${dEndIso}T12:00:00`);
    const startX = getX(s);
    const endX = getX(e);
    const w = Math.max(dayWidth, endX - startX + (s > gridStartDate ? dayWidth : 0));
    return { startX, width: w };
}

/** 子PDCA：計画＝元サイズの破線枠、実績＝下段の細い実線（計画上に重ねる・B1） */
const TIMELINE_PDCA_EXEC_H = 10;
const TIMELINE_PDCA_SINGLE_H = 21.6;
const TIMELINE_PDCA_EXEC_TOP = TIMELINE_PDCA_SINGLE_H - TIMELINE_PDCA_EXEC_H;

/** 依存線用：子PDCAは計画区間の端を使う（実績の伸び・ずれに追従しない） */
function timelineDepBarEdgeClientX(barEl, edge) {
    const r = barEl.getBoundingClientRect();
    const ow = barEl.offsetWidth || r.width || 1;
    const scale = r.width / ow;
    if (barEl.classList.contains("timeline-bar--pdca")) {
        const pl = parseFloat(barEl.dataset.planLeft || "0");
        const pw = parseFloat(barEl.dataset.planWidth || "0");
        const left = r.left + pl * scale;
        const right = r.left + (pl + pw) * scale;
        return edge === "right" ? right : left;
    }
    return edge === "right" ? r.right : r.left;
}

/** タイムライン：実績だけ手で合わせるモード（デフォルトOFF・リストへ切替でOFF） */
let pdcaActualEditMode = false;
let timelineRenderRaf = null;

function scheduleRenderTimeline() {
    if (timelineRenderRaf != null) return;
    timelineRenderRaf = requestAnimationFrame(() => {
        timelineRenderRaf = null;
        const tv = document.getElementById("timelineView");
        const w = document.getElementById("timelineUnifiedWrapper");
        if (tv && w && tv.style.display !== "none") renderTimeline();
    });
}

function syncPdcaActualEditButton() {
    const b = document.getElementById("btnPdcaActualEdit");
    if (!b) return;
    b.classList.toggle("is-active", pdcaActualEditMode);
    b.setAttribute("aria-pressed", pdcaActualEditMode ? "true" : "false");
}

function togglePdcaActualEditMode() {
    pdcaActualEditMode = !pdcaActualEditMode;
    syncPdcaActualEditButton();
    renderTimeline();
}

function ensurePdcaActualSeedFromComputed(task, todayMidnight) {
    if (task.pdcaActualStart || task.pdcaActualEnd) return;
    if (task.status === "未着手" || !task.startDate) return;
    const e = getTimelinePdcaExecEndIso(task, todayMidnight);
    if (!e) return;
    task.pdcaActualStart = task.startDate;
    task.pdcaActualEnd = e;
    save();
}

/** 実績更新の対象か（子・着手済みの実行中系・自データ） */
const ACTUAL_UPDATE_STATUSES = new Set(["調査中", "進行中", "修正中"]);

function isTaskEligibleForAdvanceActualToToday(task) {
    if (!task || isParentTask(task) || isExternalTask(task) || task.archived) return false;
    if (!ACTUAL_UPDATE_STATUSES.has(task.status)) return false;
    if (!task.startDate || !task.deadline) return false;
    return true;
}

/** 1件の実績終了を今日まで進める。実績着手は既存値を維持（計画着手に追従しない） */
function advanceTaskActualToToday(task, todayMidnight) {
    const todayIso = dateToIsoLocal(todayMidnight);
    const curStart = String(task.pdcaActualStart || "").trim();
    const curEnd = String(task.pdcaActualEnd || "").trim();
    const hasStart = /^\d{4}-\d{2}-\d{2}$/.test(curStart);
    const hasEnd = /^\d{4}-\d{2}-\d{2}$/.test(curEnd);

    const workStart = hasStart ? curStart : task.startDate;
    if (!workStart || compareIsoDate(todayIso, workStart) < 0) return false;

    const newEnd = todayIso;
    if (compareIsoDate(newEnd, workStart) < 0) return false;

    let changed = false;
    if (!hasStart && task.startDate) {
        task.pdcaActualStart = task.startDate;
        changed = true;
    }
    if (!hasEnd || compareIsoDate(curEnd, newEnd) !== 0) {
        task.pdcaActualEnd = newEnd;
        changed = true;
    }
    return changed;
}

/**
 * 進行中・修正中の子タスク実績を今日まで進めて save。
 * @returns {number} 更新件数
 */
function advanceRunningTasksActualToToday(options = {}) {
    const silent = !!options.silent;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    let n = 0;
    tasks.forEach((task) => {
        if (!isTaskEligibleForAdvanceActualToToday(task)) return;
        if (advanceTaskActualToToday(task, today0)) n++;
    });
    if (n > 0) {
        save();
        if (!silent) {
            showToast(`実績更新：${n} 件を今日（${dateToIsoLocal(today0)}）まで保存しました`);
        }
    } else if (!silent) {
        showToast("実績更新：対象タスクはありませんでした");
    }
    return n;
}

function onAdvanceActualToTodayClick() {
    const n = advanceRunningTasksActualToToday({ silent: false });
    if (n > 0) renderAll();
}

/** 進捗変更後など、1件だけ実績を今日まで同期 */
function maybeAdvanceActualForTask(task) {
    if (!isTaskEligibleForAdvanceActualToToday(task)) return false;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    return advanceTaskActualToToday(task, today0);
}

function closeThemeColorPicker() {
    if (themeColorPickerEl) {
        themeColorPickerEl.remove();
        themeColorPickerEl = null;
    }
    document.removeEventListener("click", onThemeColorPickerDoc, true);
}

function onThemeColorPickerDoc(e) {
    if (themeColorPickerEl && !themeColorPickerEl.contains(e.target)) closeThemeColorPicker();
}

function openThemeColorPicker(ev, parentId) {
    ev.preventDefault();
    ev.stopPropagation();
    closeThemeColorPicker();
    const pop = document.createElement("div");
    pop.id = "themeColorPickerPopover";
    pop.className = "theme-color-picker-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "テーマ色の選択");
    const sw = THEME_ACCENT_PALETTE.map(
        (hex) =>
            `<button type="button" class="theme-color-swatch" data-hex="${hex}" style="background:${hex}" title="${hex}"></button>`
    ).join("");
    pop.innerHTML = `<div class="theme-color-picker-title">テーマ色</div><div class="theme-color-picker-swatches">${sw}</div><button type="button" class="theme-color-picker-clear">色を消す</button>`;
    pop.querySelectorAll(".theme-color-swatch").forEach((btn) => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const hex = btn.getAttribute("data-hex");
            applyThemeAccentToParent(parentId, hex);
            closeThemeColorPicker();
        };
    });
    const clr = pop.querySelector(".theme-color-picker-clear");
    if (clr) {
        clr.onclick = (e) => {
            e.stopPropagation();
            applyThemeAccentToParent(parentId, "");
            closeThemeColorPicker();
        };
    }
    document.body.appendChild(pop);
    themeColorPickerEl = pop;
    const rect = ev.currentTarget.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 4;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    if (left + pw > window.scrollX + window.innerWidth - 8) left = window.scrollX + window.innerWidth - pw - 8;
    if (top + ph > window.scrollY + window.innerHeight - 8) top = rect.top + window.scrollY - ph - 4;
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${Math.max(8, top)}px`;
    setTimeout(() => document.addEventListener("click", onThemeColorPickerDoc, true), 0);
}

function applyThemeAccentToParent(parentId, hex) {
    const p = tasks.find((t) => String(t.id) === String(parentId) && isParentTask(t));
    if (!p || isExternalTask(p)) return;
    const n = normalizeThemeAccentHex(hex);
    if (n) p.themeAccentColor = n;
    else delete p.themeAccentColor;
    save();
    renderAll();
}

function pad3(n) {
    return String(n).padStart(3, "0");
}

function getChildrenSortedByBranch(familyKey) {
    return tasks
        .filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t))
        .sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
}

function rebuildFamilyOrderInTasks(familyKey) {
    const parentIdx = tasks.findIndex(t => !t.archived && getTaskFamilyKey(t) === familyKey && isParentTask(t));
    if (parentIdx === -1) return;
    const parent = tasks[parentIdx];
    const children = getChildrenSortedByBranch(familyKey);
    const others = tasks.filter(t => getTaskFamilyKey(t) !== familyKey);
    // others内で親がいた場所に family を差し込む必要があるので、元配列を使って再構築
    const out = [];
    tasks.forEach((t) => {
        if (getTaskFamilyKey(t) !== familyKey) out.push(t);
        else if (t === parent) {
            out.push(parent);
            children.forEach(c => out.push(c));
        }
    });
    // 念のため、元配列に居たが上ループで拾えないケース（稀）を末尾に追加
    if (out.length !== tasks.length) {
        const seen = new Set(out.map(t => String(t.id)));
        tasks.forEach(t => { if (!seen.has(String(t.id))) out.push(t); });
    }
    tasks = out;
}

function clearTaskDependencies(taskIds) {
    const set = new Set((taskIds || []).map(String));
    tasks.forEach(t => {
        if (!t.archived && set.has(String(t.id))) t.fFlag = false;
    });
}

function moveChildTask(childId, dir) {
    const child = tasks.find(t => String(t.id) === String(childId));
    if (!child || isParentTask(child) || child.archived || isExternalTask(child)) return;
    if (isTerminalTaskStatus(child.status)) return;
    const familyKey = getTaskFamilyKey(child);
    const children = getChildrenSortedByBranch(familyKey);
    const curIdx = children.findIndex(t => String(t.id) === String(childId));
    if (curIdx === -1) return;
    const nextIdx = dir === "up" ? curIdx - 1 : curIdx + 1;
    if (nextIdx < 0 || nextIdx >= children.length) return;
    const swapped = children[nextIdx];

    // 新しい順序（swap）
    const reordered = [...children];
    const tmp = reordered[curIdx];
    reordered[curIdx] = reordered[nextIdx];
    reordered[nextIdx] = tmp;

    const moved = reordered[nextIdx]; // swap後、移動したchildの位置
    const movedPos = nextIdx;

    const prev = movedPos > 0 ? reordered[movedPos - 1] : null;
    const next = movedPos < reordered.length - 1 ? reordered[movedPos + 1] : null;

    const family = getTaskFamilyKey(moved);
    const prevNo = prev ? parseInt(getTaskBranchNo(prev), 10) : null;
    const nextNo = next ? parseInt(getTaskBranchNo(next), 10) : null;

    let newNo = null;
    const needsRenumberAll = () => {
        // 10刻みで振り直し（-010,-020,...）して隙間を作る
        reordered.forEach((t, i) => {
            const n = (i + 1) * 10;
            t.taskCode = `${family}-${pad3(n)}`;
        });
        newNo = (movedPos + 1) * 10;
    };

    if (prevNo !== null && nextNo !== null) {
        if (prevNo + 1 < nextNo) newNo = prevNo + 1;
        else needsRenumberAll();
    } else if (prevNo === null && nextNo !== null) {
        // 先頭へ移動：基本は next-10。被ったら振り直し
        const cand = Math.max(10, nextNo - 10);
        if (cand < nextNo) newNo = cand;
        else needsRenumberAll();
    } else if (prevNo !== null && nextNo === null) {
        // 末尾へ移動：次の「10刻み」を採用（例: 090の後ろ→100）
        const maxNo = Math.max(...reordered.filter(t => String(t.id) !== String(moved.id)).map(t => parseInt(getTaskBranchNo(t), 10)).filter(n => !Number.isNaN(n)), 0);
        newNo = Math.ceil((maxNo + 10) / 10) * 10;
        if (newNo > 999) newNo = 999;
    } else {
        // 子が1件など
        newNo = 10;
    }

    if (newNo !== null) {
        moved.taskCode = `${family}-${pad3(newNo)}`;
    }

    // 並び替えの影響で依存は崩れやすいので、移動したタスクと入れ替わった相手のみ依存解除
    clearTaskDependencies([moved.id, swapped.id]);
    rebuildFamilyOrderInTasks(familyKey);

    const rowA = document.querySelector(`#taskTable tbody tr[data-id="${childId}"]`);
    const rowB = document.querySelector(`#taskTable tbody tr[data-id="${swapped.id}"]`);
    const finishReorder = () => {
        save();
        renderAll();
        if (typeof renderTimeline === "function") renderTimeline();
        showToast("子タスクの順番を変更しました（入れ替わった2件の依存を解除しました）");
    };
    if (rowA && rowB) {
        const rectA = rowA.getBoundingClientRect();
        const rectB = rowB.getBoundingClientRect();
        const dy = rectB.top - rectA.top;
        rowA.classList.add("row-reorder-anim");
        rowB.classList.add("row-reorder-anim");
        rowA.style.transform = `translateY(${dy}px)`;
        rowB.style.transform = `translateY(${-dy}px)`;
        const done = () => {
            rowA.classList.remove("row-reorder-anim");
            rowB.classList.remove("row-reorder-anim");
            rowA.style.transform = "";
            rowB.style.transform = "";
            finishReorder();
        };
        let ended = 0;
        const onEnd = () => {
            ended++;
            if (ended >= 2) {
                rowA.removeEventListener("transitionend", onEnd);
                rowB.removeEventListener("transitionend", onEnd);
                done();
            }
        };
        rowA.addEventListener("transitionend", onEnd);
        rowB.addEventListener("transitionend", onEnd);
        setTimeout(done, ACCORDION_ROW_ANIM_OUT_MS + 50);
        return;
    }
    finishReorder();
}

function toggleFamilyDependency(parentTaskId, checked) {
    const parent = tasks.find(t => String(t.id) === String(parentTaskId));
    if (!parent || !isParentTask(parent) || parent.archived) return;
    if (isTerminalTaskStatus(parent.status)) return;
    const familyKey = getTaskFamilyKey(parent);
    let blocked = 0;
    tasks.forEach(t => {
        if (t.archived) return;
        if (getTaskFamilyKey(t) !== familyKey) return;
        if (isParentTask(t)) return;
        if (getTaskBranchNo(t) === "010") return; // 最初の子は対象外
        if (isTerminalTaskStatus(t.status)) return; // 完了はロック
        if (!!checked && t.startDate && !canEnableDependencyForChild(t)) {
            blocked++;
            return;
        }
        t.fFlag = !!checked;
    });
    save();
    renderAll();
    if (typeof renderTimeline === 'function') renderTimeline();
    if (checked && blocked > 0) {
        showToast(`連携を一括ON：${blocked}件は期間が条件を満たさずONにできませんでした`);
    } else {
        showToast(checked ? "このテーマの連携を一括ONにしました" : "このテーマの連携を一括OFFにしました");
    }
}

function toggleFamilyDependencyByButton(parentTaskId) {
    const parent = tasks.find(t => String(t.id) === String(parentTaskId));
    if (!parent || !isParentTask(parent) || parent.archived) return;
    if (isTerminalTaskStatus(parent.status)) return;
    const familyKey = getTaskFamilyKey(parent);
    const eligible = tasks.filter(t =>
        !t.archived &&
        getTaskFamilyKey(t) === familyKey &&
        !isParentTask(t) &&
        getTaskBranchNo(t) !== "010" &&
        !isTerminalTaskStatus(t.status)
    );
    const allOn = eligible.length > 0 && eligible.every(t => !!t.fFlag);
    toggleFamilyDependency(parentTaskId, !allOn);
}

function isParentTask(task) {
    if (getTaskCode(task)) return getTaskBranchNo(task) === "000";
    return getPrimaryStep(task).trim().endsWith("：0");
}

function getThemeLabel(task) {
    const contentText = getPrimaryStep(task).trim();
    if (contentText.includes('：')) return contentText.split('：')[0];
    return contentText;
}

function migrateTaskFieldsIfNeeded() {
    let changed = false;
    tasks.forEach((task) => {
        if (task.PrimaryStep === undefined && task.content !== undefined) {
            task.PrimaryStep = task.content;
            changed = true;
        }
        if (task.SecondaryStep === undefined && task.issue !== undefined) {
            task.SecondaryStep = task.issue;
            changed = true;
        }
        if (task.eventName === undefined) {
            task.eventName = "";
            changed = true;
        }
        if (task.FirstFlag === undefined && task.factory !== undefined) {
            task.FirstFlag = task.factory;
            changed = true;
        }
        // 旧仕様：eventName=名称, TargetFlag/target=日付
        // 新仕様：TargetFlag=名称, TargetDate=日付
        if (task.TargetDate === undefined) {
            const oldDate = task.TargetDate ?? task.TargetFlagDate ?? task.targetDate ?? task.target ?? "";
            // 旧TargetFlagが日付っぽい場合はそれも候補
            const maybeOldDate = task.TargetFlag && /^\d{4}-\d{2}-\d{2}$/.test(task.TargetFlag) ? task.TargetFlag : "";
            task.TargetDate = oldDate || maybeOldDate || "";
            changed = true;
        }
        if (task.TargetFlag === undefined || (task.TargetFlag && /^\d{4}-\d{2}-\d{2}$/.test(task.TargetFlag))) {
            // 旧TargetFlag(日付)が入っていた場合は名称をeventNameから移す
            const name = task.eventName || "";
            task.TargetFlag = name;
            changed = true;
        }
    });
    if (changed) save();
}

function formatDateCodePart(dateObj = new Date()) {
    const yy = String(dateObj.getFullYear()).slice(-2);
    const dd = String(dateObj.getDate()).padStart(2, "0");
    // 月は 1-12 を A-L に変換（例：2026/05/09 → 26E09）
    const monthLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const mon = monthLetters[Math.max(0, Math.min(11, dateObj.getMonth()))];
    return `${yy}${mon}${dd}`;
}

function generateParentTaskCode() {
    const base = formatDateCodePart(new Date());
    const sameDayParents = tasks
        .filter(t => isParentTask(t) && getTaskCode(t).startsWith(base))
        .map(t => {
            const family = getTaskFamilyKey(t);
            const seq = parseInt(family.slice(base.length), 10);
            return Number.isNaN(seq) ? 0 : seq;
        });
    const nextSeq = (sameDayParents.length ? Math.max(...sameDayParents) : 0) + 1;
    return `${base}${String(nextSeq).padStart(2, "0")}-000`;
}

function generateChildTaskCode(parentCode) {
    const family = (parentCode || "").split("-")[0];
    if (!family) return "";
    const siblings = tasks
        .filter(t => getTaskFamilyKey(t) === family && !isParentTask(t))
        .map(t => parseInt(getTaskBranchNo(t), 10))
        .filter(n => !Number.isNaN(n));
    const next = (siblings.length ? Math.max(...siblings) : 0) + 10;
    return `${family}-${String(next).padStart(3, "0")}`;
}

function migrateTaskCodesIfNeeded() {
    let changed = false;
    const familyMap = {};

    tasks.forEach((task) => {
        if (getTaskCode(task)) return;
        const familyLabel = getTaskFamilyKey(task);
        if (!familyMap[familyLabel]) familyMap[familyLabel] = generateParentTaskCode().split("-")[0];
        const family = familyMap[familyLabel];
        if (isParentTask(task)) {
            task.taskCode = `${family}-000`;
        } else {
            const used = tasks
                .filter(t => t.taskCode && t.taskCode.startsWith(family + "-") && !t.taskCode.endsWith("-000"))
                .map(t => parseInt(t.taskCode.split("-")[1], 10))
                .filter(n => !Number.isNaN(n));
            const next = (used.length ? Math.max(...used) : 0) + 10;
            task.taskCode = `${family}-${String(next).padStart(3, "0")}`;
        }
        changed = true;
    });

    if (changed) save();
}

// 閉じている月のインデックス（0=4月, 1=5月...）を保持
let collapsedMonths = [];


let yearlyMaster = JSON.parse(localStorage.getItem('omnistep_master') || '[]');

function normalizeYearlyMasterEntry(m) {
    if (!m || typeof m !== "object") {
        return { name: "", date: "", dateEnd: "", isHoliday: false };
    }
    return {
        name: String(m.name || ""),
        date: String(m.date || "").trim(),
        dateEnd: String(m.dateEnd || "").trim(),
        isHoliday: !!m.isHoliday,
    };
}

function migrateYearlyMasterIfNeeded() {
    let changed = false;
    yearlyMaster = yearlyMaster.map((m) => {
        const n = normalizeYearlyMasterEntry(m);
        if (
            m.name !== n.name ||
            m.date !== n.date ||
            m.dateEnd !== n.dateEnd ||
            !!m.isHoliday !== n.isHoliday
        ) {
            changed = true;
        }
        return n;
    });
    if (changed) saveMaster();
}

/** 年間日程の休日行から ISO 日付セット（単日・期間） */
function getMasterHolidayIsoSet() {
    const set = new Set();
    yearlyMaster.forEach((m) => {
        if (!m.isHoliday) return;
        const start = String(m.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
        const endRaw = String(m.dateEnd || "").trim();
        const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : start;
        if (compareIsoDate(end, start) < 0) return;
        let cur = start;
        while (compareIsoDate(cur, end) <= 0) {
            set.add(cur);
            cur = addCalendarDaysIso(cur, 1);
        }
    });
    return set;
}

function validateMasterDateRange(startIso, endIso) {
    const s = String(startIso || "").trim();
    const e = String(endIso || "").trim();
    if (!e) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return true;
    return compareIsoDate(e, s) >= 0;
}

function applyMasterDateEndEmptyStyle(startEl, endEl) {
    if (!endEl) return;
    const hasStart = !!(startEl && String(startEl.value || "").trim());
    const hasEnd = !!String(endEl.value || "").trim();
    endEl.classList.toggle("master-date-end-empty", hasStart && !hasEnd);
}

function syncMasterAddDateEndMin() {
    const start = document.getElementById("masterDate");
    const end = document.getElementById("masterDateEnd");
    if (!start || !end) return;
    if (start.value) end.min = start.value;
    else end.removeAttribute("min");
    if (end.value && start.value && compareIsoDate(end.value, start.value) < 0) {
        end.value = start.value;
    }
    applyMasterDateEndEmptyStyle(start, end);
}

function syncMasterRowDateEndMin(rowIndex) {
    const start = document.querySelector(`input[data-master-date-start="${rowIndex}"]`);
    const end = document.querySelector(`input[data-master-date-end="${rowIndex}"]`);
    if (!start || !end) return;
    if (start.value) end.min = start.value;
    else end.removeAttribute("min");
    if (end.value && start.value && compareIsoDate(end.value, start.value) < 0) {
        end.value = start.value;
        updateMasterEntry(rowIndex, "dateEnd", end.value);
    }
    applyMasterDateEndEmptyStyle(start, end);
}

function syncMasterListDateEndStyles() {
    yearlyMaster.forEach((_, i) => syncMasterRowDateEndMin(i));
}
let projectTitle = localStorage.getItem('pbpm_project_title') || 'Personal Business Project Manager';
let ownerName = localStorage.getItem('pbpm_owner_name') || '';
let ownerId = localStorage.getItem('pbpm_owner_id') || '';

const LS_PBPM_DARK_MODE = 'pbpm_dark_mode';
const LS_PBPM_LIGHT_THEME = 'pbpm_light_theme';
/** ライト配色の内部名（設定HTML・先読みscriptの許可リストと同期すること） */
const PBPM_LIGHT_THEMES = Object.freeze(['sharp', 'cool', 'sepia', 'soft']);
const PBPM_LIGHT_THEME_RADIO_IDS = Object.freeze({
    sharp: 'settingsThemeSharp',
    cool: 'settingsThemeCool',
    sepia: 'settingsThemeSepia',
    soft: 'settingsThemeSoft'
});

function getPbpmLightTheme() {
    const v = (localStorage.getItem(LS_PBPM_LIGHT_THEME) || 'sharp').toLowerCase();
    return PBPM_LIGHT_THEMES.includes(v) ? v : 'sharp';
}

function isPbpmDarkMode() {
    return localStorage.getItem(LS_PBPM_DARK_MODE) === '1';
}

function syncThemeToggleButton() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    if (isPbpmDarkMode()) {
        btn.textContent = '☀️';
        btn.removeAttribute('title');
        btn.setAttribute('aria-label', 'ライト表示に戻す');
    } else {
        btn.textContent = '🌙';
        btn.removeAttribute('title');
        btn.setAttribute('aria-label', 'ダークモードに切り替え');
    }
    btn.setAttribute(
        'data-help',
        'テーマ切替：画面の配色をダークモードとライトモードで切り替えます（🌙／☀️）'
    );
}

function applyPbpmTheme() {
    const dark = isPbpmDarkMode();
    const light = getPbpmLightTheme();
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : light);
    syncThemeToggleButton();
}

function toggleDarkMode() {
    localStorage.setItem(LS_PBPM_DARK_MODE, isPbpmDarkMode() ? '0' : '1');
    applyPbpmTheme();
}

let externalTasks = []; // 外部CSV（閲覧専用・保存しない）

function getExternalCsvOwnerIds() {
    const set = new Set();
    externalTasks.forEach((t) => {
        if (t && t.__externalOwnerId) set.add(String(t.__externalOwnerId).trim());
    });
    return Array.from(set).sort();
}

function getTabFilteredOwnTasks() {
    if (currentTab === "完了") return tasks.filter((t) => t.archived);
    if (currentTab === "すべて") return tasks.filter((t) => !t.archived);
    return tasks.filter((t) => t.category === currentTab && !t.archived);
}

function getTabFilteredExternalTasks() {
    if (currentTab === "完了") return externalTasks.filter((t) => t.archived);
    if (currentTab === "すべて") return externalTasks.filter((t) => !t.archived);
    return externalTasks.filter((t) => !t.archived && t.category === currentTab);
}

function buildMergedDisplayRows(ownRows, externalRows) {
    const mode = externalOwnerFilterMode;
    if (!externalTasks.length) return ownRows.concat(externalRows);
    if (mode === "external-all") return externalRows.slice();
    if (mode && mode !== "merged") {
        return externalRows.filter((t) => String(t.__externalOwnerId || "") === mode);
    }
    return ownRows.concat(externalRows);
}

function getVersionHistoryForDisplay() {
    return PBPM_VERSION_HISTORY.slice();
}

function formatVersionHistoryDate(releasedAt) {
    if (!releasedAt) return "—";
    const d = new Date(`${releasedAt}T12:00:00`);
    if (isNaN(d.getTime())) return String(releasedAt);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}/${mo}/${da}`;
}

function openVersionHistoryModal() {
    const modal = document.getElementById("versionHistoryModal");
    const body = document.getElementById("versionHistoryBody");
    if (!modal || !body) return;
    const log = getVersionHistoryForDisplay();
    if (!log.length) {
        body.innerHTML = "<p style=\"margin:0;color:var(--app-text-muted);\">版履歴はまだありません。</p>";
    } else {
        let rows = "";
        log.forEach((e) => {
            rows += `<tr><td>${escapeHtml(e.ver || "")}</td><td>${escapeHtml(e.content || "")}</td><td>${escapeHtml(formatVersionHistoryDate(e.releasedAt))}</td><td>${escapeHtml(e.modifier || "—")}</td></tr>`;
        });
        body.innerHTML = `<table class="version-history-table"><colgroup><col class="version-history-col-ver"><col class="version-history-col-content"><col class="version-history-col-datetime"><col class="version-history-col-modifier"></colgroup><thead><tr><th>ver</th><th>内容</th><th>日付</th><th>修正者</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    updateBodyScrollLock();
}

function closeVersionHistoryModal() {
    const modal = document.getElementById("versionHistoryModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    updateBodyScrollLock();
}

function syncExternalOwnerFilterUi() {
    const sel = document.getElementById("externalOwnerFilterSelect");
    if (!sel) return;
    const owners = getExternalCsvOwnerIds();
    if (!owners.length) {
        sel.style.display = "none";
        externalOwnerFilterMode = "merged";
        sel.classList.remove("external-owner-filter-active");
        return;
    }
    sel.style.display = "";
    const prev = sel.value;
    sel.innerHTML = "";
    const optMerged = document.createElement("option");
    optMerged.value = "merged";
    optMerged.textContent = "自分のタスク＋外部CSV（全担当）";
    sel.appendChild(optMerged);
    const optAllExt = document.createElement("option");
    optAllExt.value = "external-all";
    optAllExt.textContent = "外部CSVのみ（全担当）";
    sel.appendChild(optAllExt);
    owners.forEach((oid) => {
        const o = document.createElement("option");
        o.value = oid;
        o.textContent = `（${oid}）のみ表示`;
        sel.appendChild(o);
    });
    const valid = ["merged", "external-all", ...owners];
    sel.value = valid.includes(prev) ? prev : "merged";
    if (!valid.includes(sel.value)) sel.value = "merged";
    externalOwnerFilterMode = sel.value;
    sel.classList.toggle("external-owner-filter-active", externalOwnerFilterMode !== "merged");
}

function onExternalOwnerFilterChange() {
    const sel = document.getElementById("externalOwnerFilterSelect");
    if (!sel) return;
    externalOwnerFilterMode = sel.value || "merged";
    syncExternalOwnerFilterUi();
    renderAll();
    if (typeof renderTimeline === "function") renderTimeline();
    const labels = {
        merged: "自分のタスクと外部CSV（全担当）を表示中",
        "external-all": "外部CSVのみ（全担当）を表示中",
    };
    const msg = labels[externalOwnerFilterMode] || `（${externalOwnerFilterMode}）の外部CSVのみ表示中`;
    showToast(msg);
}

function getListFamiliesWithChildren(pool) {
    const keys = new Set();
    pool.filter((t) => isParentTask(t) && !t.archived).forEach((p) => {
        const fk = getTaskFamilyKey(p);
        const n = pool.filter((t) => !t.archived && getTaskFamilyKey(t) === fk && !isParentTask(t)).length;
        if (n > 0) keys.add(fk);
    });
    return keys;
}

function updateListAccordionBulkStateFromCollapsed() {
    const pool = tasks.filter((t) => !t.archived);
    const families = getListFamiliesWithChildren(pool);
    if (families.size === 0) {
        listAccordionBulkCollapsed = false;
    } else {
        listAccordionBulkCollapsed = Array.from(families).every((fk) => collapsedThemes.includes(fk));
    }
    syncListAccordionBulkButton();
}

function syncListAccordionBulkButton() {
    const btn = document.getElementById("btnAccordionBulk");
    if (!btn) return;
    const icon = listAccordionBulkCollapsed ? "＋" : "－";
    btn.textContent = icon;
    btn.setAttribute(
        "aria-label",
        listAccordionBulkCollapsed ? "すべての子タスク行を開く" : "すべての子タスク行を閉じる"
    );
    btn.setAttribute(
        "data-help",
        listAccordionBulkCollapsed
            ? "一括開く：すべてのテーマで子タスク行を表示します"
            : "一括閉じる：すべてのテーマで子タスク行を隠します"
    );
}

function toggleAllThemeAccordions() {
    const pool = tasks.filter((t) => !t.archived);
    const families = getListFamiliesWithChildren(pool);
    if (families.size === 0) {
        showToast("子タスクがあるテーマがありません");
        return;
    }
    if (listAccordionBulkCollapsed) {
        families.forEach((fk) => {
            const i = collapsedThemes.indexOf(fk);
            if (i !== -1) collapsedThemes.splice(i, 1);
            const j = collapsedThemesTimeline.indexOf(fk);
            if (j !== -1) collapsedThemesTimeline.splice(j, 1);
        });
        listAccordionBulkCollapsed = false;
    } else {
        families.forEach((fk) => {
            if (!collapsedThemes.includes(fk)) collapsedThemes.push(fk);
            if (!collapsedThemesTimeline.includes(fk)) collapsedThemesTimeline.push(fk);
        });
        listAccordionBulkCollapsed = true;
    }
    syncListAccordionBulkButton();
    renderAll();
    if (typeof renderTimeline === "function") renderTimeline();
}

function cancelTask(id) {
    const task = tasks.find((t) => String(t.id) === String(id));
    if (!task || isExternalTask(task) || task.archived) return;
    if (isTerminalTaskStatus(task.status)) {
        showToast("すでに完了または中止です");
        return;
    }
    const nowIso = dateToIsoLocal(new Date());
    if (isParentTask(task)) {
        const familyKey = getTaskFamilyKey(task);
        const label = getThemeLabel(task) || "（無題）";
        const children = tasks.filter(
            (t) =>
                !t.archived &&
                getTaskFamilyKey(t) === familyKey &&
                !isParentTask(t) &&
                !isExternalTask(t) &&
                !isTerminalTaskStatus(t.status)
        );
        const childNote =
            children.length > 0
                ? `\nこのテーマの子タスク ${children.length} 件もまとめて「中止」にします。`
                : "\n（中止対象の子タスクはありません）";
        if (
            !confirm(
                `テーマ「${label}」を一括中止しますか？${childNote}\n親・子とも進捗は「中止」になり、完了と同様に履歴へ移動できます。`
            )
        ) {
            return;
        }
        task.status = "中止";
        children.forEach((c) => {
            c.status = "中止";
            c.progressUpdatedAt = nowIso;
        });
        applyParentStatusFromChildrenForFamily(familyKey);
        save();
        renderAll();
        if (typeof renderTimeline === "function") renderTimeline();
        showToast(children.length > 0 ? `テーマと子タスク ${children.length} 件を中止にしました` : "テーマを中止にしました");
        return;
    }
    const label = getSecondaryStep(task) || getDisplayTaskCode(task);
    if (!confirm(`「${label}」を中止しますか？\n進捗は「中止」になり、完了と同様に履歴へ移動できます。`)) return;
    task.status = "中止";
    task.progressUpdatedAt = nowIso;
    applyParentStatusFromChildrenForFamily(getTaskFamilyKey(task));
    save();
    renderAll();
    if (typeof renderTimeline === "function") renderTimeline();
    showToast("中止にしました");
}
let currentTab = "すべて";
let editingMemoId = null;

window.onload = () => {
    loadHelpHoverState();
    applyHelpHoverToDocument();
    bindHelpHoverListeners();
    applyPbpmTheme();
    syncTimelineRangeButtons();
    // 初期表示はリストなので範囲ボタン・実績修正は隠す
    const rangeGroup = document.querySelector('.timeline-range-group');
    if (rangeGroup) rangeGroup.style.display = 'none';
    const btnPdcaInit = document.getElementById('btnPdcaActualEdit');
    if (btnPdcaInit) btnPdcaInit.style.display = 'none';
    const btnAdvInit = document.getElementById('btnAdvanceActualToday');
    if (btnAdvInit) btnAdvInit.style.display = 'none';
    ensureDependencyFieldsIfNeeded();
    migrateYearlyMasterIfNeeded();
    migrateTaskFieldsIfNeeded();
    migrateTaskCodesIfNeeded();
    ensureFamilyCategoriesSyncedIfNeeded();
    advanceRunningTasksActualToToday({ silent: true });
    displayToday();
    initThemeCalendarUi();
    updateTitleDisplay(); // タイトルを表示
    renderTabs();
    renderAll();
    setupEnterKey();
    updateMasterDropdown();
    // 起動時に一度「期間順」でソートをかける
    executeSort('date');
    setupScrollTopButtons();
    if (isOwnerIdUnsetForTutorial()) {
        requestAnimationFrame(() => openTutorialModal(true));
    }
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        pdcaActualEditMode = false;
        syncPdcaActualEditButton();
        const tv = document.getElementById("timelineView");
        if (tv && tv.style.display !== "none") renderTimeline();
    });
};

function scrollToTopSmooth() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function setupScrollTopButtons() {
    const onScroll = () => {
        const listView = document.getElementById('listView');
        const isListVisible = listView && listView.style.display !== 'none';
        const y = window.scrollY || document.documentElement.scrollTop || 0;

        const floatBtn = document.getElementById('scrollTopFloatingBtn');
        if (!floatBtn) return;

        // 一定スクロールしたら出す（誤クリック防止）
        const show = isListVisible && y > 180;
        floatBtn.style.display = show ? 'inline-block' : 'none';
    };

    // 多重登録防止のため一度だけ
    if (!window.__omnistepScrollTopInit) {
        window.__omnistepScrollTopInit = true;
        window.addEventListener('scroll', onScroll, { passive: true });
    }
    onScroll();
}

function displayToday() {
    const now = new Date();
    const w = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
    const dateElement = document.getElementById('todayDate');
    if (dateElement) dateElement.innerText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${w})`;
}

function updateBodyScrollLock() {
    // どれか1つでもモーダル/オーバーレイが開いていたら背面スクロールを止める
    const overlays = Array.from(document.querySelectorAll(".modal, .modal-overlay"));
    const anyOpen = overlays.some((el) => {
        if (!el || !document.body.contains(el)) return false;
        const disp = (el.style && el.style.display) ? el.style.display : "";
        if (disp && disp !== "none") return true;
        const cs = window.getComputedStyle(el);
        return cs && cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
    });
    document.body.classList.toggle("no-scroll", anyOpen);
}

function dateToIsoLocal(d) {
    if (!d || isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
}

const THEME_CAL_BAR_COLORS = ["#4285f4", "#0f9d58", "#ab47bc", "#e8710a", "#00838f"];

let themeCalendarYear = null;
let themeCalendarMonth = null;

function getThemeCalendarSegments() {
    const pool = tasks.concat(externalTasks || []).filter((t) => !t.archived);
    const parents = pool.filter((t) => isParentTask(t));
    const segs = [];
    let colorIdx = 0;
    parents.forEach((parent) => {
        const fk = getTaskFamilyKey(parent);
        let s = parent.startDate || "";
        let e = parent.deadline || "";
        if (!s || !e) {
            const kids = pool.filter((t) => getTaskFamilyKey(t) === fk && !isParentTask(t));
            if (kids.length) {
                const ss = kids.map((k) => k.startDate).filter(Boolean);
                const ee = kids.map((k) => k.deadline).filter(Boolean);
                if (!s && ss.length) s = ss.reduce((a, b) => (a < b ? a : b));
                if (!e && ee.length) e = ee.reduce((a, b) => (a > b ? a : b));
            }
        }
        if (!s || !e) return;
        if (s > e) {
            const x = s;
            s = e;
            e = x;
        }
        const isExt = isExternalTask(parent);
        const accent = getThemeAccentForFamily(fk, pool);
        const color = isExt ? "#5c6bc0" : accent || THEME_CAL_BAR_COLORS[colorIdx++ % THEME_CAL_BAR_COLORS.length];
        segs.push({
            label: getThemeLabel(parent),
            start: s,
            end: e,
            isExt,
            color,
        });
    });
    return segs;
}

function getCalendarWeekDates(year, month0) {
    const first = new Date(year, month0, 1);
    const pad = first.getDay();
    const start = new Date(year, month0, 1 - pad);
    const weeks = [];
    const cur = new Date(start);
    for (let w = 0; w < 6; w++) {
        const row = [];
        for (let i = 0; i < 7; i++) {
            row.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()));
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(row);
    }
    return weeks;
}

function segmentWeekColumns(segStart, segEnd, weekDates) {
    let minC = -1;
    let maxC = -1;
    for (let c = 0; c < 7; c++) {
        const iso = dateToIsoLocal(weekDates[c]);
        if (iso >= segStart && iso <= segEnd) {
            if (minC === -1) minC = c;
            maxC = c;
        }
    }
    if (minC === -1) return null;
    return { startCol: minC, endCol: maxC };
}

function assignThemeCalTracks(intervals) {
    intervals.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
    const lastEndOnTrack = [];
    intervals.forEach((inv) => {
        let t = 0;
        while (lastEndOnTrack[t] !== undefined && lastEndOnTrack[t] >= inv.startCol) t++;
        lastEndOnTrack[t] = inv.endCol;
        inv.track = t;
    });
}

function renderThemeCalendarInner() {
    const host = document.getElementById("themeCalendarGrid");
    const labelEl = document.getElementById("themeCalMonthLabel");
    if (!host || !labelEl || themeCalendarYear == null) return;

    const y = themeCalendarYear;
    const m = themeCalendarMonth;
    labelEl.textContent = `${y}年 ${m + 1}月`;

    const segments = getThemeCalendarSegments();
    const weeks = getCalendarWeekDates(y, m);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = dateToIsoLocal(today);

    const dow = ["日", "月", "火", "水", "木", "金", "土"];
    let html = `<div class="theme-cal-dow-row">`;
    dow.forEach((ch, i) => {
        const cls = i === 0 ? " theme-cal-dow-sun" : i === 6 ? " theme-cal-dow-sat" : "";
        html += `<div class="theme-cal-dow-cell${cls}">${escapeHtml(ch)}</div>`;
    });
    html += `</div>`;

    const BAR_H = 19;
    const GAP = 3;
    const MIN_LANES = 3;

    weeks.forEach((weekDates) => {
        const intervals = [];
        segments.forEach((seg) => {
            const cols = segmentWeekColumns(seg.start, seg.end, weekDates);
            if (!cols) return;
            intervals.push({ seg, startCol: cols.startCol, endCol: cols.endCol });
        });
        assignThemeCalTracks(intervals);
        const maxTrack = intervals.length ? Math.max(...intervals.map((x) => x.track)) : 0;
        const lanes = Math.max(MIN_LANES, maxTrack + 1);
        const ganttH = lanes * (BAR_H + GAP) + GAP;

        html += `<div class="theme-cal-week">`;
        html += `<div class="theme-cal-week-days">`;
        for (let c = 0; c < 7; c++) {
            const dt = weekDates[c];
            const inMonth = dt.getMonth() === m;
            const iso = dateToIsoLocal(dt);
            let cls = "theme-cal-day-cell";
            if (!inMonth) cls += " theme-cal-day-outside";
            if (iso === todayIso) cls += " theme-cal-day-today";
            const dowIdx = dt.getDay();
            if (dowIdx === 0) cls += " theme-cal-day-sun";
            if (dowIdx === 6) cls += " theme-cal-day-sat";
            html += `<div class="${cls}"><span class="theme-cal-day-num">${dt.getDate()}</span></div>`;
        }
        html += `</div>`;
        html += `<div class="theme-cal-week-gantt" style="height:${ganttH}px">`;
        intervals.forEach((inv) => {
            const { seg, startCol, endCol, track } = inv;
            const span = endCol - startCol + 1;
            const leftPct = (startCol / 7) * 100;
            const widthPct = (span / 7) * 100;
            const top = GAP + track * (BAR_H + GAP);
            const title = `${seg.label}（${formatDateJpFromISO(seg.start)}～${formatDateJpFromISO(seg.end)}）`;
            html += `<div class="theme-cal-bar" style="left:${leftPct}%;width:${widthPct}%;top:${top}px;height:${BAR_H}px;background:${seg.color}" title="${escapeHtmlAttr(title)}">`;
            html += `<span class="theme-cal-bar-label">${escapeHtml(seg.label)}</span>`;
            html += `</div>`;
        });
        html += `</div></div>`;
    });

    host.innerHTML = html;
}

function openThemeCalendarModal() {
    const modal = document.getElementById("themeCalendarModal");
    if (!modal) return;
    const now = new Date();
    themeCalendarYear = now.getFullYear();
    themeCalendarMonth = now.getMonth();
    renderThemeCalendarInner();
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    updateBodyScrollLock();
}

function closeThemeCalendarModal() {
    const modal = document.getElementById("themeCalendarModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
    updateBodyScrollLock();
}

function themeCalendarPrevMonth() {
    if (themeCalendarMonth == null) return;
    themeCalendarMonth--;
    if (themeCalendarMonth < 0) {
        themeCalendarMonth = 11;
        themeCalendarYear--;
    }
    renderThemeCalendarInner();
}

function themeCalendarNextMonth() {
    if (themeCalendarMonth == null) return;
    themeCalendarMonth++;
    if (themeCalendarMonth > 11) {
        themeCalendarMonth = 0;
        themeCalendarYear++;
    }
    renderThemeCalendarInner();
}

function initThemeCalendarUi() {
    const td = document.getElementById("todayDate");
    if (td) {
        td.style.cursor = "pointer";
        td.onclick = (e) => {
            e.preventDefault();
            openThemeCalendarModal();
        };
        td.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openThemeCalendarModal();
            }
        };
    }
    const prev = document.getElementById("themeCalPrevMonth");
    const next = document.getElementById("themeCalNextMonth");
    if (prev) prev.onclick = () => themeCalendarPrevMonth();
    if (next) next.onclick = () => themeCalendarNextMonth();
}

// 【既存の修正】表示を更新するだけの役割にする
function updateTitleDisplay() {
    const titleEl = document.getElementById('mainTitle');
    if (titleEl) {
        // 変数 projectTitle の内容を画面に反映
        titleEl.innerText = projectTitle;
    }
}

// 【新規追加】編集が確定した（フォーカスが外れた）時に動く
function finalizeTitle(newText) {
    const defaultTitle = "Personal Business Project Manager";

    // 入力が空、または空白のみならデフォルトに戻す
    const title = newText.trim() || defaultTitle;

    // 1. 変数の中身を更新
    projectTitle = title;

    // 2. ローカルストレージに保存
    localStorage.setItem('pbpm_project_title', title);

    // 3. 画面の表示を整える（空入力だった場合にデフォルト名を再表示するため）
    updateTitleDisplay();
}

// --- テンプレート機能 ---
function getDefaultFiscalYear() {
    const now = new Date();
    return `${now.getFullYear()}年度`;
}

function exportTemplate() {
    const templateName = prompt("テンプレート名を入力してください", "自治区会計業務");
    if (!templateName) return;

    let exportTarget = tasks.filter(t => !t.archived);
    if (currentTab !== "すべて" && currentTab !== "完了") {
        exportTarget = tasks.filter(t => t.category === currentTab && !t.archived);
    }

    if (exportTarget.length === 0) { alert("保存するタスクがありません。"); return; }

    // ひな形用途：現行CSV形式に合わせつつ taskCode は空にする（取込で親子復元できる形）
    // TargetFlag=イベント名 / TargetDate=イベント日
    let csv = "\uFEFFタスクID,カテゴリ,PrimaryStep,FirstFlag,展開日,TargetFlag,TargetDate,SecondaryStep,着手日,納期,進捗,メモ,アーカイブ済,fFlag\n";

    const families = Array.from(new Set(exportTarget.map(t => getTaskFamilyKey(t))));
    families.forEach((familyKey) => {
        const parent = exportTarget.find(t => getTaskFamilyKey(t) === familyKey && isParentTask(t));
        if (!parent) return;
        const theme = getThemeLabel(parent);
        const category = parent.category || "その他";

        // 親行（SecondaryStepは空）
        const parentRow = [
            "", // taskCodeは空（テンプレ）
            category,
            theme,
            getFirstFlag(parent) || "",
            "", // 展開日はテンプレでは空（必要なら入力）
            getTargetName(parent) || "",
            "", // TargetDateはテンプレでは空（必要なら入力）
            "",
            "",
            "",
            "未着手",
            "",
            "false",
            "false"
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
        csv += parentRow + "\n";

        // 子行（SecondaryStepに工程名など）
        const children = exportTarget
            .filter(t => getTaskFamilyKey(t) === familyKey && !isParentTask(t))
            .sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
        children.forEach((c) => {
            const row = [
                "",
                category,
                theme,
                "", // FirstFlag
                "", // 展開日
                "", // TargetFlag
                "", // TargetDate
                getSecondaryStep(c) || "",
                "",
                "",
                "未着手",
                "",
                "false",
                "false"
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
            csv += row + "\n";
        });
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${templateName}.csv`;
    link.click();
}

function triggerTemplateImport() {
    document.getElementById('templateInput').click();
}

function importTemplate(event) {
    const file = event.target.files[0];
    if (!file) return;

    const prefix = prompt("【グループ名】業務内容の頭に付ける名前を入力してください", getDefaultFiscalYear());
    if (prefix === null) return;

    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const nextTitle = prefix ? `${prefix}_${fileName}` : fileName;
    if (confirm(`表題を「${nextTitle}」に変更しますか？`)) {
        projectTitle = nextTitle;
        localStorage.setItem('pbpm_project_title', projectTitle);
        updateTitleDisplay();
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const splitCsv = (line) =>
            String(line || "")
                .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(v => v.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));

        const lines = String(e.target.result || "").split(/\r\n|\n/).filter(l => l !== "");
        if (lines.length <= 1) {
            showToast("テンプレートが空です");
            event.target.value = "";
            return;
        }

        const header = splitCsv(lines[0]).map(s => (s || "").trim());
        const idxByName = {};
        header.forEach((h, idx) => { if (h) idxByName[h] = idx; });
        const pick = (row, ...names) => {
            for (const n of names) {
                const idx = idxByName[n];
                if (typeof idx === "number") return row[idx] ?? "";
            }
            return "";
        };

        const isNew = header.includes("タスクID") || header.includes("PrimaryStep");
        const isOld = header.includes("内容") && header.includes("課題");

        const rawRows = [];
        for (let i = 1; i < lines.length; i++) {
            const row = splitCsv(lines[i]);
            const category = (pick(row, "カテゴリ") || "").trim() || "その他";
            const primary = (pick(row, "PrimaryStep", "内容") || "").trim();
            if (!primary) continue;
            const secondary = pick(row, "SecondaryStep", "課題") || "";
            const firstFlag = pick(row, "FirstFlag", "展開先名称") || "";
            const msDate = pick(row, "展開日", "展開先日程") || "";
            const targetName = pick(row, "TargetFlag", "イベント名") || "";
            const targetDate = pick(row, "TargetDate", "イベント日", "目標") || "";
            rawRows.push({ __lineNo: i, category, primary, secondary, firstFlag, msDate, targetName, targetDate });
        }

        if (rawRows.length === 0) {
            alert("テンプレートから取り込める行が見つかりませんでした。");
            event.target.value = "";
            return;
        }

        // PrimaryStep単位で親子復元（taskCodeはテンプレでは空想定）
        const groups = new Map();
        rawRows.forEach(r => {
            if (!groups.has(r.primary)) groups.set(r.primary, []);
            groups.get(r.primary).push(r);
        });

        let added = 0;
        const ts = Date.now();
        groups.forEach((rows, basePrimary) => {
            // テンプレ取込みの名称は "_" で統一（見やすさ優先）
            const fullPrimary = prefix ? `${prefix}_${basePrimary}` : basePrimary;

            const existingParent = tasks.find(t => !t.archived && isParentTask(t) && getPrimaryStep(t) === fullPrimary);
            if (existingParent) {
                const choice = prompt(
                    `「${fullPrimary}」が既に存在します。どうしますか？\n` +
                    `1: 追加（そのまま追加）\n` +
                    `2: 上書き（既存の親子を削除してから取り込み）\n` +
                    `3: スキップ（このテーマは取り込まない）`,
                    "3"
                );
                const key = String(choice || "3").trim();
                if (key === "3") return;
                if (key === "2") {
                    const familyKey = getTaskFamilyKey(existingParent);
                    tasks = tasks.filter(t => getTaskFamilyKey(t) !== familyKey);
                }
            }

            const parentRow = rows.find(r => !String(r.secondary || "").trim()) || rows[0];
            // テンプレ内にタスクIDが入っていても無視して新規採番
            const parentCode = generateParentTaskCode();
            const family = parentCode.split("-")[0];
            const firstMaster = yearlyMaster.find(m => m.name === (parentRow.firstFlag || ""));
            const targetMaster = yearlyMaster.find(m => m.name === (parentRow.targetName || ""));

            tasks.push({
                id: ts + parentRow.__lineNo,
                taskCode: parentCode,
                category: parentRow.category,
                PrimaryStep: fullPrimary,
                SecondaryStep: "",
                content: fullPrimary,
                issue: "",
                FirstFlag: parentRow.firstFlag || "",
                factory: parentRow.firstFlag || "",
                // テンプレは名称を引き継ぎ、日付は取込み先マスターに合わせて補完
                msDate: (firstMaster?.date || parentRow.msDate || ""),
                TargetFlag: parentRow.targetName || "",
                TargetDate: (targetMaster?.date || parentRow.targetDate || ""),
                target: (targetMaster?.date || parentRow.targetDate || ""),
                startDate: "",
                deadline: "",
                status: "未着手",
                memo: "",
                archived: false,
                fFlag: false
            });
            added++;

            const childRows = rows
                .filter(r => r !== parentRow && String(r.secondary || "").trim())
                .sort((a, b) => a.__lineNo - b.__lineNo);
            childRows.forEach((r, idx) => {
                tasks.push({
                    id: ts + r.__lineNo,
                    taskCode: `${family}-${pad3((idx + 1) * 10)}`,
                    category: parentRow.category,
                    PrimaryStep: fullPrimary,
                    SecondaryStep: r.secondary,
                    content: fullPrimary,
                    issue: r.secondary,
                    FirstFlag: "",
                    factory: "",
                    msDate: "",
                    TargetFlag: "",
                    TargetDate: "",
                    target: "",
                    startDate: "",
                    deadline: "",
                    status: "未着手",
                    memo: "",
                    archived: false,
                    fFlag: false
                });
                added++;
            });
        });

        save();
        renderAll();
        showToast(`${added}件を「${projectTitle}」として展開しました`);
        event.target.value = "";
    };
    reader.readAsText(file);
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    const verEl = document.getElementById('settingsAppVersionLine');
    if (verEl) verEl.innerHTML = `<button type="button" class="settings-version-link" onclick="openVersionHistoryModal()">PBPM バージョン ${PBPM_APP_VERSION}</button>`;
    const t = document.getElementById('settingsTitle');
    const o = document.getElementById('settingsOwner');
    const oid = document.getElementById('settingsOwnerId');
    if (t) t.value = projectTitle || "";
    if (o) o.value = ownerName || "";
    if (oid) oid.value = ownerId || "";
    renderSettingsCategoryEditor();
    const lt = getPbpmLightTheme();
    PBPM_LIGHT_THEMES.forEach((val) => {
        const radio = document.getElementById(PBPM_LIGHT_THEME_RADIO_IDS[val]);
        if (radio) radio.checked = val === lt;
    });
    modal.style.display = 'flex';
    updateBodyScrollLock();
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = 'none';
    updateBodyScrollLock();
}

/** 担当者IDが実質未設定か（空・未保存・0のみなど） */
function isOwnerIdUnsetForTutorial() {
    const raw = (localStorage.getItem("pbpm_owner_id") || "").trim();
    if (!raw) return true;
    const u = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!u) return true;
    return /^0+$/.test(u);
}

const TUTORIAL_SECTIONS = [
    {
        title: "1. 設定から担当者IDを登録",
        html: "<p>右上の<strong>⚙ 設定</strong>を開き、<strong>担当者ID（6桁）</strong>と担当者名を入力して<strong>保存</strong>します。IDはCSVのOwnerID列に使われ、自分のデータとして出力・取り込みするときの基準になります。6桁に満たない入力は先頭0埋めで保存されます。</p>",
    },
    {
        title: "2. テーマを登録",
        html: "<p><strong>＋新規テーマ登録</strong>から親テーマ（テーマ名）を作成します。カテゴリ・着手日・完了日・展開（◇）・イベント（☆）に紐づくマスター項目などをまとめて指定できます。必須のテーマ名を入れて登録します。</p>",
    },
    {
        title: "3. 子タスクを追加",
        html: "<p>一覧で親行の<strong>テーマ/課題</strong>列から子タスクを追加し、子行では同じ列に具体的な作業を入力します。左の▲▼で順序変更、依存連携（fFlag）で前後タスクとの整合も取れます。</p>",
    },
    {
        title: "4. 期間を入れる",
        html: "<p>各タスクの<strong>着手日・納期</strong>を入力します。親に期間がない状態から着手日を一括設定すると、子へ日付がずらして入る機能や、親子での期間リセットも利用できます。日付はリスト列のほか、タイムライン上のバー操作でも調整できます（編集可能な子のみ）。</p>",
    },
    {
        title: "5. 年間日程を登録",
        html: "<p><strong>📅 年間日程</strong>でマスターを編集し、展開イベント（FirstFlag）やイベント（Target）の名称と日付を登録します。一覧のドロップダウン候補や、タイムライン上の<strong>◇</strong>・<strong>★</strong>の位置の基準になります。必要に応じてマスターのCSV入出力も利用できます。</p>",
    },
    {
        title: "6. タイムラインで確認",
        html: "<p><strong>📅 タイムライン</strong>表示に切り替えると、期間がガント風に並びます。子タスクのバーはドラッグで移動、右端ハンドルで納期（幅）変更ができます。親バーや外部CSV行は閲覧中心です。<strong>◇</strong>はマイルストーン、<strong>★</strong>は目標日の目印です。</p>",
    },
    {
        title: "7. 進捗を更新する",
        html: "<p>一覧の<strong>進捗</strong>列から、進行中・修正中・完了などの状態を更新します。親行は子の状況に合わせて表示が変わる場合があります。完了・履歴タブでは完了済みテーマの確認ができます。</p>",
    },
    {
        title: "8. メモを記入",
        html: "<p>メモ列のアイコンからメモウィンドウを開き、詳細や備考を記入します。保存でタスクに紐づけて保持されます。</p>",
    },
    {
        title: "9. テーマが完了したら履歴へ移動",
        html: "<p>進捗を<strong>完了</strong>にしたうえで、ツールバーの<strong>履歴へ移動</strong>で完了テーマを<strong>完了履歴</strong>タブ側へ移します（対象はチェックした親テーマなど、画面の案内に従ってください）。履歴からの復元も可能です。</p>",
    },
    {
        title: "10. CSVへの出力と取込み",
        html: "<p>親行にチェックを入れ、<strong>CSV出力</strong>でバックアップや共有用ファイルを作成します。<strong>CSV取込</strong>でファイルを読み込みます。<strong>自分のOwnerIDの行のみ編集・取り込み対象</strong>となり、別のIDのデータは参照専用（外部CSV）として開きます。</p>",
    },
    {
        title: "11. テンプレートの運用",
        html: "<p><strong>テンプレート保存</strong>でタスク構成のひな形をCSVに書き出し、<strong>テンプレート読込</strong>で別名プロジェクトとして展開できます。年間の型や繰り返し業務のたたき台に向いています。</p>",
    },
    {
        title: "12. 別のIDで作成したCSVについて",
        html: "<p>CSVに含まれるOwnerIDが、設定で保存した自分のIDと一致しない場合、アプリはそのデータを<strong>外部CSV</strong>として閲覧専用で表示します。本体の保存データには混ぜず、ロック表示のまま参照できます。不要になったら<strong>外部表示をクリア</strong>で表示だけ消せます。</p>",
    },
    {
        title: "13. 保存先について",
        html: "<p>タスク・マスター・設定（担当者ID・表題・カテゴリ・配色など）は、すべて<strong>お使いのブラウザ内の localStorage（ローカル保存）</strong>に記録されます。<strong>GitHub Pages のサーバーには保存されません</strong>。別のPC・別ブラウザ・シークレットウィンドウでは共有されず、ブラウザのデータ削除やプロファイル削除で<strong>消える可能性</strong>があります。</p><p>大切なデータは<strong>CSV出力</strong>や<strong>テンプレート保存</strong>で定期的にファイルとしてバックアップしてください。GitHub に上がっているのは<strong>アプリのプログラム（HTML/CSS/JS）だけ</strong>で、あなたの業務データ本体は含まれません。</p>",
    },
];

const TUTORIAL_SECTIONS_DOM_VER = "3";

function ensureTutorialSectionsRendered() {
    const container = document.getElementById("tutorialSections");
    if (!container) return;
    if (container.dataset.built === TUTORIAL_SECTIONS_DOM_VER) return;
    container.innerHTML = "";
    container.dataset.built = TUTORIAL_SECTIONS_DOM_VER;
    TUTORIAL_SECTIONS.forEach((sec) => {
        const wrap = document.createElement("div");
        wrap.className = "tutorial-section";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tutorial-section-toggle";
        btn.setAttribute("aria-expanded", "false");
        const chev = document.createElement("span");
        chev.className = "tutorial-section-chevron";
        chev.textContent = "▽";
        const title = document.createElement("span");
        title.className = "tutorial-section-heading";
        title.textContent = sec.title;
        btn.appendChild(chev);
        btn.appendChild(title);
        const shell = document.createElement("div");
        shell.className = "tutorial-section-panel-shell";
        const panel = document.createElement("div");
        panel.className = "tutorial-section-panel";
        const inner = document.createElement("div");
        inner.className = "tutorial-section-panel-inner";
        inner.innerHTML = sec.html;
        panel.appendChild(inner);
        shell.appendChild(panel);
        btn.addEventListener("click", () => {
            const open = wrap.classList.contains("is-open");
            const next = !open;
            wrap.classList.toggle("is-open", next);
            btn.setAttribute("aria-expanded", next ? "true" : "false");
            chev.textContent = next ? "△" : "▽";
        });
        wrap.appendChild(btn);
        wrap.appendChild(shell);
        container.appendChild(wrap);
    });
}

/** @param {boolean} [asWelcome] 初回未設定時など大きめ表示 */
function openTutorialModal(asWelcome) {
    ensureTutorialSectionsRendered();
    const m = document.getElementById("tutorialModal");
    if (!m) return;
    m.style.display = "flex";
    m.classList.toggle("tutorial-modal--welcome", !!asWelcome);
    updateBodyScrollLock();
}

function closeTutorialModal() {
    const m = document.getElementById("tutorialModal");
    if (m) {
        m.style.display = "none";
        m.classList.remove("tutorial-modal--welcome");
    }
    updateBodyScrollLock();
}

function saveSettings() {
    const t = document.getElementById('settingsTitle');
    const o = document.getElementById('settingsOwner');
    const oid = document.getElementById('settingsOwnerId');
    if (t) {
        projectTitle = (t.value || "").trim() || "Personal Business Project Manager";
        localStorage.setItem('pbpm_project_title', projectTitle);
        updateTitleDisplay();
    }
    if (o) {
        ownerName = (o.value || "").trim();
        localStorage.setItem('pbpm_owner_name', ownerName);
    }
    if (oid) {
        const raw = String(oid.value || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
        const padded = raw.padStart(6, "0").slice(-6);
        ownerId = padded;
        localStorage.setItem('pbpm_owner_id', ownerId);
    }
    for (let i = 1; i <= CATEGORY_SLOT_COUNT; i++) {
        const nameEl = document.getElementById(`settingsCatName${i}`);
        const hideEl = document.getElementById(`settingsCatHide${i}`);
        categorySlots[i - 1] = {
            name: nameEl ? nameEl.value : "",
            hidden: !!(hideEl && hideEl.checked)
        };
    }
    saveCategorySlotsToStorage();
    const lightRadio = document.querySelector('input[name="settingsLightTheme"]:checked');
    if (lightRadio && PBPM_LIGHT_THEMES.includes(lightRadio.value)) {
        localStorage.setItem(LS_PBPM_LIGHT_THEME, lightRadio.value);
    }
    applyPbpmTheme();
    normalizeCurrentTabAfterCategoryChange();
    renderTabs();
    fillNewTaskCategorySelect();
    renderAll();

    closeSettingsModal();
    showToast("設定を保存しました");
}

function clearExternalView() {
    externalTasks = [];
    externalOwnerFilterMode = "merged";
    showToast("外部CSVの表示をクリアしました");
    syncExternalOwnerFilterUi();
    renderAll();
}

function findTaskByIdAny(id) {
    const sid = String(id);
    return tasks.find(t => String(t.id) === sid) || externalTasks.find(t => String(t.id) === sid);
}

function isExternalTask(task) {
    return !!(task && task.__external);
}

function getDisplayTaskCode(task) {
    if (!task) return "-";
    if (isExternalTask(task)) {
        const oid = String(task.__externalOwnerId || "").trim();
        return oid ? `（${oid}）******` : "******";
    }
    return task.taskCode || "-";
}

// --- 描画・タブ・UIロジック ---
function renderTabs() {
    const tabsContainer = document.querySelector('.tabs');
    if (!tabsContainer) return;
    let html = `<div class="tab ${currentTab === 'すべて' ? 'active' : ''}" onclick="changeTab('すべて')"${helpAttr('「すべて」タブ：すべてのカテゴリのタスクを一覧表示')}>すべて</div>`;
    const tabSeen = new Set();
    getVisibleResolvedCategoryLabels().forEach((cat) => {
        if (tabSeen.has(cat)) return;
        tabSeen.add(cat);
        const esc = escapeJsSingleQuotedString(cat);
        html += `<div class="tab ${currentTab === cat ? 'active' : ''}" onclick="changeTab('${esc}')"${helpAttr(`「${cat}」タブ：このカテゴリのタスクのみ表示`)}>${escapeHtml(cat)}</div>`;
    });
    html += `<div class="tab tab-archive ${currentTab === '完了' ? 'active' : ''}" onclick="changeTab('完了')"${helpAttr('「完了履歴」タブ：完了して履歴へ移したタスクを表示')}>完了履歴</div>`;
    tabsContainer.innerHTML = html;
}

/** 表示行から遅れタスクを含むテーマの上下境界（親上・最下子下）を算出 */
function computeOverdueFamilyRowMarkers(displayRows, todayMidnight, collapsedFamilyKeys, searchFamilyKeys) {
    const overdueFamilies = new Set();
    const lastVisibleChildIdByFamily = new Map();
    displayRows.forEach((task) => {
        const isParent = isParentTask(task);
        const familyKey = getTaskFamilyKey(task);
        const isCollapsed = collapsedFamilyKeys.includes(familyKey);
        const showDespiteCollapse = searchFamilyKeys && searchFamilyKeys.has(familyKey);
        if (!isParent && isCollapsed && !showDespiteCollapse) return;
        if (!isParent) {
            lastVisibleChildIdByFamily.set(familyKey, task.id);
            const deadlineDate = task.deadline ? new Date(task.deadline) : null;
            if (!isTerminalTaskStatus(task.status) && deadlineDate && deadlineDate < todayMidnight) {
                overdueFamilies.add(familyKey);
            }
        }
    });
    return { overdueFamilies, lastVisibleChildIdByFamily };
}

// --- メイン描画処理 ---
function renderAll() {
    const tbody = document.getElementById('taskBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    const btnClearExt = document.getElementById('btnClearExternal');
    if (btnClearExt) {
        const hasExt = externalTasks.length > 0;
        btnClearExt.style.display = hasExt ? "" : "none";
        btnClearExt.disabled = !hasExt;
    }

    // 完了ボタンの状態更新
    const hasCompleted = tasks.some(t => isTerminalTaskStatus(t.status) && !t.archived);
    const archiveBtn = document.getElementById('btnArchive');
    if (archiveBtn) {
        archiveBtn.disabled = !hasCompleted;
        archiveBtn.className = hasCompleted ? 'btn-archive-active' : 'btn-archive-disabled';
    }

    const filtered = getTabFilteredOwnTasks();
    const externalFiltered = getTabFilteredExternalTasks();
    let displayRows = buildMergedDisplayRows(filtered, externalFiltered);

    syncExternalOwnerFilterUi();
    updateListAccordionBulkStateFromCollapsed();

    const searchQuery = getSearchQueryLower();
    const searchFamilyKeys = getSearchMatchingFamilyKeys(displayRows, searchQuery);
    if (searchFamilyKeys) {
        displayRows = displayRows.filter((t) => searchFamilyKeys.has(getTaskFamilyKey(t)));
    }

    let lastThemeRoot = "";
    let useGrayBackground = false;

    // --- 1. renderAll関数の最初の方（filtered.forEach の直前あたり）に追加 ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 時刻をリセットして日付のみで比較

    const { overdueFamilies, lastVisibleChildIdByFamily } = computeOverdueFamilyRowMarkers(
        displayRows,
        today,
        typeof collapsedThemes !== "undefined" ? collapsedThemes : [],
        searchFamilyKeys
    );

    displayRows.forEach(task => {
        // 2. 判定用の準備
        const isParent = isParentTask(task);
        const isArchived = task.archived;
        const isExt = isExternalTask(task);
        const isLocked = isArchived || isTerminalTaskStatus(task.status) || isExt;
        const familyKey = getTaskFamilyKey(task);
        const branchNo = getTaskBranchNo(task);
        const depEligible = !isParent && branchNo !== "010";
        const depPrevDeadline = depEligible && task.fFlag ? (getPrevChildTask(task)?.deadline || "") : "";
        // 依存（fFlag）は「直前子の納期」を下限にする（期間のみ）
        const startMin = depPrevDeadline || "";
        const deadlineMin = maxDateStr(task.startDate || "", depPrevDeadline || "");
        // ◇/★ は「自分の期間」に依存（他の子の影響を受けない）
        const msMin = !isParent ? (task.startDate || "") : "";
        const msMax = !isParent ? (task.deadline || "") : "";
        const targetMin = !isParent ? (task.startDate || "") : "";
        const targetMax = !isParent ? (task.deadline || "") : "";

        // ★追加：期限切れの判定ロジック
        const deadlineDate = task.deadline ? new Date(task.deadline) : null;
        // 「完了」以外 且つ 期限が設定されている 且つ 今日より前
        const isExpired = !isTerminalTaskStatus(task.status) && deadlineDate && deadlineDate < today;
        const expiredClass = isExpired ? "expired" : "";
        const scheduleSig = !isExpired ? getChildScheduleSignal(task, today) : null;

        // テーマごとに背景色を切り替え
        if (familyKey !== lastThemeRoot) {
            useGrayBackground = !useGrayBackground;
            lastThemeRoot = familyKey;
        }

        // 開閉状態の判定（検索ヒット時は該当テーマの子行も表示）
        const isCollapsed = (typeof collapsedThemes !== "undefined") && collapsedThemes.includes(familyKey);
        const showDespiteCollapse = searchFamilyKeys && searchFamilyKeys.has(familyKey);
        if (!isParent && isCollapsed && !showDespiteCollapse) return;

        // 親タスクの進捗計算
        let progressLabel = "";
        if (isParent) {
            const pool = isExt ? displayRows : tasks;
            const subTasks = pool.filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t));
            if (subTasks.length > 0) {
                const completedCount = subTasks.filter(t => isTerminalTaskStatus(t.status)).length;
                const percent = Math.round((completedCount / subTasks.length) * 100);
                progressLabel = ` (${completedCount}/${subTasks.length}) ${percent}%`;
                // 自動ステータス同期
                if (!isExt) {
                    applyParentStatusFromChildrenForFamily(familyKey);
                }
            }
        }

        // --- 3. 行の作成とスタイル適用 ---
        const row = tbody.insertRow();
        row.dataset.id = task.id;

        // クラス付与の整理
        if (task.status === "完了") row.classList.add("row-completed");
        if (task.status === "中止") row.classList.add("row-cancelled");
        if (isParent) row.classList.add("parent-row");
        if (isExpired) row.classList.add("expired"); // ★ここを追加：これで赤くなります
        if (!isParent && familyKey === lastExpandedListTheme) row.classList.add("row-animate-in");

        if (isExpired) row.classList.add("expired"); // ★追加：期限切れクラス
        if (isParent && overdueFamilies.has(familyKey)) {
            row.classList.add("timeline-overdue-family-top");
        }
        if (
            !isParent &&
            overdueFamilies.has(familyKey) &&
            String(lastVisibleChildIdByFamily.get(familyKey)) === String(task.id)
        ) {
            row.classList.add("timeline-overdue-family-bottom");
        }

        row.style.backgroundColor = useGrayBackground ? "var(--app-row-alt)" : "var(--app-row-base)";

        // 各種ボタンの準備
        const accentHex = getThemeAccentForFamily(familyKey, displayRows);
        const accentCss = accentHex || "#cfd8dc";
        const canPickThemeColor = isParent && !isExt && !isLocked;
        const colorBarBtn = `<button type="button" class="theme-color-bar-btn" style="background:${accentCss}" ${canPickThemeColor ? `onclick="openThemeColorPicker(event,${task.id})"` : "disabled"}${helpAttr("テーマ色：クリックで色を選べます（親テーマのみ）")} aria-label="テーマ色"></button>`;
        const railLine = `<span class="theme-family-rail-line" aria-hidden="true"></span>`;
        const gutterBlock = `<div class="task-row-gutter">${colorBarBtn}${railLine}</div>`;

        const scheduleSigForIcon =
            !isParent && task.status === "中止" ? "cancelled" : scheduleSig;
        const scheduleIconList = !isParent ? scheduleSignalIconHtml(scheduleSigForIcon, "list") : "";
        const checkboxHTML = isParent && !isExt
            ? `<input type="checkbox" class="row-check" onchange="updateDeleteButtonState()" style="transform: scale(1.2); cursor:pointer;"${helpAttr('行チェック：CSV出力・一括削除などの対象に含める（親行のみ）')}>`
            : `<span style="display:inline-block; width:20px;"></span>`;

        const toggleIcon = isCollapsed ? "＋" : "－";
        const childCount = displayRows.filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t)).length;
        const hasChildren = childCount > 0;
        const accordionBtn = isParent
            ? hasChildren
                ? `<span class="accordion-btn" onclick="toggleAccordion('${task.id}')"${helpAttr('アコーディオン：このテーマの子タスク行の表示を開閉します')}>${toggleIcon}</span>`
                : `<span class="accordion-btn accordion-btn-disabled"${helpAttr('アコーディオン：子タスクがないため開閉できません')}>＋</span>`
            : `<span style="display:inline-block; width:25px;"></span>`;

        const addChildBtn = (isParent && !isExt)
            ? `<button class="add-child-btn" type="button" onclick="addSubTask('${task.id}')" style="font-size:10px; padding:2px 6px; cursor:pointer; vertical-align:middle;"${helpAttr('＋子タスク追加：この親テーマの下に新しい子タスクを追加します')}>＋子タスク追加</button>`
            : "";

        let orderBtns = "";
        if (!isParent && !isArchived && !isExt) {
            const siblings = tasks
                .filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t))
                .sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
            const sibIdx = siblings.findIndex(t => String(t.id) === String(task.id));
            const isFirst = sibIdx === 0;
            const isLast = sibIdx === siblings.length - 1;
            const isDone = isTerminalTaskStatus(task.status);
            const upBtn = isDone
                ? `<span class="order-btn order-btn-disabled"${helpAttr('順序▲：完了タスクは移動できません')}>▲</span>`
                : isFirst
                ? `<span class="order-btn order-btn-disabled"${helpAttr('順序▲：これ以上上へは移動できません')}>▲</span>`
                : `<span class="order-btn" onclick="moveChildTask('${task.id}','up')"${helpAttr('順序▲：同じテーマ内でこの子を一つ上へ移動します')}>▲</span>`;
            const downBtn = isDone
                ? `<span class="order-btn order-btn-disabled"${helpAttr('順序▼：完了タスクは移動できません')}>▼</span>`
                : isLast
                ? `<span class="order-btn order-btn-disabled"${helpAttr('順序▼：これ以上下へは移動できません')}>▼</span>`
                : `<span class="order-btn" onclick="moveChildTask('${task.id}','down')"${helpAttr('順序▼：同じテーマ内でこの子を一つ下へ移動します')}>▼</span>`;
            orderBtns = `<span class="order-controls gutter-order-controls ${isDone ? "order-controls-disabled" : ""}">${upBtn}${downBtn}</span>`;
        }

        // 3. HTMLの流し込み（箇条書きスタイル）
        const progHint =
            !isParent && task.progressUpdatedAt
                ? `進捗更新日: ${task.progressUpdatedAt}。`
                : !isParent && scheduleSig === "risk"
                  ? "期間に対して進捗が遅れている可能性があります。"
                  : !isParent && scheduleSig === "ahead"
                    ? "計画より進捗が先行しています。"
                    : "";
        const statusTitleAttr = progHint ? ` title="${escapeHtmlAttr(progHint)}"` : "";
        const col1 = `<td class="td-gutter-cell"><div class="gutter-cell-inner">${gutterBlock}<div class="gutter-check-slot"><div class="gutter-check-main">${scheduleIconList}${checkboxHTML}</div>${orderBtns ? `<div class="gutter-order-row">${orderBtns}</div>` : ""}</div></div></td>`;

        const col2 = `<td>
            <select class="cat-select" ${(!isParent || isLocked) ? 'disabled' : ''} 
                    onchange="updateTaskValue(${task.id}, 'category', this.value)" style="background:transparent;"${helpAttr('カテゴリ：この行のカテゴリ（親を変更するとテーマ内のカテゴリが変更されます）')}>
                ${buildCategorySelectOptionsHtml(task.category)}
            </select>
        </td>`;

        const extLockHtml = isExt
            ? `<span class="external-lock"${helpAttr('外部CSV：閲覧専用のため一覧からは編集できません')}>🔒</span>`
            : "";
        const displayName = isParent ? getPrimaryStep(task) : getSecondaryStep(task);
        const displayField = isParent ? "PrimaryStep" : "SecondaryStep";
        const themeNameHelp = isParent
            ? helpAttr("テーマ名：親タスクのテーマ／課題の見出しを編集します")
            : helpAttr("業務内容：子タスクの作業内容を編集します。はみ出しは省略し、ホバーで全文を表示します");
        const themeNameClass = isParent
            ? "theme-name theme-name-parent theme-name--ellipsis-tip"
            : "theme-name theme-name-child theme-name--ellipsis-tip";
        const themeMetaClass = isParent ? "theme-meta" : "theme-meta theme-meta--child";
        const depChecked = !!task.fFlag;
        const depCheckboxHtml = (depEligible && !isLocked)
            ? `<input type="checkbox" class="dep-flag-input" ${depChecked ? "checked" : ""} onchange="updateTaskValue(${task.id}, 'fFlag', this.checked)"${helpAttr('依存連携：ONにすると直前の子の納期より前に期間が入らないよう前後が連携します')}>`
            : !isParent
              ? `<span class="dep-flag-spacer" aria-hidden="true"></span>`
              : "";
        let parentDepToggleHtml = "";
        if (isParent && !isLocked) {
            const eligible = tasks.filter(t =>
                !t.archived &&
                getTaskFamilyKey(t) === familyKey &&
                !isParentTask(t) &&
                getTaskBranchNo(t) !== "010" &&
                !isTerminalTaskStatus(t.status)
            );
            const anyEligible = eligible.length > 0;
            const allOn = anyEligible && eligible.every(t => !!t.fFlag);
            const label = allOn ? "連携一括OFF" : "連携一括ON";
            parentDepToggleHtml = `<button class="dep-bulk-btn" type="button" onclick="toggleFamilyDependencyByButton('${task.id}')" ${anyEligible ? "" : "disabled"}${helpAttr('連携一括ON/OFF：依存連携の付いた子タスクへ、連携フラグをまとめてONまたはOFFにします')}>${label}</button>`;
        }
        const periodResetBtn = (isParent && !isLocked)
            ? `<button class="dep-bulk-btn" type="button" onclick="resetFamilyPeriods('${task.id}')"${helpAttr('期間リセット：このテーマと編集可能な子タスクの着手日・納期をまとめてクリアします（確認あり）')}>期間リセット</button>`
            : "";
        const parentControlsHtml = (isParent && !isLocked)
            ? `<span class="parent-theme-controls">${addChildBtn}${periodResetBtn}${parentDepToggleHtml}</span>`
            : "";
        const themeActionsHtml = isParent
            ? parentControlsHtml
            : depCheckboxHtml;
        const col3 = `<td class="td-theme-col">
            <div class="theme-cell${isExt ? " external-task-row" : ""}">
                <div class="theme-top">
                        ${accordionBtn}
                        ${extLockHtml}
                        <span class="${themeNameClass}"
                              contenteditable="${!isLocked}"
                              oninput="updateDataSilent(${task.id}, '${displayField}', this.innerText)"
                              onblur="renderAll()"${themeNameHelp}>${displayName}</span>
                </div>
                <div class="theme-cell-footer">
                    <div class="${themeMetaClass}">
                        <span class="theme-code">[${getDisplayTaskCode(task)}]</span>
                        ${isParent ? `<span class="theme-progress">${progressLabel}</span>` : ""}
                    </div>
                    ${themeActionsHtml ? `<div class="theme-cell-actions">${themeActionsHtml}</div>` : ""}
                </div>
            </div>
        </td>`;

        const col4 = `<td> 
            <select class="cat-select" style="width:100%; font-weight:bold; border:none; background:transparent;" ${isLocked ? 'disabled' : ''} 
                    onchange="updateTaskTargetFromMaster(${task.id}, this.value)"${helpAttr('イベント（TargetFlag）：年間マスターのイベント名と☆目標日を選びます')}>
                ${getMasterOptionsHTML(getTargetName(task))}
            </select>
            <span style="display:block;margin-top:2px;"${helpAttr('☆日付：マスターに日付がないときだけ、目標日を直接指定できます（クリックでカレンダー）')}>
            <input type="date"
                   value="${getTargetDate(task) || ''}"
                   ${isLocked ? 'disabled' : ''}
                   min="${targetMin}"
                   ${targetMax ? `max="${targetMax}"` : ""}
                   title=""
                   onchange="updateTaskValue(${task.id}, 'TargetDate', this.value)"
                   style="font-size:0.75rem; border:none; background:transparent; width:100%; text-align:center;">
            </span>
        </td>`;

        const startDateHelp = isParent
            ? "着手日：親の着手と納期がどちらも空のときに着手を入れると、子へ1日ずつ連番で入ります"
            : "着手日：タイムラインのバーとも連動します";
        const deadlineHelp = isParent
            ? "納期：親テーマ全体の完了目安"
            : "納期：この子タスクの完了予定日";
        const col5 = `<td class="td-date-col td-date-start">
            <input type="date" class="list-date-input" data-date-field="start"
                   value="${task.startDate || ''}" ${isLocked ? 'disabled' : ''}
                   min="${startMin}"
                   title=""
                   onchange="updateTaskDate(${task.id}, 'startDate', this.value)"
                   ${helpAttr(startDateHelp)}>
        </td>`;
        const col6 = `<td class="td-date-col td-date-deadline">
            <input type="date" class="list-date-input" data-date-field="deadline"
                   value="${task.deadline || ''}" ${isLocked ? 'disabled' : ''}
                   min="${deadlineMin}"
                   title=""
                   onchange="updateTaskDate(${task.id}, 'deadline', this.value)"
                   ${helpAttr(deadlineHelp)}>
        </td>`;

        const statusHelp = isParent
            ? "進捗：親タスクは「進行中」と「修正中」だけを切り替えます（未着手などからは一度「進行中」に入ります）"
            : "進捗：クリックのたびに 未着手→調査中→進行中→修正中→完了 の順で切り替わります";
        const col7 = `<td class="td-status">
            <button class="status-btn status-${task.status}" ${isArchived || isExt ? 'disabled' : ''} onclick="cycleStatus(${task.id})"${helpAttr(statusHelp)}${statusTitleAttr}>${task.status}</button>
        </td>`;

        const restoreBtn = (isArchived && !isParent && !isExt)
            ? `<span class="memo-action-icon" onclick="restoreTask(${task.id})" style="cursor:pointer; color:#1a73e8;"${helpAttr('復元：押した子と親のステータスが「進行中」になり、このテーマを履歴から一覧へ戻します')}>↺</span>`
            : (isArchived ? `<span class="memo-action-icon" style="opacity:0.0; pointer-events:none;">↺</span>` : "");
        const cancelBtnHtml = (!isExt && !isArchived && !isTerminalTaskStatus(task.status))
            ? `<span class="memo-action-icon memo-cancel-icon" onclick="cancelTask(${task.id})" style="cursor:pointer; color:#c62828;"${helpAttr("中止：このタスクを中止します（完了と同様に履歴へ移動できます）")}>⛔</span>`
            : `<span class="memo-action-icon memo-cancel-spacer" aria-hidden="true"></span>`;
        const col8 = `<td class="td-action-col">
            <div class="memo-action-cell">
                <span class="memo-action-icon" onclick="openMemo(${task.id})" style="cursor:pointer; color:${(task.memo?.trim()) ? "#999" : "#1a73e8"};"${helpAttr('メモ：詳細メモの入力・編集ウィンドウを開きます')}>${(task.memo?.trim()) ? "📝" : "🖋"}</span>
                ${cancelBtnHtml}
                ${isExt ? `<span class="memo-action-icon" style="opacity:0.35; pointer-events:none;"${helpAttr('削除：外部CSV行はここから削除できません')}>🗑</span>` : (isArchived ? restoreBtn : `<span class="memo-action-icon" onclick="deleteTask(${task.id})" style="cursor:pointer; color:#999;"${helpAttr('削除：このタスクを削除します（親ならテーマごと）')}>🗑</span>`)}
            </div>
        </td>`;

        row.innerHTML = col1 + col2 + col3 + col4 + col5 + col6 + col7 + col8;
    });

    // タイムライン同期
    const timeEl = document.getElementById('timelineView');
    if (timeEl && timeEl.style.display !== 'none') {
        renderTimeline();
    }
    updateMasterDropdown();
    if (isSearchFilterActive()) {
        const checkAll = document.getElementById("checkAll");
        if (checkAll) {
            checkAll.checked = false;
            checkAll.indeterminate = false;
        }
        const inc = document.getElementById("includeArchivedBulk");
        if (inc) inc.checked = false;
    }
    syncIncludeArchivedBulkVisibility();
    updateDeleteButtonState();
    lastExpandedListTheme = null;
    setupScrollTopButtons();
}

/**
 * ビューの切り替え（リストとタイムラインを完全に排他表示）
 */
function switchView(viewName) {
    const listEl = document.getElementById('listView');
    const timeEl = document.getElementById('timelineView');
    const btnL = document.getElementById('btnList');
    const btnT = document.getElementById('btnTimeline');
    const rangeGroup = document.querySelector('.timeline-range-group');
    const btnPdca = document.getElementById('btnPdcaActualEdit');
    const btnAdv = document.getElementById('btnAdvanceActualToday');

    if (viewName === 'list') {
        pdcaActualEditMode = false;
        syncPdcaActualEditButton();
        listEl.style.display = 'block';
        timeEl.style.display = 'none';
        if (rangeGroup) rangeGroup.style.display = 'none';
        if (btnPdca) btnPdca.style.display = 'none';
        if (btnAdv) btnAdv.style.display = 'none';
        if (btnL) {
            btnL.classList.add('view-btn-active');
            btnL.classList.remove('view-btn-inactive');
        }
        if (btnT) {
            btnT.classList.add('view-btn-inactive');
            btnT.classList.remove('view-btn-active');
        }
    } else {
        listEl.style.display = 'none';
        timeEl.style.display = 'block';
        if (rangeGroup) rangeGroup.style.display = 'inline-flex';
        if (btnPdca) btnPdca.style.display = 'inline-flex';
        if (btnAdv) btnAdv.style.display = 'inline-flex';
        hideThemeOverflowTooltip();
        if (btnT) {
            btnT.classList.add('view-btn-active');
            btnT.classList.remove('view-btn-inactive');
        }
        if (btnL) {
            btnL.classList.add('view-btn-inactive');
            btnL.classList.remove('view-btn-active');
        }
        renderTimeline();
    }
}


function getTimelineMonthIsoRange(monthIdx, timelineStartDate) {
    const mDate = new Date(timelineStartDate.getFullYear(), timelineStartDate.getMonth() + monthIdx, 1);
    return {
        monthStart: dateToIsoLocal(mDate),
        monthEnd: dateToIsoLocal(new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0)),
    };
}

function taskOverlapsTimelineMonth(task, monthIdx, timelineStartDate) {
    const { monthStart, monthEnd } = getTimelineMonthIsoRange(monthIdx, timelineStartDate);
    const s = task.startDate || task.deadline;
    const e = task.deadline || task.startDate;
    if (!s && !e) return false;
    const start = s || e;
    const end = e || s;
    return start <= monthEnd && end >= monthStart;
}

/** 当該月に未完了タスクの期間が重なるか */
function timelineMonthHasIncompleteTasks(monthIdx, timelineStartDate) {
    const pool = tasks.concat(externalTasks).filter((t) => !t.archived);
    return pool.some((t) => !isTerminalTaskStatus(t.status) && taskOverlapsTimelineMonth(t, monthIdx, timelineStartDate));
}

// 月の開閉を切り替える関数
function toggleMonth(mIdx) {
    if (forcedCollapsedMonths && forcedCollapsedMonths.has(mIdx)) return;
    const index = collapsedMonths.indexOf(mIdx);
    if (index === -1) {
        collapsedMonths.push(mIdx); // 閉じる
    } else {
        collapsedMonths.splice(index, 1); // 開く
    }
    renderTimeline(); // 再描画
}

/** YYYY-MM-DD → 「2026年5月5日」 */
function formatDateJpFromISO(iso) {
    if (!iso || typeof iso !== "string") return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
}

function showTimelineMarkerTooltip(kind, task, e) {
    const tooltip = ensureTimelineTooltip();
    const nameLine =
        kind === "ms"
            ? getFirstFlag(task) || "（展開イベント名なし）"
            : getTargetName(task) || "（イベント名なし）";
    const dateLine =
        kind === "ms"
            ? task.msDate
                ? formatDateJpFromISO(task.msDate)
                : "日程なし"
            : getTargetDate(task)
              ? formatDateJpFromISO(String(getTargetDate(task)))
              : "日程なし";
    tooltip.innerHTML = `<strong>${escapeHtml(nameLine)}</strong><br>${escapeHtml(dateLine)}`;
    tooltip.style.display = "block";
    moveTimelineTooltip(e);
}

/**
 * タイムライン描画エンジン (左ラベルと右バーの高さ完全同期版・4月始まり)
 */
function renderTimeline() {
    const wrapper = document.getElementById('timelineUnifiedWrapper');
    if (!wrapper) return;
    // --- 【追加】現在のスクロール位置を記憶 ---
    const savedScrollTop = wrapper.scrollTop;
    const savedScrollLeft = wrapper.scrollLeft;
    wrapper.innerHTML = "";

    // --- 1. 定数・変数の定義 ---
    const dayWidth = 15;
    // CSS変数(--label-width)と揃える
    const labelWidth = (() => {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--label-width').trim();
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : 280;
    })();
    const now = new Date();
    const todayTl = new Date();
    todayTl.setHours(0, 0, 0, 0);
    const barElsById = new Map();

    const dependencyPairs = [];
    // family単位で子タスクを枝番順に並べ、fFlagが立っているタスクの「直前」を依存元にする
    const childrenByFamily = new Map();
    tasks
        .filter(t => !t.archived && !isParentTask(t) && !isExternalTask(t))
        .forEach(t => {
            const k = getTaskFamilyKey(t);
            if (!childrenByFamily.has(k)) childrenByFamily.set(k, []);
            childrenByFamily.get(k).push(t);
        });
    childrenByFamily.forEach(children => {
        children.sort((a, b) => parseInt(getTaskBranchNo(a), 10) - parseInt(getTaskBranchNo(b), 10));
        for (let i = 1; i < children.length; i++) {
            const cur = children[i];
            if (cur.fFlag && getTaskBranchNo(cur) !== "010") dependencyPairs.push([children[i - 1].id, cur.id]);
        }
    });

    const baseStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // 親タスクの期間が「当月より前」から続いている場合、当月より前の月もヘッダに含める
    let minStartNeed = new Date(baseStart);
    const parentsForRange = tasks.concat(externalTasks).filter(t => !t.archived && isParentTask(t));
    parentsForRange.forEach((p) => {
        if (!p.startDate || !p.deadline) return;
        const s = new Date(p.startDate);
        const e = new Date(p.deadline);
        if (isNaN(s) || isNaN(e)) return;
        if (s < baseStart && e >= baseStart) {
            if (s < minStartNeed) minStartNeed = s;
        }
    });
    const startDate = new Date(minStartNeed.getFullYear(), minStartNeed.getMonth(), 1);
    const endDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + 12, 0);

    // --- 2. 計算用関数 getX ---
    function getX(date) {
        if (!date) return 0;
        let d = new Date(date);

        // 【修正】もし日付がカレンダー開始（4月1日）より前なら、強制的に開始点(0)を返す
        if (d < startDate) return 0;
        // もし終了（翌年3月末）より後なら、最大幅を返す
        if (d > endDate) return gridTotalWidth;

        let x = 0;
        for (let i = 0; i < monthsCount; i++) {
            const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
            const isCollapsed = forcedCollapsedMonths.has(i) || collapsedMonths.includes(i);

            if (d.getMonth() === mDate.getMonth() && d.getFullYear() === mDate.getFullYear()) {
                return x + (isCollapsed ? 5 : (d.getDate() - 1) * dayWidth);
            }
            x += isCollapsed ? 30 : daysInMonth * dayWidth;
        }
        return x;
    }

    const monthsCount = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
    collapsedMonths = collapsedMonths.filter(i => i >= 0 && i < monthsCount);

    // 今日の月から N か月先まで操作可能。それより先の未来月のみ折りたたみ固定
    // 過去月は 3/6/9/12 か月表示とは別に、未完了タスクがある月は常に展開
    const baseIndex = (() => {
        const diff = (baseStart.getFullYear() - startDate.getFullYear()) * 12 + (baseStart.getMonth() - startDate.getMonth());
        return Math.max(0, Math.min(monthsCount - 1, diff));
    })();
    const endIndexExclusive = Math.min(monthsCount, baseIndex + timelineMonthRange);
    forcedCollapsedMonths = new Set();
    for (let mi = 0; mi < monthsCount; mi++) {
        if (mi >= endIndexExclusive) forcedCollapsedMonths.add(mi);
    }

    let gridTotalWidth = 0;
    for (let i = 0; i < monthsCount; i++) {
        const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const count = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
        const isCollapsed = forcedCollapsedMonths.has(i) || collapsedMonths.includes(i);
        gridTotalWidth += isCollapsed ? 30 : count * dayWidth;
    }

    // --- 3. ヘッダー行の生成 ---
    const corner = document.createElement('div');
    corner.className = 'sticky-label sticky-header';
    corner.innerText = "業務内容";
    corner.style.width = `${labelWidth}px`;
    corner.style.minWidth = `${labelWidth}px`;
    corner.setAttribute("data-help", "タイムライン左上：テーマ/課題列の見出し（リスト左列と対応）");
    wrapper.appendChild(corner);

    const monthHeaderArea = document.createElement('div');
    monthHeaderArea.className = 'sticky-header';
    monthHeaderArea.style.width = `${gridTotalWidth}px`;
    monthHeaderArea.style.display = 'flex';
    monthHeaderArea.style.borderBottom = '2px solid #ccc';
    wrapper.appendChild(monthHeaderArea);

    for (let i = 0; i < monthsCount; i++) {
        const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
        const isForced = forcedCollapsedMonths.has(i);
        const isCollapsed = isForced || collapsedMonths.includes(i);

        const mLabel = document.createElement('div');
        mLabel.style.width = isCollapsed ? `30px` : `${daysInMonth * dayWidth}px`;
        mLabel.style.cursor = isForced ? 'not-allowed' : 'pointer';
        mLabel.className = "timeline-month-header";
        mLabel.classList.add(isCollapsed ? "timeline-month-header--collapsed" : "timeline-month-header--open");
        mLabel.classList.add(i % 2 === 0 ? "timeline-month-header--stripe-a" : "timeline-month-header--stripe-b");
        mLabel.style.fontSize = '0.8rem';
        mLabel.style.fontWeight = 'bold';
        mLabel.style.height = '35px';
        mLabel.style.lineHeight = '35px';
        mLabel.style.paddingLeft = '5px';

        if (isCollapsed) {
            mLabel.style.paddingLeft = '0';
            mLabel.style.lineHeight = '1.05';
            mLabel.style.textAlign = 'center';
            mLabel.style.fontSize = '0.72rem';
            mLabel.innerHTML = `+<br>${mDate.getMonth() + 1}月`;
        } else {
            mLabel.style.textAlign = 'left';
            mLabel.innerHTML = `&minus; ${mDate.getMonth() + 1}月`;
        }
        if (isForced) {
            mLabel.classList.add("month-toggle-disabled");
            mLabel.onclick = null;
            mLabel.setAttribute(
                "data-help",
                `月の折りたたみ（制限中）：表示範囲（今日から${timelineMonthRange}か月）より先の月のため固定で折りたたみです`
            );
        } else {
            mLabel.onclick = () => toggleMonth(i);
            mLabel.setAttribute(
                "data-help",
                "月の折りたたみ：クリックでこの月の日付列をまとめて狭くする／広げます"
            );
        }

        monthHeaderArea.appendChild(mLabel);
    }

    // 日曜・マスター休日の縦帯（月見出しの下の行だけに重ねる。折りたたみ月は日単位が無いため除外）
    const masterHolidayIsoSet = getMasterHolidayIsoSet();
    const timelineSunRects = (() => {
        const rects = [];
        for (let mi = 0; mi < monthsCount; mi++) {
            if (forcedCollapsedMonths.has(mi) || collapsedMonths.includes(mi)) continue;
            const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + mi, 1);
            const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dt = new Date(mDate.getFullYear(), mDate.getMonth(), d);
                const iso = dateToIsoLocal(dt);
                if (dt.getDay() !== 0 && !masterHolidayIsoSet.has(iso)) continue;
                rects.push({ left: getX(dt), width: dayWidth });
            }
        }
        return rects;
    })();
    const timelineSatRects = (() => {
        const rects = [];
        for (let mi = 0; mi < monthsCount; mi++) {
            if (forcedCollapsedMonths.has(mi) || collapsedMonths.includes(mi)) continue;
            const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + mi, 1);
            const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dt = new Date(mDate.getFullYear(), mDate.getMonth(), d);
                if (dt.getDay() !== 6) continue;
                rects.push({ left: getX(dt) });
            }
        }
        return rects;
    })();
    const timelineSaturdayBorder =
        timelineSatRects.length > 0
            ? timelineSatRects
                  .map(
                      ({ left }) =>
                          `linear-gradient(to right, transparent ${left}px, var(--app-timeline-sat-border) ${left}px, var(--app-timeline-sat-border) ${left + 2}px, transparent ${left + 2}px)`
                  )
                  .join(", ")
            : "";

    const timelineSundayBg =
        timelineSunRects.length > 0
            ? timelineSunRects
                  .map(
                      ({ left, width }) =>
                          `linear-gradient(to right, transparent ${left}px, var(--app-timeline-sunday-band) ${left}px, var(--app-timeline-sunday-band) ${left + width}px, transparent ${left + width}px)`
                  )
                  .join(", ")
            : "";

    // --- 4. タスク行の描画 ---
    const ownTl = getTabFilteredOwnTasks().filter((t) => t.startDate || t.deadline || t.msDate);
    const extTl = getTabFilteredExternalTasks().filter((t) => t.startDate || t.deadline || t.msDate);
    let timelineTasks = buildMergedDisplayRows(ownTl, extTl);

    const searchQueryTl = getSearchQueryLower();
    const searchFamilyKeysTl = getSearchMatchingFamilyKeys(timelineTasks, searchQueryTl);
    if (searchFamilyKeysTl) {
        timelineTasks = timelineTasks.filter((t) => searchFamilyKeysTl.has(getTaskFamilyKey(t)));
    }

    let lastThemeRootTimeline = "";
    let useGreenBackgroundTimeline = false;
    let hasAnimateIn = false; // row-animate-in が付く場合だけ依存線を遅延描画

    const { overdueFamilies: overdueFamiliesTl, lastVisibleChildIdByFamily } =
        computeOverdueFamilyRowMarkers(
            timelineTasks,
            todayTl,
            typeof collapsedThemesTimeline !== "undefined" ? collapsedThemesTimeline : [],
            searchFamilyKeysTl
        );

    timelineTasks.forEach(task => {
        const isParent = isParentTask(task);
        const isExt = isExternalTask(task);
        const familyKey = getTaskFamilyKey(task);
        const rootName = getThemeLabel(task);

        if (familyKey !== lastThemeRootTimeline) {
            useGreenBackgroundTimeline = !useGreenBackgroundTimeline;
            lastThemeRootTimeline = familyKey;
        }

        const isCollapsedT = (typeof collapsedThemesTimeline !== "undefined") && collapsedThemesTimeline.includes(familyKey);
        const showDespiteCollapseTl = searchFamilyKeysTl && searchFamilyKeysTl.has(familyKey);
        const rowBgColor = useGreenBackgroundTimeline ? "var(--app-row-alt)" : "var(--app-row-base)";
        if (!isParent && isCollapsedT && !showDespiteCollapseTl) return;

        let progressLabel = "";
        if (isParent) {
            const pool = isExt ? timelineTasks : tasks;
            const subTasks = pool.filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t));
            if (subTasks.length > 0) {
                const completedCount = subTasks.filter(t => isTerminalTaskStatus(t.status)).length;
                const percent = Math.round((completedCount / subTasks.length) * 100);
                progressLabel = ` (${completedCount}/${subTasks.length}) ${percent}%`;
            }
        }

        const isCompleted = isTerminalTaskStatus(task.status);
        const isCancelled = task.status === "中止";
        const deadlineDateTl = task.deadline ? new Date(task.deadline) : null;
        const isExpiredTl = !isTerminalTaskStatus(task.status) && deadlineDateTl && deadlineDateTl < todayTl;
        const scheduleSigTl =
            !isParent && task.status === "中止"
                ? "cancelled"
                : !isExpiredTl
                  ? getChildScheduleSignal(task, todayTl)
                  : null;
        const accentTl = getThemeAccentForFamily(familyKey, tasks.concat(externalTasks));
        const toggleIcon = isCollapsedT ? "＋" : "－";
        const childCount = timelineTasks.filter(t => !t.archived && getTaskFamilyKey(t) === familyKey && !isParentTask(t)).length;
        const hasChildren = childCount > 0;

        let labelHTML = "";
        if (isParent) {
            const lockHtml = isExt
                ? `<span class="external-lock" style="margin-right:4px;"${helpAttr("外部CSV：タイムライン上も閲覧専用です")}>🔒</span>`
                : "";
            labelHTML = hasChildren
                ? `<span class="accordion-btn" onclick="toggleTimelineAccordion('${task.id}'); event.stopPropagation();" style="margin-right:5px;"${helpAttr("アコーディオン（タイムライン）：子の行表示を開閉します")}>${toggleIcon}</span>${lockHtml}<strong class="tl-parent-label--ellipsis-tip">${rootName}${progressLabel}</strong>`
                : `<span class="accordion-btn accordion-btn-disabled" style="margin-right:5px;"${helpAttr("アコーディオン：子タスクがないため開閉できません")}>＋</span>${lockHtml}<strong class="tl-parent-label--ellipsis-tip">${rootName}${progressLabel}</strong>`;
        } else {
            const childLabel = getSecondaryStep(task) || "詳細未入力";
            labelHTML = `<span class="tl-label-child-row"><span class="tl-child-detail tl-child-detail--ellipsis-tip">${childLabel}</span>${scheduleSignalIconHtml(scheduleSigTl, "tl")}</span>`;
        }

        const displayLabel = isParent
            ? ((isExt ? "🔒 " : "") + rootName + progressLabel)
            : (getSecondaryStep(task) || rootName);
        // --- ★追加：アニメーションをさせるかどうかの判定 ---
        // 1. 初回ロード時（isInitialLoad）の「子タスク」
        // 2. または、今クリックして開いた親（lastToggledTheme）に属する「子タスク」
        const shouldAnimate = (isInitialLoad && !isParent) || (familyKey === lastToggledTheme && !isParent);

        // --- 左側のラベル (lCell) ---
        const lCell = document.createElement('div');
        lCell.className = 'sticky-label';
        lCell.dataset.family = familyKey;
        lCell.dataset.parent = isParent ? '1' : '0';
        lCell.innerHTML = `<span class="label-text">${labelHTML}</span>`;
        lCell.style.backgroundColor = rowBgColor;
        lCell.style.width = `${labelWidth}px`;
        lCell.style.minWidth = `${labelWidth}px`;
        if (isExpiredTl) lCell.classList.add('timeline-expired');
        if (isParent && overdueFamiliesTl.has(familyKey)) {
            lCell.classList.add("timeline-overdue-family-top");
        }
        if (!isParent && overdueFamiliesTl.has(familyKey) && lastVisibleChildIdByFamily.get(familyKey) === task.id) {
            lCell.classList.add("timeline-overdue-family-bottom");
        }
        //if (!isParent) lCell.classList.add('row-animate-in');
        if (isCompleted) lCell.style.color = '#888';
        lCell.setAttribute(
            "data-help",
            isParent
                ? "タイムライン左ラベル（親）：テーマ名と集計。右側のバーと並びます"
                : "タイムライン左ラベル（子）：業務内容。右側に期間バーがあります"
        );
        wrapper.appendChild(lCell);

        // --- 右側のタイムラインエリア (rArea) ---
        const rArea = document.createElement('div');
        rArea.className = 'timeline-row-area';
        rArea.dataset.family = familyKey;
        rArea.dataset.parent = isParent ? '1' : '0';
        rArea.style.width = `${gridTotalWidth}px`;
        rArea.style.backgroundColor = rowBgColor;
        if (isExpiredTl) rArea.classList.add('timeline-expired');
        if (isParent && overdueFamiliesTl.has(familyKey)) {
            rArea.classList.add("timeline-overdue-family-top");
        }
        if (!isParent && overdueFamiliesTl.has(familyKey) && lastVisibleChildIdByFamily.get(familyKey) === task.id) {
            rArea.classList.add("timeline-overdue-family-bottom");
        }
        //if (!isParent) rArea.classList.add('row-animate-in');
        // 初回ロード時、かつ親タスクでない場合のみ、両方にアニメーションクラスを付ける判定を shouldAnimate に変更 ---
        if (shouldAnimate) {
            lCell.classList.add('row-animate-in');
            rArea.classList.add('row-animate-in');
            hasAnimateIn = true;
        }
        if (isCompleted) rArea.style.opacity = isParent ? "0.8" : "1";

        if (timelineSundayBg) {
            const sunLayer = document.createElement("div");
            sunLayer.className = "timeline-sunday-layer";
            sunLayer.style.background = timelineSundayBg;
            rArea.appendChild(sunLayer);
        }

        if (timelineSaturdayBorder) {
            const satLayer = document.createElement("div");
            satLayer.className = "timeline-saturday-layer";
            satLayer.style.background = timelineSaturdayBorder;
            rArea.appendChild(satLayer);
        }

        // 今日ライン
        const todayX = getX(now);
        const todayLine = document.createElement('div');
        todayLine.style.position = 'absolute';
        todayLine.style.left = `${todayX}px`;
        todayLine.style.top = '0';
        todayLine.style.bottom = '0';
        todayLine.style.width = '2px';
        todayLine.style.background = 'rgba(255, 0, 0, 0.5)';
        todayLine.style.zIndex = '2';
        todayLine.setAttribute("data-help", "今日ライン：今日の日付位置を示す縦線です");
        rArea.appendChild(todayLine);

        // バーの描画
        let s = task.startDate ? new Date(task.startDate) : (task.msDate ? new Date(task.msDate) : new Date(task.deadline));
        let e = task.deadline ? new Date(task.deadline) : (task.msDate ? new Date(task.msDate) : s);

        if (e >= startDate && s <= endDate) {
            const startX = getX(s);
            const endX = getX(e);
            //const barWidth = Math.max(5, endX - startX + dayWidth);
            // 【修正】最低でも1日分の幅を確保し、終了日が開始日より前にならないように計算
            const barWidth = Math.max(dayWidth, endX - startX + (s > startDate ? dayWidth : 0));

            const barBg =
                accentTl ||
                (isExt ? "#5c6bc0" : isParent ? "#4285f4" : "#4285f4");
            const readOnlyBar = isExt || isParent;
            const barBase = isExt ? "#5c6bc0" : barBg;

            const bar = document.createElement("div");
            bar.className = "timeline-bar bar" + (isCancelled ? " timeline-bar--cancelled" : "");
            bar.dataset.id = task.id;
            barElsById.set(task.id, bar);
            bar.style.position = "absolute";
            bar.style.left = `${startX}px`;
            bar.style.width = `${barWidth}px`;
            bar.style.height = "21.6px";
            bar.style.top = "6.2px";
            bar.style.zIndex = "5";
            bar.style.overflow = "visible";

            if (isParent) {
                bar.style.background = barBase;
                bar.style.color = "#fff";
                bar.style.fontSize = "10px";
                bar.style.lineHeight = "21.6px";
                bar.style.padding = "0 5px";
                bar.style.borderRadius = "3px";
                bar.style.overflow = "hidden";
                bar.classList.add("timeline-bar--ellipsis-tip");
                bar.innerText = displayLabel;
            } else {
                bar.classList.add("timeline-bar--pdca");
                const gridStart = startDate;
                if (
                    pdcaActualEditMode &&
                    !readOnlyBar &&
                    !isTerminalTaskStatus(task.status) &&
                    task.status !== "未着手"
                ) {
                    ensurePdcaActualSeedFromComputed(task, todayTl);
                }
                const planSpan = timelinePixelSpanForRange(gridStart, dayWidth, getX, task.startDate, task.deadline);
                let actS = getPdcaActualStartForDisplay(task);
                let actE = getPdcaActualEndForDisplay(task, todayTl);
                const wrapLeft = planSpan.startX;
                const wrapWidth = planSpan.width;
                const planRelLeft = 0;
                const planRelW = planSpan.width;
                let actRelLeft = 0;
                let actRelW = 0;
                let hasAct = false;
                if (actS && actE && compareIsoDate(actS, actE) <= 0) {
                    hasAct = true;
                    const actSpan = timelinePixelSpanForRange(gridStart, dayWidth, getX, actS, actE);
                    actRelLeft = actSpan.startX - planSpan.startX;
                    actRelW = actSpan.width;
                    bar.classList.add("timeline-bar--pdca-overlap");
                }

                bar.style.height = `${TIMELINE_PDCA_SINGLE_H}px`;
                bar.style.left = `${wrapLeft}px`;
                bar.style.width = `${wrapWidth}px`;
                bar.dataset.planLeft = String(planRelLeft);
                bar.dataset.planWidth = String(planRelW);

                const planLayer = document.createElement("div");
                planLayer.className = "timeline-bar-plan";
                planLayer.style.cssText = [
                    "position:absolute",
                    `left:${planRelLeft}px`,
                    `width:${planRelW}px`,
                    "top:0",
                    "height:100%",
                    "box-sizing:border-box",
                    `background:${hexToRgba(barBase, 0.16)}`,
                    `border:2px dashed ${hexToRgba(barBase, 0.5)}`,
                    "border-radius:3px",
                    "pointer-events:none",
                    "z-index:6"
                ].join(";");
                bar.appendChild(planLayer);

                let labelEl = document.createElement("div");
                labelEl.className = "timeline-bar-label timeline-bar-label--ellipsis-tip";
                labelEl.textContent = displayLabel;

                if (hasAct && task.deadline) {
                    const planEnd = task.deadline;
                    const nextAfterPlan = addCalendarDaysIso(planEnd, 1);
                    let mS = actS;
                    let mE = actE;
                    let oS = null;
                    let oE = null;
                    if (compareIsoDate(actE, planEnd) > 0) {
                        if (compareIsoDate(actS, planEnd) > 0) {
                            mS = null;
                            mE = null;
                            oS = actS;
                            oE = actE;
                        } else {
                            mE = planEnd;
                            oS = nextAfterPlan;
                            oE = actE;
                            if (compareIsoDate(oS, oE) > 0) {
                                oS = null;
                                oE = null;
                            }
                        }
                    }

                    const hit = document.createElement("div");
                    const canEditAct =
                        pdcaActualEditMode && !readOnlyBar && !isTerminalTaskStatus(task.status);
                    hit.className = "timeline-bar-exec-hit";
                    hit.style.cssText = [
                        "position:absolute",
                        `left:${actRelLeft}px`,
                        `width:${actRelW}px`,
                        `top:${TIMELINE_PDCA_EXEC_TOP}px`,
                        `height:${TIMELINE_PDCA_EXEC_H}px`,
                        canEditAct ? "z-index:12" : "z-index:7",
                        "box-sizing:border-box",
                        canEditAct ? "pointer-events:auto;cursor:grab" : "pointer-events:none"
                    ].join(";");

                    const addSeg = (cls, bg, isoA, isoB, rad, borderCss) => {
                        if (!isoA || !isoB || compareIsoDate(isoA, isoB) > 0) return null;
                        const sp = timelinePixelSpanForRange(gridStart, dayWidth, getX, isoA, isoB);
                        const innerL = sp.startX - wrapLeft - actRelLeft;
                        const el = document.createElement("div");
                        el.className = cls;
                        el.style.cssText = [
                            "position:absolute",
                            `left:${innerL}px`,
                            `width:${sp.width}px`,
                            "top:0",
                            "height:100%",
                            `background:${bg}`,
                            borderCss || "border:none",
                            "box-sizing:border-box",
                            `border-radius:${rad}`,
                            "pointer-events:none",
                            "overflow:hidden"
                        ].join(";");
                        return el;
                    };

                    const execBorder = `1px solid ${hexToRgba(barBase, 0.88)}`;
                    const mainEl =
                        mS && mE
                            ? addSeg(
                                  "timeline-bar-exec-main",
                                  barBase,
                                  mS,
                                  mE,
                                  !oS && actRelW >= wrapWidth - 1 ? "3px" : "3px 0 0 3px",
                                  execBorder
                              )
                            : null;
                    const overRad = mS && mE ? "0 3px 3px 0" : "3px";
                    const overEl =
                        oS && oE
                            ? addSeg(
                                  "timeline-bar-exec-over",
                                  "rgba(229, 115, 115, 0.92)",
                                  oS,
                                  oE,
                                  overRad,
                                  "1px solid rgba(198, 40, 40, 0.75)"
                              )
                            : null;
                    if (overEl) {
                        overEl.style.border = "1px solid rgba(198, 40, 40, 0.75)";
                        overEl.style.background = "rgba(239, 154, 154, 0.95)";
                    }
                    if (mainEl) hit.appendChild(mainEl);
                    if (overEl) hit.appendChild(overEl);
                    bar.appendChild(hit);

                    const execRight = actRelLeft + actRelW;
                    const planRight = planRelLeft + planRelW;
                    if (actRelW > 2 && execRight < planRight - 2) {
                        const arrPlan = document.createElement("div");
                        arrPlan.className = "timeline-pdca-arrow timeline-pdca-arrow--plan";
                        arrPlan.innerHTML = `<span class="timeline-pdca-arrow-dash">┄┄</span><span class="timeline-pdca-arrow-head">›</span>`;
                        arrPlan.style.left = `${execRight}px`;
                        arrPlan.setAttribute("data-help", "計画区間へ（破線矢印）：この先は予定のみ未消化");
                        bar.appendChild(arrPlan);
                    }
                }

                labelEl.style.cssText = [
                    "position:absolute",
                    `left:${planRelLeft}px`,
                    `width:${planRelW}px`,
                    "top:0",
                    "height:100%",
                    "box-sizing:border-box",
                    "display:flex",
                    "align-items:center",
                    "padding:0 5px",
                    "font-size:10px",
                    "line-height:1.15",
                    "white-space:nowrap",
                    "overflow:hidden",
                    "text-overflow:ellipsis",
                    pdcaActualEditMode ? "pointer-events:none" : "pointer-events:auto",
                    "cursor:default",
                    "z-index:9",
                    isCompleted
                        ? "color:rgba(90,90,90,0.98);text-shadow:0 0 2px #fff,0 0 4px rgba(255,255,255,0.85)"
                        : "color:#102027;text-shadow:0 0 2px #fff,0 0 5px rgba(255,255,255,0.95),0 1px 0 rgba(255,255,255,0.8)"
                ].join(";");
                bar.appendChild(labelEl);

                const doneIsoSpark =
                    isTerminalTaskStatus(task.status) &&
                    String(task.progressUpdatedAt || "").trim() &&
                    String(task.progressUpdatedAt).trim() <= task.deadline &&
                    String(task.progressUpdatedAt).trim() >= (task.startDate || "")
                        ? String(task.progressUpdatedAt).trim()
                        : "";
                if (doneIsoSpark && task.deadline && doneIsoSpark < task.deadline) {
                    const doneDayLeft = getX(new Date(`${doneIsoSpark}T12:00:00`));
                    const spark = document.createElement("div");
                    spark.className = "timeline-bar-sparkle";
                    spark.textContent = "✨";
                    const sparkLeft = doneDayLeft - wrapLeft + dayWidth / 2;
                    spark.style.cssText = `position:absolute;left:${sparkLeft}px;top:-4px;transform:translateX(-50%);font-size:12px;line-height:1;z-index:12;pointer-events:none;text-shadow:0 0 3px #fff,0 0 2px #000;`;
                    spark.setAttribute("data-help", `期限内完了：完了日 ${doneIsoSpark}（右側は計画のみ表示）`);
                    bar.appendChild(spark);
                }
            }

            if (isExpiredTl) bar.classList.add("timeline-expired");
            if (!readOnlyBar) {
                bar.onmousedown = (e) => {
                    if (e.target.closest(".timeline-resize-handle")) return;
                    if (!isParent && pdcaActualEditMode) {
                        if (e.target.closest(".timeline-bar-exec-hit")) {
                            startPdcaActualBarDrag(e, task, bar);
                        }
                        return;
                    }
                    startDrag(e, task, bar);
                };
                bar.style.cursor = !isParent && pdcaActualEditMode ? "default" : "move";
            } else {
                bar.style.cursor = "default";
            }
            bar.addEventListener("mouseenter", (evt) => {
                if (!helpHoverOn) showTimelineTooltip(task, evt);
            });
            bar.addEventListener("mousemove", (evt) => {
                if (!helpHoverOn) moveTimelineTooltip(evt);
            });
            bar.addEventListener("mouseleave", () => {
                if (!isDraggingNow) hideTimelineTooltip();
            });
            if (isCompleted) bar.classList.add("timeline-bar--completed");
            if (isExt) {
                if (isParent) bar.style.background = "#5c6bc0";
                bar.setAttribute("data-help", "タイムライン・バー（外部）：閲覧専用のためドラッグできません");
            } else if (isParent) {
                bar.setAttribute(
                    "data-help",
                    "タイムライン・親バー：子の期間を集約した表示（ドラッグでは動かしません）"
                );
            } else {
                bar.setAttribute(
                    "data-help",
                    "タイムライン・子バー：破線枠＝計画（着手〜納期の元幅）、下に重ねた実線＝実績。納期超過分は実績が薄赤。ドラッグ＝計画のみ移動（実績は独立）、実績修正ONで実績のみ移動／伸縮"
                );
            }

            if (!readOnlyBar) {
                const resizeHandle = document.createElement("div");
                resizeHandle.className = "timeline-resize-handle";
                resizeHandle.style.position = "absolute";
                resizeHandle.style.top = "0";
                resizeHandle.style.width = "8px";
                resizeHandle.style.height = "100%";
                resizeHandle.style.cursor = "ew-resize";
                resizeHandle.style.background = "rgba(255,255,255,0.35)";
                resizeHandle.style.zIndex = "15";
                resizeHandle.style.pointerEvents = "auto";
                if (!isParent && bar.classList.contains("timeline-bar--pdca")) {
                    const pl = parseFloat(bar.dataset.planLeft || "0");
                    const pw = parseFloat(bar.dataset.planWidth || "0");
                    const hit = bar.querySelector(".timeline-bar-exec-hit");
                    const overlap = bar.classList.contains("timeline-bar--pdca-overlap");
                    if (pdcaActualEditMode && hit) {
                        resizeHandle.dataset.resizeTarget = "actual";
                        const actL = parseFloat(hit.style.left || "0");
                        const actW = parseFloat(hit.style.width || "0");
                        resizeHandle.style.left = `${actL + actW - 8}px`;
                        resizeHandle.style.right = "auto";
                        if (overlap) {
                            resizeHandle.style.top = `${TIMELINE_PDCA_EXEC_TOP}px`;
                            resizeHandle.style.height = `${TIMELINE_PDCA_EXEC_H}px`;
                        }
                        resizeHandle.setAttribute(
                            "data-help",
                            "実績ハンドル：実績の終了日だけを伸縮します（実績修正ON時）"
                        );
                    } else {
                        resizeHandle.dataset.resizeTarget = "plan";
                        resizeHandle.style.left = `${pl + pw - 8}px`;
                        resizeHandle.style.right = "auto";
                        resizeHandle.style.top = "0";
                        resizeHandle.style.height = "100%";
                        resizeHandle.setAttribute(
                            "data-help",
                            "納期ハンドル：計画の納期を変更します"
                        );
                    }
                } else {
                    resizeHandle.style.right = "0";
                    resizeHandle.style.left = "auto";
                    resizeHandle.setAttribute(
                        "data-help",
                        "納期ハンドル：右端をドラッグして納期（バーの長さ）だけ変更します"
                    );
                }
                resizeHandle.onmousedown = (evt) => {
                    evt.stopPropagation();
                    startResize(evt, task, bar);
                };
                bar.appendChild(resizeHandle);
            }
            rArea.appendChild(bar);
        }

        // ◇ マイルストーン
        if (task.msDate) {
            const msX = getX(new Date(task.msDate));
            const diamond = document.createElement('div');
            diamond.innerText = '◇';
            diamond.style.position = 'absolute';
            diamond.style.left = `${msX}px`;
            diamond.style.top = '0';
            diamond.style.height = '35px';
            diamond.style.lineHeight = '35px';
            diamond.style.color = '#ffeb3b';
            diamond.style.fontSize = '20px';
            diamond.style.transform = 'translateX(-50%)';
            diamond.style.zIndex = '8';
            diamond.style.textShadow = '1px 1px 2px #000';
            diamond.style.cursor = "default";
            diamond.setAttribute("data-help", "◇マイルストーン：展開（FirstFlag）に紐づく基準日を示します");
            diamond.addEventListener("mouseenter", (evt) => {
                if (!helpHoverOn) showTimelineMarkerTooltip("ms", task, evt);
            });
            diamond.addEventListener("mousemove", (evt) => {
                if (!helpHoverOn) moveTimelineTooltip(evt);
            });
            diamond.addEventListener("mouseleave", () => {
                if (!isDraggingNow) hideTimelineTooltip();
            });
            rArea.appendChild(diamond);
        }

        // ★ ターゲット
        if (getTargetDate(task)) {
            const tarX = getX(new Date(getTargetDate(task)));
            const star = document.createElement('div');
            star.innerText = '★';
            star.style.position = 'absolute';
            star.style.left = `${tarX}px`;
            star.style.top = '0';
            star.style.height = '35px';
            star.style.lineHeight = '35px';
            star.style.color = '#ff9800';
            star.style.fontSize = '22px';
            star.style.transform = 'translateX(-50%)';
            star.style.zIndex = '9';
            star.style.textShadow = '0 0 3px #fff';
            star.style.cursor = "default";
            star.setAttribute("data-help", "★ターゲット：イベント（Target）の目標日を示します");
            star.addEventListener("mouseenter", (evt) => {
                if (!helpHoverOn) showTimelineMarkerTooltip("tar", task, evt);
            });
            star.addEventListener("mousemove", (evt) => {
                if (!helpHoverOn) moveTimelineTooltip(evt);
            });
            star.addEventListener("mouseleave", () => {
                if (!isDraggingNow) hideTimelineTooltip();
            });
            rArea.appendChild(star);
        }

        rArea.setAttribute(
            "data-help",
            "タイムライン右エリア：日付グリッド上にバーや記号が載ります（横スクロールで全体を見られます）"
        );
        wrapper.appendChild(rArea);
    });

    // --- 【書き換え】スクロール制御ロジック ---
    function drawDependencyLines() {
        // 既存SVGがあれば消す（再描画のたびに揮発させる）
        const old = wrapper.querySelector('svg.timeline-dependency-lines');
        if (old) old.remove();

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.classList.add("timeline-dependency-lines");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.pointerEvents = "none";
        svg.style.zIndex = "2";
        svg.setAttribute("width", wrapper.scrollWidth);
        svg.setAttribute("height", wrapper.scrollHeight);
        wrapper.appendChild(svg);

        const wrapperRect = wrapper.getBoundingClientRect();

        dependencyPairs.forEach(([prevId, curId]) => {
            const prevEl = barElsById.get(prevId);
            const curEl = barElsById.get(curId);
            if (!prevEl || !curEl) return;

            const p = prevEl.getBoundingClientRect();
            const c = curEl.getBoundingClientRect();

            // SVGはwrapper content座標系に揃える（子PDCAは計画バーの端）
            const x1 = timelineDepBarEdgeClientX(prevEl, "right") - wrapperRect.left + wrapper.scrollLeft;
            const y1 = (p.top + p.height / 2) - wrapperRect.top + wrapper.scrollTop;
            const x2 = timelineDepBarEdgeClientX(curEl, "left") - wrapperRect.left + wrapper.scrollLeft;
            const y2 = (c.top + c.height / 2) - wrapperRect.top + wrapper.scrollTop;

            const path = document.createElementNS(svgNS, "path");
            // 曲線だと「ひも」っぽく見えやすいため、始点-終点を直線で結ぶ
            path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
            path.setAttribute("stroke", "#9c27b0");
            path.setAttribute("stroke-width", "2");
            path.setAttribute("fill", "none");
            path.setAttribute("opacity", "0.7");
            svg.appendChild(path);
        });
    }

    const delayMs = hasAnimateIn ? ACCORDION_ROW_ANIM_IN_MS : 0;
    const scheduleDrawDependencyLines = () => {
        if (dependencyDrawTimer) clearTimeout(dependencyDrawTimer);
        if (!delayMs) {
            drawDependencyLines();
            return;
        }
        dependencyDrawTimer = setTimeout(() => {
            dependencyDrawTimer = null;
            drawDependencyLines();
        }, delayMs);
    };

    if (isInitialLoad) {
        // 初回のみ：今日（now）の位置へスクロール
        setTimeout(() => {
            const targetScroll = getX(now) - 50;
            wrapper.scrollLeft = Math.max(0, targetScroll);
            isInitialLoad = false; // 初回フラグをオフ
            scheduleDrawDependencyLines();
        }, 50);
    } else {
        // 2回目以降（開閉やドラッグ）：記憶していた位置を即座に復元
        wrapper.scrollTop = savedScrollTop;
        wrapper.scrollLeft = savedScrollLeft;

        // 【追加】アニメーションが終わるタイミングでターゲット記憶をリセット
        lastToggledTheme = null;
        scheduleDrawDependencyLines();
    }

} // renderTimeline の終わり

//ドラッグ動作の制御ロジック
let isDragging = false;

function startPdcaActualBarDrag(e, task, bar) {
    if (isExternalTask(task) || isTerminalTaskStatus(task.status)) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingNow = true;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    ensurePdcaActualSeedFromComputed(task, today0);
    const origS = getPdcaActualStartForDisplay(task);
    const origE = getPdcaActualEndForDisplay(task, today0);
    if (!origS || !origE) {
        isDraggingNow = false;
        return;
    }
    const startClientX = e.clientX;
    const dayW = 15;
    const onMove = (ev) => {
        const dDays = Math.round((ev.clientX - startClientX) / dayW);
        task.pdcaActualStart = addCalendarDaysIso(origS, dDays);
        task.pdcaActualEnd = addCalendarDaysIso(origE, dDays);
        save();
        scheduleRenderTimeline();
        showTimelineTooltip(task, ev);
    };
    const onUp = () => {
        isDraggingNow = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        renderAll();
        hideTimelineTooltip();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}

function startPdcaActualResize(e, task, bar) {
    if (isExternalTask(task) || isTerminalTaskStatus(task.status)) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingNow = true;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    ensurePdcaActualSeedFromComputed(task, today0);
    const origS = getPdcaActualStartForDisplay(task);
    let origE = String(task.pdcaActualEnd || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(origE)) {
        origE = getTimelinePdcaExecEndIso(task, today0) || origS;
    }
    const startClientX = e.clientX;
    const dayW = 15;
    const onMove = (ev) => {
        const dDays = Math.round((ev.clientX - startClientX) / dayW);
        let ne = addCalendarDaysIso(origE, dDays);
        if (compareIsoDate(ne, origS) < 0) ne = origS;
        task.pdcaActualEnd = ne;
        save();
        scheduleRenderTimeline();
        showTimelineTooltip(task, ev);
    };
    const onUp = () => {
        isDraggingNow = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        renderAll();
        hideTimelineTooltip();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}

function startDrag(e, task, bar) {
    // 親タスク、または「完了」ステータスのタスクはドラッグさせない
    if (isParentTask(task) || isTerminalTaskStatus(task.status) || isExternalTask(task)) return;

    isDraggingNow = true;
    const startX = e.clientX;
    const startBase = task.startDate || task.deadline || task.msDate;
    const endBase = task.deadline || task.startDate || task.msDate;
    const originalStart = startBase ? new Date(startBase) : new Date();
    const originalEnd = endBase ? new Date(endBase) : new Date(originalStart);
    const durationDays = Math.max(0, Math.round((originalEnd - originalStart) / (1000 * 60 * 60 * 24)));
    const familyKey = getTaskFamilyKey(task);
    const depPrevDeadline = getDependencyPrevDeadlineMin(task);
    const minStartDate = depPrevDeadline ? new Date(depPrevDeadline) : null;
    const minDaysMoved = minStartDate
        ? Math.round((minStartDate - originalStart) / (1000 * 60 * 60 * 24))
        : null;
    const markers = getMarkersMinMaxDate(task);
    // ◇/★ を期間外に出さないための移動範囲（ドラッグ＝期間を平行移動）
    const markerMinDaysMoved =
        markers.max ? Math.round((markers.max - originalEnd) / (1000 * 60 * 60 * 24)) : null;
    const markerMaxDaysMoved =
        markers.min ? Math.round((markers.min - originalStart) / (1000 * 60 * 60 * 24)) : null;

    const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        let previewDays = Math.round(deltaX / 15);
        const lower = Math.max(
            minDaysMoved !== null ? minDaysMoved : -Infinity,
            markerMinDaysMoved !== null ? markerMinDaysMoved : -Infinity
        );
        const upper = markerMaxDaysMoved !== null ? markerMaxDaysMoved : Infinity;
        previewDays = Math.max(lower, Math.min(upper, previewDays));
        const previewStart = new Date(originalStart);
        previewStart.setDate(originalStart.getDate() + previewDays);
        const previewEnd = new Date(previewStart);
        previewEnd.setDate(previewStart.getDate() + durationDays);
        task.startDate = previewStart.toISOString().split('T')[0];
        task.deadline = previewEnd.toISOString().split('T')[0];
        reflectTaskDatesInList(task);
        syncParentDates(familyKey);
        save();
        scheduleRenderTimeline();
        showTimelineTooltip(task, moveEvent);
    };

    const onMouseUp = (upEvent) => {
        const deltaX = upEvent.clientX - startX;
        let daysMoved = Math.round(deltaX / 15);
        const lower = Math.max(
            minDaysMoved !== null ? minDaysMoved : -Infinity,
            markerMinDaysMoved !== null ? markerMinDaysMoved : -Infinity
        );
        const upper = markerMaxDaysMoved !== null ? markerMaxDaysMoved : Infinity;
        daysMoved = Math.max(lower, Math.min(upper, daysMoved));
        if (daysMoved !== 0) {
            const newStart = new Date(originalStart);
            newStart.setDate(originalStart.getDate() + daysMoved);
            const newEnd = new Date(originalEnd);
            newEnd.setDate(originalEnd.getDate() + daysMoved);
            task.startDate = newStart.toISOString().split('T')[0];
            task.deadline = newEnd.toISOString().split('T')[0];
            pushNextDependentTasks(task);
            // 子を動かしたら親も更新
            syncParentDates(familyKey);

            // ★追加：移動後のデータをローカルストレージに保存する
            save();
        }
        isDraggingNow = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // 再描画（リスト側にも反映させるため renderAll を呼ぶのも有効です）
        renderAll();
        hideTimelineTooltip();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function startResize(e, task, bar) {
    if (isParentTask(task) || isTerminalTaskStatus(task.status) || isExternalTask(task)) return;
    const resizeTarget = e.currentTarget?.dataset?.resizeTarget || "plan";
    if (resizeTarget === "actual") {
        startPdcaActualResize(e, task, bar);
        return;
    }
    isDraggingNow = true;
    const startX = e.clientX;
    const startIso = (task.startDate || "").trim();
    const origDeadline = (task.deadline || "").trim();
    const markers = getMarkersMinMaxDate(task);
    const minEndByMarkers = markers.max ? dateToIsoLocal(markers.max) : "";

    const onMouseMove = (moveEvent) => {
        const dDays = Math.round((moveEvent.clientX - startX) / 15);
        let newDeadline = addCalendarDaysIso(origDeadline, dDays);
        const depPrevDeadline = getDependencyPrevDeadlineMin(task);
        if (depPrevDeadline && newDeadline < depPrevDeadline) newDeadline = depPrevDeadline;
        if (startIso && newDeadline < startIso) newDeadline = startIso;
        if (minEndByMarkers && newDeadline < minEndByMarkers) newDeadline = minEndByMarkers;
        if (markers.min && dateToIsoLocal(markers.min) < startIso) {
            showToast("◇/★ が着手日より前です（バーを左へ動かして期間に入れてください）");
        }
        task.startDate = startIso;
        task.deadline = newDeadline;
        reflectTaskDatesInList(task);
        syncParentDates(getTaskFamilyKey(task));
        save();
        scheduleRenderTimeline();
        showTimelineTooltip(task, moveEvent);
    };

    const onMouseUp = () => {
        isDraggingNow = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        pushNextDependentTasks(task);
        renderAll();
        hideTimelineTooltip();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}

function reflectTaskDatesInList(task) {
    const row = document.querySelector(`#taskBody tr[data-id="${task.id}"]`);
    if (!row) return;
    const startIn = row.querySelector('input[data-date-field="start"]');
    const endIn = row.querySelector('input[data-date-field="deadline"]');
    if (startIn) startIn.value = task.startDate || "";
    if (endIn) endIn.value = task.deadline || "";
}

function syncParentDates(familyKey) {
    // 同じファミリーIDを持つ子タスクを抽出（自分自身＝親は除く）
    const children = tasks.filter(t => getTaskFamilyKey(t) === familyKey && !isParentTask(t) && !t.archived);
    if (children.length === 0) return;

    const startDates = children.map(t => new Date(t.startDate)).filter(d => !isNaN(d));
    const endDates = children.map(t => new Date(t.deadline)).filter(d => !isNaN(d));

    const parent = tasks.find(t => getTaskFamilyKey(t) === familyKey && isParentTask(t));
    if (parent) {
        if (startDates.length > 0) parent.startDate = new Date(Math.min(...startDates)).toISOString().split('T')[0];
        if (endDates.length > 0) parent.deadline = new Date(Math.max(...endDates)).toISOString().split('T')[0];
    }
}

// --- 保存・同期・マスタ ---
// 【共通】データをローカルストレージに保存する関数
function save() {
    localStorage.setItem('omniStepData', JSON.stringify(tasks));
}

// 【共通】タスクの値を書き換える唯一の窓口
function updateTaskValue(taskId, field, value) {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        const task = tasks[index];
        if (isExternalTask(task)) {
            showToast("外部CSVは編集できません");
            renderAll();
            return;
        }
        const isLocked = task.archived || isTerminalTaskStatus(task.status);
        // 完了/アーカイブは「進捗・メモ以外」をロック
        if (isLocked && !["status", "memo"].includes(field)) {
            showToast("完了タスクは進捗・メモ以外は編集できません");
            renderAll();
            return;
        }
        const depPrevDeadline = getDependencyPrevDeadlineMin(task);
        // ◇/★ は「自分の期間」に依存（他の子の影響を受けない）
        if (!isParentTask(task) && (field === "msDate" || field === "TargetDate" || field === "target")) {
            if (value) {
                const v = String(value);
                if (!isIsoDateInOwnPeriod(task, v)) {
                    showToast("◇/★ はこの子タスクの期間内に設定してください");
                    // 入力は反映せず終了
                    renderAll();
                    return;
                }
            }
        }

        // 依存ON時：期間が既に入っていて矛盾する場合はONにしない（警告）
        if (field === "fFlag" && !!value) {
            if (!canEnableDependencyForChild(task)) {
                showToast("連携ONにできません：直前の子の納期がこの子の着手日より後です");
                renderAll();
                return;
            }
        }
        // 1. 配列内のデータを書き換え
        if (field === "PrimaryStep" || field === "content") setPrimaryStep(tasks[index], value);
        else if (field === "SecondaryStep" || field === "issue") setSecondaryStep(tasks[index], value);
        else if (field === "TargetFlag") setTargetName(tasks[index], value);
        else if (field === "TargetDate" || field === "target") setTargetDate(tasks[index], value);
        else if (field === "FirstFlag" || field === "factory") setFirstFlag(tasks[index], value);
        else if (field === "fFlag") tasks[index].fFlag = !!value;
        else tasks[index][field] = value;

        // カテゴリは「テーマ（親子）」で統一
        if (field === "category") {
            const familyKey = getTaskFamilyKey(tasks[index]);
            const parent = tasks.find(t => !t.archived && getTaskFamilyKey(t) === familyKey && isParentTask(t));
            const nextCat = value || parent?.category || getDefaultCategoryFallback();
            syncFamilyCategory(familyKey, nextCat);
        }

        // 2. もし日付関連（開始、期限、ターゲット、MS）なら、親タスクの日程も再計算する
        const dateFields = ['startDate', 'deadline', 'target', 'msDate', 'TargetDate'];
        if (dateFields.includes(field)) {
            syncParentDates(getTaskFamilyKey(tasks[index]));
        }

        // 3. 保存して再描画（これで「書き換えたのに消えた」を防ぐ）
        save();
        renderAll();
    }
}
function saveMaster() { localStorage.setItem('omnistep_master', JSON.stringify(yearlyMaster)); updateMasterDropdown(); }

function getMasterOptionsHTML(currentValue) {
    let options = `<option value="" ${!currentValue ? 'selected' : ''}>--未選択--</option>`;
    const sorted = [...yearlyMaster]
        .filter((m) => !m.isHoliday)
        .sort((a, b) => ((a.date || "9999-12-31") > (b.date || "9999-12-31") ? 1 : -1));
    sorted.forEach(m => { options += `<option value="${m.name}" ${m.name === currentValue ? 'selected' : ''}>${m.name}</option>`; });
    return options;
}

function updateMasterDropdown() {
    const inFac = document.getElementById('inFactorySelect');
    const inCat = document.getElementById('inCategory');
    const newFirst = document.getElementById('newFirstFlagName');
    const newEvent = document.getElementById('newTargetFlagName');
    if (inFac) inFac.innerHTML = getMasterOptionsHTML("");
    if (inCat) inCat.innerHTML = buildCategorySelectOptionsHtml("");
    fillNewTaskCategorySelect();
    if (newFirst) newFirst.innerHTML = getMasterOptionsHTML("");
    if (newEvent) newEvent.innerHTML = getMasterOptionsHTML("");
}

function updateTaskFromMaster(taskId, newName) {
    const task = tasks.find(t => t.id === taskId);
    const masterEntry = yearlyMaster.find(m => m.name === newName);
    if (!task || isExternalTask(task)) return;
    setFirstFlag(task, newName);
    const nextDate = masterEntry ? (masterEntry.date || "") : "";
    if (nextDate && !isIsoDateInOwnPeriod(task, nextDate)) {
        showToast("◇日付がこの子タスクの期間外のため、マスターから設定できません");
        save();
        renderAll();
        return;
    }
    task.msDate = nextDate;
    save();
    renderAll();
}

function updateTaskTargetFromMaster(taskId, newName) {
    const task = tasks.find(t => t.id === taskId);
    const masterEntry = yearlyMaster.find(m => m.name === newName);
    if (task && !isExternalTask(task)) {
        setTargetName(task, newName);
        const nextDate = masterEntry ? (masterEntry.date || "") : "";
        if (nextDate && !isIsoDateInOwnPeriod(task, nextDate)) {
            showToast("★日付がこの子タスクの期間外のため、マスターから設定できません");
            save();
            renderAll();
            return;
        }
        setTargetDate(task, nextDate);
        save();
        renderAll();
    }
}


function updateTaskDate(id, field, value) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        if (isExternalTask(task)) {
            showToast("外部CSVは編集できません");
            renderAll();
            return;
        }
        const isLocked = task.archived || isTerminalTaskStatus(task.status);
        if (isLocked) {
            showToast("完了タスクは進捗・メモ以外は編集できません");
            renderAll();
            return;
        }
        const parentWasBlankForStagger =
            !isExternalTask(task) &&
            isParentTask(task) &&
            field === "startDate" &&
            !!value &&
            !task.startDate &&
            !task.deadline;

        const depPrevDeadline = getDependencyPrevDeadlineMin(task);
        if (field === 'startDate' && depPrevDeadline && value && value < depPrevDeadline) {
            value = depPrevDeadline;
        }
        if (field === 'deadline' && depPrevDeadline && value) {
            const minD = maxDateStr(task.startDate, depPrevDeadline);
            if (minD && value < minD) value = minD;
        }
        task[field] = value;

        // --- 【追加】 着手日と納期の連動ロジック ---
        if (field === 'startDate' && value) {
            // 着手日を入力した時、納期が空、または納期が着手日より前なら同期
            if (!task.deadline || task.deadline < value) {
                task.deadline = value;
            }
        }

        if (field === 'deadline' && task.startDate && value < task.startDate) {
            // 納期を着手日より前にしようとしたら、強制的に着手日と同じにする
            task.deadline = task.startDate;
            showToast("納期は着手日以降に設定してください");
        }

        // 期間を設定/変更したら、◇/★ が自分の期間外なら警告（他の子には影響しない）
        if (!isParentTask(task) && (field === "startDate" || field === "deadline")) {
            warnIfMarkersOutsideOwnPeriod(task);
        }

        // 親の着手・納期がどちらも空だった状態で着手日を入れたときだけ、子へ連番でコピー（タイムラインで個別調整可）
        if (parentWasBlankForStagger && staggerChildDatesFromParentBase(task, value)) {
            showToast("子タスクの着手日・納期を、親の着手日から1日ずつずらして設定しました");
        }

        // --- 親の期間を再計算 ---
        updateParentDates(getTaskFamilyKey(task));

        save(); // データの保存
        renderAll();
        if (typeof renderTimeline === 'function') renderTimeline(); // タイムラインも更新
    }
}

/** テーマ内の着手日・納期をまとめて削除（外部・完了・アーカイブは対象外） */
function resetFamilyPeriods(parentId) {
    const parent = tasks.find((t) => String(t.id) === String(parentId));
    if (!parent || !isParentTask(parent) || isExternalTask(parent)) return;
    if (parent.archived || isTerminalTaskStatus(parent.status)) {
        showToast("完了または履歴のテーマは期間リセットできません");
        return;
    }
    const rootName = getThemeLabel(parent) || "（無題）";
    if (
        !confirm(
            `このテーマ「${rootName}」（関連する子タスクすべて）の期間（着手日・納期）をリセットしますか？`
        )
    ) {
        return;
    }
    const familyKey = getTaskFamilyKey(parent);
    tasks.forEach((t) => {
        if (getTaskFamilyKey(t) !== familyKey) return;
        if (isExternalTask(t)) return;
        if (t.archived || isTerminalTaskStatus(t.status)) return;
        t.startDate = "";
        t.deadline = "";
    });
    save();
    renderAll();
    if (typeof renderTimeline === "function") renderTimeline();
    showToast("期間をリセットしました");
}

function cycleStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || isExternalTask(task)) return;
    if (isParentTask(task)) {
        if (task.status === "進行中") task.status = "修正中";
        else if (task.status === "修正中") task.status = "進行中";
        else task.status = "進行中";
    } else {
        const idx = statusList.indexOf(task.status);
        task.status = statusList[(idx + 1) % statusList.length];
        task.progressUpdatedAt = dateToIsoLocal(new Date());
        applyParentStatusFromChildrenForFamily(getTaskFamilyKey(task));
        maybeAdvanceActualForTask(task);
    }
    save();
    renderAll();
}

function deleteTask(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const targetTask = tasks[taskIndex];
    const isParent = isParentTask(targetTask);
    const familyKey = getTaskFamilyKey(targetTask);
    const rootName = getThemeLabel(targetTask);

    let message = "このタスクを削除しますか？";
    if (isParent) {
        message = `テーマ「${rootName}」を削除しますか？\n関連する子タスクもすべて削除されます。`;
    }

    if (!confirm(message)) return;

    if (isParent) {
        // 親タスクと同じルート名を持つタスクをすべて削除（自分自身を含む）
        tasks = tasks.filter(t => {
            return getTaskFamilyKey(t) !== familyKey;
        });
    } else {
        // 子タスク単体の削除
        tasks.splice(taskIndex, 1);
    }

    save();
    renderAll();
    if (typeof renderTimeline === 'function') renderTimeline();
    showToast("削除しました");
}

function changeTab(tabName) { currentTab = tabName; renderTabs(); renderAll(); }

function isTaskTableRowVisible(tr) {
    if (!tr) return false;
    return tr.style.display !== "none";
}

function isSearchFilterActive() {
    const sb = document.getElementById("searchBox");
    return !!(sb && String(sb.value || "").trim());
}

function getSearchQueryLower() {
    return (document.getElementById("searchBox")?.value || "").trim().toLowerCase();
}

function buildTaskSearchHaystack(task) {
    return [
        getPrimaryStep(task),
        getSecondaryStep(task),
        getDisplayTaskCode(task),
        getThemeLabel(task),
        task.category || "",
        task.status || "",
        getTargetName(task) || "",
        getTargetDate(task) || "",
        task.startDate || "",
        task.deadline || "",
        (task.memo || "").trim(),
        task.taskCode || "",
    ]
        .join(" ")
        .toLowerCase();
}

function taskMatchesSearchQuery(task, queryLower) {
    if (!queryLower) return true;
    return buildTaskSearchHaystack(task).includes(queryLower);
}

/** 検索語に一致するタスクを含むテーマ（familyKey）の集合。検索なしは null */
function getSearchMatchingFamilyKeys(pool, queryLower) {
    if (!queryLower) return null;
    const keys = new Set();
    pool.forEach((t) => {
        if (taskMatchesSearchQuery(t, queryLower)) keys.add(getTaskFamilyKey(t));
    });
    return keys;
}

function syncIncludeArchivedBulkVisibility() {
    const wrap = document.getElementById("includeArchivedBulkWrap");
    const checkAll = document.getElementById("checkAll");
    if (!wrap) return;
    const show = !!(checkAll && checkAll.checked && currentTab !== "完了" && !isSearchFilterActive());
    wrap.style.display = show ? "" : "none";
    if (!show) {
        const inc = document.getElementById("includeArchivedBulk");
        if (inc) inc.checked = false;
    }
}

function syncCheckAllStateAfterRender() {
    const checkAll = document.getElementById("checkAll");
    if (!checkAll) return;
    const parentRows = Array.from(document.querySelectorAll("#taskBody tr.parent-row")).filter(isTaskTableRowVisible);
    if (parentRows.length === 0) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
        return;
    }
    let checked = 0;
    parentRows.forEach((tr) => {
        const cb = tr.querySelector(".row-check");
        if (cb && cb.checked) checked++;
    });
    checkAll.checked = checked === parentRows.length;
    checkAll.indeterminate = checked > 0 && checked < parentRows.length;
}

function countVisibleCheckedParents() {
    let n = 0;
    document.querySelectorAll("#taskBody tr.parent-row").forEach((tr) => {
        if (!isTaskTableRowVisible(tr)) return;
        const cb = tr.querySelector(".row-check:checked");
        if (cb) n++;
    });
    return n;
}

/** CSV出力・選択削除で使うファミリー集合（表示上チェック済みの親＋任意で履歴） */
function getBulkOperationFamilySet() {
    const ids = [];
    document.querySelectorAll("#taskBody tr").forEach((tr) => {
        if (!isTaskTableRowVisible(tr)) return;
        const cb = tr.querySelector(".row-check:checked");
        if (!cb) return;
        const id = cb.closest("tr")?.dataset?.id;
        if (id) ids.push(String(id));
    });
    if (ids.length === 0) return null;

    const familySet = new Set(
        tasks.filter(t => ids.includes(String(t.id))).map(t => getTaskFamilyKey(t))
    );

    const includeArch = document.getElementById("includeArchivedBulk")?.checked;
    if (includeArch && currentTab !== "完了" && !isSearchFilterActive()) {
        tasks.forEach((t) => {
            if (!t.archived) return;
            const fam = getTaskFamilyKey(t);
            if (currentTab === "すべて") {
                familySet.add(fam);
                return;
            }
            const p = tasks.find(x => getTaskFamilyKey(x) === fam && isParentTask(x));
            const cat = p ? p.category : t.category;
            if (cat === currentTab) familySet.add(fam);
        });
    }
    return familySet;
}

function countParentThemesInFamilySet(familySet) {
    if (!familySet || familySet.size === 0) return 0;
    return tasks.filter(t => isParentTask(t) && familySet.has(getTaskFamilyKey(t))).length;
}

function filterTasks() {
    renderAll();
}

// WBS（親子）を考慮したソートロジック
function sortTasks() {
    tasks.sort((a, b) => {
        // 名称を「：」で分けて、名前と番号にする
        const [nameA, numAStr] = getPrimaryStep(a).split('：');
        const [nameB, numBStr] = getPrimaryStep(b).split('：');

        // 番号を数値に変換（無い場合は0）
        const numA = parseInt(numAStr, 10) || 0;
        const numB = parseInt(numBStr, 10) || 0;

        // ① まずは「プロジェクト名（名前）」で並べる
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;

        // ② 名前が同じなら、「枝番」で並べる
        return numA - numB;
    });

    save();
    renderAll();
    showToast("プロジェクト順に整列しました");
}

//★ここから★
function archiveCompletedTasks() {
    // 1. 現在表示されている（未アーカイブの）親タスクの中で「完了」のものを抽出
    const completedParents = tasks
        .filter(t => isParentTask(t) && isTerminalTaskStatus(t.status) && !t.archived)
        .map(t => ({ family: getTaskFamilyKey(t), id: t.taskCode || "-", name: getThemeLabel(t) }));

    const completedParentRoots = completedParents.map(t => t.family);

    if (completedParentRoots.length === 0) {
        showToast("完了または中止のテーマがないため、移動できません");
        return;
    }

    // 確認メッセージ（テーマ名を表示して親切に）
    const themeLines = completedParents.map(t => `・${t.id} ${t.name}`).join('\n');
    if (!confirm(`以下の${completedParentRoots.length}テーマを履歴に移動しますか？\n\n${themeLines}`)) return;

    // 2. 対象のルート名を持つ全タスク（親子セット）をアーカイブ
    let count = 0;
    tasks.forEach(t => {
        const root = getTaskFamilyKey(t);
        if (completedParentRoots.includes(root)) {
            t.archived = true;
            count++;
        }
    });

    save();
    renderAll();
    if (typeof renderTimeline === 'function') renderTimeline();
    showToast(`${completedParentRoots.length}つのテーマ（計${count}件）を移動しました`);
}

//★ここまで★

function restoreTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        // 戻すボタンは子タスクのみ表示する想定
        if (isParentTask(task)) {
            showToast("親タスクは子タスクから戻してください");
            return;
        }

        const familyKey = getTaskFamilyKey(task);
        const parent = tasks.find(t => getTaskFamilyKey(t) === familyKey && isParentTask(t));
        const themeName = parent ? getThemeLabel(parent) : getThemeLabel(task);

        if (!confirm(`【${themeName}】を進行中に戻しますか？`)) return;

        // 親子をまとめて復帰（同一familyKeyのタスクを全て戻す）
        const familyTasks = tasks.filter(t => getTaskFamilyKey(t) === familyKey);
        familyTasks.forEach(t => { t.archived = false; });

        // 編集したいことが多いので、親＋押した子だけは進行中へ（他の子は完了のままでも可）
        task.status = "進行中";
        if (parent) parent.status = "進行中";

        // 保存と再描画
        save();
        renderAll();

        // 【追加】「何」を「どこ」に戻したかを表示
        showToast(`親子（${familyTasks.length}件）を履歴から戻しました`);
    }
}

function updateDeleteButtonState() {
    const nChecked = countVisibleCheckedParents();
    const btn = document.getElementById('btnDeleteMain');
    const exp = document.getElementById('btnExportCsv');
    const label = document.getElementById('selectedCountLabel');
    const includeArch = document.getElementById('includeArchivedBulk')?.checked;
    let displayCount = nChecked;
    if (nChecked > 0 && includeArch && currentTab !== "完了" && !isSearchFilterActive()) {
        const full = getBulkOperationFamilySet();
        if (full) displayCount = countParentThemesInFamilySet(full);
    }
    if (btn) {
        btn.innerText = "選択削除";
        btn.disabled = nChecked === 0;
        btn.classList.toggle('btn-danger-active', nChecked > 0);
        btn.classList.toggle('btn-archive-disabled', nChecked === 0);
    }
    if (exp) {
        exp.disabled = nChecked === 0;
        exp.classList.toggle('btn-archive-disabled', nChecked === 0);
    }
    if (label) {
        if (nChecked > 0) {
            label.innerText = `選択中：${displayCount}件`;
        } else {
            label.innerText = "";
        }
    }
    syncCheckAllStateAfterRender();
    syncIncludeArchivedBulkVisibility();
}

function handleDeleteLogic() {
    const familySet = getBulkOperationFamilySet();
    if (!familySet || familySet.size === 0) {
        showToast("削除したい親テーマにチェックを入れてください");
        return;
    }

    const previewParents = tasks.filter(t => isParentTask(t) && familySet.has(getTaskFamilyKey(t)));
    const lines = previewParents.map(p => `・${p.taskCode || "-"} ${getThemeLabel(p)}`).join("\n");
    if (!confirm(`以下の${previewParents.length}テーマ（同一テーマの子タスク含む全行）を削除しますか？\n\n${lines}`)) return;

    const beforeCount = tasks.length;
    tasks = tasks.filter(t => !familySet.has(getTaskFamilyKey(t)));
    const count = beforeCount - tasks.length;

    save();
    renderAll();
    const checkAll = document.getElementById('checkAll');
    if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
    const inc = document.getElementById('includeArchivedBulk');
    if (inc) inc.checked = false;
    syncIncludeArchivedBulkVisibility();
    updateDeleteButtonState();

    showToast(`${count}件を削除しました`);
}

// 新しい状態
function closeMemo() {
    const modal = document.getElementById('memoModal');
    if (modal) {
        modal.style.display = 'none'; // 画面から隠す
    }
    const saveBtn = document.querySelector('#memoModal .btn-add');
    if (saveBtn) saveBtn.style.display = "";
    const ta = document.getElementById('memoText');
    if (ta) ta.readOnly = false;
    updateBodyScrollLock();
}

// 補足：メモを開く関数も、これと対になるように ID を確認してください
function openMemo(taskId) {
    editingMemoId = taskId;
    const task = findTaskByIdAny(taskId);
    const ta = document.getElementById('memoText');
    const saveBtn = document.querySelector('#memoModal .btn-add');
    if (ta) {
        ta.value = task?.memo || "";
        ta.readOnly = isExternalTask(task);
    }
    if (saveBtn) saveBtn.style.display = isExternalTask(task) ? "none" : "";
    document.getElementById('memoModal').style.display = 'flex'; // 中央に表示
    updateBodyScrollLock();
}
function saveMemo() {
    const text = document.getElementById('memoText').value;
    const task = findTaskByIdAny(editingMemoId);
    if (task && !isExternalTask(task)) {
        task.memo = text;
        save();
        renderAll();
        closeMemo();
        // 【追記】メモ保存の通知
        showToast("メモを保存しました");
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
}

function setupEnterKey() {
    ["inContent", "inTarget", "inStartDate", "inDeadline"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addRow(); } };
    });
}

// マスター管理
function openYearlyMaster() {
    const modal = document.getElementById('yearlyMasterModal');
    if (modal) modal.style.display = 'flex';
    updateBodyScrollLock();
    renderMasterList();
    syncMasterAddDateEndMin();
}
function closeYearlyMaster() {
    const modal = document.getElementById('yearlyMasterModal');
    if (modal) modal.style.display = 'none';
    updateBodyScrollLock();
    renderAll();
}
// A: 新規追加
function addMasterDay() {
    const n = document.getElementById("masterName");
    const d = document.getElementById("masterDate");
    const de = document.getElementById("masterDateEnd");
    const hol = document.getElementById("masterHolidayAdd");

    if (!n || !n.value) {
        showToast("名称を入力してください");
        return;
    }
    const dateEnd = de?.value || "";
    if (dateEnd && d?.value && !validateMasterDateRange(d.value, dateEnd)) {
        showToast("終了日は開始日以降にしてください");
        return;
    }

    yearlyMaster.push({
        name: n.value,
        date: d?.value || "",
        dateEnd,
        isHoliday: !!(hol && hol.checked),
    });
    saveMaster();
    renderMasterList();

    n.value = "";
    if (d) d.value = "";
    if (de) {
        de.value = "";
        de.removeAttribute("min");
    }
    if (hol) hol.checked = false;
    showToast("マスターを追加しました");
}
function renderMasterList() {
    const tbody = document.getElementById("yearlyMasterBody");
    if (!tbody) return;
    tbody.innerHTML = yearlyMaster
        .map(
            (m, i) => `
     <tr>
      <td class="master-col-holiday"><input type="checkbox"${m.isHoliday ? " checked" : ""} onchange="updateMasterEntry(${i}, 'isHoliday', this.checked)"${helpAttr("休日：ONでタイムラインに日曜と同じ帯を表示します")}></td>
      <td style="padding:5px;"><input type="text" value="${escapeHtmlAttr(m.name)}" oninput="updateMasterEntry(${i}, 'name', this.value)" style="width:95%;"${helpAttr("マスター名称：展開・イベントの候補として一覧に出る名前です")}></td>
      <td style="padding:5px;"><span class="master-date-range"${helpAttr("マスター日程：左のみ＝単日。終了日も入れると期間。休日ONでタイムラインに反映")}>
        <input type="date" value="${m.date || ""}" title="" data-master-date-start="${i}" onchange="updateMasterEntry(${i}, 'date', this.value); syncMasterRowDateEndMin(${i})" style="width:48%;">
        <span class="master-date-sep">〜</span>
        <input type="date" value="${m.dateEnd || ""}" title="" data-master-date-end="${i}" min="${m.date || ""}" class="${m.date && !m.dateEnd ? "master-date-end-empty" : ""}" onchange="updateMasterEntry(${i}, 'dateEnd', this.value); syncMasterRowDateEndMin(${i})" style="width:48%;"${helpAttr("終了日（任意）：空のままなら単日。期間にする場合は開始日以降を指定")}>
      </span></td>
      <td style="text-align:center;"><span onclick="deleteMasterDay(${i})" style="cursor:pointer; color:#999;"${helpAttr("マスター削除：この行の年間イベントを削除します")}>🗑</span></td>
    </tr>
`
        )
        .join("");
    syncMasterListDateEndStyles();
}

function deleteMasterDay(i) {
    if (i < 0 || i >= yearlyMaster.length) return;
    const target = yearlyMaster[i];
    const name = target?.name || "";
    if (!confirm(`「${name || "(名称なし)"}」を削除しますか？`)) return;

    yearlyMaster.splice(i, 1);
    saveMaster();

    // タスク側の参照も外す（名称一致）
    tasks.forEach(t => {
        if (getFirstFlag(t) === name) {
            setFirstFlag(t, "");
            t.msDate = "";
        }
        if (getTargetName(t) === name) {
            setTargetName(t, "");
            setTargetDate(t, "");
        }
    });
    save();
    renderMasterList();
    showToast("マスターを削除しました");
}
function updateMasterEntry(i, f, v) {
    if (i < 0 || i >= yearlyMaster.length) return;
    const oldName = yearlyMaster[i].name;
    if (f === "dateEnd" || f === "date") {
        const nextStart = f === "date" ? String(v || "").trim() : String(yearlyMaster[i].date || "").trim();
        const nextEnd = f === "dateEnd" ? String(v || "").trim() : String(yearlyMaster[i].dateEnd || "").trim();
        if (nextEnd && nextStart && !validateMasterDateRange(nextStart, nextEnd)) {
            showToast("終了日は開始日以降にしてください");
            renderMasterList();
            return;
        }
    }
    if (f === "isHoliday") yearlyMaster[i][f] = !!v;
    else yearlyMaster[i][f] = v;
    saveMaster();
    if (f === "name") {
        tasks.forEach(t => {
            if (getFirstFlag(t) === oldName) setFirstFlag(t, v);
            if (getTargetName(t) === oldName) setTargetName(t, v);
        });
        save();
    }
    if (f === "date") {
        tasks.forEach(t => {
            if (getFirstFlag(t) === yearlyMaster[i].name) t.msDate = v;
            if (getTargetName(t) === yearlyMaster[i].name) setTargetDate(t, v);
        });
        save();
    }
    if (f === "isHoliday" || f === "dateEnd" || (f === "date" && yearlyMaster[i].isHoliday)) {
        const tv = document.getElementById("timelineView");
        if (tv && tv.style.display !== "none") renderTimeline();
    }
}
// 日程のみクリア（項目名は残す）
function resetMasterDates() {
    if (!confirm("全てのマスター日程（日付のみ）を消去しますか？")) return;

    // マスター側の日付を空に
    yearlyMaster.forEach((m) => {
        m.date = "";
        m.dateEnd = "";
    });

    // タスク側の連動している日付も空にする
    tasks.forEach(t => {
        if (getFirstFlag(t)) t.msDate = "";
        if (getTargetName(t)) setTargetDate(t, "");
    });

    saveMaster();
    save(); // タスク側も保存
    renderMasterList();
    showToast("マスターの日程をクリアしました");
}

// B: 全件削除（HTMLのボタンから呼ばれる名前）
function clearMasterAll() {
    if (!confirm("マスターの項目を全て削除しますか？")) return;
    const count = yearlyMaster.length;
    yearlyMaster = [];
    saveMaster();
    renderMasterList();
    showToast(`${count}件のマスターを削除しました`);
}

function importMasterCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        // Shift-JISでの文字化け対策を考慮した分割
        const lines = e.target.result.split(/\r\n|\n/);

        lines.forEach((line, i) => {
            if (i === 0 || !line.trim()) return; // ヘッダーと空行をスキップ
            const col = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());

            if (col.length >= 2) {
                const name = col[0];
                const date = col[1] || "";
                const col2 = col[2] || "";
                const col3 = col[3] || "";
                const dateEnd = /^\d{4}-\d{2}-\d{2}$/.test(col2) ? col2 : "";
                const isHoliday = /^(1|true|yes|休日|はい)$/i.test(dateEnd ? col3 : col2);

                const exist = yearlyMaster.find((m) => m.name === name);
                const row = normalizeYearlyMasterEntry({
                    name,
                    date,
                    dateEnd,
                    isHoliday,
                });
                if (exist) {
                    Object.assign(exist, row);
                } else {
                    yearlyMaster.push(row);
                }
            }
        });
        saveMaster();
        renderMasterList();
        showToast("マスターCSVを読み込みました");
    };
    // 自治会のExcel等で作成されたCSVなら 'Shift-JIS' を指定
    reader.readAsText(file, 'Shift-JIS');
}

function exportCSV() {
    const selectedFamilies = getBulkOperationFamilySet();
    if (!selectedFamilies || selectedFamilies.size === 0) {
        alert("CSV出力したい親テーマにチェックを入れてください。");
        return;
    }
    if (!ownerId) {
        alert("設定で担当者ID（6桁）を設定してください。");
        return;
    }

    const exportTargets = tasks.filter(t => selectedFamilies.has(getTaskFamilyKey(t)));

    const parents = exportTargets.filter(t => isParentTask(t));
    const lines = parents.map(p => `・${p.taskCode || "-"} ${getThemeLabel(p)}`).join('\n');
    if (!confirm(`以下の${parents.length}テーマ（計${exportTargets.length}件）をCSV出力しますか？\n\n${lines}`)) return;

    // BOMを付与してExcelの文字化けを防止
    // TargetFlag=イベント名 / TargetDate=イベント日
    let csv = "\uFEFFOwnerID,タスクID,カテゴリ,PrimaryStep,FirstFlag,展開日,TargetFlag,TargetDate,SecondaryStep,着手日,納期,進捗,メモ,アーカイブ済,fFlag,テーマ色,進捗更新日,実績着手,実績納期\n";

    exportTargets.forEach(t => {
        const isPar = isParentTask(t);
        const themeCol = isPar ? normalizeThemeAccentHex(t.themeAccentColor) : "";
        const progAt = !isPar && t.progressUpdatedAt ? t.progressUpdatedAt : "";
        const pStart = !isPar && t.pdcaActualStart ? String(t.pdcaActualStart).trim() : "";
        const pEnd = !isPar && t.pdcaActualEnd ? String(t.pdcaActualEnd).trim() : "";
        // カンマや改行が含まれても壊れないように各項目をダブルクォートで囲む
        const row = [
            ownerId,
            t.taskCode || "",
            t.category,
            getPrimaryStep(t),
            getFirstFlag(t),
            t.msDate,
            getTargetName(t),
            getTargetDate(t),
            getSecondaryStep(t),
            t.startDate || '',
            t.deadline || '',
            t.status,
            (t.memo || '').replace(/"/g, '""').replace(/\n/g, ' '), // 改行はスペースに置換
            t.archived,
            t.fFlag === true,
            themeCol,
            progAt,
            pStart,
            pEnd
        ].map(v => `"${v}"`).join(",");

        csv += row + "\n";
    });

    const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `OmniStep_Selected_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

function importCSV(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const lines = String(e.target.result || "").split(/\r\n|\n/).filter(l => l !== "");
        if (lines.length <= 1) {
            alert("CSVの中身が空です。");
            event.target.value = "";
            return;
        }

        const splitCsv = (line) =>
            line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));

        const header = splitCsv(lines[0]).map(s => (s || "").trim());
        const idxByName = {};
        header.forEach((h, idx) => { if (h) idxByName[h] = idx; });

        const pick = (row, ...names) => {
            for (const n of names) {
                const idx = idxByName[n];
                if (typeof idx === "number") return row[idx] ?? "";
            }
            return "";
        };

        // 新フォーマット/旧フォーマット判定（ヘッダーで判断）
        const isNew = header.includes("タスクID") || header.includes("PrimaryStep");
        const isOld = header.includes("内容") && header.includes("課題");

        const imported = [];
        const ts = Date.now();
        const parseBool = (v) => String(v || "").trim().toLowerCase() === "true";

        // OwnerID列があれば、行ごとに読む（OwnerID列を優先）
        const ownerFromRow = (row) => String(pick(row, "OwnerID") || "").trim();
        const normalizeOwnerIdCsv = (v) => {
            const raw = String(v || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
            return raw ? raw.padStart(6, "0").slice(-6) : "";
        };

        // 取り込み中に taskCode を自動採番する場合、同一ファイル内で重複しないよう予約を持つ
        const base = formatDateCodePart(new Date());
        const existingSeq = tasks
            .filter(t => isParentTask(t) && (t.taskCode || "").startsWith(base))
            .map(t => parseInt(getTaskFamilyKey(t).slice(base.length), 10))
            .filter(n => Number.isFinite(n));
        let nextSeq = (existingSeq.length ? Math.max(...existingSeq) : 0) + 1;
        const reservedFamilies = new Set();
        const nextParentCode = () => {
            while (reservedFamilies.has(`${base}${String(nextSeq).padStart(2, "0")}`)) nextSeq++;
            const fam = `${base}${String(nextSeq).padStart(2, "0")}`;
            reservedFamilies.add(fam);
            nextSeq++;
            return `${fam}-000`;
        };

        // --- 旧フォーマット：content の「：0」を親にして復元 ---
        if (isOld && !isNew) {
            const groups = new Map(); // theme -> { parentRow, childRows[] }
            for (let i = 1; i < lines.length; i++) {
                const row = splitCsv(lines[i]);
                if (row.length < 2) continue;
                const content = (pick(row, "内容") || "").trim();
                if (!content) continue;
                const theme = content.includes("：") ? content.split("：")[0] : content;
                const suffix = content.includes("：") ? content.split("：")[1] : "";
                const isParentOld = suffix === "0";
                const branch = parseInt(suffix, 10);
                const entry = groups.get(theme) || { parentRow: null, childRows: [] };
                if (isParentOld) entry.parentRow = { row, i };
                else entry.childRows.push({ row, i, branch: Number.isFinite(branch) ? branch : 9999 });
                groups.set(theme, entry);
            }

            groups.forEach((entry, theme) => {
                if (!entry.parentRow) {
                    // 原則ありえないが、親が無い場合：子を単独タスク化（注記）
                    entry.childRows.forEach((cr, k) => {
                        const row = cr.row;
                        const category = pick(row, "カテゴリ") || "その他";
                        const issue = (pick(row, "課題") || "").trim();
                        const memo = pick(row, "メモ") || "";
                        const status = pick(row, "進捗") || "未着手";
                        const startDate = pick(row, "着手日") || "";
                        const deadline = pick(row, "納期") || "";
                        const targetDate = pick(row, "目標") || "";
                        const msDate = pick(row, "展開先日程") || "";
                        const firstFlag = pick(row, "展開先名称") || "";
                        const taskCode = nextParentCode();
                        imported.push({
                            id: ts + cr.i,
                            taskCode,
                            category,
                            PrimaryStep: theme,
                            SecondaryStep: issue ? `${issue}（取り込み条件不明）` : "（取り込み条件不明）",
                            content: theme,
                            issue: issue ? `${issue}（取り込み条件不明）` : "（取り込み条件不明）",
                            FirstFlag: firstFlag, factory: firstFlag,
                            msDate,
                            TargetFlag: "",
                            TargetDate: targetDate,
                            target: targetDate,
                            startDate,
                            deadline,
                            status,
                            memo,
                            archived: false,
                            fFlag: false
                        });
                    });
                    return;
                }

                const parentRow = entry.parentRow.row;
                const category = pick(parentRow, "カテゴリ") || "その他";
                const firstFlag = pick(parentRow, "展開先名称") || "";
                const msDate = pick(parentRow, "展開先日程") || "";
                const targetDate = pick(parentRow, "目標") || "";
                const memo = pick(parentRow, "メモ") || "";
                const status = pick(parentRow, "進捗") || "未着手";

                const parentCode = nextParentCode();
                imported.push({
                    id: ts + entry.parentRow.i,
                    taskCode: parentCode,
                    category,
                    PrimaryStep: theme,
                    SecondaryStep: "",
                    content: theme,
                    issue: "",
                    FirstFlag: firstFlag, factory: firstFlag,
                    msDate,
                    TargetFlag: "",
                    TargetDate: targetDate,
                    target: targetDate,
                    startDate: "",
                    deadline: "",
                    status,
                    memo,
                    archived: false,
                    fFlag: false
                });

                // 子は旧連番順で紐づけ
                entry.childRows
                    .sort((a, b) => a.branch - b.branch)
                    .forEach((cr, idx) => {
                        const row = cr.row;
                        const issue = pick(row, "課題") || "";
                        const memoC = pick(row, "メモ") || "";
                        const statusC = pick(row, "進捗") || "未着手";
                        const startDate = pick(row, "着手日") || "";
                        const deadline = pick(row, "納期") || "";
                        const childCode = `${parentCode.split("-")[0]}-${pad3((idx + 1) * 10)}`;
                        imported.push({
                            id: ts + cr.i,
                            taskCode: childCode,
                            category,
                            PrimaryStep: theme,
                            SecondaryStep: issue,
                            content: theme,
                            issue,
                            FirstFlag: "", factory: "",
                            msDate: "",
                            TargetFlag: "",
                            TargetDate: "",
                            target: "",
                            startDate,
                            deadline,
                            status: statusC,
                            memo: memoC,
                            archived: false,
                            fFlag: false
                        });
                    });
            });
        } else {
            // --- 新フォーマット：列名ベースで取り込み ---
            const rawRows = [];
            for (let i = 1; i < lines.length; i++) {
                const row = splitCsv(lines[i]);
                if (row.length < 3) continue;
                const taskCode = (pick(row, "タスクID", "taskCode") || "").trim();
                const category = (pick(row, "カテゴリ") || "").trim() || "その他";
                const primary = (pick(row, "PrimaryStep", "内容") || "").trim();
                if (!primary) continue;
                const firstFlag = pick(row, "FirstFlag", "展開先名称") || "";
                const msDate = pick(row, "展開日", "展開先日程") || "";
                const targetName = pick(row, "TargetFlag", "イベント名") || "";
                const targetDate = pick(row, "TargetDate", "イベント日", "目標") || "";
                const secondary = pick(row, "SecondaryStep", "課題") || "";
                const startDate = pick(row, "着手日") || "";
                const deadline = pick(row, "納期") || "";
                const status = pick(row, "進捗") || "未着手";
                const memo = pick(row, "メモ") || "";
                const archived = parseBool(pick(row, "アーカイブ済"));
                const fFlag = parseBool(pick(row, "fFlag"));
                const themeAccent = pick(row, "テーマ色", "themeAccentColor") || "";
                const progressUpdatedAt = pick(row, "進捗更新日", "progressUpdatedAt") || "";
                const pdcaActualStart = pick(row, "実績着手", "pdcaActualStart") || "";
                const pdcaActualEnd = pick(row, "実績納期", "pdcaActualEnd") || "";

                rawRows.push({
                    __lineNo: i,
                    taskCode,
                    category,
                    PrimaryStep: primary,
                    SecondaryStep: secondary,
                    FirstFlag: firstFlag,
                    msDate,
                    TargetFlag: targetName,
                    TargetDate: targetDate,
                    startDate,
                    deadline,
                    status,
                    memo,
                    archived,
                    fFlag,
                    themeAccent,
                    progressUpdatedAt,
                    pdcaActualStart,
                    pdcaActualEnd
                });
            }

            // taskCode が空の行は PrimaryStep 単位で「1親 + 複数子」に復元する
            const groups = new Map();
            rawRows.forEach(r => {
                const key = r.PrimaryStep;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(r);
            });

            groups.forEach((rows, key) => {
                const hasAnyCode = rows.some(r => r.taskCode);
                if (hasAnyCode) {
                    rows.forEach(r => {
                        const isPar = String(r.taskCode || "").trim().endsWith("-000");
                        const ta = normalizeThemeAccentHex(r.themeAccent);
                        const pu = String(r.progressUpdatedAt || "").trim();
                        const pas = String(r.pdcaActualStart || "").trim();
                        const pae = String(r.pdcaActualEnd || "").trim();
                        const rowObj = {
                            id: ts + r.__lineNo,
                            taskCode: r.taskCode,
                            category: r.category,
                            PrimaryStep: r.PrimaryStep,
                            SecondaryStep: r.SecondaryStep,
                            content: r.PrimaryStep,
                            issue: r.SecondaryStep,
                            FirstFlag: r.FirstFlag, factory: r.FirstFlag,
                            msDate: r.msDate,
                            TargetFlag: r.TargetFlag,
                            TargetDate: r.TargetDate,
                            target: r.TargetDate,
                            startDate: r.startDate,
                            deadline: r.deadline,
                            status: r.status,
                            memo: r.memo,
                            archived: r.archived,
                            fFlag: r.fFlag
                        };
                        if (isPar && ta) rowObj.themeAccentColor = ta;
                        if (!isPar && pu) rowObj.progressUpdatedAt = pu;
                        if (!isPar && /^\d{4}-\d{2}-\d{2}$/.test(pas)) rowObj.pdcaActualStart = pas;
                        if (!isPar && /^\d{4}-\d{2}-\d{2}$/.test(pae)) rowObj.pdcaActualEnd = pae;
                        imported.push(rowObj);
                    });
                    return;
                }

                const parentRow = rows.find(r => !String(r.SecondaryStep || "").trim()) || rows[0];
                const parentCode = nextParentCode();

                const parentTa = normalizeThemeAccentHex(parentRow.themeAccent);
                imported.push({
                    id: ts + parentRow.__lineNo,
                    taskCode: parentCode,
                    category: parentRow.category,
                    PrimaryStep: parentRow.PrimaryStep,
                    SecondaryStep: "",
                    content: parentRow.PrimaryStep,
                    issue: "",
                    FirstFlag: parentRow.FirstFlag, factory: parentRow.FirstFlag,
                    msDate: parentRow.msDate,
                    TargetFlag: parentRow.TargetFlag,
                    TargetDate: parentRow.TargetDate,
                    target: parentRow.TargetDate,
                    startDate: parentRow.startDate || "",
                    deadline: parentRow.deadline || "",
                    status: parentRow.status || "未着手",
                    memo: parentRow.memo || "",
                    archived: parentRow.archived,
                    fFlag: false,
                    ...(parentTa ? { themeAccentColor: parentTa } : {})
                });

                const childRows = rows
                    .filter(r => r !== parentRow && String(r.SecondaryStep || "").trim())
                    .sort((a, b) => a.__lineNo - b.__lineNo);

                childRows.forEach((r, idx) => {
                    const childCode = `${parentCode.split("-")[0]}-${pad3((idx + 1) * 10)}`;
                    const cpu = String(r.progressUpdatedAt || "").trim();
                    const pas = String(r.pdcaActualStart || "").trim();
                    const pae = String(r.pdcaActualEnd || "").trim();
                    imported.push({
                        id: ts + r.__lineNo,
                        taskCode: childCode,
                        category: parentRow.category,
                        PrimaryStep: parentRow.PrimaryStep,
                        SecondaryStep: r.SecondaryStep,
                        content: parentRow.PrimaryStep,
                        issue: r.SecondaryStep,
                        FirstFlag: "", factory: "",
                        msDate: "",
                        TargetFlag: "",
                        TargetDate: "",
                        target: "",
                        startDate: r.startDate || "",
                        deadline: r.deadline || "",
                        status: r.status || "未着手",
                        memo: r.memo || "",
                        archived: parentRow.archived,
                        fFlag: false,
                        ...(cpu ? { progressUpdatedAt: cpu } : {}),
                        ...(/^\d{4}-\d{2}-\d{2}$/.test(pas) ? { pdcaActualStart: pas } : {}),
                        ...(/^\d{4}-\d{2}-\d{2}$/.test(pae) ? { pdcaActualEnd: pae } : {})
                    });
                });
            });
        }

        if (imported.length === 0) {
            alert("取り込める行が見つかりませんでした。CSVの形式（ヘッダー/区切り/列）を確認してください。");
            event.target.value = "";
            return;
        }

        // --- taskCode が無い場合は自動割り振り ---
        // 親子が揃っていれば既に付与済みのはずだが、単発・新形式の空欄に備える
        imported.forEach(t => {
            if (!t.taskCode) t.taskCode = nextParentCode();
        });

        // OwnerIDが自分と違う場合は「外部CSV」として閲覧専用で読み込み（保存しない）
        const hasOwnerColumn = header.includes("OwnerID");
        let incomingOwner = "";
        if (hasOwnerColumn) {
            for (let li = 1; li < lines.length; li++) {
                const row = splitCsv(lines[li]);
                const o = normalizeOwnerIdCsv(ownerFromRow(row));
                if (o) {
                    incomingOwner = o;
                    break;
                }
            }
        }
        const isExternal = !!(incomingOwner && ownerId && incomingOwner !== ownerId);

        if (isExternal) {
            // 外部表示用のフラグを付けて保持（保存しない）。同一担当者は上書き、別担当者は追加
            const ns = `EXT${incomingOwner}_`;
            const withoutSameOwner = externalTasks.filter(
                (t) => String(t.__externalOwnerId || "") !== incomingOwner
            );
            const importedExternal = imported.map((t) => {
                const code = String(t.taskCode || "").trim();
                if (!code || !code.includes("-")) {
                    return {
                        ...t,
                        __external: true,
                        __externalOwnerId: incomingOwner
                    };
                }
                const [family, branch] = code.split("-");
                // 内部データと taskCode/familyKey が衝突すると、アコーディオン・親子判定が巻き込まれる。
                // 外部は表示上 taskCode を伏せる（******）ので、内部キーだけ確実に別物にする。
                const namespacedCode = `${ns}${family}-${branch}`;
                return {
                    ...t,
                    taskCode: namespacedCode,
                    __external: true,
                    __externalOwnerId: incomingOwner
                };
            });
            externalTasks = withoutSameOwner.concat(importedExternal);
            const ownerCount = getExternalCsvOwnerIds().length;
            showToast(
                `外部CSV（${incomingOwner}）を取り込みました（閲覧専用・登録担当${ownerCount}名）`
            );
            syncExternalOwnerFilterUi();
            renderAll();
            event.target.value = "";
            return;
        }

        // --- taskCode 重複は確認して上書き ---
        const existingByCode = new Map(tasks.filter(t => t.taskCode).map(t => [t.taskCode, t]));
        const dupCodes = Array.from(new Set(imported.map(t => t.taskCode).filter(code => existingByCode.has(code))));
        let overwrite = false;
        if (dupCodes.length > 0) {
            overwrite = confirm(`既存データと同じタスクIDが${dupCodes.length}件あります。取り込みデータで上書きしますか？\n（OK=上書き／キャンセル=重複分はスキップ）`);
        }

        let importedCount = 0;
        let overwrittenCount = 0;
        imported.forEach(t => {
            const exist = existingByCode.get(t.taskCode);
            if (exist) {
                if (!overwrite) return;
                // 既存の id は維持しつつ、内容は取り込みで置換
                const keepId = exist.id;
                Object.keys(exist).forEach(k => { delete exist[k]; });
                Object.assign(exist, { ...t, id: keepId });
                overwrittenCount++;
                importedCount++;
            } else {
                tasks.push(t);
                importedCount++;
            }
        });

        // 取り込み後に「子だけ存在して親(-000)が居ない」familyが出ることがあるため、自動で親を補完する
        const importedFamilies = Array.from(new Set(
            imported
                .map(t => getTaskFamilyKey(t))
                .filter(Boolean)
        ));
        importedFamilies.forEach((family) => {
            const hasParent = tasks.some(t => !t.archived && getTaskFamilyKey(t) === family && isParentTask(t));
            if (hasParent) return;
            const children = tasks.filter(t => getTaskFamilyKey(t) === family && !isParentTask(t));
            if (children.length === 0) return;

            const sample = children[0];
            const familyCode = (sample.taskCode || "").includes("-") ? (sample.taskCode.split("-")[0]) : family;
            const parentCode = `${familyCode}-000`;

            // 既に同じtaskCodeが存在する場合はスキップ（重複回避）
            if (tasks.some(t => String(t.taskCode) === parentCode)) return;

            const allArchived = children.every(t => t.archived === true);
            const allDone = children.length > 0 && children.every(t => isTerminalTaskStatus(t.status));
            const parent = {
                id: Date.now() + Math.floor(Math.random() * 10000),
                taskCode: parentCode,
                category: sample.category || "その他",
                PrimaryStep: getPrimaryStep(sample) || getThemeLabel(sample) || family,
                SecondaryStep: "",
                content: getPrimaryStep(sample) || getThemeLabel(sample) || family,
                issue: "",
                FirstFlag: "",
                factory: "",
                msDate: "",
                TargetFlag: "",
                TargetDate: "",
                target: "",
                startDate: "",
                deadline: "",
                status: allDone ? "完了" : "進行中",
                memo: "",
                archived: allArchived,
                fFlag: false
            };
            tasks.push(parent);
        });

        // 子タスクの期間（最小startDate・最大deadline）を親へ反映
        importedFamilies.forEach((family) => {
            const parent = tasks.find(t => getTaskFamilyKey(t) === family && isParentTask(t));
            if (!parent) return;
            const children = tasks
                .filter(t => getTaskFamilyKey(t) === family && !isParentTask(t))
                .filter(t => (t.startDate || t.deadline)); // 日付がある子だけ
            if (children.length === 0) return;

            let minStart = "";
            let maxEnd = "";
            children.forEach((c) => {
                if (c.startDate) {
                    if (!minStart || c.startDate < minStart) minStart = c.startDate;
                }
                if (c.deadline) {
                    if (!maxEnd || c.deadline > maxEnd) maxEnd = c.deadline;
                }
            });
            if (minStart) parent.startDate = minStart;
            if (maxEnd) parent.deadline = maxEnd;
        });

        // 取り込み直後に親が末尾へ行って「子だけ見える」状態にならないよう、親→子の順に並びを再構築
        importedFamilies.forEach((family) => {
            rebuildFamilyOrderInTasks(family);
        });

        migrateTaskCodesIfNeeded();
        save();
        renderAll();
        showToast(`取り込み ${importedCount}件（上書き ${overwrittenCount}件）`);
        event.target.value = "";
    };
    reader.readAsText(file);
}


// すべてのチェックボックスをON/OFFする機能
function toggleAll(isChecked) {
    document.querySelectorAll('#taskBody tr').forEach((tr) => {
        if (!isTaskTableRowVisible(tr)) return;
        const cb = tr.querySelector('.row-check:not(:disabled)');
        if (cb) cb.checked = isChecked;
    });
    if (!isChecked) {
        const inc = document.getElementById('includeArchivedBulk');
        if (inc) inc.checked = false;
    }
    updateDeleteButtonState();
}


// 再描画（renderAll）を呼ばない保存専用の関数
function updateDataSilent(id, field, value) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        if (isExternalTask(task)) return;
        const isLocked = task.archived || isTerminalTaskStatus(task.status);
        if (isLocked && !["status", "memo"].includes(field)) return;
        if (field === "PrimaryStep" || field === "content") setPrimaryStep(task, value);
        else if (field === "SecondaryStep" || field === "issue") setSecondaryStep(task, value);
        else task[field] = value;
        // LocalStorageへの保存だけ実行し、画面の書き換えは行わない
        localStorage.setItem('omniStepData', JSON.stringify(tasks));
    }
}


//タスクの親子化
// --- 1. 新規プロジェクト（親：0）を追加する ---
function addNewProject() {
    const projectName = prompt("新しいプロジェクト名を入力してください");
    if (!projectName) return;

    const newTask = {
        id: Date.now(),
        taskCode: generateParentTaskCode(),
        category: "未分類",
        PrimaryStep: projectName,
        SecondaryStep: "",
        content: projectName,
        issue: "",
        status: "未着手",
        startDate: "",
        deadline: "",
        archived: false
    };

    tasks.push(newTask);
    renderAll(); // 全体を再描画
}

// --- 2. 既存の親に子タスク（：10, 20...）を追加する ---
function addSubTask(parentTaskId) {
    const parentTask = tasks.find(t => String(t.id) === String(parentTaskId));
    if (!parentTask) return;
    const familyKey = getTaskFamilyKey(parentTask);
    const rootName = getThemeLabel(parentTask);

    // 同じプロジェクトのタスクを抽出して、現在の最大枝番を探す
    const family = tasks.filter(t => getTaskFamilyKey(t) === familyKey);

    const newTask = {
        id: Date.now(),
        taskCode: generateChildTaskCode(parentTask.taskCode),
        category: family[0]?.category || "未分類", // 親のカテゴリを継承
        PrimaryStep: rootName,
        SecondaryStep: "",
        content: rootName,
        issue: "",
        status: "未着手",
        startDate: "",
        deadline: "",
        archived: false
    };

    tasks.push(newTask);
    renderAll();
}


// 開閉状態を管理する配列（非表示にするテーマ名を格納）
let collapsedThemes = [];
let collapsedThemesTimeline = []; // タイムライン側の開閉状態
let lastExpandedListTheme = null;

function animateListClose(familyKey, done) {
    const rows = Array.from(document.querySelectorAll('#taskBody tr'));
    rows.forEach((row) => {
        const task = findTaskByIdAny(row.dataset.id);
        if (task && !isParentTask(task) && getTaskFamilyKey(task) === familyKey) {
            row.classList.add('row-animate-out');
        }
    });
    setTimeout(done, ACCORDION_ROW_ANIM_OUT_MS);
}

function animateTimelineClose(familyKey, done) {
    const rows = Array.from(document.querySelectorAll(".timeline-row-area, .sticky-label"));
    rows.forEach((row) => {
        const fam = row.dataset.family;
        const isParent = row.dataset.parent === "1";
        if (fam === familyKey && !isParent) row.classList.add("row-animate-out");
    });
    setTimeout(done, ACCORDION_ROW_ANIM_OUT_MS);
}

// ① ＋/－ ボタンの開閉処理
function toggleAccordion(parentTaskId) {
    const parentTask = findTaskByIdAny(parentTaskId);
    if (!parentTask) return;
    const familyKey = getTaskFamilyKey(parentTask);
    const rootName = getThemeLabel(parentTask);
    const index = collapsedThemes.indexOf(familyKey);

    if (index === -1) {
        animateListClose(familyKey, () => {
            collapsedThemes.push(familyKey); // 閉じる
            renderAll();
        });
        return;
    } else {
        collapsedThemes.splice(index, 1); // 開く
        lastExpandedListTheme = familyKey;
    }
    
    renderAll(); // リスト再描画
    updateListAccordionBulkStateFromCollapsed();

    // 展開（開く）した時だけ、その場所までスクロール
    if (index !== -1) {
        setTimeout(() => {
            // 親タスクの行を探す（innerTextにテーマ名が含まれるtrを探す）
            const rows = document.querySelectorAll('tr.parent-row');
            const targetRow = Array.from(rows).find(r => r.innerText.includes(rootName));
            
            if (targetRow) {
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 50);
    }
}

function toggleTimelineAccordion(parentTaskId) {
    const parentTask = findTaskByIdAny(parentTaskId);
    if (!parentTask) return;
    clearDependencyLines();
    const familyKey = getTaskFamilyKey(parentTask);
    const index = collapsedThemesTimeline.indexOf(familyKey);

    if (index === -1) {
        animateTimelineClose(familyKey, () => {
            collapsedThemesTimeline.push(familyKey);
            renderTimeline();
        });
        return;
    }
    collapsedThemesTimeline.splice(index, 1);
    lastToggledTheme = familyKey;
    renderTimeline();
}

// ② 子タスクの追加処理
function addSubTask(parentId) {
    const parentTask = tasks.find(t => String(t.id) === String(parentId));
    if (!parentTask || isExternalTask(parentTask)) return;
    const familyKey = getTaskFamilyKey(parentTask);
    const rootName = getThemeLabel(parentTask);

    // 1. 親タスクのインデックスを探す
    const parentIndex = tasks.findIndex(t => String(t.id) === String(parentId));
    if (parentIndex === -1) return;

    // 2. 同じテーマの最後のタスク（枝番が一番大きいもの）の場所を探す
    let lastIndexInTheme = parentIndex;
    tasks.forEach((t, idx) => {
        if (getTaskFamilyKey(t) === familyKey) {
            if (idx > lastIndexInTheme) lastIndexInTheme = idx;
        }
    });

    const newTask = {
        id: Date.now(),
        taskCode: generateChildTaskCode(parentTask.taskCode),
        category: tasks[parentIndex].category, // 親のカテゴリを継承
        PrimaryStep: rootName,
        SecondaryStep: "",
        content: rootName,
        issue: "",
        status: "未着手",
        startDate: "",
        deadline: "",
        // 子タスク追加時は親の FirstFlag/TargetFlag などを継承しない
        FirstFlag: "",
        factory: "",
        msDate: "",
        TargetFlag: "",
        TargetDate: "",
        target: "",
        fFlag: false,
        archived: false
    };

    // 3. push ではなく、テーマの最後尾に「挿入」する
    tasks.splice(lastIndexInTheme + 1, 0, newTask);

    save();
    renderAll();
    showToast("子タスクを追加しました");
}

function updateParentDates(familyKey) {
    // 同じ親ID（familyKey）を持つ全タスクを抽出
    const family = tasks.filter(t => getTaskFamilyKey(t) === familyKey);

    // 親タスクと子タスクを特定
    const parentTask = family.find(t => isParentTask(t));
    const children = family.filter(t => !isParentTask(t));

    // 子タスクがない場合は親の日付は自由入力なので、計算をスキップ
    if (!parentTask || children.length === 0) return;

    let minStart = null;
    let maxDeadline = null;

    // 子タスクの中から「一番早い開始」と「一番遅い納期」を探す
    children.forEach(child => {
        if (child.startDate) {
            if (!minStart || child.startDate < minStart) minStart = child.startDate;
        }
        if (child.deadline) {
            if (!maxDeadline || child.deadline > maxDeadline) maxDeadline = child.deadline;
        }
    });

    // 親タスクを更新
    parentTask.startDate = minStart || "";
    parentTask.deadline = maxDeadline || "";

    save();
    // renderAllは呼び出し側で行うか、ここで行う
}


// マスター日程のCSV出力機能
function exportMasterCSV() {
    if (!yearlyMaster || yearlyMaster.length === 0) {
        showToast("出力するデータがありません");
        return;
    }

    // CSVのヘッダー（Excelで開いても文字化けしないようBOMを付与）
    let csvContent = "\uFEFF名称,日付,終了日,休日\n";

    yearlyMaster.forEach(item => {
        const row = `"${item.name}","${item.date || ""}","${item.dateEnd || ""}","${item.isHoliday ? "1" : "0"}"`;
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `OmniStep_Master_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("マスター日程をCSVで出力しました");
}


// ソート実行関数
function executeSort(key) {
    // 1. 親タスク（：0）だけを抽出してソート
    const parents = tasks.filter(t => isParentTask(t));

    parents.sort((a, b) => {
        if (key === 'theme') {
            return getPrimaryStep(a).localeCompare(getPrimaryStep(b), 'ja');
        } else if (key === 'date') {
            // 開始日が未入力の場合は後ろへ
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate) - new Date(b.startDate);
        }
    });

    // 2. ソートされた親の順番に従って、子タスクを紐付けて再構成
    let newTaskList = [];
    parents.forEach(p => {
        const familyKey = getTaskFamilyKey(p);
        // 親を追加
        newTaskList.push(p);
        // その親に属する子タスクを探して追加
        const children = tasks.filter(t => getTaskFamilyKey(t) === familyKey && !isParentTask(t));
        // 子タスク内は枝番順
        children.sort((a, b) => {
            const numA = parseInt(getTaskBranchNo(a), 10) || 0;
            const numB = parseInt(getTaskBranchNo(b), 10) || 0;
            return numA - numB;
        });
        newTaskList = newTaskList.concat(children);
    });

    // 3. 全体リストを更新して再描画
    tasks = newTaskList;
    save();      // 並び順を保存
    renderAll(); // 画面更新
    showToast(key === 'date' ? "期間の早い順に並び替えました" : "テーマ順に並び替えました");
}

// ==========================================
// 新規テーマ登録モーダル (改良版) の制御
// ==========================================

// 入力チェック：テーマ名があればボタンを有効化
function validateNewTask() {
    const content = document.getElementById('newContent').value.trim();
    const btn = document.getElementById('btnSubmitNewTask');
    if (btn) btn.disabled = (content === "");
}

// モーダルを開く（リセット処理含む）
function openNewTaskModal() {
    // 各項目の初期化
    document.getElementById('newContent').value = "";
    document.getElementById('newSecondaryStep').value = "";
    document.getElementById('newStartDate').value = "";
    document.getElementById('newDeadline').value = "";
    document.getElementById('newDeadline').min = ""; // 制限をリセット
    document.getElementById('newFirstFlagDate').value = "";
    document.getElementById('newTargetFlagDate').value = "";
    const firstSelect = document.getElementById('newFirstFlagName');
    const eventSelect = document.getElementById('newTargetFlagName');
    if (firstSelect) firstSelect.innerHTML = getMasterOptionsHTML("");
    if (eventSelect) eventSelect.innerHTML = getMasterOptionsHTML("");
    const fd = document.getElementById('newFirstFlagDate');
    const td = document.getElementById('newTargetFlagDate');
    if (fd) fd.disabled = false;
    if (td) td.disabled = false;

    fillNewTaskCategorySelect();
    validateNewTask();
    document.getElementById('newTaskModal').style.display = 'flex';
    document.getElementById('newContent').focus();
    updateBodyScrollLock();
}

// モーダルを閉じる
function closeNewTaskModal() {
    document.getElementById('newTaskModal').style.display = 'none';
    updateBodyScrollLock();
}

// 登録実行（親タスク専用）
function submitNewTask() {
    const rawContent = document.getElementById('newContent').value.trim();
    if (!rawContent) return;

    const category = document.getElementById('newCat').value;
    const startDate = document.getElementById('newStartDate').value;
    const deadline = document.getElementById('newDeadline').value;
    const firstFlagName = document.getElementById('newFirstFlagName').value;
    const targetFlagName = document.getElementById('newTargetFlagName').value;
    const firstFlagDate = document.getElementById('newFirstFlagDate').value;
    const targetFlagDate = document.getElementById('newTargetFlagDate').value;
    const secondaryInput = document.getElementById('newSecondaryStep').value.trim();

    // onchangeで日付が反映されないケースの保険
    const firstMasterEntry = yearlyMaster.find(m => m.name === firstFlagName);
    const targetMasterEntry = yearlyMaster.find(m => m.name === targetFlagName);
    const effectiveFirstFlagDate = firstFlagDate || (firstMasterEntry ? firstMasterEntry.date : "");
    const effectiveTargetFlagDate = targetFlagDate || (targetMasterEntry ? targetMasterEntry.date : "");

    // ① 日付のバリデーション（着手日が完了日より後なら警告）
    if (startDate && deadline && new Date(startDate) > new Date(deadline)) {
        alert("完了日は着手日より後の日付に設定してください。");
        return;
    }

    const newTask = {
        id: Date.now(),
        taskCode: generateParentTaskCode(),
        category: category,
        PrimaryStep: rawContent,
        SecondaryStep: "",
        content: rawContent,
        issue: "",
        TargetFlag: targetFlagName || "",
        TargetDate: effectiveTargetFlagDate,
        target: effectiveTargetFlagDate,
        startDate: secondaryInput ? "" : startDate,
        deadline: secondaryInput ? "" : deadline,
        msDate: effectiveFirstFlagDate,
        status: "未着手",
        archived: false,
        memo: "",
        FirstFlag: firstFlagName || "",
        factory: firstFlagName || ""
    };

    tasks.push(newTask);
    if (secondaryInput) {
        const childTask = {
            id: Date.now() + 1,
            taskCode: generateChildTaskCode(newTask.taskCode),
            category: category,
            PrimaryStep: rawContent,
            SecondaryStep: secondaryInput,
            content: rawContent,
            issue: secondaryInput,
            TargetFlag: "",
            TargetDate: "",
            target: "",
            startDate: startDate,
            deadline: deadline,
            msDate: "",
            status: "未着手",
            archived: false,
            memo: "",
            FirstFlag: "",
            factory: ""
        };
        tasks.push(childTask);
        syncParentDates(getTaskFamilyKey(newTask));
    }
    save();
    renderAll();

    // ② トースト表示
    if (typeof showToast === "function") {
        showToast("新規テーマを登録しました。");
    }

    closeNewTaskModal();
}

// Enterキーでの登録ショートカット
document.getElementById('newContent')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const btn = document.getElementById('btnSubmitNewTask');
        if (btn && !btn.disabled) {
            submitNewTask();
        }
    }
});

// 新規登録モーダル用：着手日と完了日の同期・制限
function syncNewModalDates() {
    const startDate = document.getElementById('newStartDate').value;
    const deadlineInput = document.getElementById('newDeadline');

    if (startDate) {
        // 完了日に着手日と同じ日付をセット
        deadlineInput.value = startDate;
        // 完了日のカレンダーで着手日より前を選択不可（グレーアウト）にする
        deadlineInput.min = startDate;
    } else {
        deadlineInput.min = "";
    }
}

function syncNewMasterDate(selectId, dateId) {
    const selectEl = document.getElementById(selectId);
    const dateEl = document.getElementById(dateId);
    if (!selectEl || !dateEl) return;
    const selected = yearlyMaster.find(m => m.name === selectEl.value);
    if (selected && selected.date) {
        dateEl.value = selected.date;
        dateEl.disabled = true;
    } else {
        dateEl.disabled = false;
    }
}


// --- タイムライン・ツールチップ制御（吹き出し表示） ---
function ensureTimelineTooltip() {
    let tooltip = document.getElementById('timeline-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'timeline-tooltip';
        tooltip.className = 'tooltip-balloon';
        document.body.appendChild(tooltip);
    }
    // JS側でも強制的に見えるスタイルを付与（CSS差異の影響を受けにくくする）
    tooltip.style.position = 'fixed';
    tooltip.style.zIndex = '99999';
    tooltip.style.pointerEvents = 'none';
    return tooltip;
}

function showTimelineTooltip(task, e) {
    const tooltip = ensureTimelineTooltip();

    const periodStart = task.startDate || task.msDate || "未設定";
    const periodEnd = task.deadline || task.startDate || task.msDate || "未設定";
    let dayLabel = "";
    if (task.startDate && task.deadline) {
        const diff = Math.ceil((new Date(task.deadline) - new Date(task.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        dayLabel = ` (${Math.max(diff, 1)}日)`;
    }
    const durationText = `${periodStart} ～ ${periodEnd}${dayLabel}`;

    tooltip.innerHTML = `<strong>業務内容:</strong> ${getSecondaryStep(task) || getPrimaryStep(task) || "未入力"}<br><strong>着手日～納期:</strong> ${durationText}`;
    tooltip.style.display = 'block';
    moveTimelineTooltip(e);
}

function moveTimelineTooltip(e) {
    const tooltip = ensureTimelineTooltip();
    if (!tooltip || tooltip.style.display !== 'block') return;
    const x = typeof e?.clientX === 'number' ? e.clientX : 20;
    const y = typeof e?.clientY === 'number' ? e.clientY : 20;
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y - 60) + 'px';
}

function hideTimelineTooltip() {
    const tooltip = ensureTimelineTooltip();
    if (tooltip) tooltip.style.display = 'none';
}