// --- Supabase 設定 ---
const SUPABASE_URL = 'https://qdlaszfikcmdawbmgyan.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGFzemZpa2NtZGF3Ym1neWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTUzOTksImV4cCI6MjEwNDM5MTM5OX0.E0UwQzp6X9A-SzFqMG2M2YpCfMSRs-_BmUXbghbqfT0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_STORES = 30;
let map;
let markerLayerGroup;
let singularityLayerGroup;
let currentStores = [];
let selectedStore = null;
let isSignUpMode = false;

// 未ログイン用・現在選択中のマップID管理
let myDefaultMapId = 'MAP-GUEST';
let currentMapId = myDefaultMapId;

let tempMarker = null;

// 未ログイン時のデフォルト特異点
const defaultSingularity = { id: 'default-yokohama', name: '横浜駅', lat: 35.4658, lng: 139.6223 };
let singularities = [defaultSingularity];
let selectedSingularityId = defaultSingularity.id;

// 赤い仮ピンの定義
const tempIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 特異点専用緑色アイコン
const singularityIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 初期化関数
async function initApp() {
  map = L.map('map').setView([defaultSingularity.lat, defaultSingularity.lng], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markerLayerGroup = L.layerGroup().addTo(map);
  singularityLayerGroup = L.layerGroup().addTo(map);

  setupEventListeners();

  // 地図クリック時の座標更新
  map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    document.getElementById("reg-lat").value = lat;
    document.getElementById("reg-lng").value = lng;

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

  await fetchSingularitiesFromSupabase();
  await fetchStoresFromSupabase();
}

// --- イベントリスナー一括設定 ---
function setupEventListeners() {
  // ヘッダー操作
  document.getElementById("singularity-select").addEventListener("change", handleSingularityChange);
  document.getElementById("move-singularity-btn").addEventListener("click", moveToSelectedSingularity);
  document.getElementById("open-singularity-modal-btn").addEventListener("click", openSingularityModal);
  document.getElementById("add-store-btn").addEventListener("click", openRegisterModal);
  document.getElementById("open-share-modal-btn").addEventListener("click", openShareModal);
  document.getElementById("login-btn").addEventListener("click", openAuthModal);
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // サイドバー・フィルター
  document.getElementById("sidebar-header").addEventListener("click", toggleSidebar);
  document.getElementById("search-name").addEventListener("input", filterMarkers);
  document.getElementById("filter-genre").addEventListener("change", filterMarkers);
  document.getElementById("filter-budget").addEventListener("change", filterMarkers);
  document.getElementById("filter-charter").addEventListener("change", filterMarkers);
  document.getElementById("filter-course").addEventListener("change", filterMarkers);
  document.getElementById("filter-drink").addEventListener("change", filterMarkers);
  document.getElementById("filter-eat").addEventListener("change", filterMarkers);

  // 詳細パネル
  document.getElementById("close-detail-btn").addEventListener("click", closeDetailPanel);
  document.getElementById("delete-store-btn").addEventListener("click", handleDeleteStore);

  // 特異点モーダル
  document.getElementById("add-singularity-form").addEventListener("submit", handleAddSingularity);
  document.getElementById("use-map-center-btn").addEventListener("click", setSingularityFromMapCenter);
  document.getElementById("close-singularity-modal-btn").addEventListener("click", closeSingularityModal);

  // 店舗登録モーダル
  document.getElementById("reg-image").addEventListener("change", (e) => validateImageCount(e.target));
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("close-register-modal-btn").addEventListener("click", closeRegisterModal);

  // 認証モーダル
  document.getElementById("auth-form").addEventListener("submit", handleAuthSubmit);
  document.getElementById("auth-toggle-link").addEventListener("click", toggleAuthMode);
  document.getElementById("close-auth-modal-btn").addEventListener("click", closeAuthModal);

  // 共有・切り替えモーダル
  document.getElementById("copy-map-id-btn").addEventListener("click", copyMapId);
  document.getElementById("add-favorite-btn").addEventListener("click", addCurrentToFavorites);
  document.getElementById("switch-my-default-btn").addEventListener("click", switchToMyDefaultMap);
  document.getElementById("close-share-modal-btn").addEventListener("click", closeShareModal);
  document.getElementById("import-map-btn").addEventListener("click", handleImportMap);
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  
  sidebar.classList.toggle("open");
  toggleBtn.textContent = sidebar.classList.contains("open") ? "閉じる" : "検索・絞り込み";
}

// --- 特異点機能 (Supabase連携) ---
async function fetchSingularitiesFromSupabase() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    singularities = [defaultSingularity];
    selectedSingularityId = defaultSingularity.id;
    renderSingularitySelect();
    renderSingularityMarkers();
    return;
  }

  const { data, error } = await supabaseClient
    .from('singularities')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('特異点取得エラー:', error);
    return;
  }

  if (data && data.length > 0) {
    singularities = data;
    selectedSingularityId = singularities[0].id;
  } else {
    singularities = [defaultSingularity];
    selectedSingularityId = defaultSingularity.id;
  }

  renderSingularitySelect();
  renderSingularityMarkers();
}

