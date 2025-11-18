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
  
    // 價格分類標準（對應 book_list.html 中的 {% if book.price > 500 %} 邏輯）
    const PRICE_CATEGORIES = {
      HIGH: { threshold: 500, label: "💎 高價書籍", className: "purple" },
      MEDIUM: { threshold: 300, label: "📘 中價書籍", className: "blue" },
      LOW: { threshold: 0, label: "📗 平價書籍", className: "green" },
    };
  
    // ==========================================
    // 私有變數
    // ==========================================
  
    let currentViewMode = VIEW_MODES.CARD;
    let isInitialized = false;
  
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
      stockStatus.textContent = hasStock ? "✓ 有庫存" : "✗ 已售完";
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
        this.switchView(currentViewMode);
  
        // 2. 設定事件監聽器
        setupModalBackgroundClose();
        setupKeyboardShortcuts();
  
        isInitialized = true;
        console.log("[BookListApp] Initialized successfully");
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
  
        const isCardView = mode === VIEW_MODES.CARD;
  
        toggleElementVisibility("cardView", isCardView);
        toggleElementVisibility("listView", !isCardView);
        toggleButtonActive("cardViewBtn", isCardView);
        toggleButtonActive("listViewBtn", !isCardView);
  
        currentViewMode = mode;
        saveViewModePreference(mode);
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
          const self = this; // 保存 module 的 context

          // 儲存原本的內容
          const originalHTML = buttonElement.innerHTML;
          const originalClass = buttonElement.className;

          // 設定 Loading 狀態
          buttonElement.disabled = true;
          buttonElement.innerHTML = "⏳ 處理中...";
          buttonElement.className =
            buttonElement.className.replace(/bg-\S+|border-\S+|text-\S+/g, "") +
            " bg-gray-300 text-gray-600 cursor-not-allowed";

          sendRequest({
            url: `/library/api/reading-list/add/${bookId}/`,
            method: "POST",
            onSuccess: (data) => {
              // 顯示成功訊息
              alert(data.message);

              // 更新按鈕為「已收藏」狀態
              if (originalClass.includes("flex-1")) {
                // 卡片視圖的樣式
                buttonElement.innerHTML = "❤️ 已收藏";
                buttonElement.className =
                  "btn-remove-favorite flex-1 text-center px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg transition";
              } else {
                // 列表視圖的樣式（保留 SVG）
                buttonElement.className =
                  "btn-remove-favorite inline-flex items-center px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium rounded-md transition";
                buttonElement.title = "已收藏";
                buttonElement.innerHTML =
                  '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>';
              }
              buttonElement.disabled = false;

              // 重新綁定事件為「移除」（使用 self 來保留 module context）
              buttonElement.onclick = function () {
                self.removeFromReadingList(bookId, this);
              };
            },
            onError: (error) => {
              // 失敗時的處理
              alert(error.message || "加入失敗，請稍後再試");

              // 恢復按鈕原本狀態
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
          const self = this; // 保存 module 的 context

          // 確認是否要移除
          if (!confirm("確定要從最愛移除嗎？")) {
            return;
          }

          // 儲存原本的內容
          const originalHTML = buttonElement.innerHTML;
          const originalClass = buttonElement.className;

          // 設定 Loading 狀態
          buttonElement.disabled = true;
          buttonElement.innerHTML = "⏳ 處理中...";
          buttonElement.className =
            buttonElement.className.replace(/bg-\S+|border-\S+|text-\S+/g, "") +
            " bg-gray-300 text-gray-600 cursor-not-allowed";

          sendRequest({
            url: `/library/api/reading-list/remove/${bookId}/`,
            method: "POST",
            onSuccess: (data) => {
              // 顯示成功訊息
              alert(data.message);

              // 更新按鈕為「加入最愛」狀態
              if (originalClass.includes("flex-1")) {
                // 卡片視圖的樣式
                buttonElement.innerHTML = "🤍 加入最愛";
                buttonElement.className =
                  "btn-add-favorite flex-1 text-center px-4 py-2 border-2 border-pink-500 text-pink-500 hover:bg-pink-50 text-sm font-medium rounded-lg transition";
              } else {
                // 列表視圖的樣式（保留 SVG）
                buttonElement.className =
                  "btn-add-favorite inline-flex items-center px-3 py-1.5 border-2 border-pink-500 text-pink-500 hover:bg-pink-50 text-xs font-medium rounded-md transition";
                buttonElement.title = "加入最愛";
                buttonElement.innerHTML =
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>';
              }
              buttonElement.disabled = false;

              // 重新綁定事件為「加入」（使用 self 來保留 module context）
              buttonElement.onclick = function () {
                self.addToReadingList(bookId, this);
              };
            },
            onError: (error) => {
              // 失敗時的處理
              alert(error.message || "移除失敗，請稍後再試");

              // 恢復按鈕原本狀態
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
  