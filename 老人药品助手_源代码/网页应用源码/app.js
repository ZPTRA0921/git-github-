(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    var DEMO = params.get('demo') === '1';
    var android = window.Android || null;
    var isNative = !!(android && typeof android.getData === 'function');

    var PACK_LABELS = {
        'pack-front': '正面',
        'pack-back': '背面',
        'pack-left': '左侧',
        'pack-right': '右侧',
        'pack-top': '顶部',
        'pack-bottom': '底部'
    };
    var PACK_KEYS = ['pack-front', 'pack-back', 'pack-left', 'pack-right', 'pack-top', 'pack-bottom'];
    var EMERGENCY_SETTING_KEY = 'emergency_number';
    var EMERGENCY_DEFAULT = '120';

    var state = {
        meds: [],
        filter: 'all',
        query: '',
        location: '',
        editingId: null,
        detailId: null,
        draft: { photos: {}, storagePhoto: '' },
        dirty: false,
        saveInProgress: false,
        pendingPhotoKey: null,
        pendingBrowserKey: null,
        photoTimeout: null,
        confirmAction: null,
        toastTimer: null,
        online: null,
        initialized: false,
        emergencyNumber: EMERGENCY_DEFAULT
    };

    var dom = {};

    var DB_NAME = 'elderMedicineApp';
    var DB_VERSION = 2;
    var DB_STORE = 'app';
    var DB_KEY = 'medicines';
    var LS_KEY = 'elderMedicineData';
    var LS_EMERGENCY_KEY = 'elderMedicineEmergencyNumber';
    var LS_REVIEW_KEY = 'elderMedicineLastReview';
    var REVIEW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
    var browserDbPromise = null;

    var pinyinCollator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'accent', numeric: true });

    var ICON_LOCATION = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
    var ICON_CALENDAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';
    var ICON_SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
    var ICON_CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="4"/></svg>';
    var ICON_EMPTY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="8" width="15" height="11" rx="4"/><path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8M9 13h6M12 10v6"/></svg>';

    document.addEventListener('DOMContentLoaded', init);

    function $(id) {
        return document.getElementById(id);
    }

    function cacheDom() {
        dom.homeView = $('homeView');
        dom.addButtonBottom = $('addButtonBottom');
        dom.emergencyButton = $('emergencyButton');
        dom.locationFilter = $('locationFilter');
        dom.searchInput = $('searchInput');
        dom.clearSearch = $('clearSearch');
        dom.onlineHint = $('onlineHint');
        dom.onlineHintText = $('onlineHintText');
        dom.countAll = $('countAll');
        dom.countSoon = $('countSoon');
        dom.countExpired = $('countExpired');
        dom.notificationBanner = $('notificationBanner');
        dom.notificationButton = $('notificationButton');
        dom.medicineList = $('medicineList');
        dom.listSummary = $('listSummary');

        dom.editorView = $('editorView');
        dom.editorScroll = $('editorScroll');
        dom.backButton = $('backButton');
        dom.editorTitle = $('editorTitle');
        dom.deleteButton = $('deleteButton');
        dom.detailView = $('detailView');
        dom.detailBack = $('detailBack');
        dom.detailTitle = $('detailTitle');
        dom.detailSubtitle = $('detailSubtitle');
        dom.detailScroll = $('detailScroll');
        dom.photoError = $('photoError');
        dom.nameInput = $('nameInput');
        dom.nameError = $('nameError');
        dom.locationInput = $('locationInput');
        dom.locationError = $('locationError');
        dom.expiryInput = $('expiryInput');
        dom.expiryError = $('expiryError');
        dom.dateHint = $('dateHint');
        dom.notesInput = $('notesInput');
        dom.saveButton = $('saveButton');
        dom.storageTile = $('storageTile');
        dom.photoFileInput = $('photoFileInput');

        dom.photoViewer = $('photoViewer');
        dom.closePhotoViewer = $('closePhotoViewer');
        dom.viewerImage = $('viewerImage');
        dom.viewerCaption = $('viewerCaption');

        dom.confirmModal = $('confirmModal');
        dom.confirmTitle = $('confirmTitle');
        dom.confirmMessage = $('confirmMessage');
        dom.confirmCancel = $('confirmCancel');
        dom.confirmOk = $('confirmOk');

        dom.emergencyModal = $('emergencyModal');
        dom.emergencyNumber = $('emergencyNumber');
        dom.emergencyCancel = $('emergencyCancel');
        dom.emergencyOk = $('emergencyOk');

        dom.toast = $('toast');
    }

    async function init() {
        cacheDom();
        bindEvents();

        if (DEMO) {
            state.meds = demoMeds();
            renderAll();
            hideNotificationBanner();
            refreshOnlineState();
            applyDemoView();
        } else {
            try {
                state.meds = await loadInitialData();
            } catch (error) {
                console.error(error);
                state.meds = [];
                showToast('药品数据读取失败，请重新打开软件');
            }
            renderAll();
            initNotificationBanner();
            refreshOnlineState();
            syncReminders(state.meds);
            requestPersistentStorage();
            loadEmergencyNumber();
            runWeeklyReviewIfDue();
        }

        state.initialized = true;
    }

    function bindEvents() {
        dom.addButtonBottom.addEventListener('click', function () {
            openEditor(null);
        });

        dom.emergencyButton.addEventListener('click', openEmergencyModal);
        dom.emergencyCancel.addEventListener('click', closeEmergencyModal);
        dom.emergencyOk.addEventListener('click', callEmergencyNumber);
        dom.emergencyModal.addEventListener('click', function (event) {
            if (event.target === dom.emergencyModal) {
                closeEmergencyModal();
            }
        });

        document.querySelectorAll('.filter-chip').forEach(function (button) {
            button.addEventListener('click', function () {
                setFilter(button.dataset.filter);
            });
        });

        dom.searchInput.addEventListener('input', function () {
            state.query = dom.searchInput.value.trim();
            dom.clearSearch.hidden = dom.searchInput.value.length === 0;
            renderCardsOnly();
        });

        dom.clearSearch.addEventListener('click', function () {
            dom.searchInput.value = '';
            state.query = '';
            dom.clearSearch.hidden = true;
            dom.searchInput.focus();
            renderCardsOnly();
        });

        dom.locationFilter.addEventListener('change', function () {
            state.location = dom.locationFilter.value;
            renderCardsOnly();
        });

        dom.medicineList.addEventListener('click', onMedicineListClick);
        dom.medicineList.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            var main = event.target.closest('.card-main');
            if (!main) {
                return;
            }
            event.preventDefault();
            var card = main.closest('.med-card');
            if (card) {
                handleCardTap(card.dataset.id);
            }
        });

        document.querySelectorAll('[data-photo-key]').forEach(function (tile) {
            tile.addEventListener('click', function () {
                requestPhoto(tile.dataset.photoKey);
            });
        });

        dom.photoFileInput.addEventListener('change', function (event) {
            handleBrowserFile(event.target);
        });

        dom.backButton.addEventListener('click', requestCloseEditor);
        dom.saveButton.addEventListener('click', saveCurrentMedicine);
        dom.deleteButton.addEventListener('click', requestDeleteMedicine);
        dom.detailBack.addEventListener('click', closeDetail);
        dom.detailScroll.addEventListener('click', onDetailClick);

        dom.nameInput.addEventListener('input', function () {
            markDirty();
            if (dom.nameInput.value.trim()) {
                hideError(dom.nameError);
            }
        });
        dom.locationInput.addEventListener('input', function () {
            markDirty();
            if (dom.locationInput.value.trim()) {
                hideError(dom.locationError);
            }
        });
        dom.expiryInput.addEventListener('change', function () {
            markDirty();
            updateDateHint();
            if (dom.expiryInput.value) {
                hideError(dom.expiryError);
            }
        });
        dom.notesInput.addEventListener('input', markDirty);

        dom.closePhotoViewer.addEventListener('click', closePhotoViewer);
        dom.photoViewer.addEventListener('click', function (event) {
            if (event.target === dom.photoViewer) {
                closePhotoViewer();
            }
        });

        dom.confirmCancel.addEventListener('click', closeConfirm);
        dom.confirmOk.addEventListener('click', function () {
            var action = state.confirmAction;
            closeConfirm();
            if (typeof action === 'function') {
                action();
            }
        });

        dom.notificationButton.addEventListener('click', function () {
            if (isNative && typeof android.openNotificationSettings === 'function') {
                android.openNotificationSettings();
                window.setTimeout(refreshNotificationBanner, 900);
                return;
            }
            if ('Notification' in window && typeof Notification.requestPermission === 'function') {
                Notification.requestPermission().then(refreshNotificationBanner);
            }
        });

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                refreshNotificationBanner();
                refreshOnlineState();
                syncReminders(state.meds);
            }
        });
        window.addEventListener('focus', function () {
            refreshNotificationBanner();
            refreshOnlineState();
        });
        window.addEventListener('online', refreshOnlineState);
        window.addEventListener('offline', refreshOnlineState);

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') {
                return;
            }
            if (!dom.photoViewer.hidden) {
                closePhotoViewer();
            } else if (!dom.emergencyModal.hidden) {
                closeEmergencyModal();
            } else if (!dom.confirmModal.hidden) {
                closeConfirm();
            } else if (!dom.detailView.hidden) {
                closeDetail();
            } else if (!dom.editorView.hidden) {
                requestCloseEditor();
            }
        });
    }

    // ---------- 数据存储 ----------

    function openBrowserDb() {
        if (browserDbPromise) {
            return browserDbPromise;
        }
        browserDbPromise = new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            var request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains(DB_STORE)) {
                    db.createObjectStore(DB_STORE, { keyPath: 'key' });
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('IndexedDB error')); };
        });
        return browserDbPromise;
    }

    async function loadBrowserData() {
        try {
            var db = await openBrowserDb();
            var record = await new Promise(function (resolve, reject) {
                var tx = db.transaction(DB_STORE, 'readonly');
                var request = tx.objectStore(DB_STORE).get(DB_KEY);
                request.onsuccess = function () { resolve(request.result); };
                request.onerror = function () { reject(request.error); };
            });
            if (record && Array.isArray(record.value)) {
                return record.value;
            }
        } catch (error) {
            console.warn('IndexedDB read failed', error);
        }

        try {
            var raw = window.localStorage.getItem(LS_KEY);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (error) {
            console.warn('localStorage read failed', error);
        }
        return [];
    }

    async function saveBrowserData(meds) {
        var saved = false;
        try {
            var db = await openBrowserDb();
            await new Promise(function (resolve, reject) {
                var tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).put({ key: DB_KEY, value: meds });
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
                tx.onabort = function () { reject(tx.error); };
            });
            saved = true;
        } catch (error) {
            console.warn('IndexedDB write failed', error);
        }

        try {
            window.localStorage.setItem(LS_KEY, JSON.stringify(meds));
            saved = true;
        } catch (error) {
            console.warn('localStorage write failed', error);
        }

        if (!saved) {
            throw new Error('本机存储空间不足');
        }
    }

    async function loadInitialData() {
        if (isNative) {
            var raw = android.getData();
            return normalizeMeds(raw ? JSON.parse(raw) : []);
        }
        return normalizeMeds(await loadBrowserData());
    }

    async function persistMeds(meds) {
        if (DEMO) {
            return;
        }
        if (isNative) {
            var ok = android.saveData(JSON.stringify(meds));
            if (ok === false) {
                throw new Error('本机保存失败');
            }
            return;
        }
        await saveBrowserData(meds);
    }

    function syncReminders(meds) {
        if (!isNative || typeof android.syncReminders !== 'function') {
            return;
        }
        try {
            var reminders = meds.map(function (med) {
                return { id: med.id, name: med.name, expiry: med.expiry };
            });
            android.syncReminders(JSON.stringify(reminders));
        } catch (error) {
            console.warn('reminder sync failed', error);
        }
    }

    function runWeeklyReviewIfDue() {
        var last = 0;
        try {
            last = Number(window.localStorage.getItem(LS_REVIEW_KEY)) || 0;
        } catch (error) {
            console.warn(error);
        }
        var now = Date.now();
        if (last > 0 && now - last < REVIEW_INTERVAL_MS) {
            return;
        }
        try {
            window.localStorage.setItem(LS_REVIEW_KEY, String(now));
        } catch (error) {
            console.warn(error);
        }

        var expired = [];
        var soon = [];
        state.meds.forEach(function (med) {
            var status = expiryStatus(med.expiry);
            if (status.key === 'expired') {
                expired.push(med);
            } else if (status.key === 'soon') {
                soon.push(med);
            }
        });

        if (expired.length > 0) {
            var names = expired.slice(0, 3).map(function (med) { return med.name; }).join('、');
            if (expired.length > 3) {
                names += ' 等 ' + expired.length + ' 种药品';
            }
            var message = '本周复查：' + names + ' 已过期，请勿食用';
            showToast(message);
            if (!isNative && 'Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('药品过期提醒', { body: message });
                } catch (error) {
                    console.warn(error);
                }
            }
        } else if (soon.length > 0) {
            var soonNames = soon.slice(0, 3).map(function (med) { return med.name; }).join('、');
            if (soon.length > 3) {
                soonNames += ' 等 ' + soon.length + ' 种药品';
            }
            showToast('本周复查：' + soonNames + ' 即将过期，请留意');
        }
        syncReminders(state.meds);
    }

    function normalizeMeds(input) {
        if (!Array.isArray(input)) {
            return [];
        }
        var seen = {};
        var result = [];
        input.forEach(function (item) {
            if (!item || typeof item !== 'object' || !item.name || !item.expiry) {
                return;
            }
            var id = String(item.id || newId());
            if (seen[id]) {
                return;
            }
            seen[id] = true;
            result.push({
                id: id,
                name: String(item.name).trim(),
                location: String(item.location || '').trim() || '未填写',
                expiry: String(item.expiry),
                notes: String(item.notes || ''),
                photos: normalizePhotos(item),
                storagePhoto: typeof item.storagePhoto === 'string' ? item.storagePhoto : '',
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString()
            });
        });
        return result;
    }

    function normalizePhotos(item) {
        if (Array.isArray(item.photos)) {
            return item.photos.filter(function (photo) {
                return photo && typeof photo.dataUrl === 'string' && photo.dataUrl;
            }).map(function (photo) {
                return {
                    label: photo.label || '照片',
                    dataUrl: photo.dataUrl
                };
            });
        }
        var photos = [];
        if (typeof item.front === 'string' && item.front) {
            photos.push({ label: '正面', dataUrl: item.front });
        }
        if (typeof item.back === 'string' && item.back) {
            photos.push({ label: '背面', dataUrl: item.back });
        }
        return photos;
    }

    function newId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'med-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function requestPersistentStorage() {
        try {
            if (!isNative && navigator.storage && typeof navigator.storage.persist === 'function') {
                navigator.storage.persist();
            }
        } catch (error) {
            console.warn(error);
        }
    }

    // ---------- 首页渲染 ----------

    function renderAll() {
        renderLocationOptions();
        renderCounts();
        renderFilterButtons();
        renderCardsOnly();
    }

    function renderLocationOptions() {
        var locations = [];
        state.meds.forEach(function (med) {
            if (med.location && locations.indexOf(med.location) === -1) {
                locations.push(med.location);
            }
        });
        locations.sort(function (a, b) { return pinyinCollator.compare(a, b); });

        var current = state.location;
        if (current && locations.indexOf(current) === -1) {
            current = '';
            state.location = '';
        }

        dom.locationFilter.innerHTML = '';
        var all = document.createElement('option');
        all.value = '';
        all.textContent = '全部位置';
        dom.locationFilter.appendChild(all);

        locations.forEach(function (location) {
            var option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            dom.locationFilter.appendChild(option);
        });
        dom.locationFilter.value = current;
    }

    function renderCounts() {
        var counts = { all: state.meds.length, soon: 0, expired: 0 };
        state.meds.forEach(function (med) {
            var status = expiryStatus(med.expiry);
            if (status.key === 'expired') {
                counts.expired += 1;
            } else if (status.key === 'soon') {
                counts.soon += 1;
            }
        });
        dom.countAll.textContent = String(counts.all);
        dom.countSoon.textContent = String(counts.soon);
        dom.countExpired.textContent = String(counts.expired);
    }

    function renderFilterButtons() {
        document.querySelectorAll('.filter-chip').forEach(function (button) {
            button.classList.toggle('active', button.dataset.filter === state.filter);
        });
    }

    function setFilter(filter) {
        state.filter = filter || 'all';
        renderFilterButtons();
        renderCardsOnly();
    }

    function renderCardsOnly() {
        var filtered = filteredMeds();
        var hasAnyFilters = state.filter !== 'all' || state.query.length > 0 || state.location.length > 0;
        dom.listSummary.textContent = hasAnyFilters
            ? '找到 ' + filtered.length + ' 种'
            : '共 ' + state.meds.length + ' 种';

        if (state.meds.length === 0) {
            dom.medicineList.innerHTML = emptyStateHtml(false);
            return;
        }
        if (filtered.length === 0) {
            dom.medicineList.innerHTML = emptyStateHtml(true);
            return;
        }
        dom.medicineList.innerHTML = filtered.map(cardHtml).join('');
    }

    function filteredMeds() {
        var query = state.query.toLowerCase();
        var location = state.location;
        var filter = state.filter;

        var list = state.meds.filter(function (med) {
            var status = expiryStatus(med.expiry);
            if (filter === 'expired' && status.key !== 'expired') {
                return false;
            }
            if (filter === 'soon' && status.key !== 'soon') {
                return false;
            }
            if (location && med.location !== location) {
                return false;
            }
            if (query) {
                var tokens = query.split(/\s+/).filter(Boolean);
                var haystack = (med.name + ' ' + med.location + ' ' + med.notes).toLowerCase();
                for (var t = 0; t < tokens.length; t++) {
                    if (haystack.indexOf(tokens[t]) === -1) {
                        return false;
                    }
                }
            }
            return true;
        });

        // 按药品名称首字母（拼音）排列
        list.sort(function (a, b) {
            return pinyinCollator.compare(a.name, b.name);
        });
        return list;
    }

    function emptyStateHtml(filtered) {
        if (!filtered) {
            return '<div class="empty-state">' +
                '<div class="empty-icon">' + ICON_EMPTY + '</div>' +
                '<h3>还没有药品记录</h3>' +
                '<p>点下方“添加药品”，全方位拍下包装盒，记好有效期和存放位置。</p>' +
                '</div>';
        }

        var onlineBlock = '';
        if (state.query) {
            var queryText = escapeHtml(state.query);
            if (state.online) {
                onlineBlock = '<p class="online-search-note">本地未找到「' + queryText + '」。可联网查询国家药品监督管理局发布的官方药品信息。</p>' +
                    '<button type="button" class="online-button" data-online-search="' + queryText + '">联网查询官方药品信息</button>';
            } else {
                onlineBlock = '<p class="online-search-note">本地未找到「' + queryText + '」。当前离线，联网后可查询未入库药品的官方信息。</p>';
            }
        }

        return '<div class="empty-state">' +
            '<div class="empty-icon">' + ICON_EMPTY + '</div>' +
            '<h3>没有找到符合条件的药品</h3>' +
            '<p>可以换个关键词，或清除筛选条件查看全部药品。</p>' +
            '<button type="button" class="empty-button" data-empty="reset">清除筛选</button>' +
            onlineBlock +
            '</div>';
    }

    function mainPhotoOf(med) {
        var photos = med.photos || [];
        for (var i = 0; i < photos.length; i++) {
            if (photos[i].label === '正面') {
                return photos[i].dataUrl;
            }
        }
        return photos.length > 0 ? photos[0].dataUrl : '';
    }

    function cardHtml(med) {
        var status = expiryStatus(med.expiry);
        var name = escapeHtml(med.name);
        var id = escapeHtml(med.id);
        var notes = (med.notes || '').trim();
        var notePreview = notes.length > 90 ? notes.slice(0, 90) + '…' : notes;
        var mainPhoto = mainPhotoOf(med);
        var photoHtml = mainPhoto
            ? '<img src="' + escapeHtml(mainPhoto) + '" alt="' + name + '包装正面照片" loading="lazy">'
            : '<span class="card-photo-placeholder">' + ICON_CAMERA + '<span>包装正面照片</span></span>';
        var photoCount = (med.photos || []).length;
        var photoCountHtml = photoCount > 0
            ? '<span class="thumb-label">共 ' + photoCount + ' 张包装照片</span>'
            : '';

        return '<article class="med-card ' + status.key + '" data-id="' + id + '">' +
            '<div class="card-main" tabindex="0" aria-label="' + name + '，' + escapeHtml(status.badge) + '">' +
                '<div class="card-photo">' + photoHtml + photoCountHtml + '</div>' +
                '<div class="card-body">' +
                    '<div class="card-top">' +
                        '<h3 class="med-name">' + name + '</h3>' +
                        '<span class="status-badge ' + status.key + '">' + escapeHtml(status.badge) + '</span>' +
                    '</div>' +
                    '<div class="meta-row">' +
                        '<div class="meta-item">' + ICON_LOCATION + '<span><strong>存放位置：</strong>' + escapeHtml(med.location) + '</span></div>' +
                        '<div class="meta-item">' + ICON_CALENDAR + '<span><strong>有效期至：</strong>' + formatDate(med.expiry) + '</span></div>' +
                    '</div>' +
                    (notes ? '<p class="pack-note"><strong>包装说明：</strong>' + escapeHtml(notePreview) + '</p>' : '') +
                    '<p class="tap-hint">' + (status.key === 'expired' ? '点击卡片：语音提醒已过期' : '点击卡片：播报药品信息') + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="card-actions">' +
                '<button type="button" class="action-button" data-action="view" data-id="' + id + '">查看</button>' +
                '<button type="button" class="action-button" data-action="edit" data-id="' + id + '">修改</button>' +
            '</div>' +
            '</article>';
    }

    function onMedicineListClick(event) {
        var onlineButton = event.target.closest('[data-online-search]');
        if (onlineButton) {
            event.preventDefault();
            openOfficialSearch(onlineButton.dataset.onlineSearch);
            return;
        }

        var emptyButton = event.target.closest('[data-empty]');
        if (emptyButton) {
            if (emptyButton.dataset.empty === 'reset') {
                resetFilters();
            }
            return;
        }

        var actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            event.preventDefault();
            event.stopPropagation();
            var actionMed = findMed(actionButton.dataset.id);
            if (!actionMed) {
                return;
            }
            if (actionButton.dataset.action === 'view') {
                openDetail(actionMed);
            } else if (actionButton.dataset.action === 'edit') {
                openEditor(actionMed);
            }
            return;
        }

        var main = event.target.closest('.card-main');
        if (main) {
            var card = main.closest('.med-card');
            if (card) {
                handleCardTap(card.dataset.id);
            }
        }
    }

    function handleCardTap(id) {
        var med = findMed(id);
        if (!med) {
            return;
        }
        speakMedicine(med);
    }

    function resetFilters() {
        state.filter = 'all';
        state.query = '';
        state.location = '';
        dom.searchInput.value = '';
        dom.clearSearch.hidden = true;
        dom.locationFilter.value = '';
        renderFilterButtons();
        renderCardsOnly();
    }

    // ---------- 状态与日期 ----------

    function expiryStatus(expiry) {
        var days = daysUntil(expiry);
        if (days === null) {
            return { key: 'normal', days: null, badge: '有效期未填写' };
        }
        if (days < 0) {
            return { key: 'expired', days: days, badge: '已过期 ' + (-days) + ' 天' };
        }
        if (days === 0) {
            return { key: 'soon', days: 0, badge: '今天到期' };
        }
        if (days <= 30) {
            return { key: 'soon', days: days, badge: '还有 ' + days + ' 天' };
        }
        return { key: 'normal', days: days, badge: '正常' };
    }

    function daysUntil(expiry) {
        var parts = String(expiry || '').split('-');
        if (parts.length !== 3) {
            return null;
        }
        var year = Number(parts[0]);
        var month = Number(parts[1]);
        var day = Number(parts[2]);
        if (!year || !month || !day) {
            return null;
        }
        var now = new Date();
        var todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        var expiryUtc = Date.UTC(year, month - 1, day);
        if (isNaN(expiryUtc)) {
            return null;
        }
        return Math.round((expiryUtc - todayUtc) / 86400000);
    }

    function formatDate(expiry) {
        var parts = String(expiry || '').split('-');
        if (parts.length !== 3) {
            return escapeHtml(expiry || '');
        }
        return escapeHtml(Number(parts[0]) + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日');
    }

    function formatInputDate(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    // ---------- 添加 / 编辑 ----------

    function openEditor(med) {
        state.editingId = med ? med.id : null;
        state.draft.photos = {};
        state.draft.storagePhoto = '';
        state.dirty = false;
        state.saveInProgress = false;

        if (med && Array.isArray(med.photos)) {
            var used = {};
            med.photos.forEach(function (photo) {
                var label = photo.label || '';
                var key = labelToKey(label);
                if (key && !used[key]) {
                    state.draft.photos[key] = photo.dataUrl;
                    used[key] = true;
                }
            });
        }
        state.draft.storagePhoto = med && med.storagePhoto ? med.storagePhoto : '';

        dom.editorTitle.textContent = med ? '修改药品' : '添加药品';
        dom.deleteButton.hidden = !med;

        dom.nameInput.value = med ? med.name : '';
        dom.locationInput.value = med ? med.location : '';
        dom.expiryInput.value = med ? med.expiry : '';
        dom.notesInput.value = med ? med.notes : '';

        hideError(dom.photoError);
        hideError(dom.nameError);
        hideError(dom.locationError);
        hideError(dom.expiryError);
        updateDateHint();

        PACK_KEYS.forEach(function (key) {
            updatePhotoTile(key);
            resetPhotoLoading(key);
        });
        updatePhotoTile('storage');
        resetPhotoLoading('storage');

        dom.saveButton.disabled = false;
        dom.saveButton.textContent = '保存药品';

        dom.homeView.hidden = true;
        dom.editorView.hidden = false;
        document.body.classList.add('editor-open');
        dom.editorScroll.scrollTop = 0;
    }

    function closeEditor() {
        dom.editorView.hidden = true;
        dom.homeView.hidden = false;
        document.body.classList.remove('editor-open');
        state.editingId = null;
        state.draft = { photos: {}, storagePhoto: '' };
        state.dirty = false;
        state.saveInProgress = false;
        renderAll();
    }

    function requestCloseEditor() {
        if (dom.editorView.hidden) {
            return;
        }
        if (!state.dirty) {
            closeEditor();
            return;
        }
        showConfirm({
            title: '放弃未保存的内容？',
            message: '当前填写的信息和照片还没有保存。',
            okText: '放弃',
            cancelText: '继续填写',
            onOk: closeEditor
        });
    }

    function markDirty() {
        state.dirty = true;
    }

    function labelToKey(label) {
        for (var key in PACK_LABELS) {
            if (PACK_LABELS.hasOwnProperty(key) && PACK_LABELS[key] === label) {
                return key;
            }
        }
        return '';
    }

    function requestPhoto(key) {
        if (isNative && typeof android.pickPhoto === 'function') {
            if (state.pendingPhotoKey) {
                return;
            }
            state.pendingPhotoKey = key;
            setPhotoLoading(key, true);
            try {
                android.pickPhoto(key);
                state.photoTimeout = window.setTimeout(function () {
                    if (state.pendingPhotoKey === key) {
                        state.pendingPhotoKey = null;
                        setPhotoLoading(key, false);
                        showToast('没有收到照片，请重试');
                    }
                }, 90000);
            } catch (error) {
                state.pendingPhotoKey = null;
                setPhotoLoading(key, false);
                showToast('无法打开相机，请重试');
            }
            return;
        }

        state.pendingBrowserKey = key;
        dom.photoFileInput.value = '';
        dom.photoFileInput.click();
    }

    async function handleBrowserFile(input) {
        var file = input.files && input.files[0];
        input.value = '';
        var key = state.pendingBrowserKey;
        state.pendingBrowserKey = null;
        if (!file || !key) {
            return;
        }
        setPhotoLoading(key, true);
        try {
            var dataUrl = await compressImageFile(file);
            applyPhoto(key, dataUrl);
        } catch (error) {
            console.error(error);
            showToast('照片读取失败，请换一张图片');
        } finally {
            setPhotoLoading(key, false);
        }
    }

    function compressImageFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onerror = function () { reject(new Error('read error')); };
            reader.onload = function () {
                var image = new Image();
                image.onerror = function () { reject(new Error('image error')); };
                image.onload = function () {
                    var maxSide = 1600;
                    var width = image.naturalWidth || image.width;
                    var height = image.naturalHeight || image.height;
                    var scale = Math.min(1, maxSide / Math.max(width, height));
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(width * scale));
                    canvas.height = Math.max(1, Math.round(height * scale));
                    var ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                    try {
                        resolve(canvas.toDataURL('image/jpeg', 0.82));
                    } catch (error) {
                        reject(error);
                    }
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function applyPhoto(key, dataUrl) {
        if (key === 'storage') {
            state.draft.storagePhoto = dataUrl;
        } else {
            state.draft.photos[key] = dataUrl;
        }
        updatePhotoTile(key);
        markDirty();
        if (state.draft.photos['pack-front']) {
            hideError(dom.photoError);
        }
    }

    function updatePhotoTile(key) {
        var tile = document.querySelector('[data-photo-key="' + key + '"]');
        if (!tile) {
            return;
        }
        var preview = tile.querySelector('.photo-image');
        var retake = tile.querySelector('.photo-retake');
        var empty = tile.querySelector('.photo-empty') || tile.querySelector('.storage-empty');
        var dataUrl = key === 'storage' ? state.draft.storagePhoto : state.draft.photos[key];

        tile.classList.toggle('has-photo', !!dataUrl);
        if (dataUrl) {
            preview.src = dataUrl;
            preview.hidden = false;
            empty.hidden = true;
            retake.hidden = false;
        } else {
            preview.removeAttribute('src');
            preview.hidden = true;
            empty.hidden = false;
            retake.hidden = true;
        }
    }

    function setPhotoLoading(key, loading) {
        var tile = document.querySelector('[data-photo-key="' + key + '"]');
        if (!tile) {
            return;
        }
        var indicator = tile.querySelector('.photo-loading');
        indicator.hidden = !loading;
        tile.disabled = !!loading;
        tile.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function resetPhotoLoading(key) {
        setPhotoLoading(key, false);
        if (state.photoTimeout) {
            window.clearTimeout(state.photoTimeout);
            state.photoTimeout = null;
        }
    }

    function updateDateHint() {
        var value = dom.expiryInput.value;
        dom.dateHint.classList.remove('hint-warn', 'hint-soon');
        if (!value) {
            dom.dateHint.textContent = '请按包装上的有效期填写';
            return;
        }
        var days = daysUntil(value);
        if (days === null) {
            dom.dateHint.textContent = '请填写正确的有效期';
            dom.dateHint.classList.add('hint-warn');
            return;
        }
        if (days < 0) {
            dom.dateHint.textContent = '这个日期已经过期（已过期 ' + (-days) + ' 天）';
            dom.dateHint.classList.add('hint-warn');
        } else if (days === 0) {
            dom.dateHint.textContent = '今天到期，请留意';
            dom.dateHint.classList.add('hint-soon');
        } else if (days <= 30) {
            dom.dateHint.textContent = '还有 ' + days + ' 天到期';
            dom.dateHint.classList.add('hint-soon');
        } else {
            dom.dateHint.textContent = '有效期正常，还有 ' + days + ' 天';
        }
    }

    function collectPhotos() {
        var photos = [];
        PACK_KEYS.forEach(function (key) {
            if (state.draft.photos[key]) {
                photos.push({ label: PACK_LABELS[key], dataUrl: state.draft.photos[key] });
            }
        });
        return photos;
    }

    function validateAndCollect() {
        var valid = true;
        var firstFocus = null;

        var hasFront = !!state.draft.photos['pack-front'];
        if (!hasFront) {
            showError(dom.photoError);
            valid = false;
            firstFocus = document.querySelector('[data-photo-key="pack-front"]');
        } else {
            hideError(dom.photoError);
        }

        var name = dom.nameInput.value.trim();
        if (!name) {
            showError(dom.nameError);
            valid = false;
            if (!firstFocus) {
                firstFocus = dom.nameInput;
            }
        } else {
            hideError(dom.nameError);
        }

        var location = dom.locationInput.value.trim();
        if (!location) {
            showError(dom.locationError);
            valid = false;
            if (!firstFocus) {
                firstFocus = dom.locationInput;
            }
        } else {
            hideError(dom.locationError);
        }

        var expiry = dom.expiryInput.value;
        if (!expiry || daysUntil(expiry) === null) {
            showError(dom.expiryError);
            valid = false;
            if (!firstFocus) {
                firstFocus = dom.expiryInput;
            }
        } else {
            hideError(dom.expiryError);
        }

        if (!valid) {
            showToast('请补全带 * 的项目');
            if (firstFocus) {
                firstFocus.scrollIntoView({ behavior: 'smooth', block: 'center' });
                try {
                    firstFocus.focus({ preventScroll: true });
                } catch (error) {
                    firstFocus.focus();
                }
            }
            return null;
        }

        return {
            name: name,
            location: location,
            expiry: expiry,
            notes: dom.notesInput.value.trim(),
            photos: collectPhotos(),
            storagePhoto: state.draft.storagePhoto
        };
    }

    async function saveCurrentMedicine() {
        if (state.saveInProgress) {
            return;
        }
        var data = validateAndCollect();
        if (!data) {
            return;
        }

        state.saveInProgress = true;
        dom.saveButton.disabled = true;
        dom.saveButton.textContent = '保存中…';

        var existing = state.editingId ? findMed(state.editingId) : null;
        var now = new Date().toISOString();
        var medicine = {
            id: existing ? existing.id : newId(),
            name: data.name,
            location: data.location,
            expiry: data.expiry,
            notes: data.notes,
            photos: data.photos,
            storagePhoto: data.storagePhoto,
            createdAt: existing ? existing.createdAt : now,
            updatedAt: now
        };

        var next;
        if (existing) {
            next = state.meds.map(function (med) {
                return med.id === existing.id ? medicine : med;
            });
        } else {
            next = state.meds.concat([medicine]);
        }

        try {
            await persistMeds(next);
            state.meds = next;
            syncReminders(next);
            state.dirty = false;
            closeEditor();
            showToast(existing ? '药品信息已保存' : '药品已添加');
        } catch (error) {
            console.error(error);
            showToast('保存失败，请检查本机存储空间后重试');
            dom.saveButton.disabled = false;
            dom.saveButton.textContent = '保存药品';
        } finally {
            state.saveInProgress = false;
        }
    }

    function requestDeleteMedicine() {
        if (!state.editingId) {
            return;
        }
        var med = findMed(state.editingId);
        if (!med) {
            return;
        }
        showConfirm({
            title: '删除这份药品？',
            message: '删除「' + med.name + '」后，包装照片和记录都会从手机中删除。',
            okText: '删除',
            cancelText: '取消',
            onOk: function () {
                deleteMedicine(med);
            }
        });
    }

    async function deleteMedicine(med) {
        var next = state.meds.filter(function (item) { return item.id !== med.id; });
        try {
            await persistMeds(next);
            state.meds = next;
            syncReminders(next);
            state.dirty = false;
            closeEditor();
            showToast('药品已删除');
        } catch (error) {
            console.error(error);
            showToast('删除失败，请重试');
        }
    }

    function findMed(id) {
        for (var i = 0; i < state.meds.length; i++) {
            if (state.meds[i].id === id) {
                return state.meds[i];
            }
        }
        return null;
    }

    // ---------- 查看药品 ----------

    function openDetail(med) {
        state.detailId = med.id;
        dom.detailTitle.textContent = '查看药品';
        dom.detailSubtitle.textContent = '包装照片与药品信息';
        dom.detailScroll.innerHTML = detailHtml(med);
        dom.homeView.hidden = true;
        dom.editorView.hidden = true;
        dom.detailView.hidden = false;
        document.body.classList.add('editor-open');
        dom.detailScroll.scrollTop = 0;
    }

    function closeDetail() {
        dom.detailView.hidden = true;
        dom.homeView.hidden = false;
        document.body.classList.remove('editor-open');
        state.detailId = null;
        dom.detailScroll.innerHTML = '';
        renderAll();
    }

    function detailHtml(med) {
        var status = expiryStatus(med.expiry);
        var name = escapeHtml(med.name);
        var photos = med.photos || [];
        var notes = (med.notes || '').trim();

        var photoHtml = photos.map(function (photo, index) {
            var label = escapeHtml(photo.label || '照片');
            return '<button type="button" class="detail-photo" data-view-photo="' + index + '" aria-label="查看' + name + label + '照片">' +
                '<img src="' + escapeHtml(photo.dataUrl) + '" alt="' + name + label + '照片" loading="lazy">' +
                '<span class="detail-photo-label">' + label + '</span>' +
                '</button>';
        }).join('');

        var storageHtml = med.storagePhoto
            ? '<button type="button" class="detail-storage-photo" data-view-storage aria-label="查看存放位置照片">' +
                '<img src="' + escapeHtml(med.storagePhoto) + '" alt="药品存放位置照片" loading="lazy">' +
                '<span class="detail-photo-label">存放位置</span>' +
                '</button>'
            : '<p class="detail-empty">未拍摄存放位置照片</p>';

        return '<div class="detail-body">' +
            '<div class="detail-hero ' + status.key + '">' +
                '<h2 class="detail-name">' + name + '</h2>' +
                '<span class="status-badge ' + status.key + '">' + escapeHtml(status.badge) + '</span>' +
            '</div>' +
            '<div class="detail-info">' +
                '<div class="meta-row">' +
                    '<div class="meta-item">' + ICON_LOCATION + '<span><strong>存放位置：</strong>' + escapeHtml(med.location) + '</span></div>' +
                    '<div class="meta-item">' + ICON_CALENDAR + '<span><strong>有效期至：</strong>' + formatDate(med.expiry) + '</span></div>' +
                '</div>' +
            '</div>' +
            (photos.length
                ? '<section class="detail-section"><h3>包装照片（' + photos.length + ' 张）</h3><div class="detail-photo-grid">' + photoHtml + '</div></section>'
                : '<section class="detail-section"><h3>包装照片</h3><p class="detail-empty">暂无包装照片</p></section>') +
            '<section class="detail-section"><h3>存放位置照片</h3>' + storageHtml + '</section>' +
            '<section class="detail-section"><h3>包装上的说明</h3>' +
                (notes ? '<p class="detail-note">' + escapeHtml(notes) + '</p>' : '<p class="detail-empty">未填写</p>') +
            '</section>' +
            '</div>';
    }

    function onDetailClick(event) {
        var photoButton = event.target.closest('[data-view-photo]');
        if (photoButton) {
            var med = findMed(state.detailId);
            if (!med) {
                return;
            }
            var index = Number(photoButton.dataset.viewPhoto);
            var photo = (med.photos || [])[index];
            if (photo) {
                openPhotoViewer(photo.dataUrl, med.name + ' · ' + (photo.label || '照片'));
            }
            return;
        }

        var storageButton = event.target.closest('[data-view-storage]');
        if (storageButton) {
            var storageMed = findMed(state.detailId);
            if (storageMed && storageMed.storagePhoto) {
                openPhotoViewer(storageMed.storagePhoto, storageMed.name + ' · 存放位置');
            }
        }
    }

    // ---------- 语音 ----------

    function speakMedicine(med) {
        var status = expiryStatus(med.expiry);
        var message;
        var toastText;
        if (status.key === 'expired') {
            message = '药品已过期，请勿食用';
            toastText = '已语音提醒：药品已过期，请勿食用';
        } else {
            message = '药品名称：' + med.name
                + '。存放位置：' + med.location
                + '。有效期至：' + formatDate(med.expiry);
            toastText = '已播报药品信息';
        }
        speakText(message, toastText);
    }

    function speakText(message, toastText) {
        if (isNative && typeof android.speak === 'function') {
            try {
                android.speak(message);
                showToast(toastText);
                return;
            } catch (error) {
                console.warn(error);
            }
        }

        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
                var utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'zh-CN';
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
                showToast(toastText);
            } catch (error) {
                showToast('当前手机无法播放语音');
            }
        } else {
            showToast('当前手机无法播放语音');
        }
    }

    // ---------- 紧急呼叫 ----------

    function loadEmergencyNumber() {
        if (isNative && typeof android.getSetting === 'function') {
            try {
                var value = android.getSetting(EMERGENCY_SETTING_KEY);
                if (value) {
                    state.emergencyNumber = value;
                }
            } catch (error) {
                console.warn(error);
            }
        } else {
            try {
                var saved = window.localStorage.getItem(LS_EMERGENCY_KEY);
                if (saved) {
                    state.emergencyNumber = saved;
                }
            } catch (error) {
                console.warn(error);
            }
        }
    }

    function saveEmergencyNumber(value) {
        state.emergencyNumber = value;
        if (isNative && typeof android.setSetting === 'function') {
            try {
                android.setSetting(EMERGENCY_SETTING_KEY, value);
            } catch (error) {
                console.warn(error);
            }
        }
        try {
            window.localStorage.setItem(LS_EMERGENCY_KEY, value);
        } catch (error) {
            console.warn(error);
        }
    }

    function openEmergencyModal() {
        loadEmergencyNumber();
        dom.emergencyNumber.value = state.emergencyNumber;
        dom.emergencyModal.hidden = false;
        document.body.classList.add('modal-open');
        window.setTimeout(function () {
            dom.emergencyNumber.focus();
            dom.emergencyNumber.select();
        }, 50);
    }

    function closeEmergencyModal() {
        dom.emergencyModal.hidden = true;
        if (dom.confirmModal.hidden && dom.photoViewer.hidden) {
            document.body.classList.remove('modal-open');
        }
    }

    function callEmergencyNumber() {
        var number = dom.emergencyNumber.value.trim();
        if (!number) {
            showToast('请输入紧急电话号码');
            dom.emergencyNumber.focus();
            return;
        }
        saveEmergencyNumber(number);
        closeEmergencyModal();

        if (isNative && typeof android.callEmergency === 'function') {
            try {
                android.callEmergency(number);
            } catch (error) {
                console.warn(error);
                showToast('无法拨打电话');
            }
            return;
        }
        try {
            window.location.href = 'tel:' + encodeURIComponent(number);
        } catch (error) {
            showToast('无法拨打电话');
        }
    }

    // ---------- 联网查询 ----------

    function refreshOnlineState() {
        var online;
        if (isNative && typeof android.isOnline === 'function') {
            try {
                online = !!android.isOnline();
            } catch (error) {
                online = navigator.onLine;
            }
        } else {
            online = navigator.onLine;
        }
        state.online = online;

        dom.onlineHint.hidden = false;
        dom.onlineHint.classList.toggle('online', !!online);
        dom.onlineHint.classList.toggle('offline', !online);
        dom.onlineHintText.textContent = online
            ? '已联网，可查询未入库药品的官方信息'
            : '当前离线，联网后可查询未入库药品';

        renderCardsOnly();
    }

    function openOfficialSearch(name) {
        var query = String(name || '').trim();
        if (!query) {
            return;
        }
        if (isNative && typeof android.openOfficialSearch === 'function') {
            try {
                android.openOfficialSearch(query);
            } catch (error) {
                console.warn(error);
            }
            return;
        }
        try {
            var url = 'https://www.nmpa.gov.cn/datasearch/search-result.html?searchkey=' + encodeURIComponent(query);
            window.open(url, '_blank');
        } catch (error) {
            showToast('无法打开联网查询页面');
        }
    }

    // ---------- 通知权限 ----------

    function initNotificationBanner() {
        refreshNotificationBanner();
    }

    function refreshNotificationBanner() {
        if (isNative) {
            if (typeof android.areNotificationsAllowed !== 'function') {
                hideNotificationBanner();
                return;
            }
            var allowed = true;
            try {
                allowed = !!android.areNotificationsAllowed();
            } catch (error) {
                console.warn(error);
            }
            dom.notificationBanner.hidden = allowed;
            if (allowed) {
                syncReminders(state.meds);
            }
            return;
        }

        if ('Notification' in window) {
            dom.notificationBanner.hidden = Notification.permission !== 'default';
        } else {
            hideNotificationBanner();
        }
    }

    function hideNotificationBanner() {
        if (dom.notificationBanner) {
            dom.notificationBanner.hidden = true;
        }
    }

    // ---------- 查看器与确认框 ----------

    function openPhotoViewer(src, caption) {
        dom.viewerImage.src = src;
        dom.viewerCaption.textContent = caption || '';
        dom.photoViewer.hidden = false;
        document.body.classList.add('modal-open');
    }

    function closePhotoViewer() {
        dom.photoViewer.hidden = true;
        dom.viewerImage.removeAttribute('src');
        if (dom.confirmModal.hidden && dom.emergencyModal.hidden) {
            document.body.classList.remove('modal-open');
        }
    }

    function showConfirm(options) {
        dom.confirmTitle.textContent = options.title || '确认';
        dom.confirmMessage.textContent = options.message || '';
        dom.confirmOk.textContent = options.okText || '确定';
        dom.confirmCancel.textContent = options.cancelText || '取消';
        state.confirmAction = options.onOk || null;
        dom.confirmModal.hidden = false;
        document.body.classList.add('modal-open');
        window.setTimeout(function () {
            dom.confirmCancel.focus();
        }, 30);
    }

    function closeConfirm() {
        dom.confirmModal.hidden = true;
        state.confirmAction = null;
        if (dom.photoViewer.hidden && dom.emergencyModal.hidden) {
            document.body.classList.remove('modal-open');
        }
    }

    function showToast(message) {
        if (!dom.toast) {
            return;
        }
        dom.toast.textContent = message;
        dom.toast.hidden = false;
        if (state.toastTimer) {
            window.clearTimeout(state.toastTimer);
        }
        state.toastTimer = window.setTimeout(function () {
            dom.toast.hidden = true;
        }, 2400);
    }

    // ---------- 工具函数 ----------

    function showError(element) {
        if (element) {
            element.hidden = false;
        }
    }

    function hideError(element) {
        if (element) {
            element.hidden = true;
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[character];
        });
    }

    // ---------- Android 回调 ----------

    window.onNativePhotoResult = function (key, dataUrl, error) {
        resetPhotoLoading(key);
        state.pendingPhotoKey = null;
        if (dataUrl) {
            applyPhoto(key, dataUrl);
            return;
        }
        if (error && error !== 'cancel' && error !== 'cancelled') {
            showToast('照片读取失败，请重试');
        }
    };

    window.onAndroidResume = function () {
        if (!state.initialized) {
            return;
        }
        refreshNotificationBanner();
        refreshOnlineState();
        syncReminders(state.meds);
    };

    window.appHandleBack = function () {
        if (dom.searchInput && (dom.searchInput.value.trim() || document.activeElement === dom.searchInput)) {
            resetFilters();
            dom.searchInput.blur();
            return true;
        }
        if (!dom.photoViewer.hidden) {
            closePhotoViewer();
            return true;
        }
        if (!dom.emergencyModal.hidden) {
            closeEmergencyModal();
            return true;
        }
        if (!dom.confirmModal.hidden) {
            closeConfirm();
            return true;
        }
        if (!dom.detailView.hidden) {
            closeDetail();
            return true;
        }
        if (!dom.editorView.hidden) {
            requestCloseEditor();
            return true;
        }
        return false;
    };

    // ---------- 演示数据 ----------

    function applyDemoView() {
        var view = params.get('view');
        if (view === 'add') {
            openEditor(null);
        } else if (view === 'edit' && state.meds.length > 0) {
            openEditor(state.meds[0]);
        } else if (view === 'detail' && state.meds.length > 0) {
            openDetail(state.meds[0]);
        }
    }

    function demoMeds() {
        var today = new Date();
        return [
            {
                id: 'demo-expired',
                name: '苯磺酸氨氯地平片',
                location: '客厅电视柜第二层',
                expiry: formatInputDate(addDays(today, -8)),
                notes: '包装标注：5mg × 28片，遮光、密封保存。',
                photos: [
                    { label: '正面', dataUrl: demoPhoto('苯磺酸氨氯地平片', '降压药 5mg × 28片', '#B43E3D') },
                    { label: '背面', dataUrl: demoPhoto('苯磺酸氨氯地平片', '包装背面成分与批号信息', '#8C2F2E') },
                    { label: '左侧', dataUrl: demoPhoto('苯磺酸氨氯地平片', '包装左侧说明', '#9E3A39') }
                ],
                storagePhoto: demoPhoto('家庭药品箱', '客厅电视柜第二层', '#3F7D56'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'demo-soon',
                name: '阿托伐他汀钙片',
                location: '卧室床头柜抽屉',
                expiry: formatInputDate(addDays(today, 12)),
                notes: '包装标注：20mg × 14片，遮光、密封保存。',
                photos: [
                    { label: '正面', dataUrl: demoPhoto('阿托伐他汀钙片', '降脂药 20mg × 14片', '#2C6B96') },
                    { label: '背面', dataUrl: demoPhoto('阿托伐他汀钙片', '包装背面批号与储藏说明', '#235474') }
                ],
                storagePhoto: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'demo-normal',
                name: '盐酸二甲双胍片',
                location: '厨房餐边柜上层',
                expiry: formatInputDate(addDays(today, 160)),
                notes: '包装标注：0.5g × 20片，密封、在阴凉干燥处保存。',
                photos: [
                    { label: '正面', dataUrl: demoPhoto('盐酸二甲双胍片', '降糖药 0.5g × 20片', '#3F7D56') },
                    { label: '背面', dataUrl: demoPhoto('盐酸二甲双胍片', '包装背面批号与储藏说明', '#306343') }
                ],
                storagePhoto: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    }

    function addDays(date, days) {
        var copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        copy.setDate(copy.getDate() + days);
        return copy;
    }

    function demoPhoto(title, subtitle, color) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="570" viewBox="0 0 760 570">' +
            '<rect width="760" height="570" fill="#E9EFEA"/>' +
            '<rect x="92" y="70" width="576" height="430" rx="12" fill="#FFFFFF" stroke="#D4DFD7"/>' +
            '<rect x="92" y="70" width="576" height="108" rx="12" fill="' + color + '"/>' +
            '<rect x="92" y="148" width="576" height="30" fill="' + color + '"/>' +
            '<text x="122" y="138" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">' + escapeXml(title) + '</text>' +
            '<text x="122" y="232" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="23" fill="#39483E">' + escapeXml(subtitle) + '</text>' +
            '<line x1="122" y1="264" x2="638" y2="264" stroke="#E2EAE4" stroke-width="2"/>' +
            '<text x="122" y="318" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="20" fill="#718177">包装照片</text>' +
            '<text x="122" y="354" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="20" fill="#718177">请以实际包装信息为准</text>' +
            '</svg>';
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function escapeXml(value) {
        return String(value == null ? '' : value).replace(/[<>&"']/g, function (character) {
            return {
                '<': '&lt;',
                '>': '&gt;',
                '&': '&amp;',
                '"': '&quot;',
                "'": '&apos;'
            }[character];
        });
    }
})();