function getSelectedSingularity() {
  const found = singularities.find(s => s.id === selectedSingularityId);
  return found || singularities[0] || defaultSingularity;
}

function renderSingularitySelect() {
  const select = document.getElementById("singularity-select");
  select.textContent = "";

  const currentSelected = getSelectedSingularity();

  singularities.forEach(singularity => {
    const option = document.createElement("option");
    option.value = singularity.id;
    option.textContent = singularity.name;
    if (singularity.id === currentSelected.id) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function renderSingularityMarkers() {
  singularityLayerGroup.clearLayers();

  singularities.forEach(singularity => {
    const marker = L.marker([singularity.lat, singularity.lng], { icon: singularityIcon });
    
    const popupContent = document.createElement("div");
    popupContent.style.textAlign = "center";

    const title = document.createElement("strong");
    title.textContent = `📍 特異点: ${singularity.name}`;
    popupContent.appendChild(title);
    popupContent.appendChild(document.createElement("br"));

    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-orange";
    moveBtn.style.cssText = "margin-top:5px; padding:2px 8px; font-size:0.75rem;";
    moveBtn.textContent = "ここに移動";
    moveBtn.addEventListener("click", () => moveToSingularityById(singularity.id));
    
    popupContent.appendChild(moveBtn);
    marker.bindPopup(popupContent);
    marker.addTo(singularityLayerGroup);
  });
}

function handleSingularityChange() {
  const select = document.getElementById("singularity-select");
  selectedSingularityId = select.value;
  moveToSelectedSingularity();
}

function moveToSelectedSingularity() {
  const singularity = getSelectedSingularity();
  if (map && singularity) {
    map.flyTo([singularity.lat, singularity.lng], 17);
  }
}

function moveToSingularityById(singularityId) {
  const found = singularities.find(s => s.id === singularityId);
  if (found) {
    selectedSingularityId = singularityId;
    renderSingularitySelect();
    map.flyTo([found.lat, found.lng], 17);
  }
}

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

async function handleAddSingularity(e) {
  e.preventDefault();

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("特異点を保存するにはログインが必要です。");
    openAuthModal();
    return;
  }

  const name = document.getElementById("singularity-name-input").value.trim();
  const lat = parseFloat(document.getElementById("singularity-lat-input").value);
  const lng = parseFloat(document.getElementById("singularity-lng-input").value);

  if (!lat || !lng) {
    alert("地図上をクリックするか「画面中心を使用」を押して座標を指定してください。");
    return;
  }

  const newSingularity = {
    user_id: user.id,
    name: name,
    lat: lat,
    lng: lng
  };

  const { data, error } = await supabaseClient
    .from('singularities')
    .insert([newSingularity])
    .select();

  if (error) {
    console.error(error);
    alert('特異点の保存に失敗しました。');
    return;
  }

  alert(`特異点「${name}」を保存しました！`);
  document.getElementById("add-singularity-form").reset();
  document.getElementById("singularity-coords-input").value = "";

  await fetchSingularitiesFromSupabase();
  renderSingularityList();

  if (data && data.length > 0) {
    moveToSingularityById(data[0].id);
  }
}

function renderSingularityList() {
  const listContainer = document.getElementById("singularity-list");
  listContainer.textContent = "";

  singularities.forEach(singularity => {
    const item = document.createElement("div");
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px solid #eee;";

    const infoDiv = document.createElement("div");
    infoDiv.style.fontSize = "0.85rem";
    const nameStrong = document.createElement("strong");
    nameStrong.textContent = singularity.name;
    infoDiv.appendChild(nameStrong);

    const actionDiv = document.createElement("div");
    actionDiv.style.display = "flex";
    actionDiv.style.gap = "4px";

    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-orange";
    moveBtn.style.cssText = "padding:2px 6px; font-size:0.75rem;";
    moveBtn.textContent = "移動";
    moveBtn.addEventListener("click", () => {
      moveToSingularityById(singularity.id);
      closeSingularityModal();
    });

    actionDiv.appendChild(moveBtn);

    // データベース上のUUIDを持つ場合のみ削除ボタンを表示
    if (singularity.id !== defaultSingularity.id) {
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger";
      delBtn.style.cssText = "padding:2px 6px; font-size:0.75rem;";
      delBtn.textContent = "削除";
      delBtn.addEventListener("click", () => removeSingularity(singularity.id));
      actionDiv.appendChild(delBtn);
    }

    item.appendChild(infoDiv);
    item.appendChild(actionDiv);
    listContainer.appendChild(item);
  });
}

async function removeSingularity(singularityId) {
  if (!confirm("この特異点を削除してもよろしいですか？")) return;

  const { error } = await supabaseClient
    .from('singularities')
    .delete()
    .eq('id', singularityId);

  if (error) {
    console.error(error);
    alert("特異点の削除に失敗しました。");
  } else {
    await fetchSingularitiesFromSupabase();
    renderSingularityList();
  }
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
    userEmail.textContent = user.email;

    myDefaultMapId = `MAP-${user.id.substring(0, 8).toUpperCase()}`;

    if (authEvent === 'SIGNED_IN') {
      currentMapId = myDefaultMapId;
      await fetchSingularitiesFromSupabase();
      await fetchStoresFromSupabase();
    }
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userEmail.style.display = "none";
    myDefaultMapId = 'MAP-GUEST';
    currentMapId = myDefaultMapId;
  }

  if (selectedStore) {
    checkDeleteButtonVisibility(selectedStore);
  }
}

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
    marker.addEventListener('click', () => openDetailPanel(store));
    marker.addTo(markerLayerGroup);
  });
}

