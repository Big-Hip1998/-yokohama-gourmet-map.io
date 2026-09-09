// --- Supabase 設定 ---
const SUPABASE_URL = 'https://qdlaszfikcmdawbmgyan.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGFzemZpa2NtZGF3Ym1neWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTUzOTksImV4cCI6MjEwNDM5MTM5OX0.E0UwQzp6X9A-SzFqMG2M2YpCfMSRs-_BmUXbghbqfT0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_STORES = 30;
let map;
let markerLayerGroup;
let singularityLayerGroup; // 特異点用レイヤーグループ
let currentStores = [];
let selectedStore = null;
let isSignUpMode = false;

// 初期化用マップID処理
let myDefaultMapId = localStorage.getItem('my_default_map_id') || generateRandomMapId();
localStorage.setItem('my_default_map_id', myDefaultMapId);

let currentMapId = localStorage.getItem('current_view_map_id') || myDefaultMapId;

let tempMarker = null;

// デフォルトの特異点（マーキングピン）初期データ
const defaultSingularities = [
  { id: 'yokohama', name: '横浜駅', lat: 35.4658, lng: 139.6223 }
];

let singularities = JSON.parse(localStorage.getItem('singularities')) || defaultSingularities;

// 赤い仮ピンの定義（店舗追加時の場所選択用）
const tempIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 特異点（マーキングピン）専用緑色アイコン
const singularityIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// マップID作成関数
function generateRandomMapId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MAP-${randomStr}`;
}

// 初期化関数
async function initApp() {
  const selectedSingularity = getSelectedSingularity();
  map = L.map('map').setView([selectedSingularity.lat, selectedSingularity.lng], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markerLayerGroup = L.layerGroup().addTo(map);
  singularityLayerGroup = L.layerGroup().addTo(map);

  // 特異点UIとピンの描画
  renderSingularitySelect();
  renderSingularityMarkers();

  // クリック時の座標更新
  map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // 店舗登録フォームへのセット
    document.getElementById("reg-lat").value = lat;
    document.getElementById("reg-lng").value = lng;

    // 特異点追加モーダルへのセット
    document.getElementById("singularity-lat-input").value = lat;
    document.getElementById("singularity-lng-input").value = lng;
    document.getElementById("singularity-coords-input").value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (tempMarker) {
      tempMarker.setLatLng([lat, lng]);
    } else {
      tempMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      tempMarker.bindPopup("<b>選択中の場所</b>").openPopup();
    }
  });

  // 認証状態の監視
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    await updateAuthUIAndSwitchMap(session?.user || null, event);
  });

  await fetchStoresFromSupabase();
}

// --- モバイル用サイドバー（検索パネル）の開閉 ---
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  
  sidebar.classList.toggle("open");
  
  if (sidebar.classList.contains("open")) {
    toggleBtn.innerText = "閉じる";
  } else {
    toggleBtn.innerText = "検索・絞り込み";
  }
}

// --- 特異点（マーキングピン）機能 ---

// 現在選択されている特異点を取得
function getSelectedSingularity() {
  const selectedId = localStorage.getItem('selected_singularity_id');
  const found = singularities.find(s => s.id === selectedId);
  return found || singularities[0] || defaultSingularities[0];
}

// ヘッダーのプルダウン構築
function renderSingularitySelect() {
  const select = document.getElementById("singularity-select");
  select.innerHTML = "";

  const currentSelectedId = getSelectedSingularity().id;

  singularities.forEach(singularity => {
    const option = document.createElement("option");
    option.value = singularity.id;
    option.innerText = singularity.name;
    if (singularity.id === currentSelectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// 地図上に緑色の特異点ピンを配置
function renderSingularityMarkers() {
  singularityLayerGroup.clearLayers();

  singularities.forEach(singularity => {
    const marker = L.marker([singularity.lat, singularity.lng], { icon: singularityIcon });
    marker.bindPopup(`
      <div style="text-align:center;">
        <strong>📍 特異点: ${singularity.name}</strong><br>
        <button class="btn btn-orange" style="margin-top:5px; padding:2px 8px; font-size:0.75rem;" onclick="moveToSingularityById('${singularity.id}')">ここに移動</button>
      </div>
    `);
    marker.addTo(singularityLayerGroup);
  });
}

// プルダウン変更時
function handleSingularityChange() {
  const select = document.getElementById("singularity-select");
  const singularityId = select.value;
  localStorage.setItem('selected_singularity_id', singularityId);
  moveToSelectedSingularity();
}

// 選択中の特異点へジャンプ
function moveToSelectedSingularity() {
  const singularity = getSelectedSingularity();
  if (map && singularity) {
    map.flyTo([singularity.lat, singularity.lng], 17);
  }
}

function moveToSingularityById(singularityId) {
  const found = singularities.find(s => s.id === singularityId);
  if (found) {
    localStorage.setItem('selected_singularity_id', singularityId);
    renderSingularitySelect();
    map.flyTo([found.lat, found.lng], 17);
  }
}

// 特異点管理モーダル関連
function openSingularityModal() {
  renderSingularityList();
  document.getElementById("singularity-modal").classList.add("active");
}

function closeSingularityModal() {
  document.getElementById("singularity-modal").classList.remove("active");
  document.getElementById("add-singularity-form").reset();
  document.getElementById("singularity-coords-input").value = "";
}

function setSingularityFromMapCenter() {
  const center = map.getCenter();
  document.getElementById("singularity-lat-input").value = center.lat;
  document.getElementById("singularity-lng-input").value = center.lng;
  document.getElementById("singularity-coords-input").value = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
}

// 特異点登録処理
function handleAddSingularity(e) {
  e.preventDefault();
  const name = document.getElementById("singularity-name-input").value.trim();
  const lat = parseFloat(document.getElementById("singularity-lat-input").value);
  const lng = parseFloat(document.getElementById("singularity-lng-input").value);

  if (!lat || !lng) {
    alert("地図上をクリックするか「画面中心を使用」を押して座標を指定してください。");
    return;
  }

  const newSingularity = {
    id: `singularity_${Date.now()}`,
    name: name,
    lat: lat,
    lng: lng
  };

  singularities.push(newSingularity);
  localStorage.setItem('singularities', JSON.stringify(singularities));
  localStorage.setItem('selected_singularity_id', newSingularity.id);

  renderSingularitySelect();
  renderSingularityMarkers();
  renderSingularityList();

  alert(`特異点「${name}」を保存しました！`);
  document.getElementById("add-singularity-form").reset();
  document.getElementById("singularity-coords-input").value = "";
}

// 登録済み特異点一覧（削除機能）
function renderSingularityList() {
  const listContainer = document.getElementById("singularity-list");
  listContainer.innerHTML = "";

  singularities.forEach(singularity => {
    const item = document.createElement("div");
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px solid #eee;";

    const canDelete = singularities.length > 1;

    item.innerHTML = `
      <div style="font-size:0.85rem;">
        <strong>${singularity.name}</strong>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn btn-orange" style="padding:2px 6px; font-size:0.75rem;" onclick="moveToSingularityById('${singularity.id}'); closeSingularityModal();">移動</button>
        ${canDelete ? `<button class="btn btn-danger" style="padding:2px 6px; font-size:0.75rem;" onclick="removeSingularity('${singularity.id}')">削除</button>` : ''}
      </div>
    `;
    listContainer.appendChild(item);
  });
}

// 特異点削除
function removeSingularity(singularityId) {
  if (!confirm("この特異点を削除してもよろしいですか？")) return;

  singularities = singularities.filter(s => s.id !== singularityId);
  localStorage.setItem('singularities', JSON.stringify(singularities));

  if (localStorage.getItem('selected_singularity_id') === singularityId) {
    localStorage.setItem('selected_singularity_id', singularities[0].id);
  }

  renderSingularitySelect();
  renderSingularityMarkers();
  renderSingularityList();
}

// --- ユーザー状態更新 ---
async function updateAuthUIAndSwitchMap(user, authEvent) {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userEmail = document.getElementById("user-email");

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userEmail.style.display = "inline-block";
    userEmail.innerText = user.email;

    myDefaultMapId = `MAP-${user.id.substring(0, 8).toUpperCase()}`;
    localStorage.setItem('my_default_map_id', myDefaultMapId);

    if (authEvent === 'SIGNED_IN' || !localStorage.getItem('is_viewing_other_map')) {
      currentMapId = myDefaultMapId;
      localStorage.setItem('current_view_map_id', currentMapId);
      localStorage.removeItem('is_viewing_other_map');
      await fetchStoresFromSupabase();
    }
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
    .select('*')
    .eq('map_id', currentMapId);

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

  const isMyMap = (currentMapId === myDefaultMapId);
  indicator.innerText = `登録数: ${count} / ${MAX_STORES} 件 (${currentMapId}${isMyMap ? '・マイマップ' : ''})`;

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

function validateImageCount(input) {
  if (input.files.length > 5) {
    alert("画像は最大5枚までしか選択できません。");
    input.value = "";
  }
}

async function openDetailPanel(store) {
  selectedStore = store;
  document.getElementById("detail-name").innerText = store.name;
  document.getElementById("detail-genre").innerText = store.genre || '-';
  document.getElementById("detail-budget").innerText = store.budget || '-';
  document.getElementById("detail-phone").innerText = store.phone || '-';
  document.getElementById("detail-notes").innerText = store.notes || '-';

  const imgContainer = document.getElementById("detail-image-container");
  const imgWrapper = document.getElementById("detail-image-wrapper");
  imgWrapper.innerHTML = "";

  const images = store.image_urls && store.image_urls.length > 0 
    ? store.image_urls 
    : (store.image_url ? [store.image_url] : []);

  if (images.length > 0) {
    images.forEach(url => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "店舗画像";
      imgWrapper.appendChild(img);
    });
    imgContainer.style.display = "block";
  } else {
    imgContainer.style.display = "none";
  }

  let features = [];
  if (store.is_charter) features.push("貸切");
  if (store.has_course) features.push("コース");
  if (store.has_all_you_can_drink) features.push("飲み放題");
  if (store.has_all_you_can_eat) features.push("食べ放題");
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
    el.innerText = "開く";
    el.style.color = "#3498db";
  } else {
    el.removeAttribute("href");
    el.innerText = "-";
    el.style.color = "#999";
  }
}

function closeDetailPanel() {
  document.getElementById("detail-panel").classList.remove("active");
  selectedStore = null;
}

// --- 店舗登録 ---
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
    tempMarker.bindPopup("<b>選択中の場所</b>").openPopup();
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
    alert("ログインが必要です。");
    return;
  }

  const imageFiles = Array.from(document.getElementById("reg-image").files);
  if (imageFiles.length > 5) {
    alert("画像は最大5枚までです。");
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "保存中...";

  let imageUrls = [];

  if (imageFiles.length > 0) {
    try {
      const uploadPromises = imageFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `store-photos/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('store-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabaseClient.storage
          .from('store-images')
          .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
      });

      imageUrls = await Promise.all(uploadPromises);
    } catch (err) {
      alert("画像のアップロードに失敗しました: " + err.message);
      submitBtn.disabled = false;
      submitBtn.innerText = "登録";
      return;
    }
  }

  const newStore = {
    user_id: user.id,
    map_id: currentMapId,
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
    notes: document.getElementById("reg-notes").value,
    image_urls: imageUrls,
    image_url: imageUrls[0] || null,
    lat: parseFloat(document.getElementById("reg-lat").value),
    lng: parseFloat(document.getElementById("reg-lng").value)
  };

  const { error } = await supabaseClient.from('stores').insert([newStore]);

  if (error) {
    alert('保存失敗: ' + error.message);
  } else {
    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
    await fetchStoresFromSupabase();
    closeRegisterModal();
  }

  submitBtn.disabled = false;
  submitBtn.innerText = "登録";
}

