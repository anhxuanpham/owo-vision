# 🚀 LongAKolangle Deployment Guide

Hướng dẫn deploy LongAKolangle (ADOTF API) để serve captcha solving cho các selfbot.

---

## 📋 Yêu cầu

- **Node.js** 20+ hoặc **Docker**
- **Discord Bot Token** (từ Discord Developer Portal)
- **VPS/Server** với RAM ≥ 512MB

---

## 🔧 Bước 1: Tạo Discord Bot

### 1.1 Tạo Application

1. Truy cập [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** → Đặt tên (ví dụ: `ADOTF API`)
3. Vào tab **"Bot"** → Click **"Add Bot"**
4. Copy **Token** → Lưu lại (sẽ dùng ở bước sau)

### 1.2 Cấu hình Bot

Trong tab **Bot**, bật các options:
- ✅ **MESSAGE CONTENT INTENT** (bắt buộc)

### 1.3 Tạo Invite Link

Vào tab **OAuth2** → **URL Generator**:
- **Scopes**: `bot`, `applications.commands`
- **Bot Permissions**: `Send Messages`, `Use Slash Commands`

Copy URL và invite bot vào server Discord của bạn.

### 1.4 Lấy Application ID

Trong tab **General Information**, copy **Application ID**.

> ⚠️ **Quan trọng**: Application ID này cần config trong advanced-owo-farm!

---

## 🐳 Bước 2: Deploy với Docker (Recommended)

### 2.1 Clone repository

```bash
git clone <your-repo-url> longakolangle
cd longakolangle
```

### 2.2 Tạo file .env

```bash
cp .env.example .env
nano .env  # hoặc vim .env
```

Điền token:
```env
BOT_TOKEN=your_discord_bot_token_here
```

### 2.3 Build và Run

```bash
# Sử dụng docker-compose (recommended)
docker-compose up -d

# Hoặc build thủ công
docker build -t longakolangle .
docker run -d --name adotf-api -e BOT_TOKEN=xxx longakolangle
```

### 2.4 Kiểm tra logs

```bash
docker logs -f adotf-api
```

Nếu thành công, sẽ thấy:
```
[INFO] ✓ Huntbot model loaded successfully
[INFO] Attempting to login to Discord...
[INFO] Ready! Logged in as ADOTF API
```

---

## 💻 Bước 2 (Alternative): Deploy không Docker

### 2.1 Cài đặt dependencies

```bash
git clone <your-repo-url> longakolangle
cd longakolangle
npm install
```

### 2.2 Build và chạy

```bash
# Build TypeScript
npm run build

# Chạy trực tiếp
npm start

# Hoặc với PM2 (production)
npm install -g pm2
pm2 start dist/index.js --name "adotf-api"
pm2 save
pm2 startup  # Tự động start khi reboot
```

---

## ⚙️ Bước 3: Config advanced-owo-farm

### 3.1 Cập nhật Application ID (miraiID)

Mở file trong project **advanced-discord-owo-tool-farm**:

```
src/structure/BaseAgent.ts (Line 32)
```

Tìm dòng:
```typescript
public readonly miraiID = "1205422490969579530"
```

Thay đổi thành Application ID của bot bạn:
```typescript
public readonly miraiID = "YOUR_APPLICATION_ID_HERE"
```

> **Lưu ý**: 
> - Application ID lấy từ Discord Developer Portal → General Information
> - Sau khi thay đổi, cần rebuild: `npm run build`

### 3.2 Config selfbot

Trong config selfbot (`accounts/your-account/config.json`):

```json
{
    "autoHuntbot": true,
    "useAdotfAPI": true
}
```

### 3.3 Invite bot vào server

Đảm bảo LongAKolangle bot được invite vào **cùng server** với OwO bot mà selfbot đang farm.

---

## ✅ Bước 4: Verify hoạt động

### 4.1 Test thủ công

Trong Discord, gõ:
```
/solve huntbot url:<link_ảnh_huntbot>
```

Nếu hoạt động, bot sẽ trả về JSON:
```json
{
  "result": "xY8k2",
  "avgConfidence": "98.50%",
  "time": "75.23"
}
```

### 4.2 Test với selfbot

Chạy selfbot và đợi đến khi cần solve huntbot. Check logs:
```
[DATA] ✓ Solution found: xY8k2 (98.50% confidence)
```

---

## 🔧 Troubleshooting

### Bot không respond slash command

1. Đảm bảo bot đã được invite với permission `applications.commands`
2. Đợi 1-2 tiếng để Discord sync slash commands
3. Thử restart bot

### ONNX model load failed

```bash
# Đảm bảo có file model
ls -la src/models/huntbot.onnx
```

### Lỗi "No instance found for token"

Container chưa khởi tạo xong. Đợi vài giây và thử lại.

---

## 📊 Resource Usage

| Metric | Value |
|--------|-------|
| **RAM** | ~150-250MB |
| **CPU** | ~5-10% (idle), ~30-50% (inference) |
| **Disk** | ~200MB (with dependencies) |
| **Inference Time** | ~50-100ms per captcha |

---

## 🔄 Update

```bash
# Pull latest code
git pull

# Rebuild và restart
docker-compose down
docker-compose build
docker-compose up -d
```
