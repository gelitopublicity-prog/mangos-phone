(function () {
  "use strict";

  var SPREADSHEET_ID = "1Nix9XwpwIsAqUwqejRn9okqCxjKPGOi2wvUaUeU7qnE";
  var GVIZ_URL = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/gviz/tq?tqx=out:json";
  var WHATSAPP_NUMBER = "584248516883";
  var MAX_FEATURED = 4;

  var productos = [];
  var currentCategory = "Todos";
  var currentSearch = "";
  var cart = [];

  function formatPrice(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return "$0.00";
    return "$" + n.toFixed(2);
  }

  function escapeHtml(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  function esDisponible(valor) {
    if (valor === undefined || valor === null || valor === "") return true;
    if (valor === true) return true;
    if (valor === false) return false;
    var s = String(valor).trim().toLowerCase();
    if (s === "false" || s === "no" || s === "0" || s === "n") return false;
    return true;
  }

  function esProductoDestacado(item) {
    if (!item) return false;
    var val;
    if (item.destacado !== undefined) val = item.destacado;
    else if (item.Destacado !== undefined) val = item.Destacado;
    else if (item.DESTACADO !== undefined) val = item.DESTACADO;
    else return false;
    if (val === true) return true;
    if (val === false || val === null || val === undefined) return false;
    if (typeof val === "string") {
      var v = val.trim().toUpperCase();
      return v === "TRUE" || v === "VERDADERO" || v === "SI" || v === "SÍ" || v === "1" || v === "⭐";
    }
    if (typeof val === "number") return val === 1;
    return false;
  }

  var MODEL_ALIASES = {
    "11": "iPhone 11", "11P": "iPhone 11 Pro", "11PMX": "iPhone 11 Pro Max",
    "12": "iPhone 12", "12P": "iPhone 12 Pro", "12PMX": "iPhone 12 Pro Max",
    "13": "iPhone 13", "13P": "iPhone 13 Pro", "13PMX": "iPhone 13 Pro Max",
    "14": "iPhone 14", "14P": "iPhone 14 Pro", "14PMX": "iPhone 14 Pro Max",
    "15": "iPhone 15", "15P": "iPhone 15 Pro", "15PMX": "iPhone 15 Pro Max",
    "16": "iPhone 16", "16BASE": "iPhone 16", "16P": "iPhone 16 Pro", "16PMX": "iPhone 16 Pro Max",
    "17": "iPhone 17", "17BASE": "iPhone 17", "17P": "iPhone 17 Pro", "17PMX": "iPhone 17 Pro Max"
  };

  var ALL_MODELS = [
    "iPhone 11","iPhone 11 Pro","iPhone 11 Pro Max",
    "iPhone 12","iPhone 12 Pro","iPhone 12 Pro Max",
    "iPhone 13","iPhone 13 Pro","iPhone 13 Pro Max",
    "iPhone 14","iPhone 14 Pro","iPhone 14 Pro Max",
    "iPhone 15","iPhone 15 Pro","iPhone 15 Pro Max",
    "iPhone 16","iPhone 16 Pro","iPhone 16 Pro Max",
    "iPhone 17","iPhone 17 Pro","iPhone 17 Pro Max",
    "Otro / Consultar"
  ];

  function expandModels(raw) {
    if (!raw) return ["Todos los modelos"];
    var txt = String(raw).trim();
    if (/todos|all/i.test(txt)) return ["Todos los modelos"];
    var parts = txt.split(/[\s,\/|]+/).filter(Boolean);
    var result = [];
    parts.forEach(function (p) {
      var key = p.toUpperCase().replace(/\s+/g, "");
      if (MODEL_ALIASES[key]) {
        if (result.indexOf(MODEL_ALIASES[key]) === -1) result.push(MODEL_ALIASES[key]);
      } else if (/^IPHONE/i.test(p)) {
        if (result.indexOf(p) === -1) result.push(p);
      }
    });
    return result.length ? result : ["Todos los modelos"];
  }

  function productCardHtml(p, featured) {
    var imgSrc = p.imagen_url || "https://via.placeholder.com/400x400/ffffff/ff9900?text=Mangos+Phone";
    var modelos = expandModels(p.iphone_compatibles);
    var modelsToRender = modelos.indexOf("Todos los modelos") !== -1 ? ALL_MODELS : modelos;
    var modelOptions = modelsToRender.map(function (m) {
      return '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>';
    }).join("");
    var badge = featured ? '<span class="badge-featured">★ Destacado</span>' : "";
    return '<div class="product-card' + (featured ? ' is-featured' : '') + '">' +
      '<div class="product-image">' +
        '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(p.nombre) + '" loading="lazy" onerror="this.onerror=null; this.src=\'https://via.placeholder.com/400x400/ffffff/ff9900?text=Mangos+Phone\';" />' +
        badge +
        '<span class="product-category">' + escapeHtml(p.categoria) + '</span>' +
      '</div>' +
      '<div class="product-info">' +
        '<h3 class="product-name">' + escapeHtml(p.nombre) + '</h3>' +
        '<div class="product-compat"><i class="fas fa-mobile-screen-button"></i><span>' + escapeHtml(modelos.join(", ")) + '</span></div>' +
        '<div class="product-price">' + formatPrice(p.precio) + '<small>USD</small></div>' +
        '<div class="selectors">' +
          '<select class="model-select">' + modelOptions + '</select>' +
          '<input type="number" class="qty-input" value="1" min="1" max="99">' +
        '</div>' +
        '<button class="btn-add-cart" data-name="' + escapeHtml(p.nombre) + '" data-price="' + p.precio + '">' +
          '<i class="fas fa-cart-plus"></i> Añadir a la cesta' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function cargarProductos() {
    var grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = '<div class="state-msg"><div class="spinner"></div>Cargando productos...</div>';

    fetch(GVIZ_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var start = text.indexOf("{", text.indexOf("setResponse("));
        var end = text.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("Respuesta inválida");
        var data = JSON.parse(text.substring(start, end + 1));
        if (!data.table || !data.table.rows) throw new Error("Sin filas");

        var cols = data.table.cols.map(function (c) { return (c.label || "").trim().toLowerCase(); });

        var idx = {
          id: cols.indexOf("id"),
          nombre: cols.indexOf("nombre"),
          categoria: cols.indexOf("categoria"),
          precio: cols.indexOf("precio"),
          iphone: cols.indexOf("iphone_compatibles"),
          imagen: cols.findIndex(function (c) { return c.indexOf("imagen") === 0; }),
          disponible: cols.indexOf("disponible"),
          destacado: cols.indexOf("destacado")
        };

        productos = [];
        data.table.rows.forEach(function (row, i) {
          try {
            var c = row.c || [];
            var getVal = function (k) {
              if (k < 0 || !c[k]) return "";
              var v = c[k].v;
              return (v === null || v === undefined) ? "" : v;
            };
            var precioRaw = String(getVal(idx.precio)).replace(/[^0-9.,]/g, "").replace(",", ".");
            var precio = parseFloat(precioRaw) || 0;
            var p = {
              id: getVal(idx.id),
              nombre: String(getVal(idx.nombre)).trim(),
              categoria: String(getVal(idx.categoria)).trim() || "Otros",
              precio: precio,
              iphone_compatibles: String(getVal(idx.iphone)).trim() || "Todos los modelos",
              imagen_url: String(getVal(idx.imagen)).trim(),
              disponible: esDisponible(getVal(idx.disponible)),
              destacado: idx.destacado >= 0 ? getVal(idx.destacado) : ""
            };
            if (p.nombre && p.precio > 0 && p.disponible) productos.push(p);
          } catch (e) { console.warn("Fila con error:", i, e); }
        });

        if (productos.length === 0) {
          grid.innerHTML = '<div class="state-msg"><i class="fas fa-box-open"></i><p>No hay productos disponibles.</p></div>';
          return;
        }
        renderDestacados();
        renderCatalogo();
      })
      .catch(function (err) {
        console.error("❌ Error:", err);
        grid.innerHTML = '<div class="state-msg"><i class="fas fa-triangle-exclamation"></i><p>No se pudieron cargar los productos. Recarga la página.</p><p style="font-size:0.8rem;margin-top:0.6rem;opacity:0.7;">' + escapeHtml(err.message) + '</p></div>';
      });
  }

  function renderDestacados() {
    var grid = document.getElementById("featuredGrid");
    var section = document.getElementById("featuredSection");
    if (!grid) return;
    var destacados = productos.filter(esProductoDestacado).slice(0, MAX_FEATURED);
    if (destacados.length === 0) {
      if (section) section.style.display = "none";
      return;
    }
    if (section) section.style.display = "";
    grid.innerHTML = destacados.map(function (p) { return productCardHtml(p, true); }).join("");
  }

  function renderCatalogo() {
    var grid = document.getElementById("productsGrid");
    if (!grid) return;
    var filtered = productos.filter(function (p) {
      var cat = currentCategory.toLowerCase();
      var matchCat = currentCategory === "Todos" || p.categoria.toLowerCase().indexOf(cat) !== -1;
      var matchSearch = currentSearch === "" ||
        p.nombre.toLowerCase().indexOf(currentSearch) !== -1 ||
        p.categoria.toLowerCase().indexOf(currentSearch) !== -1 ||
        p.iphone_compatibles.toLowerCase().indexOf(currentSearch) !== -1;
      return matchCat && matchSearch;
    });
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="state-msg"><i class="fas fa-box-open"></i><p>No hay productos que coincidan.</p></div>';
      return;
    }
    grid.innerHTML = filtered.map(function (p) { return productCardHtml(p, esProductoDestacado(p)); }).join("");
  }

  function addToCart(nombre, precio, modelo, qty) {
    var prod = null;
    for (var i = 0; i < productos.length; i++) {
      if (productos[i].nombre === nombre) { prod = productos[i]; break; }
    }
    var imgUrl = prod ? (prod.imagen_url || "") : "";

    var key = nombre + "__" + modelo;
    var existing = null;
    for (var j = 0; j < cart.length; j++) if (cart[j].key === key) { existing = cart[j]; break; }
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        key: key,
        nombre: nombre,
        precio: precio,
        modelo: modelo,
        qty: qty,
        imagen_url: imgUrl
      });
    }
    updateCartUI();
    openCart();
  }

  function removeFromCart(key) {
    cart = cart.filter(function (i) { return i.key !== key; });
    updateCartUI();
  }

  function changeQty(key, delta) {
    var item = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].key === key) { item = cart[i]; break; }
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) removeFromCart(key); else updateCartUI();
  }

  function getCartTotal() { return cart.reduce(function (s, i) { return s + i.precio * i.qty; }, 0); }
  function getCartCount() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }

  function updateCartUI() {
    var body = document.getElementById("cartBody");
    var totalEl = document.getElementById("cartTotal");
    var countEl = document.getElementById("cartCount");
    var checkoutBtn = document.getElementById("checkoutBtn");
    if (!body || !totalEl || !countEl || !checkoutBtn) return;

    countEl.textContent = getCartCount();
    totalEl.textContent = formatPrice(getCartTotal());

    if (cart.length === 0) {
      body.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-basket"></i>Tu carrito está vacío.<br>¡Agrega tus accesorios favoritos!</div>';
      checkoutBtn.disabled = true;
      return;
    }

    body.innerHTML = cart.map(function (item) {
      var imgSrc = item.imagen_url || "https://via.placeholder.com/200x200/ffffff/ff9900?text=MP";
      return '<div class="cart-item">' +
        '<div class="cart-item-img">' +
          '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(item.nombre) + '" ' +
            'onerror="this.onerror=null; this.src=\'https://via.placeholder.com/200x200/ffffff/ff9900?text=MP\';" />' +
        '</div>' +
        '<div class="cart-item-info">' +
          '<h4>' + escapeHtml(item.nombre) + '</h4>' +
          '<div class="meta"><i class="fas fa-mobile-screen-button"></i> ' + escapeHtml(item.modelo) + '</div>' +
          '<div class="price-line">' +
            '<div class="qty-controls">' +
              '<button data-action="dec" data-key="' + escapeHtml(item.key) + '">−</button>' +
              '<span>' + item.qty + '</span>' +
              '<button data-action="inc" data-key="' + escapeHtml(item.key) + '">+</button>' +
            '</div>' +
            '<strong>' + formatPrice(item.precio * item.qty) + '</strong>' +
          '</div>' +
          '<button class="cart-remove" data-action="remove" data-key="' + escapeHtml(item.key) + '">' +
            '<i class="fas fa-trash-alt"></i> Eliminar' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join("");

    checkoutBtn.disabled = false;
  }

  function openCart() {
    var p = document.getElementById("cartPanel");
    var o = document.getElementById("cartOverlay");
    if (p) p.classList.add("open");
    if (o) o.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    var p = document.getElementById("cartPanel");
    var o = document.getElementById("cartOverlay");
    if (p) p.classList.remove("open");
    if (o) o.classList.remove("open");
    document.body.style.overflow = "";
  }

  function checkoutWhatsApp() {
    if (cart.length === 0) return;
    var msg = "🛒 *NUEVO PEDIDO - MANGOS PHONE*\n\nHola, quiero realizar el siguiente pedido:\n\n";
    cart.forEach(function (item, i) {
      msg += "*" + (i + 1) + ". " + item.nombre + "*\n";
      msg += "   • Modelo: " + item.modelo + "\n";
      msg += "   • Cantidad: " + item.qty + "\n";
      msg += "   • Precio: " + formatPrice(item.precio) + "\n";
      msg += "   • Subtotal: " + formatPrice(item.precio * item.qty) + "\n\n";
    });
    msg += "━━━━━━━━━━━━━━━\n*TOTAL: " + formatPrice(getCartTotal()) + " USD*\n━━━━━━━━━━━━━━━\n\nPor favor confirmar disponibilidad. ¡Gracias!";
    window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encode
