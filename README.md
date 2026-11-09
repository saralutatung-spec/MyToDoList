# MyToDoList - 多人即時協作待辦清單

一個支援 **Google 帳號登入** 與 **多人即時協作** 的現代化待辦清單 Web 應用程式，使用 Firebase 專案 `project-566930163538`。

---

## 🌟 核心功能特色

### 1. Google 帳號一鍵登入
- 透過 Firebase Authentication 實現 Google 授權登入。
- 自動同步並儲存使用者 Google 個人檔案與頭像（`/users/{userId}`）。

### 2. 三大多人協作加入機制
1. **專屬 6 碼邀請碼 / 連結**：
   - 每個清單自動產生 6 碼英數代碼（例如：`A7K9X2`）。
   - 夥伴可直接在介面輸入邀請碼加入，或透過一鍵複製的 `?join=邀請碼` 連結自動加入。
2. **Google Email 邀請**：
   - 點選「邀請」輸入夥伴的 Gmail 信箱，即可直接加入協作名單。
3. **公開協作模式切換**：
   - 支援將清單設為「🌐 公開協作」（所有已登入使用者皆可存取編輯）或「🔒 專屬受邀」（僅限清單擁有者與受邀名單）。

### 3. 待辦事項即時同步與進度追蹤
- 基於 Cloud Firestore `onSnapshot` 即時資料流監聽。
- 支援任務**優先順序（高 🔥 / 中 ⚡ / 低 ☕）**、**分類標籤**、**到期日**、**補充備註**與**指派協作成員**。
- 清晰追蹤任務**由誰建立**與**由誰勾選完成**。
- 即時計算並呈現清單的**整體完成進度百分比 (%)** 與視覺化進度條。

---

## 📁 專案架構

```text
MyToDoList/
├── App.jsx             # React 前端主程式 (React 18 + Tailwind CSS + Lucide 圖示)
├── index.html          # HTML 入口
├── firebase.js         # Firebase SDK 設定檔 (專案 ID: project-566930163538)
├── firebase.json       # Firebase Hosting 部署設定
├── firestore.rules     # Cloud Firestore 安全性讀寫規則 (/users, /lists, /tasks)
└── README.md           # 專案說明文件
```

---

## 🚀 快速開始

### 1. 取得 Firebase Web SDK 設定
請前往 [Firebase Console - project-566930163538](https://console.firebase.google.com/project/project-566930163538/settings/general/)，在「一般」>「您的應用程式」中註冊 Web App 並將 `apiKey`、`appId` 填入 `firebase.js`：

```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "project-566930163538.firebaseapp.com",
  projectId: "project-566930163538",
  storageBucket: "project-566930163538.firebasestorage.app",
  messagingSenderId: "566930163538",
  appId: "YOUR_APP_ID"
};
```

### 2. 啟動本機伺服器
在終端機中切換至專案目錄：
```bash
python -m http.server 8000
```
開啟瀏覽器前往 `http://localhost:8000` 即可開始使用！

---

## 🔒 Firestore 安全規則
專案中已配置 `firestore.rules`，支援使用者檔案防護與協作清單成員讀寫權限控管。
