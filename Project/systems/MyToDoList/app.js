// Firebase SDK Modular imports from CDN
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Target Project ID
const TARGET_PROJECT_ID = "project-566930163538";

// Local storage key for custom config
const CONFIG_STORAGE_KEY = "mytodolist_firebase_config";

// Read or default config
function getStoredConfig() {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved config:", e);
    }
  }
  return {
    apiKey: "",
    authDomain: `${TARGET_PROJECT_ID}.firebaseapp.com`,
    projectId: TARGET_PROJECT_ID,
    storageBucket: `${TARGET_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId: "566930163538",
    appId: ""
  };
}

let firebaseConfig = getStoredConfig();
let app = null;
let auth = null;
let db = null;
let currentUser = null;
let activeBoardId = "general";
let currentFilter = "all";
let unsubscribeTasks = null;
let unsubscribePresence = null;

// Mock local store for demo if Firebase API key is not yet set
let isDemoMode = false;
let mockTasks = [
  {
    id: "demo-1",
    text: "設定 Firebase Console 的 Web App 金鑰",
    completed: false,
    priority: "high",
    createdBy: { name: "系統小幫手", photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=helper" },
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-2",
    text: "開啟 Authentication > Google 登入提供者",
    completed: true,
    priority: "medium",
    createdBy: { name: "系統小幫手", photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=helper" },
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: "demo-3",
    text: "體驗多人即時增刪待辦清單",
    completed: false,
    priority: "low",
    createdBy: { name: "示範成員", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
    createdAt: new Date(Date.now() - 7200000).toISOString()
  }
];

// Initialize UI elements
const googleSignInBtn = document.getElementById("googleSignInBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loggedInView = document.getElementById("loggedInView");
const loggedOutView = document.getElementById("loggedOutView");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const setupAlert = document.getElementById("setupAlert");

const addTaskForm = document.getElementById("addTaskForm");
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const taskList = document.getElementById("taskList");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const taskCountBadge = document.getElementById("taskCountBadge");

const openConfigBtn = document.getElementById("openConfigBtn");
const closeConfigBtn = document.getElementById("closeConfigBtn");
const cancelConfigBtn = document.getElementById("cancelConfigBtn");
const configModal = document.getElementById("configModal");
const configForm = document.getElementById("configForm");

const cfgApiKey = document.getElementById("cfgApiKey");
const cfgAuthDomain = document.getElementById("cfgAuthDomain");
const cfgProjectId = document.getElementById("cfgProjectId");
const cfgAppId = document.getElementById("cfgAppId");

const newBoardBtn = document.getElementById("newBoardBtn");
const newBoardModal = document.getElementById("newBoardModal");
const cancelNewBoardBtn = document.getElementById("cancelNewBoardBtn");
const createBoardForm = document.getElementById("createBoardForm");
const newBoardNameInput = document.getElementById("newBoardNameInput");
const boardList = document.getElementById("boardList");
const currentBoardTitle = document.getElementById("currentBoardTitle");
const collaboratorList = document.getElementById("collaboratorList");

// Setup Config Modal Inputs
function populateConfigInputs() {
  cfgApiKey.value = firebaseConfig.apiKey || "";
  cfgAuthDomain.value = firebaseConfig.authDomain || `${TARGET_PROJECT_ID}.firebaseapp.com`;
  cfgProjectId.value = firebaseConfig.projectId || TARGET_PROJECT_ID;
  cfgAppId.value = firebaseConfig.appId || "";
}

// Check Firebase Initialization
function initFirebase() {
  populateConfigInputs();
  
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase apiKey is missing. Running in interactive demo mode.");
    isDemoMode = true;
    setupAlert.classList.remove("hidden");
    renderMockTasks();
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setupAlert.classList.add("hidden");

    // Listen for Auth changes
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      updateAuthUI(user);
      if (user) {
        updatePresence(user);
      }
      subscribeToTasks();
      subscribeToPresence();
    });

  } catch (err) {
    console.error("Firebase init failed:", err);
    alert("Firebase 初始化發生錯誤，請檢查配置金鑰是否正確：" + err.message);
    isDemoMode = true;
    renderMockTasks();
  }
}

// Update UI based on auth state
function updateAuthUI(user) {
  if (user) {
    loggedOutView.classList.add("hidden");
    loggedInView.classList.remove("hidden");
    loggedInView.classList.add("flex");
    userName.textContent = user.displayName || user.email || "協作者";
    userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.uid}`;
  } else {
    loggedOutView.classList.remove("hidden");
    loggedInView.classList.add("hidden");
    loggedInView.classList.remove("flex");
  }
}

// Google Sign In
async function handleGoogleSignIn() {
  if (isDemoMode) {
    // Simulate user login in demo mode
    currentUser = {
      uid: "mock-" + Math.random().toString(36).substring(7),
      displayName: "訪客 (示範帳號)",
      photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=happy",
      email: "demo@example.com"
    };
    updateAuthUI(currentUser);
    alert("目前為示範模式！如需真正 Google 登入，請點擊右上角齒輪填入 Firebase API Key。");
    return;
  }

  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    alert("Google 登入失敗: " + error.message);
  }
}

