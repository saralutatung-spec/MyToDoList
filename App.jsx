import React, { useState, useEffect } from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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
  doc, 
  setDoc, 
  getDocs,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase.js";

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [inviteInput, setInviteInput] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [emailInviteInput, setEmailInviteInput] = useState("");
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isPublicMode, setIsPublicMode] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskCategory, setTaskCategory] = useState("一般");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  const [filter, setFilter] = useState("all");
  const [copiedLink, setCopiedLink] = useState(false);

  const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        try {
          await setDoc(doc(db, "users", currentUser.uid), {
            uid: currentUser.uid,
            displayName: currentUser.displayName || "未知夥伴",
            email: currentUser.email,
            photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || "User")}`,
            lastSeen: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn("同步使用者資料錯誤:", e);
        }

        const params = new URLSearchParams(window.location.search);
        const joinCode = params.get("join");
        if (joinCode) {
          joinListByCode(joinCode, currentUser);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLists([]);
      setCurrentList(null);
      return;
    }

    const q = query(collection(db, "lists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const isOwner = data.ownerId === user.uid;
        const isPublic = data.isPublic === true;
        const isMember = data.members && data.members.includes(user.uid);
        const isEmailInvited = data.memberEmails && data.memberEmails.includes(user.email);

        if (isOwner || isPublic || isMember || isEmailInvited) {
          fetchedLists.push({ id: d.id, ...data });
        }
      });
      setLists(fetchedLists);

      if (fetchedLists.length > 0) {
        setCurrentList((prev) => {
          if (!prev) return fetchedLists[0];
          const found = fetchedLists.find((l) => l.id === prev.id);
          return found || fetchedLists[0];
        });
      } else {
        createDefaultList(user);
      }
    });

    return () => unsubscribe();
  }, [user]);

  async function createDefaultList(currentUser) {
    const inviteCode = generateInviteCode();
    const docRef = await addDoc(collection(db, "lists"), {
      title: "我的協作待辦清單",
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email,
      ownerPhoto: currentUser.photoURL || "",
      isPublic: true,
      inviteCode: inviteCode,
      members: [currentUser.uid],
      memberEmails: [currentUser.email],
      createdAt: serverTimestamp()
    });
    setCurrentList({
      id: docRef.id,
      title: "我的協作待辦清單",
      ownerId: currentUser.uid,
      isPublic: true,
      inviteCode: inviteCode,
      members: [currentUser.uid],
      memberEmails: [currentUser.email]
    });
  }

  useEffect(() => {
    if (!currentList) {
      setTasks([]);
      return;
    }

    const tasksRef = collection(db, "lists", currentList.id, "tasks");
    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const fetchedTasks = [];
      snapshot.forEach((d) => {
        fetchedTasks.push({ id: d.id, ...d.data() });
      });
      fetchedTasks.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setTasks(fetchedTasks);
    });

    return () => unsubscribe();
  }, [currentList?.id]);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [user, lists, currentList, tasks, showInviteModal, showNewListModal]);

  const handleLogin = async () => {
    if (!isConfigured) {
      alert("請先於 firebase.js 填入有效的 Firebase API Key 設定！");
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert("登入失敗: " + e.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const joinListByCode = async (codeToJoin, activeUser = user) => {
    if (!codeToJoin) return;
    const cleanCode = codeToJoin.trim().toUpperCase();
    try {
      const q = query(collection(db, "lists"), where("inviteCode", "==", cleanCode));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("找不到此邀請碼對應的清單，請確認代碼是否正確！");
        return;
      }
      const listDoc = snap.docs[0];
      const listData = listDoc.data();

      if (activeUser) {
        await updateDoc(doc(db, "lists", listDoc.id), {
          members: arrayUnion(activeUser.uid),
          memberEmails: arrayUnion(activeUser.email)
        });
      }

      setCurrentList({ id: listDoc.id, ...listData });
      setInviteInput("");
      alert(`🎉 成功加入協作清單「${listData.title}」！`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      alert("加入失敗: " + err.message);
    }
  };

  const handleAddEmailInvite = async () => {
    if (!emailInviteInput.trim()) return;
    const targetEmail = emailInviteInput.trim().toLowerCase();
    try {
      await updateDoc(doc(db, "lists", currentList.id), {
        memberEmails: arrayUnion(targetEmail)
      });
      setEmailInviteInput("");
      alert(`已成功將 ${targetEmail} 加入清單協作成員！`);
    } catch (e) {
      alert("邀請失敗: " + e.message);
    }
  };

  const handleTogglePublic = async () => {
    if (!currentList) return;
    const newStatus = !currentList.isPublic;
    try {
      await updateDoc(doc(db, "lists", currentList.id), {
        isPublic: newStatus
      });
      setCurrentList({ ...currentList, isPublic: newStatus });
    } catch (e) {
      alert("更新權限失敗: " + e.message);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const code = generateInviteCode();
      const docRef = await addDoc(collection(db, "lists"), {
        title: newListName.trim(),
        ownerId: user.uid,
        ownerName: user.displayName || user.email,
        ownerPhoto: user.photoURL || "",
        isPublic: isPublicMode,
        inviteCode: code,
        members: [user.uid],
        memberEmails: [user.email],
        createdAt: serverTimestamp()
      });
      setNewListName("");
      setShowNewListModal(false);
      setCurrentList({
        id: docRef.id,
        title: newListName.trim(),
        ownerId: user.uid,
        isPublic: isPublicMode,
        inviteCode: code,
        members: [user.uid],
        memberEmails: [user.email]
      });
    } catch (err) {
      alert("建立清單失敗: " + err.message);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !currentList) return;

    try {
      await addDoc(collection(db, "lists", currentList.id, "tasks"), {
        title: taskTitle.trim(),
        priority: taskPriority,
        category: taskCategory.trim() || "一般",
        dueDate: taskDueDate || null,
        notes: taskNotes.trim() || "",
        assignee: taskAssignee.trim() || null,
        completed: false,
        createdBy: {
          uid: user.uid,
          name: user.displayName || user.email,
          photoURL: user.photoURL || ""
        },
        completedBy: null,
        completedAt: null,
        createdAt: serverTimestamp()
      });

      setTaskTitle("");
      setTaskNotes("");
      setTaskDueDate("");
      setTaskAssignee("");
    } catch (err) {
      alert("新增任務失敗: " + err.message);
    }
  };

  const handleToggleTask = async (task) => {
    const isDone = !task.completed;
    try {
      await updateDoc(doc(db, "lists", currentList.id, "tasks", task.id), {
        completed: isDone,
        completedBy: isDone ? {
          uid: user.uid,
          name: user.displayName || user.email,
          photoURL: user.photoURL || ""
        } : null,
        completedAt: isDone ? serverTimestamp() : null
      });
    } catch (err) {
      console.error("更新任務失敗:", err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("確定要刪除這筆待辦事項嗎？")) return;
    try {
      await deleteDoc(doc(db, "lists", currentList.id, "tasks", taskId));
    } catch (err) {
      alert("刪除失敗: " + err.message);
    }
  };

  const copyInviteLink = () => {
    if (!currentList?.inviteCode) return;
    const url = `${window.location.origin}${window.location.pathname}?join=${currentList.inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      
      {/* 登入後頂部導航列 */}
      {user && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                <i data-lucide="check-square" className="w-5 h-5"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">MyToDoList</h1>
                <p className="text-xs text-slate-500">基於 Firebase 的多人即時協作待辦清單</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}`} 
                  className="w-8 h-8 rounded-full border border-slate-200" 
                  alt="avatar" 
                />
                <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.displayName || user.email}</span>
              </div>
              <button 
                onClick={handleLogout} 
                className="text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded border border-slate-200 hover:border-red-200 hover:bg-red-50 transition"
              >
                登出
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 尚未登入時：完全還原老師課堂的登入卡片介面 */}
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-4 min-h-screen bg-slate-50/60">
          <div className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 max-w-[420px] w-full text-center shadow-xl shadow-slate-200/50 space-y-6">
            
            {/* 圖示 */}
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 11 3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
            </div>

            {/* 標題與副標 */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">MyToDoList</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">基於 Firebase 的多人即時協作待辦清單</p>
            </div>

            {/* 功能特色面板 */}
            <div className="bg-slate-50/90 rounded-2xl p-4 text-left space-y-3 border border-slate-100 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <span className="text-indigo-600 text-sm leading-none mt-0.5">✨</span>
                <span>Google 帳號一鍵安全登入</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 text-sm leading-none mt-0.5">👥</span>
                <span>透過 Email、6 碼邀請碼或公開清單多人即時協作</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-sky-600 text-sm leading-none mt-0.5">☑️</span>
                <span>支援任務指派、優先順序、到期日與即時同步狀態</span>
              </div>
            </div>

            {/* Google 登入按鈕 */}
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-2xl shadow-sm transition active:scale-[0.99]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              使用 Google 帳號登入
            </button>

            {!isConfigured && (
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                提示：請先在 <code className="font-mono">firebase.js</code> 填入您的 Firebase Web 金鑰。
              </p>
            )}

          </div>
        </div>
      ) : (
        /* 登入後的協作儀表板 */
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* 左側邊欄：清單管理 & 邀請碼加入 */}
          <aside className="lg:col-span-1 space-y-4">
            
            {/* 輸入 6 碼邀請碼加入 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="key" className="w-3.5 h-3.5 text-indigo-500"></i> 輸入 6 碼邀請碼加入
              </h3>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  maxLength={6}
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="例如: A7K9X2" 
                  className="w-full uppercase tracking-wider font-mono text-center text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button 
                  onClick={() => joinListByCode(inviteInput)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shrink-0 transition"
                >
                  加入
                </button>
              </div>
            </div>

            {/* 我的協作清單列表 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">我的協作清單</h3>
                <button 
                  onClick={() => setShowNewListModal(true)} 
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                >
                  <i data-lucide="plus" className="w-3.5 h-3.5"></i> 新增清單
                </button>
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setCurrentList(l)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center justify-between ${
                      currentList?.id === l.id 
                        ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200" 
                        : "hover:bg-slate-50 text-slate-600 border border-transparent"
                    }`}
                  >
                    <div className="truncate flex items-center gap-2">
                      <i data-lucide={l.isPublic ? "globe" : "lock"} className="w-3.5 h-3.5 shrink-0 opacity-70"></i>
                      <span className="truncate">{l.title}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {l.inviteCode}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 當前清單邀請與成員控制 */}
            {currentList && (
              <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-900">專屬 6 碼邀請碼</span>
                  <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-600">
                    {currentList.inviteCode || "無"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={copyInviteLink} 
                    className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-1"
                  >
                    <i data-lucide={copiedLink ? "check" : "copy"} className="w-3.5 h-3.5"></i>
                    {copiedLink ? "已複製邀請連結！" : "複製邀請連結"}
                  </button>
                  <button 
                    onClick={() => setShowInviteModal(true)}
                    className="py-1.5 px-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium transition flex items-center justify-center gap-1"
                    title="邀請 Gmail 夥伴"
                  >
                    <i data-lucide="user-plus" className="w-3.5 h-3.5"></i> 邀請
                  </button>
                </div>

                <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between">
                  <span>協作模式：</span>
                  <button 
                    onClick={handleTogglePublic}
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] transition ${
                      currentList.isPublic 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {currentList.isPublic ? "🌐 公開協作模式" : "🔒 專屬受邀模式"}
                  </button>
                </div>
              </div>
            )}
          </aside>

          {/* 右側主要看板 */}
          <main className="lg:col-span-3 space-y-4">
            
            {/* 清單頂部資訊 & 完成進度條 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{currentList?.title || "待辦清單"}</h2>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      currentList?.isPublic ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}>
                      {currentList?.isPublic ? "公開協作" : "專屬受邀"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    建立者: {currentList?.ownerName || "團隊"} • 參與成員: {(currentList?.memberEmails?.length || 1)} 人
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">整體完成進度：</span>
                  <span className="text-sm font-bold text-indigo-600 font-mono">{progressPercent}%</span>
                </div>
              </div>

              {/* 進度條 */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* 新增任務表單 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <form onSubmit={handleAddTask} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="輸入待辦事項名稱..."
                    required
                    className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 shadow transition shrink-0"
                  >
                    <i data-lucide="plus" className="w-4 h-4"></i> 新增任務
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">優先順序</label>
                    <select 
                      value={taskPriority} 
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none"
                    >
                      <option value="high">🔥 高優先度</option>
                      <option value="medium">⚡ 中優先度</option>
                      <option value="low">☕ 低優先度</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">分類標籤</label>
                    <input 
                      type="text" 
                      value={taskCategory}
                      onChange={(e) => setTaskCategory(e.target.value)}
                      placeholder="如: 開發、會議" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">到期日</label>
                    <input 
                      type="date" 
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">指派特定協作成員</label>
                    <input 
                      type="text" 
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      placeholder="姓名或 Email" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                    />
                  </div>
                </div>

                <div>
                  <input 
                    type="text" 
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    placeholder="補充備註細節（選填）..." 
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </form>
            </div>

            {/* 篩選列 */}
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 px-1">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setFilter("all")}
                  className={`transition ${filter === "all" ? "font-bold text-indigo-600 underline underline-offset-4" : "hover:text-slate-800"}`}
                >
                  全部 ({totalTasks})
                </button>
                <span>•</span>
                <button 
                  onClick={() => setFilter("active")}
                  className={`transition ${filter === "active" ? "font-bold text-indigo-600 underline underline-offset-4" : "hover:text-slate-800"}`}
                >
                  未完成 ({totalTasks - completedTasks})
                </button>
                <span>•</span>
                <button 
                  onClick={() => setFilter("completed")}
                  className={`transition ${filter === "completed" ? "font-bold text-indigo-600 underline underline-offset-4" : "hover:text-slate-800"}`}
                >
                  已完成 ({completedTasks})
                </button>
              </div>

              <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                即時雲端同步中
              </span>
            </div>

            {/* 待辦事項列表 */}
            <div className="space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                  <div className="w-12 h-12 mx-auto bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-2">
                    <i data-lucide="check" className="w-6 h-6"></i>
                  </div>
                  <p className="text-sm font-medium text-slate-600">目前沒有符合的待辦事項</p>
                  <p className="text-xs text-slate-400 mt-1">在上方輸入項目名稱，隨時與成員一起協作！</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`group bg-white p-4 rounded-xl border transition flex items-start justify-between gap-3 shadow-sm ${
                      task.completed ? "border-slate-200 bg-slate-50/60" : "border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input 
                        type="checkbox" 
                        checked={task.completed} 
                        onChange={() => handleToggleTask(task)}
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                            {task.title}
                          </p>
                          {task.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                              🏷️ {task.category}
                            </span>
                          )}
                          {task.priority === "high" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 font-medium">🔥 高</span>
                          )}
                          {task.priority === "medium" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium">⚡ 中</span>
                          )}
                          {task.priority === "low" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">☕ 低</span>
                          )}
                        </div>

                        {task.notes && (
                          <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                            {task.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <i data-lucide="user" className="w-3 h-3"></i> 建立: {task.createdBy?.name || "未知"}
                          </span>
                          {task.assignee && (
                            <span className="flex items-center gap-1 text-indigo-600 font-medium">
                              <i data-lucide="user-check" className="w-3 h-3"></i> 指派: {task.assignee}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <i data-lucide="calendar" className="w-3 h-3"></i> 到期: {task.dueDate}
                            </span>
                          )}
                          {task.completed && task.completedBy && (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <i data-lucide="check-circle" className="w-3 h-3"></i> 由 {task.completedBy.name} 勾選完成
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                      title="刪除待辦"
                    >
                      <i data-lucide="trash-2" className="w-4 h-4"></i>
                    </button>
                  </div>
                ))
              )}
            </div>

          </main>
        </div>
      )}

      {/* 彈出視窗：邀請 Gmail 夥伴 */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="mail" className="w-5 h-5 text-indigo-600"></i> 透過 Google Email 邀請夥伴
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <i data-lucide="x" className="w-5 h-5"></i>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              輸入夥伴的 Google Gmail 信箱，將其直接加入本清單協作名單。
            </p>
            <div className="flex gap-2">
              <input 
                type="email" 
                value={emailInviteInput} 
                onChange={(e) => setEmailInviteInput(e.target.value)}
                placeholder="partner@gmail.com" 
                className="flex-1 text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={handleAddEmailInvite}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition"
              >
                加入
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600 block mb-2">已受邀成員清單：</span>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {currentList?.memberEmails?.map((em, idx) => (
                  <div key={idx} className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded flex items-center justify-between">
                    <span>{em}</span>
                    <span className="text-[10px] text-slate-400">{em === user.email ? "(您)" : "成員"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 彈出視窗：新增自訂清單 */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">建立新的協作清單</h3>
              <button onClick={() => setShowNewListModal(false)} className="text-slate-400 hover:text-slate-600">
                <i data-lucide="x" className="w-5 h-5"></i>
              </button>
            </div>
            <form onSubmit={handleCreateList} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">清單名稱</label>
                <input 
                  type="text" 
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="例如: 2026 產品衝刺計畫"
                  required
                  className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="publicCheck" 
                  checked={isPublicMode} 
                  onChange={(e) => setIsPublicMode(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="publicCheck" className="text-xs text-slate-600 cursor-pointer">
                  設為公開協作模式（所有登入使用者皆可存取）
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowNewListModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium"
                >
                  確認建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 頁尾 */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        MyToDoList • Firebase 專案協作應用 (project-566930163538)
      </footer>

    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
