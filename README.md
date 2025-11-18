# Django 圖書管理系統 - 台北大學 Python 課程

這是一個使用 Django 開發的圖書管理系統,包含使用者認證、圖書 CRUD、靜態檔案管理和 Google SSO 登入等功能。

## 📋 系統需求

- Python 3.10 或以上版本
- pip (Python 套件管理工具)
- Git

## 🚀 快速開始

### 1. 下載專案

```bash
git clone <網址>
```

### 2. 建立虛擬環境

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate
```

### 3. 安裝相依套件

```bash
pip install -r requirements.txt
```

### 4. 設定環境變數

複製環境變數範例檔案並進行設定:

```bash
cp .env.example .env
```

編輯 `.env` 檔案,至少需要設定以下內容:

```env
SECRET_KEY=你的秘密金鑰
ALLOWED_HOSTS=localhost,127.0.0.1
```

#### 🔑 生成 Django SECRET_KEY

使用以下任一方法生成安全的 SECRET_KEY:

**方法 1: 使用 Python 指令**

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**方法 2: 使用 Django Shell**

```bash
python manage.py shell
```

然後執行:

```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
exit()
```

**方法 3: 使用線上生成器**

- 前往 https://djecrety.ir/
- 複製生成的金鑰

將生成的金鑰貼到 `.env` 檔案中的 `SECRET_KEY=` 後面。

### 5. 執行資料庫遷移

```bash
python manage.py migrate
```