async function handleDeleteStore() {
  if (!selectedStore) return;

  if (confirm(`「${selectedStore.name}」を削除してもよろしいですか？`)) {
    const { error } = await supabaseClient
      .from('stores')
      .delete()
      .eq('id', selectedStore.id);

    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
    } else {
      alert('削除が完了しました。');
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
      alert("登録が完了しました。ログインします。");
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
  localStorage.removeItem('is_viewing_other_map');
  await supabaseClient.auth.signOut();
  alert("ログアウトしました。");
  location.reload();
}

// --- 共有・切り替え機能 ---
async function openShareModal() {
  document.getElementById("share-current-id").value = currentMapId;
  document.getElementById("my-default-map-id").innerText = myDefaultMapId;
  document.getElementById("fav-title-input").value = "";

  await fetchFavoriteMaps();
  document.getElementById("share-modal").classList.add("active");
}

function closeShareModal() {
  document.getElementById("share-modal").classList.remove("active");
}

function copyMapId() {
  const copyText = document.getElementById("share-current-id");
  navigator.clipboard.writeText(copyText.value).then(() => {
    alert("マップIDをコピーしました: " + copyText.value);
  }).catch(() => {
    alert("コピーに失敗しました");
  });
}

async function switchToMyDefaultMap() {
  currentMapId = myDefaultMapId;
  localStorage.setItem('current_view_map_id', currentMapId);
  localStorage.removeItem('is_viewing_other_map');

  await fetchStoresFromSupabase();
  alert(`自分のデフォルトマップ (ID: ${currentMapId}) に切り替えました。`);
  closeShareModal();
}

async function handleImportMap() {
  const inputId = document.getElementById("share-input-id").value.trim();
  if (!inputId) {
    alert("マップIDを入力してください。");
    return;
  }

  await switchToSpecificMap(inputId);
  closeShareModal();
}

async function switchToSpecificMap(targetMapId) {
  currentMapId = targetMapId;
  localStorage.setItem('current_view_map_id', currentMapId);

  if (currentMapId !== myDefaultMapId) {
    localStorage.setItem('is_viewing_other_map', 'true');
  } else {
    localStorage.removeItem('is_viewing_other_map');
  }

  document.getElementById("share-current-id").value = currentMapId;
  await fetchStoresFromSupabase();
  alert(`マップID: 「${currentMapId}」に切り替えました。`);
}

async function fetchFavoriteMaps() {
  const favListContainer = document.getElementById("favorite-list");
  favListContainer.innerHTML = "<div style='font-size:0.8rem; color:#888;'>読み込み中...</div>";

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    favListContainer.innerHTML = "<div style='font-size:0.8rem; color:#888;'>※お気に入り機能を使うにはログインしてください</div>";
    return;
  }

  const { data, error } = await supabaseClient
    .from('favorite_maps')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    favListContainer.innerHTML = "<div style='font-size:0.8rem; color:#e74c3c;'>取得に失敗しました</div>";
    return;
  }

  if (!data || data.length === 0) {
    favListContainer.innerHTML = "<div style='font-size:0.8rem; color:#888;'>お気に入りは登録されていません</div>";
    return;
  }

  favListContainer.innerHTML = "";
  data.forEach(fav => {
    const item = document.createElement("div");
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding: 4px 0; border-bottom: 1px solid #eee;";
    
    item.innerHTML = `
      <div style="font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px;">
        <strong>${fav.map_title || fav.map_id}</strong>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn btn-blue" style="padding:2px 6px; font-size:0.75rem;" onclick="switchToSpecificMap('${fav.map_id}'); closeShareModal();">表示</button>
        <button class="btn btn-danger" style="padding:2px 6px; font-size:0.75rem;" onclick="removeFavoriteMap('${fav.id}')">削除</button>
      </div>
    `;
    favListContainer.appendChild(item);
  });
}

async function addCurrentToFavorites() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    alert("お気に入り登録にはログインが必要です。");
    return;
  }

  const titleInput = document.getElementById("fav-title-input").value.trim();
  const mapTitle = titleInput || `マップ (${currentMapId})`;

  const { error } = await supabaseClient
    .from('favorite_maps')
    .insert([{
      user_id: user.id,
      map_id: currentMapId,
      map_title: mapTitle
    }]);

  if (error) {
    if (error.code === '23505') {
      alert("このマップは既にお気に入りに登録されています。");
    } else {
      alert("お気に入り登録に失敗しました: " + error.message);
    }
  } else {
    alert(`「${mapTitle}」をお気に入りに追加しました！`);
    document.getElementById("fav-title-input").value = "";
    await fetchFavoriteMaps();
  }
}

async function removeFavoriteMap(favId) {
  if (!confirm("このお気に入りを削除しますか？")) return;

  const { error } = await supabaseClient
    .from('favorite_maps')
    .delete()
    .eq('id', favId);

  if (error) {
    alert("削除に失敗しました: " + error.message);
  } else {
    await fetchFavoriteMaps();
  }
}

window.onload = initApp;