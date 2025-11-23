/**
 * 書籍列表管理模組
 * 使用 Module Pattern 組織程式碼
 *
 * 這個檔案將原本內嵌在 HTML 中的 JavaScript 拆分出來
 * 使用 IIFE (立即執行函數) 建立私有作用域，避免污染全域命名空間
 */
const BookListApp = (function () {
  "use strict";

  // ==========================================
  // 私有常數
  // ==========================================

  const MODAL_IDS = {
    CREATE: "createBookModal",
    EDIT: "editBookModal",
    DELETE: "deleteBookModal",
    DETAIL: "detailBookModal",
  };

  const VIEW_MODES = {
    CARD: "card",
    LIST: "list",
  };

  const STORAGE_KEYS = {
    VIEW_MODE: "viewMode",
  };

  // 價格分類標準
  const PRICE_CATEGORIES = {
    HIGH: { threshold: 500, label: "高價書籍", className: "purple" },
    MEDIUM: { threshold: 300, label: "中價書籍", className: "blue" },
    LOW: { threshold: 0, label: "平價書籍", className: "green" },
  };

  // API 端點
  const API_ENDPOINTS = {
    BOOK_LIST: "/library/api/books/",
    ADD_TO_READING_LIST: "/library/api/reading-list/add/",
    REMOVE_FROM_READING_LIST: "/library/api/reading-list/remove/",
  };

  // ==========================================
  // WebSocket 設定
  // ==========================================
  // 根據目前頁面協定自動選擇 ws 或 wss
  // http:// → ws://（本地開發）
  // https:// → wss://（正式環境）
  const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  const WS_CONFIG = {
    URL: `${WS_PROTOCOL}//${window.location.host}/ws/books/`,
    // 斷線後重新連線的間隔（毫秒）
    RECONNECT_INTERVAL: 3000,
  };

  // ==========================================
  // 私有變數
  // ==========================================

  let currentViewMode = VIEW_MODES.CARD;
  let isInitialized = false;
  let booksData = [];
  let userFavoriteBookIds = [];
  let isAuthenticated = false;
  // WebSocket 相關變數
  let websocket = null;
  let wsReconnectTimer = null;

  // ==========================================
  // 私有方法 - 狀態管理
  // ==========================================

  function showState(stateId) {
    const states = ["loadingState", "errorState", "emptyState", "cardView", "listView"];
    states.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("hidden");
      }
    });

    const targetState = document.getElementById(stateId);
    if (targetState) {
      targetState.classList.remove("hidden");
    }
  }

  function showDataView() {
    const loadingState = document.getElementById("loadingState");
    const errorState = document.getElementById("errorState");
    const emptyState = document.getElementById("emptyState");

    if (loadingState) loadingState.classList.add("hidden");
    if (errorState) errorState.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    // 根據當前視圖模式顯示對應的視圖
    const cardView = document.getElementById("cardView");
    const listView = document.getElementById("listView");

    if (currentViewMode === VIEW_MODES.CARD) {
      if (cardView) cardView.classList.remove("hidden");
      if (listView) listView.classList.add("hidden");
    } else {
      if (cardView) cardView.classList.add("hidden");
      if (listView) listView.classList.remove("hidden");
    }
  }

  // ==========================================
  // 私有方法 - Modal 管理
  // ==========================================

  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`[BookListApp] Modal not found: ${modalId}`);
      return;
    }
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  }

  function hideAllModals() {
    Object.values(MODAL_IDS).forEach((modalId) => hideModal(modalId));
  }

  // ==========================================
  // 私有方法 - 表單處理
  // ==========================================

  function updateFormField(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) {
      console.warn(`[BookListApp] Form field not found: ${fieldId}`);
      return;
    }
    field.value = value;
  }

  function updateFormAction(formId, actionUrl) {
    const form = document.getElementById(formId);
    if (!form) {
      console.warn(`[BookListApp] Form not found: ${formId}`);
      return;
    }
    form.action = actionUrl;
  }

  function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`[BookListApp] Element not found: ${elementId}`);
      return;
    }
    element.textContent = text;
  }

  // ==========================================
  // 私有方法 - 視圖管理
  // ==========================================

  function toggleElementVisibility(elementId, visible) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.classList.toggle("hidden", !visible);
  }

  function toggleButtonActive(buttonId, active) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.classList.toggle("active", active);
  }

  function saveViewModePreference(mode) {
    try {
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
    } catch (error) {
      console.warn("[BookListApp] Failed to save view mode:", error);
    }
  }

  function loadViewModePreference() {
    try {
      return localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || VIEW_MODES.CARD;
    } catch (error) {
      console.warn("[BookListApp] Failed to load view mode:", error);
      return VIEW_MODES.CARD;
    }
  }

  // ==========================================
  // 私有方法 - 書籍資訊處理
  // ==========================================

  function getCategoryByPrice(price) {
    if (price > PRICE_CATEGORIES.HIGH.threshold) {
      return PRICE_CATEGORIES.HIGH;
    } else if (price > PRICE_CATEGORIES.MEDIUM.threshold) {
      return PRICE_CATEGORIES.MEDIUM;
    } else {
      return PRICE_CATEGORIES.LOW;
    }
  }

  function generateCategoryBadge(category) {
    return `<span class="inline-block px-4 py-1 bg-${category.className}-100 text-${category.className}-800 text-sm font-semibold rounded-full">${category.label}</span>`;
  }

  function updateStockCardStyle(stock) {
    const stockCard = document.getElementById("detail_stock_card");
    const stockLabel = document.getElementById("detail_stock_label");
    const stockValue = document.getElementById("detail_book_stock");
    const stockStatus = document.getElementById("detail_stock_status");

    if (!stockCard || !stockLabel || !stockValue || !stockStatus) return;

    const hasStock = stock > 0;
    const colorClass = hasStock ? "blue" : "red";

    stockCard.className = `bg-${colorClass}-50 border-${colorClass}-200 rounded-xl p-4 border-2`;
    stockLabel.className = `text-sm font-medium text-${colorClass}-800`;
    stockValue.className = `text-2xl font-bold text-${colorClass}-700`;
    stockValue.textContent = `${stock} 本`;
    stockStatus.className = `text-sm text-${colorClass}-600 mt-1`;
    stockStatus.textContent = hasStock ? "有庫存" : "已售完";
  }

  // ==========================================
  // 私有方法 - 渲染書籍
  // ==========================================

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function renderCardView(books) {
    const container = document.getElementById("cardView");
    if (!container) return;

    if (books.length === 0) {
      container.innerHTML = "";
      return;
    }

    const html = books
      .map((book) => {
        const category = getCategoryByPrice(book.price);
        const isFavorite = userFavoriteBookIds.includes(book.id);
        const publisherName = book.publisher ? escapeHtml(book.publisher.name) : "";
        const publisherId = book.publisher ? book.publisher.id : "";

        // 收藏按鈕
        let favoriteButton = "";
        if (isAuthenticated) {
          if (isFavorite) {
            favoriteButton = `
              <button
                onclick="BookListApp.removeFromReadingList(${book.id}, this)"
                data-book-id="${book.id}"
                class="btn-remove-favorite flex-1 text-center px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg transition"
              >
                已收藏
              </button>
            `;
          } else {
            favoriteButton = `
              <button
                onclick="BookListApp.addToReadingList(${book.id}, this)"
                data-book-id="${book.id}"
                class="btn-add-favorite flex-1 text-center px-4 py-2 border-2 border-pink-500 text-pink-500 hover:bg-pink-50 text-sm font-medium rounded-lg transition"
              >
                加入最愛
              </button>
            `;
          }
        } else {
          favoriteButton = `
            <button
              onclick="window.location.href='/accounts/login/'"
              class="flex-1 text-center px-4 py-2 border-2 border-gray-400 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition"
            >
              登入以收藏
            </button>
          `;
        }

        return `
          <div class="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div class="p-6">
              <h2 class="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                ${escapeHtml(book.title)}
              </h2>

              <div class="space-y-2 mb-4">
                <div class="flex items-center text-gray-700">
                  <svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span class="font-semibold">NT$ ${book.price}</span>
                </div>

                <div class="flex items-center">
                  <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                  ${
                    book.stock > 0
                      ? `<span class="text-green-600 font-medium">庫存：${book.stock} 本</span>`
                      : `<span class="text-red-600 font-medium">已售完</span>`
                  }
                </div>

                ${
                  book.publisher
                    ? `
                  <div class="flex items-center text-gray-600">
                    <svg class="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                    <span class="text-sm">${publisherName}</span>
                  </div>
                `
                    : ""
                }
              </div>

              <span class="inline-block px-3 py-1 bg-${category.className}-100 text-${category.className}-800 text-xs font-semibold rounded-full mb-4">
                ${category.label}
              </span>
            </div>

            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-2">
              <button onclick="BookListApp.openDetailModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}', ${book.price}, ${book.stock}, '${publisherName.replace(/'/g, "\\'")}')" class="flex-1 text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
                查看
              </button>

              <button onclick="BookListApp.openEditModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}', ${book.price}, ${book.stock}, ${publisherId})" class="flex-1 text-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition">
                編輯
              </button>

              <button onclick="BookListApp.openDeleteModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')" class="flex-1 text-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition">
                刪除
              </button>

              ${favoriteButton}
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = html;
  }

  function renderListView(books) {
    const tbody = document.getElementById("listViewBody");
    if (!tbody) return;

    if (books.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-12 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">目前沒有書籍</h3>
            <p class="text-gray-600">開始新增您的第一本書籍吧！</p>
          </td>
        </tr>
      `;
      return;
    }

    const html = books
      .map((book) => {
        const category = getCategoryByPrice(book.price);
        const isFavorite = userFavoriteBookIds.includes(book.id);
        const publisherName = book.publisher ? escapeHtml(book.publisher.name) : "";
        const publisherId = book.publisher ? book.publisher.id : "";

        // 收藏按鈕
        let favoriteButton = "";
        if (isAuthenticated) {
          if (isFavorite) {
            favoriteButton = `
              <button
                onclick="BookListApp.removeFromReadingList(${book.id}, this)"
                data-book-id="${book.id}"
                class="btn-remove-favorite inline-flex items-center px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium rounded-md transition"
                title="已收藏"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
                </svg>
              </button>
            `;
          } else {
            favoriteButton = `
              <button
                onclick="BookListApp.addToReadingList(${book.id}, this)"
                data-book-id="${book.id}"
                class="btn-add-favorite inline-flex items-center px-3 py-1.5 border-2 border-pink-500 text-pink-500 hover:bg-pink-50 text-xs font-medium rounded-md transition"
                title="加入最愛"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </button>
            `;
          }
        } else {
          favoriteButton = `
            <button
              onclick="window.location.href='/accounts/login/'"
              class="inline-flex items-center px-3 py-1.5 border-2 border-gray-400 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-md transition"
              title="登入以收藏"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </button>
          `;
        }

        return `
          <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <span class="text-sm font-semibold text-gray-900">${escapeHtml(book.title)}</span>
              </div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center text-sm text-gray-700">
                <svg class="w-4 h-4 text-green-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="font-medium">NT$ ${book.price}</span>
              </div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              ${
                book.stock > 0
                  ? `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                  ${book.stock} 本
                </span>
              `
                  : `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                  <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                  </svg>
                  已售完
                </span>
              `
              }
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              ${book.publisher ? `<span class="text-sm text-gray-700">${publisherName}</span>` : `<span class="text-sm text-gray-400">未設定</span>`}
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${category.className}-100 text-${category.className}-800">
                ${category.label}
              </span>
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="flex items-center justify-center gap-2">
                <button onclick="BookListApp.openDetailModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}', ${book.price}, ${book.stock}, '${publisherName.replace(/'/g, "\\'")}')"
                   class="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition"
                   title="查看詳細">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                <button onclick="BookListApp.openEditModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}', ${book.price}, ${book.stock}, ${publisherId})"
                   class="inline-flex items-center px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-md transition"
                   title="編輯">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button onclick="BookListApp.openDeleteModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')"
                   class="inline-flex items-center px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md transition"
                   title="刪除">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
                ${favoriteButton}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = html;
  }

  function renderBooks() {
    if (booksData.length === 0) {
      showState("emptyState");
      return;
    }

    renderCardView(booksData);
    renderListView(booksData);
    showDataView();
  }

  // ==========================================
  // 私有方法 - 事件監聽器設定
  // ==========================================

  function setupModalBackgroundClose() {
    Object.values(MODAL_IDS).forEach((modalId) => {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      modal.addEventListener("click", function (e) {
        if (e.target === this) {
          hideModal(modalId);
        }
      });
    });
  }

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        hideAllModals();
      }
    });
  }

  // ==========================================
  // 私有方法 - WebSocket
  // ==========================================

  /**
   * 初始化 WebSocket 連線
   */
  function initWebSocket() {
    // 如果已有連線，先關閉
    if (websocket) {
      websocket.close();
    }

    console.log("[WebSocket] 正在連線...", WS_CONFIG.URL);
    websocket = new WebSocket(WS_CONFIG.URL);

    // 連線成功
    websocket.onopen = function (e) {
      console.log("[WebSocket] 連線成功！");

      // 清除重連計時器
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
    };

    // 收到訊息
    websocket.onmessage = function (e) {
      const data = JSON.parse(e.data);
      console.log("[WebSocket] 收到訊息:", data);

      // 處理書籍更新通知
      if (data.type === "book_update") {
        handleBookUpdate(data);
      }
    };

    // 連線關閉
    websocket.onclose = function (e) {
      console.log("[WebSocket] 連線已關閉，將在 3 秒後重新連線...");

      // 設定自動重連
      wsReconnectTimer = setTimeout(function () {
        console.log("[WebSocket] 嘗試重新連線...");
        initWebSocket();
      }, WS_CONFIG.RECONNECT_INTERVAL);
    };

    // 連線錯誤
    websocket.onerror = function (e) {
      console.error("[WebSocket] 發生錯誤:", e);
    };
  }

  /**
   * 處理書籍更新通知
   * @param {Object} data - 包含 action 和 message
   */
  function handleBookUpdate(data) {
    // 1. 顯示通知
    showUpdateNotification(data.message, data.action);

    // 2. 延遲後重新載入資料（讓使用者先看到通知）
    setTimeout(() => {
      showState("loadingState");

      sendRequest({
        url: API_ENDPOINTS.BOOK_LIST,
        method: "GET",
        onSuccess: (response) => {
          if (response.success) {
            booksData = response.data.books;
            userFavoriteBookIds = response.data.user_favorite_book_ids;
            isAuthenticated = response.data.is_authenticated;
            renderBooks();
            console.log("[WebSocket] 資料已重新載入");
          }
        },
        onError: (error) => {
          console.error("[WebSocket] 重新載入失敗:", error);
          showState("errorState");
        },
      });
    }, 500);
  }

  /**
   * 顯示更新通知
   * @param {string} message - 通知訊息
   * @param {string} action - 動作類型 (create/update/delete)
   */
  function showUpdateNotification(message, action) {
    // 根據動作類型選擇顏色
    const colors = {
      create: "bg-green-500",
      update: "bg-blue-500",
      delete: "bg-red-500",
    };
    const bgColor = colors[action] || "bg-gray-500";

    // 建立通知元素
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    notification.style.animation = "fadeIn 0.3s ease-in-out";
    notification.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // 3 秒後淡出移除
    setTimeout(() => {
      notification.style.animation = "fadeOut 0.3s ease-in-out";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }


  // ==========================================
  // 公開 API
  // ==========================================

  return {
    /**
     * 初始化應用
     */
    init() {
      if (isInitialized) {
        console.warn("[BookListApp] Already initialized");
        return;
      }

      console.log("[BookListApp] Initializing...");

      // 1. 載入並恢復視圖模式
      currentViewMode = loadViewModePreference();

      // 2. 設定事件監聯器
      setupModalBackgroundClose();
      setupKeyboardShortcuts();

      // 3. 更新視圖切換按鈕狀態
      toggleButtonActive("cardViewBtn", currentViewMode === VIEW_MODES.CARD);
      toggleButtonActive("listViewBtn", currentViewMode === VIEW_MODES.LIST);

      // 4. 載入書籍資料
      this.fetchBooks();

      // 5. 初始化 WebSocket 連線
      initWebSocket();

      isInitialized = true;
      console.log("[BookListApp] Initialized successfully");
    },

    /**
     * 從 API 載入書籍資料
     */
    fetchBooks() {
      showState("loadingState");

      sendRequest({
        url: API_ENDPOINTS.BOOK_LIST,
        method: "GET",
        onSuccess: (response) => {
          if (response.success) {
            booksData = response.data.books;
            userFavoriteBookIds = response.data.user_favorite_book_ids;
            isAuthenticated = response.data.is_authenticated;

            console.log(`[BookListApp] Loaded ${booksData.length} books`);
            renderBooks();
          } else {
            showState("errorState");
          }
        },
        onError: (error) => {
          console.error("[BookListApp] Failed to fetch books:", error);
          const errorMessage = document.getElementById("errorMessage");
          if (errorMessage) {
            errorMessage.textContent = error.message || "無法取得書籍資料，請稍後再試";
          }
          showState("errorState");
        },
      });
    },

    // ==========================================
    // 新增書籍 Modal
    // ==========================================

    openCreateModal() {
      showModal(MODAL_IDS.CREATE);
    },

    closeCreateModal() {
      hideModal(MODAL_IDS.CREATE);
    },

    // ==========================================
    // 編輯書籍 Modal
    // ==========================================

    openEditModal(bookId, title, price, stock, publisherId) {
      updateFormAction("editBookForm", `/library/book_edit/${bookId}/`);
      updateFormField("edit_title", title);
      updateFormField("edit_price", price);
      updateFormField("edit_stock", stock);
      updateFormField("edit_publisher", publisherId);
      showModal(MODAL_IDS.EDIT);
    },

    closeEditModal() {
      hideModal(MODAL_IDS.EDIT);
    },

    // ==========================================
    // 刪除書籍 Modal
    // ==========================================

    openDeleteModal(bookId, title) {
      updateFormAction("deleteBookForm", `/library/book_delete/${bookId}/`);
      updateElementText("delete_book_title", title);
      showModal(MODAL_IDS.DELETE);
    },

    closeDeleteModal() {
      hideModal(MODAL_IDS.DELETE);
    },

    // ==========================================
    // 書籍詳細資訊 Modal
    // ==========================================

    openDetailModal(bookId, title, price, stock, publisherName) {
      updateElementText("detail_book_title", title);
      updateElementText("detail_book_price", `NT$ ${price}`);
      updateStockCardStyle(stock);

      const category = getCategoryByPrice(price);
      const categoryElement = document.getElementById("detail_book_category");
      if (categoryElement) {
        categoryElement.innerHTML = generateCategoryBadge(category);
      }

      updateElementText("detail_book_publisher", publisherName || "未設定");
      showModal(MODAL_IDS.DETAIL);
    },

    closeDetailModal() {
      hideModal(MODAL_IDS.DETAIL);
    },

    // ==========================================
    // 視圖切換
    // ==========================================

    switchView(mode) {
      if (mode !== VIEW_MODES.CARD && mode !== VIEW_MODES.LIST) {
        console.warn(`[BookListApp] Invalid view mode: ${mode}`);
        return;
      }

      currentViewMode = mode;
      saveViewModePreference(mode);

      toggleButtonActive("cardViewBtn", mode === VIEW_MODES.CARD);
      toggleButtonActive("listViewBtn", mode === VIEW_MODES.LIST);

      // 如果有資料，重新渲染
      if (booksData.length > 0) {
        showDataView();
      }
    },

    switchToCardView() {
      this.switchView(VIEW_MODES.CARD);
    },

    switchToListView() {
      this.switchView(VIEW_MODES.LIST);
    },

    // ==========================================
    // 工具方法
    // ==========================================

    getCurrentViewMode() {
      return currentViewMode;
    },

    isInitialized() {
      return isInitialized;
    },

    // ==========================================
    // 閱讀清單 AJAX 功能（加入/移除最愛）
    // ==========================================

    /**
     * 加入最愛函數
     * @param {number} bookId - 書籍 ID
     * @param {HTMLElement} buttonElement - 按鈕元素
     */
    addToReadingList(bookId, buttonElement) {
      const self = this;

      // 儲存原本的內容
      const originalHTML = buttonElement.innerHTML;
      const originalClass = buttonElement.className;

      // 設定 Loading 狀態
      buttonElement.disabled = true;
      buttonElement.innerHTML = "處理中...";
      buttonElement.className =
        buttonElement.className.replace(/bg-\S+|border-\S+|text-\S+/g, "") +
        " bg-gray-300 text-gray-600 cursor-not-allowed";

      sendRequest({
        url: `${API_ENDPOINTS.ADD_TO_READING_LIST}${bookId}/`,
        method: "POST",
        onSuccess: (data) => {
          alert(data.message);

          // 更新本地資料
          if (!userFavoriteBookIds.includes(bookId)) {
            userFavoriteBookIds.push(bookId);
          }

          // 更新按鈕為「已收藏」狀態
          if (originalClass.includes("flex-1")) {
            buttonElement.innerHTML = "已收藏";
            buttonElement.className =
              "btn-remove-favorite flex-1 text-center px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg transition";
          } else {
            buttonElement.className =
              "btn-remove-favorite inline-flex items-center px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium rounded-md transition";
            buttonElement.title = "已收藏";
            buttonElement.innerHTML =
              '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>';
          }
          buttonElement.disabled = false;

          buttonElement.onclick = function () {
            self.removeFromReadingList(bookId, this);
          };
        },
        onError: (error) => {
          alert(error.message || "加入失敗，請稍後再試");

          buttonElement.innerHTML = originalHTML;
          buttonElement.className = originalClass;
          buttonElement.disabled = false;
        },
      });
    },

    /**
     * 移除最愛函數
     * @param {number} bookId - 書籍 ID
     * @param {HTMLElement} buttonElement - 按鈕元素
     */
    removeFromReadingList(bookId, buttonElement) {
      const self = this;

      if (!confirm("確定要從最愛移除嗎？")) {
        return;
      }

      // 儲存原本的內容
      const originalHTML = buttonElement.innerHTML;
      const originalClass = buttonElement.className;

      // 設定 Loading 狀態
      buttonElement.disabled = true;
      buttonElement.innerHTML = "處理中...";
      buttonElement.className =
        buttonElement.className.replace(/bg-\S+|border-\S+|text-\S+/g, "") +
        " bg-gray-300 text-gray-600 cursor-not-allowed";

      sendRequest({
        url: `${API_ENDPOINTS.REMOVE_FROM_READING_LIST}${bookId}/`,
        method: "POST",
        onSuccess: (data) => {
          alert(data.message);

          // 更新本地資料
          const index = userFavoriteBookIds.indexOf(bookId);
          if (index > -1) {
            userFavoriteBookIds.splice(index, 1);
          }

          // 更新按鈕為「加入最愛」狀態
          if (originalClass.includes("flex-1")) {
            buttonElement.innerHTML = "加入最愛";
            buttonElement.className =
              "btn-add-favorite flex-1 text-center px-4 py-2 border-2 border-pink-500 text-pink-500 hover:bg-pink-50 text-sm font-medium rounded-lg transition";
          } else {
            buttonElement.className =
              "btn-add-favorite inline-flex items-center px-3 py-1.5 border-2 border-pink-500 text-pink-500 hover:bg-pink-50 text-xs font-medium rounded-md transition";
            buttonElement.title = "加入最愛";
            buttonElement.innerHTML =
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>';
          }
          buttonElement.disabled = false;

          buttonElement.onclick = function () {
            self.addToReadingList(bookId, this);
          };
        },
        onError: (error) => {
          alert(error.message || "移除失敗，請稍後再試");

          buttonElement.innerHTML = originalHTML;
          buttonElement.className = originalClass;
          buttonElement.disabled = false;
        },
      });
    },
  };
})();

// ==========================================
// 自動初始化
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  BookListApp.init();
});