// Sign Out
async function handleSignOut() {
  if (isDemoMode) {
    currentUser = null;
    updateAuthUI(null);
    return;
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign Out Error:", error);
  }
}

// User Presence (Tracking who is online)
async function updatePresence(user) {
  if (!db || !user) return;
  try {
    const userRef = doc(db, "presence", user.uid);
    await setDoc(userRef, {
      name: user.displayName || "匿名協作者",
      photoURL: user.photoURL || "",
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Failed to set presence:", err);
  }
}

function subscribeToPresence() {
  if (!db) return;
  try {
    const presenceCol = collection(db, "presence");
    onSnapshot(presenceCol, (snapshot) => {
      collaboratorList.innerHTML = "";
      if (snapshot.empty) {
        collaboratorList.innerHTML = `<p class="text-xs text-slate-400">目前尚無其他成員在線</p>`;
        return;
      }
      snapshot.forEach((docSnap) => {
        const u = docSnap.data();
        const div = document.createElement("div");
        div.className = "flex items-center gap-2 text-sm text-slate-700 py-1";
        div.innerHTML = `
          <img src="${u.photoURL || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + docSnap.id}" class="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-400">
          <span class="truncate text-xs font-medium">${escapeHtml(u.name || "協作者")}</span>
        `;
        collaboratorList.appendChild(div);
      });
    });
  } catch (err) {
    console.warn("Presence listener error:", err);
  }
}

// Tasks Realtime Subscription
function subscribeToTasks() {
  if (unsubscribeTasks) {
    unsubscribeTasks();
  }

  if (isDemoMode) {
    renderMockTasks();
    return;
  }

  loadingState.classList.remove("hidden");
  emptyState.classList.add("hidden");

  try {
    const tasksCol = collection(db, "boards", activeBoardId, "tasks");
    const q = query(tasksCol, orderBy("createdAt", "desc"));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
      loadingState.classList.add("hidden");
      const tasks = [];
      snapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() });
      });

      renderTasks(tasks);
    }, (error) => {
      console.error("Tasks fetch error:", error);
      loadingState.classList.add("hidden");
      taskList.innerHTML = `
        <div class="p-6 text-center text-rose-500 text-sm">
          <i class="fa-solid fa-triangle-exclamation mr-1"></i> 資料讀取失敗：${error.message}<br>
          <span class="text-xs text-slate-400">請確認 Firebase Firestore 規則是否允許存取。</span>
        </div>
      `;
    });
  } catch (err) {
    console.error("Firestore subscription error:", err);
    loadingState.classList.add("hidden");
  }
}

// Render Tasks List
function renderTasks(tasks) {
  // Filter
  const filtered = tasks.filter(t => {
    if (currentFilter === "pending") return !t.completed;
    if (currentFilter === "completed") return t.completed;
    return true;
  });

  taskCountBadge.textContent = `${filtered.length} 項目`;

  if (filtered.length === 0) {
    taskList.innerHTML = "";
    emptyState.classList.remove("hidden");
    taskList.appendChild(emptyState);
    return;
  }

  emptyState.classList.add("hidden");
  taskList.innerHTML = "";

  filtered.forEach((task) => {
    const itemEl = createTaskElement(task);
    taskList.appendChild(itemEl);
  });
}

