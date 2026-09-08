// --- Supabase 設定 ---
const SUPABASE_URL = 'https://qdlaszfikcmdawbmgyan.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGFzemZpa2NtZGF3Ym1neWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTUzOTksImV4cCI6MjEwNDM5MTM5OX0.E0UwQzp6X9A-SzFqMG2M2YpCfMSRs-_BmUXbghbqfT0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_STORES = 30;
let map;
let markerLayerGroup;
let currentStores = [];
let selectedStore = null;
let isSignUpMode = false;

// 登録時の仮ピン用変数
let tempMarker = null;

// 赤い仮ピン用アイコンの定義
const tempIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 初期化処理
async function initApp() {
  map = L.map('map').setView([35.4658, 139.6223], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markerLayerGroup = L.layerGroup().addTo(map);

  // 地図クリック時の処理（仮ピンを立てる）
  map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    document.getElementById("reg-lat").value = lat;
    document.getElementById("reg-lng").value = lng;

    // すでに仮ピンがある場合は位置を移動、ない場合は新規作成
    if (tempMarker) {
      tempMarker.setLatLng([lat, lng]);
    } else {
      tempMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      tempMarker.bindPopup("<b>登録予定位置</b>").openPopup();
    }
  });

  // 認証状態の監視
  supabaseClient.auth.onAuthStateChange((event, session) => {
    updateAuthUI(session?.user || null);
  });

  await fetchStoresFromSupabase();
}

// ユーザーログイン状態に応じたUIの切り替え
function updateAuthUI(user) {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userEmail = document.getElementById("user-email");

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userEmail.style.display = "inline-block";
    userEmail.innerText = user.email;
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userEmail.style.display = "none";
  }

  if (selectedStore) {
    checkDeleteButtonVisibility(selectedStore);
  }
}

// データ取得
async function fetchStoresFromSupabase() {
  const { data, error } = await supabaseClient
    .from('stores')
    .select('*');

  if (error) {
    console.error('データ取得エラー:', error);
    return;
  }

  currentStores = data || [];
  renderMarkers();
  updateIndicator();
}

function renderMarkers() {
  markerLayerGroup.clearLayers();

  currentStores.forEach(store => {
    const marker = L.marker([store.lat, store.lng]);
    marker.storeData = store;

    marker.on('click', () => {
      openDetailPanel(store);
    });

    marker.addTo(markerLayerGroup);
  });
}

function updateIndicator() {
  const count = currentStores.length;
  const indicator = document.getElementById("count-indicator");
  const addBtn = document.getElementById("add-store-btn");

  indicator.innerText = `登録数: ${count} / ${MAX_STORES} 件`;

  if (count >= MAX_STORES) {
    indicator.classList.add("limit-reached");
    addBtn.disabled = true;
  } else {
    indicator.classList.remove("limit-reached");
    addBtn.disabled = false;
  }
}

function filterMarkers() {
  const nameVal = document.getElementById("search-name").value.toLowerCase();
  const genreVal = document.getElementById("filter-genre").value;
  const budgetVal = document.getElementById("filter-budget").value;
  const isCharter = document.getElementById("filter-charter").checked;
  const hasCourse = document.getElementById("filter-course").checked;
  const hasDrink = document.getElementById("filter-drink").checked;
  const hasEat = document.getElementById("filter-eat").checked;

  markerLayerGroup.eachLayer(marker => {
    const store = marker.storeData;
    let visible = true;

    if (nameVal && !store.name.toLowerCase().includes(nameVal)) visible = false;
    if (genreVal && store.genre !== genreVal) visible = false;
    if (budgetVal && store.budget !== budgetVal) visible = false;
    if (isCharter && !store.is_charter) visible = false;
    if (hasCourse && !store.has_course) visible = false;
    if (hasDrink && !store.has_all_you_can_drink) visible = false;
    if (hasEat && !store.has_all_you_can_eat) visible = false;

    if (visible) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });
}

async function openDetailPanel(store) {
  selectedStore = store;
  document.getElementById("detail-name").innerText = store.name;
  document.getElementById("detail-genre").innerText = store.genre || '-';
  document.getElementById("detail-budget").innerText = store.budget || '-';
  document.getElementById("detail-phone").innerText = store.phone || '-';

  let features = [];
  if (store.is_charter) features.push("貸し切りあり");
  if (store.has_course) features.push("コースあり");
  if (store.has_all_you_can_drink) features.push("飲み放題あり");
  if (store.has_all_you_can_eat) features.push("食べ放題あり");
  document.getElementById("detail-features").innerText = features.join(" / ") || "なし";

  setupLink("detail-official", store.official_url);
  setupLink("detail-tabelog", store.tabelog_url);
  setupLink("detail-hotpepper", store.hotpepper_url);
  setupLink("detail-other", store.other_url);

  checkDeleteButtonVisibility(store);

  document.getElementById("detail-panel").classList.add("active");
}

