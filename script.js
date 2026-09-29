/* ==========================================================================
   Body Scent — script.js
   ไฟล์เดียวใช้ร่วมทุกหน้า ตรวจจาก element ที่มีในหน้านั้นแล้วรันเฉพาะส่วนที่เกี่ยวข้อง
   - product.html : #product-list, #filter-bar
   - order.html   : #orderForm, #items, #total
   - admin.html   : #ordersTable
   ========================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "bodyScentOrders";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var MOOD_LABELS = {
    fresh: "Fresh",
    sweet: "Sweet",
    confident: "Confident",
    romance: "Romance"
  };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(n) {
    return Number(n).toLocaleString("th-TH");
  }

  function setFieldValue(el, value) {
    if (!el) return;
    if ("value" in el) {
      el.value = value;
    } else {
      el.textContent = value;
    }
  }

  function readOrders() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Cannot read orders:", err);
      return [];
    }
  }

  /* ------------------------------------------------------------------------
     product.html
     ------------------------------------------------------------------------ */
  function initProductPage(listEl, filterBar) {
    var products = [];
    var currentMood = "all";

    function getMoodFromUrl() {
      var mood = new URLSearchParams(window.location.search).get("mood");
      mood = mood ? mood.toLowerCase() : "all";
      return MOODS.some(function (m) { return m.key === mood; }) ? mood : "all";
    }

    function buildOrderUrl(p) {
      var itemName = p.name + (p.size ? " " + p.size : "");
      var params = new URLSearchParams({ item: itemName, price: p.price });
      return "order.html?" + params.toString();
    }

    function cardHtml(p) {
      var moodLabel = MOOD_LABELS[p.mood] || p.mood;
      var sizeTag = p.size
        ? '<span class="size-tag">' + escapeHtml(p.size) + "</span>"
        : "";

      return (
        '<article class="product-card" data-mood="' + escapeHtml(p.mood) + '">' +
          '<div class="product-card__media">' +
            '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
          "</div>" +
          '<div class="product-card__meta">' +
            '<span class="mood-dot" aria-hidden="true"></span>' + escapeHtml(moodLabel) +
          "</div>" +
          '<h3 class="product-card__title">' + escapeHtml(p.name) + "</h3>" +
          '<p class="product-card__desc">' + escapeHtml(p.description) + "</p>" +
          '<div class="product-card__foot">' +
            '<span class="price">' + formatPrice(p.price) + "<small>บาท</small></span>" +
            sizeTag +
          "</div>" +
          '<a class="btn btn--block" href="' + escapeHtml(buildOrderUrl(p)) + '" style="margin-top:1.5rem">สั่งซื้อ</a>' +
        "</article>"
      );
    }

    function render() {
      var visible = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (!visible.length) {
        listEl.innerHTML = "<p>ยังไม่มีสินค้าในหมวดนี้</p>";
        return;
      }
      listEl.innerHTML = visible.map(cardHtml).join("");
    }

    function updateButtons() {
      filterBar.querySelectorAll("button").forEach(function (btn) {
        var active = btn.dataset.mood === currentMood;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.classList.toggle("is-active", active);
      });
    }

    function setMood(mood, updateUrl) {
      currentMood = mood;
      updateButtons();
      render();

      if (updateUrl && window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (mood === "all") {
          url.searchParams.delete("mood");
        } else {
          url.searchParams.set("mood", mood);
        }
        history.replaceState(null, "", url.toString());
      }
    }

    function buildFilterBar() {
      filterBar.classList.add("filter");
      filterBar.innerHTML = MOODS.map(function (m) {
        return (
          '<button type="button" data-mood="' + m.key + '" aria-pressed="false">' +
          escapeHtml(m.label) + "</button>"
        );
      }).join("");

      filterBar.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-mood]");
        if (btn) setMood(btn.dataset.mood, true);
      });
    }

    buildFilterBar();
    currentMood = getMoodFromUrl();
    updateButtons();
    listEl.innerHTML = "<p>กำลังโหลดสินค้า...</p>";

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        render();
      })
      .catch(function (err) {
        console.error("Cannot load products.json:", err);
        listEl.innerHTML =
          "<p>ไม่สามารถโหลดข้อมูลสินค้าได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p>";
      });
  }

  /* ------------------------------------------------------------------------
     order.html
     ------------------------------------------------------------------------ */
  function initOrderPage(form) {
    var itemsEl = document.getElementById("items");
    var totalEl = document.getElementById("total");
    var params = new URLSearchParams(window.location.search);

    // เติมทั้งสองช่องเสมอ (ถ้าไม่มีพารามิเตอร์จะเติมค่าว่าง)
    setFieldValue(itemsEl, params.get("item") || "");
    setFieldValue(totalEl, params.get("price") || "");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      function val(name) {
        var field = form.elements[name];
        return field ? String(field.value).trim() : "";
      }

      var totalRaw = val("total");
      var totalNum = Number(totalRaw);

      var payload = {
        customerName: val("customerName"),
        contact: val("contact"),
        items: val("items"),
        total: totalRaw !== "" && isFinite(totalNum) ? totalNum : totalRaw,
        note: val("note"),
        timestamp: new Date().toISOString()
      };

      try {
        var orders = readOrders();
        orders.push(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      } catch (err) {
        console.error("Cannot save order:", err);
        alert("ไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      window.location.href = "thankyou.html";
    });
  }

  /* ------------------------------------------------------------------------
     admin.html
     ------------------------------------------------------------------------ */
  function initAdminPage(table) {
    var tbody = table.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      table.appendChild(tbody);
    }

    var orders = readOrders().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    tbody.innerHTML = "";

    if (!orders.length) {
      var colCount = table.querySelectorAll("thead th").length || 6;
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = colCount;
      emptyCell.textContent = "ยังไม่มีคำสั่งซื้อ";
      emptyCell.style.textAlign = "center";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    orders.forEach(function (o) {
      var date = new Date(o.timestamp);
      var dateText = isNaN(date) ? "-" : date.toLocaleString("th-TH");
      var totalText =
        typeof o.total === "number" ? formatPrice(o.total) : o.total || "";

      var cells = [dateText, o.customerName, o.contact, o.items, totalText, o.note];
      var row = document.createElement("tr");

      cells.forEach(function (text) {
        var td = document.createElement("td");
        td.textContent = text == null || text === "" ? "-" : text;
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------------
     Init — ตรวจว่าหน้านี้มี element ไหน แล้วรันเฉพาะส่วนนั้น
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    var productList = document.getElementById("product-list");
    var filterBar = document.getElementById("filter-bar");
    var orderForm = document.getElementById("orderForm");
    var ordersTable = document.getElementById("ordersTable");

    if (productList && filterBar) initProductPage(productList, filterBar);
    if (orderForm) initOrderPage(orderForm);
    if (ordersTable) initAdminPage(ordersTable);
  });
})();