function createTaskElement(task) {
  const div = document.createElement("div");
  div.className = `p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition group ${task.completed ? 'bg-slate-50/40 opacity-75' : ''}`;
  
  // Priority badges
  let priorityBadge = "";
  if (task.priority === "high") {
    priorityBadge = `<span class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">高</span>`;
  } else if (task.priority === "low") {
    priorityBadge = `<span class="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">低</span>`;
  } else {
    priorityBadge = `<span class="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">中</span>`;
  }

  // Creator Info
  const creatorName = task.createdBy?.name || "匿名";
  const creatorPhoto = task.createdBy?.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${creatorName}`;

  div.innerHTML = `
    <div class="flex items-center gap-3.5 flex-1 min-w-0">
      <button class="toggle-btn w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-500 text-transparent'}">
        <i class="fa-solid fa-check text-xs"></i>
      </button>

      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'} break-words">
          ${escapeHtml(task.text)}
        </p>
        <div class="flex items-center gap-2 mt-1 text-xs text-slate-400">
          ${priorityBadge}
          <span class="flex items-center gap-1">
            <img src="${creatorPhoto}" class="w-3.5 h-3.5 rounded-full object-cover">
            <span>${escapeHtml(creatorName)}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
      <button class="delete-btn p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition" title="刪除任務">
        <i class="fa-regular fa-trash-can text-sm"></i>
      </button>
    </div>
  `;

  // Toggle button event
  const toggleBtn = div.querySelector(".toggle-btn");
  toggleBtn.addEventListener("click", () => {
    toggleTaskStatus(task.id, !task.completed);
  });

  // Delete button event
  const deleteBtn = div.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", () => {
    deleteTask(task.id);
  });

  return div;
}

// Add Task
async function handleAddTask(e) {
  e.preventDefault();
  const text = taskInput.value.trim();
  const priority = prioritySelect.value;
  if (!text) return;

  const creator = currentUser ? {
    uid: currentUser.uid,
    name: currentUser.displayName || "協作者",
    photoURL: currentUser.photoURL || ""
  } : {
    uid: "guest",
    name: "匿名訪客",
    photoURL: "https://api.dicebear.com/7.x/identicon/svg?seed=guest"
  };

  if (isDemoMode) {
    mockTasks.unshift({
      id: "demo-" + Date.now(),
      text,
      priority,
      completed: false,
      createdBy: creator,
      createdAt: new Date().toISOString()
    });
    taskInput.value = "";
    renderMockTasks();
    return;
  }

  try {
    const tasksCol = collection(db, "boards", activeBoardId, "tasks");
    await addDoc(tasksCol, {
      text,
      priority,
      completed: false,
      createdBy: creator,
      createdAt: serverTimestamp()
    });
    taskInput.value = "";
  } catch (err) {
    console.error("Add task error:", err);
    alert("新增失敗: " + err.message);
  }
}

// Toggle Task
async function toggleTaskStatus(taskId, completed) {
  if (isDemoMode) {
    const task = mockTasks.find(t => t.id === taskId);
    if (task) task.completed = completed;
    renderMockTasks();
    return;
  }

  try {
    const taskRef = doc(db, "boards", activeBoardId, "tasks", taskId);
    await updateDoc(taskRef, { completed });
  } catch (err) {
    console.error("Update task error:", err);
  }
}

// Delete Task
async function deleteTask(taskId) {
  if (!confirm("確定要刪除這筆待辦事項嗎？")) return;

  if (isDemoMode) {
    mockTasks = mockTasks.filter(t => t.id !== taskId);
    renderMockTasks();
    return;
  }

  try {
    const taskRef = doc(db, "boards", activeBoardId, "tasks", taskId);
    await deleteDoc(taskRef);
  } catch (err) {
    console.error("Delete task error:", err);
  }
}

// Mock tasks renderer
function renderMockTasks() {
  loadingState.classList.add("hidden");
  renderTasks(mockTasks);
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

// Setup Event Listeners
googleSignInBtn.addEventListener("click", handleGoogleSignIn);
logoutBtn.addEventListener("click", handleSignOut);
addTaskForm.addEventListener("submit", handleAddTask);

// Filter Buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => {
      b.classList.remove("bg-white", "text-indigo-600", "shadow-sm", "font-bold");
      b.classList.add("hover:text-slate-900");
    });
    btn.classList.add("bg-white", "text-indigo-600", "shadow-sm", "font-bold");
    btn.classList.remove("hover:text-slate-900");

    currentFilter = btn.dataset.filter;
    if (isDemoMode) {
      renderMockTasks();
    } else {
      subscribeToTasks();
    }
  });
});

// Config Modal Handlers
openConfigBtn.addEventListener("click", () => {
  populateConfigInputs();
  configModal.classList.remove("hidden");
});
closeConfigBtn.addEventListener("click", () => configModal.classList.add("hidden"));
cancelConfigBtn.addEventListener("click", () => configModal.classList.add("hidden"));

configForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const newConfig = {
    apiKey: cfgApiKey.value.trim(),
    authDomain: cfgAuthDomain.value.trim(),
    projectId: cfgProjectId.value.trim(),
    appId: cfgAppId.value.trim()
  };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
  configModal.classList.add("hidden");
  window.location.reload();
});

// Boards Modal Handlers
newBoardBtn.addEventListener("click", () => newBoardModal.classList.remove("hidden"));
cancelNewBoardBtn.addEventListener("click", () => newBoardModal.classList.add("hidden"));
createBoardForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = newBoardNameInput.value.trim();
  if (!name) return;

  const boardId = "board-" + Date.now();
  const btn = document.createElement("button");
  btn.className = "w-full text-left px-3 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between text-slate-600 hover:bg-slate-100 transition";
  btn.innerHTML = `<span class="truncate flex items-center gap-2"><i class="fa-solid fa-list text-slate-400"></i> ${escapeHtml(name)}</span>`;
  
  btn.addEventListener("click", () => {
    document.querySelectorAll("#boardList button").forEach(b => {
      b.className = "w-full text-left px-3 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between text-slate-600 hover:bg-slate-100 transition";
    });
    btn.className = "w-full text-left px-3 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between bg-indigo-50 text-indigo-700";
    activeBoardId = boardId;
    currentBoardTitle.textContent = name;
    subscribeToTasks();
  });

  boardList.appendChild(btn);
  newBoardNameInput.value = "";
  newBoardModal.classList.add("hidden");

  // Switch to new board
  btn.click();
});

// Init on load
initFirebase();
