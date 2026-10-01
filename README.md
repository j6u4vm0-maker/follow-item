# TaskFlow 部門協作平台

以 Django 5 與 PostgreSQL 建置的繁體中文部門工作管理系統，提供工作追蹤、組織範圍篩選、行事曆、專案看板、問題便箋及會議中心。

## 功能

- 使用者、部門組織與角色權限管理
- 工作新增、編輯、狀態更新、進度追蹤、搜尋與 Excel 匯出
- 依部門、課別或組別篩選工作，並在儀表板查看今日、本週和逾期項目
- 工作行事曆、專案與里程碑管理
- 問題便箋與會議紀錄，會議行動事項可連結工作單

## 在公司電腦啟動（Windows + Docker Desktop）

先安裝並啟動 Git 與 Docker Desktop，再以 PowerShell 執行：

```powershell
git clone https://github.com/j6u4vm0-maker/follow-item.git
cd follow-item
Copy-Item .env.example .env
```

首次啟動前，請編輯 `.env`，設定新的 `SECRET_KEY`，並更改資料庫密碼。接著啟動：

```powershell
docker compose up --build -d
docker compose exec web python manage.py createsuperuser
```

在瀏覽器開啟 <http://localhost:8000/>，登入後可從「組織與人員」建立或匯入組織及帳號。查看服務狀態：

```powershell
docker compose ps
```

停止服務：

```powershell
docker compose down
```

資料庫會保存在 Docker volume，停止容器不會刪除資料。不要使用 `docker compose down -v`，除非確定要清空本機資料庫與附件。

## 更新程式

在專案資料夾內執行：

```powershell
git pull
docker compose up --build -d
```

## 本機 Python 開發

需安裝 Python 3.12 與 PostgreSQL 16，並將 `.env` 的 `DATABASE_URL` 設為本機 PostgreSQL 連線：

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## 安全設定

- `.env` 不可提交到 GitHub；此檔只保存在各自電腦。
- 正式部署時設定強密鑰、`DEBUG=False`、適當的 `ALLOWED_HOSTS`、HTTPS 與資料庫備份。
- GitHub 倉庫僅保存程式碼，不包含本機 PostgreSQL 資料或媒體附件；換電腦時須另行搬移資料庫備份。