async function checkDeleteButtonVisibility(store) {
  const deleteBtn = document.getElementById("delete-store-btn");
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user && (store.user_id === user.id || !store.user_id)) {
    deleteBtn.style.display = "block";
  } else {
    deleteBtn.style.display = "none";
  }
}

function setupLink(elementId, url) {
  const el = document.getElementById(elementId);
  if (url) {
    el.href = url;
    el.innerText = "リンクを開く";
    el.style.color = "#3498db";
  } else {
    el.removeAttribute("href");
    el.innerText = "登録なし";
    el.style.color = "#999";
  }
}

function closeDetailPanel() {
  document.getElementById("detail-panel").classList.remove("active");
  selectedStore = null;
}

// --- 店舗登録機能 ---
async function openRegisterModal() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("店舗を登録するにはログインが必要です。");
    openAuthModal();
    return;
  }
  if (currentStores.length >= MAX_STORES) return;

  const defaultLat = parseFloat(document.getElementById("reg-lat").value);
  const defaultLng = parseFloat(document.getElementById("reg-lng").value);

  if (tempMarker) {
    tempMarker.setLatLng([defaultLat, defaultLng]);
  } else {
    tempMarker = L.marker([defaultLat, defaultLng], { icon: tempIcon }).addTo(map);
    tempMarker.bindPopup("<b>登録予定位置</b>").openPopup();
  }

  document.getElementById("register-modal").classList.add("active");
}

function closeRegisterModal() {
  document.getElementById("register-modal").classList.remove("active");
  document.getElementById("register-form").reset();

  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("ログインセッションが切れました。再ログインしてください。");
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;

  const newStore = {
    user_id: user.id,
    name: document.getElementById("reg-name").value,
    genre: document.getElementById("reg-genre").value,
    budget: document.getElementById("reg-budget").value,
    is_charter: document.getElementById("reg-charter").checked,
    has_course: document.getElementById("reg-course").checked,
    has_all_you_can_drink: document.getElementById("reg-drink").checked,
    has_all_you_can_eat: document.getElementById("reg-eat").checked,
    phone: document.getElementById("reg-phone").value,
    official_url: document.getElementById("reg-official").value,
    tabelog_url: document.getElementById("reg-tabelog").value,
    hotpepper_url: document.getElementById("reg-hotpepper").value,
    other_url: document.getElementById("reg-other").value,
    lat: parseFloat(document.getElementById("reg-lat").value),
    lng: parseFloat(document.getElementById("reg-lng").value)
  };

  const { error } = await supabaseClient
    .from('stores')
    .insert([newStore]);

  if (error) {
    alert('保存に失敗しました: ' + error.message);
  } else {
    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
    await fetchStoresFromSupabase();
    closeRegisterModal();
  }

  submitBtn.disabled = false;
}

// --- 店舗削除機能 ---
async function handleDeleteStore() {
  if (!selectedStore) return;

  if (confirm(`「${selectedStore.name}」を削除してもよろしいですか？`)) {
    const { error } = await supabaseClient
      .from('stores')
      .delete()
      .eq('id', selectedStore.id);

    if (error) {
      alert(`削除に失敗しました:\n${error.message} (コード: ${error.code})`);
      console.error('Delete error details:', error);
    } else {
      alert('削除完了しました。');
      closeDetailPanel();
      await fetchStoresFromSupabase();
    }
  }
}

// --- 認証機能 ---
function openAuthModal() {
  document.getElementById("auth-modal").classList.add("active");
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("active");
}

function toggleAuthMode(e) {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;

  document.getElementById("auth-title").innerText = isSignUpMode ? "新規ユーザー登録" : "ログイン";
  document.getElementById("auth-submit-btn").innerText = isSignUpMode ? "登録" : "ログイン";
  document.getElementById("auth-toggle-link").innerText = isSignUpMode ? "ログインはこちら" : "新規登録はこちら";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;

  if (isSignUpMode) {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      alert("登録失敗: " + error.message);
    } else {
      alert("登録完了メールを送信しました。メール内のリンクを確認してください。");
      closeAuthModal();
    }
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert("ログイン失敗: " + error.message);
    } else {
      closeAuthModal();
    }
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  alert("ログアウトしました。");
}

function openShareModal() {
  document.getElementById("share-modal").classList.add("active");
}

function closeShareModal() {
  document.getElementById("share-modal").classList.remove("active");
}

function handleImportMap() {
  const inputId = document.getElementById("share-input-id").value;
  if (!inputId) {
    alert("マップIDを入力してください。");
    return;
  }
  if (confirm("同じ位置（店舗情報）が存在する場合、上書きしますか？")) {
    alert("マップ情報を更新・反映しました。");
    closeShareModal();
  }
}

window.onload = initApp;