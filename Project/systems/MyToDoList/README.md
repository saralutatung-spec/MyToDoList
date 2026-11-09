# MyToDoList - 多人即時協作待辦清單

這是一個針對 Firebase 專案 `project-566930163538` 設計的多人即時協作待辦清單網頁應用程式。

## 功能特色
1. **Google 帳號登入**：透過 Firebase Authentication 實現 Google 快速登入，支援顯示頭像與姓名。
2. **多人即時同步**：底層採用 Cloud Firestore 即時監聽 (`onSnapshot`)，任何成員新增、勾選、刪除事項，所有人在線畫面即刻同步更新。
3. **在線協作者動態**：即時顯示目前在線團隊成員。
4. **多看板切換**：支援新增不同主題的協作看板（如：活動籌備、專案 Sprint 等）。
5. **優先級與狀態篩選**：支援設定高／中／低優先級，以及全部／進行中／已完成篩選。
6. **開箱即用介面**：使用 Tailwind CSS 構建現代化高質感 UI。

---

## 啟用步驟 (Firebase Console 設定)

為讓應用程式能完整連線至您的 Firebase 專案 `project-566930163538`：

1. 前往 [Firebase Console](https://console.firebase.google.com/) 並進入專案 `project-566930163538`。
2. **啟用 Authentication (Google 登入)**：
   - 點擊左側選單 **Authentication** > **Sign-in method**。
   - 點擊 **Google** 並開啟啟用開關，設定支援電子郵件後儲存。
   - 在 **Authorized domains (已授權網域)** 確認有 `localhost`（若本機測試）。
3. **啟用 Cloud Firestore (資料庫)**：
   - 點擊左側選單 **Firestore Database** > 建立資料庫。
   - 選擇 **測試模式 (Test mode)** 或設定以下規則以允許協作：
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if true; // 協作清單建議先開啟測試，或設定 if request.auth != null;
         }
       }
     }
     ```
4. **取得 Web App 設定金鑰**：
   - 前往 **專案設定 (Project Settings)** > **一般 (General)**。
   - 在下方「您的應用程式」中新增或點選 Web App (`</>`)。
   - 複製 `apiKey` 與 `appId`。
5. **在應用程式中填入金鑰**：
   - 開啟 `index.html`，點擊右上角「齒輪圖示 (設定)」。
   - 貼上您的 `apiKey` 與 `appId`，點擊儲存即可完成連線！

---

## 如何在本機啟動預覽

直接以瀏覽器開啟 [index.html](file:///c:/Users/saral/OneDrive/Project/systems/MyToDoList/index.html)，或是使用本機 HTTP 伺服器（推薦，因為 Google 登入在 `http://localhost` 下體驗最佳）：

```powershell
# 在 MyToDoList 目錄下啟動輕量伺服器
python -m http.server 3000
# 接著瀏覽器打開 http://localhost:3000
```