function updateIndicator() {
  const count = currentStores.length;
  const indicator = document.getElementById("count-indicator");
  const addBtn = document.getElementById("add-store-btn");

  const isMyMap = (currentMapId === myDefaultMapId);
  indicator.textContent = `登録数: ${count} / ${MAX_STORES} 件 (${currentMapId}${isMyMap ? '・マイマップ' : ''})`;

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
  document.getElementById("detail-name").textContent = store.name;
  document.getElementById("detail-genre").textContent = store.genre || '-';
  document.getElementById("detail-budget").textContent = store.budget || '-';
  document.getElementById("detail-phone").textContent = store.phone || '-';
  document.getElementById("detail-notes").textContent = store.notes || '-';

  const imgContainer = document.getElementById("detail-image-container");
  const imgWrapper = document.getElementById("detail-image-wrapper");
  imgWrapper.textContent = "";

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
  document.getElementById("detail-features").textContent = features.join(" / ") || "なし";

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
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    el.href = url;
    el.textContent = "開く";
    el.style.color = "#3498db";
  } else {
    el.removeAttribute("href");
    el.textContent = "-";
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
  submitBtn.textContent = "保存中...";

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
      console.error(err);
      alert("画像のアップロードに失敗しました。");
      submitBtn.disabled = false;
      submitBtn.textContent = "登録";
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
    console.error(error);
    alert('保存に失敗しました。');
  } else {
    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
    await fetchStoresFromSupabase();
    closeRegisterModal();
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "登録";
}

async function handleDeleteStore() {
  if (!selectedStore) return;

  if (confirm(`「${selectedStore.name}」を削除してもよろしいですか？`)) {
    const { error } = await supabaseClient
      .from('stores')
      .delete()
      .eq('id', selectedStore.id);

    if (error) {
      console.error(error);
      alert('削除に失敗しました。');
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

  document.getElementById("auth-title").textContent = isSignUpMode ? "新規ユーザー登録" : "ログイン";
  document.getElementById("auth-submit-btn").textContent = isSignUpMode ? "登録" : "ログイン";
  document.getElementById("auth-toggle-link").textContent = isSignUpMode ? "ログインはこちら" : "新規登録はこちら";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;

  if (isSignUpMode) {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      console.error(error);
      alert("登録に失敗しました。");
    } else {
      alert("登録が完了しました。ログインします。");
      closeAuthModal();
    }
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(error);
      alert("ログインに失敗しました。メールアドレスまたはパスワードをご確認ください。");
    } else {
      closeAuthModal();
    }
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  alert("ログアウトしました。");
  location.reload();
}

// --- 共有・切り替え機能 ---
async function openShareModal() {
  document.getElementById("share-current-id").value = currentMapId;
  document.getElementById("my-default-map-id").textContent = myDefaultMapId;
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
  document.getElementById("share-current-id").value = currentMapId;
  await fetchStoresFromSupabase();
  alert(`マップID: 「${currentMapId}」に切り替えました。`);
}

async function fetchFavoriteMaps() {
  const favListContainer = document.getElementById("favorite-list");
  favListContainer.textContent = "";
  
  const loadingDiv = document.createElement("div");
  loadingDiv.style.cssText = "font-size:0.8rem; color:#888;";
  loadingDiv.textContent = "読み込み中...";
  favListContainer.appendChild(loadingDiv);

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    favListContainer.textContent = "";
    const noticeDiv = document.createElement("div");
    noticeDiv.style.cssText = "font-size:0.8rem; color:#888;";
    noticeDiv.textContent = "※お気に入り機能を使うにはログインしてください";
    favListContainer.appendChild(noticeDiv);
    return;
  }

  const { data, error } = await supabaseClient
    .from('favorite_maps')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    favListContainer.textContent = "";
    const errDiv = document.createElement("div");
    errDiv.style.cssText = "font-size:0.8rem; color:#e74c3c;";
    errDiv.textContent = "取得に失敗しました";
    favListContainer.appendChild(errDiv);
    return;
  }

  if (!data || data.length === 0) {
    favListContainer.textContent = "";
    const emptyDiv = document.createElement("div");
    emptyDiv.style.cssText = "font-size:0.8rem; color:#888;";
    emptyDiv.textContent = "お気に入りは登録されていません";
    favListContainer.appendChild(emptyDiv);
    return;
  }

  favListContainer.textContent = "";
  data.forEach(fav => {
    const item = document.createElement("div");
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding: 4px 0; border-bottom: 1px solid #eee;";
    
    const infoDiv = document.createElement("div");
    infoDiv.style.cssText = "font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px;";
    
    const titleStrong = document.createElement("strong");
    titleStrong.textContent = fav.map_title || fav.map_id;
    infoDiv.appendChild(titleStrong);

    const actionDiv = document.createElement("div");
    actionDiv.style.display = "flex";
    actionDiv.style.gap = "4px";

    const showBtn = document.createElement("button");
    showBtn.className = "btn btn-blue";
    showBtn.style.cssText = "padding:2px 6px; font-size:0.75rem;";
    showBtn.textContent = "表示";
    showBtn.addEventListener("click", () => {
      switchToSpecificMap(fav.map_id);
      closeShareModal();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger";
    delBtn.style.cssText = "padding:2px 6px; font-size:0.75rem;";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => removeFavoriteMap(fav.id));

    actionDiv.appendChild(showBtn);
    actionDiv.appendChild(delBtn);

    item.appendChild(infoDiv);
    item.appendChild(actionDiv);
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
      console.error(error);
      alert("お気に入り登録に失敗しました。");
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
    console.error(error);
    alert("削除に失敗しました。");
  } else {
    await fetchFavoriteMaps();
  }
}

window.addEventListener("DOMContentLoaded", initApp);