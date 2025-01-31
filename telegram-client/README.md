# Telegram Forwarder Bot

## 📌 Description
This bot listens for messages in a Telegram group and forwards specific messages to a bot. It also listens to messages sent to the bot and responds to `/tradelast` if trade execution is enabled.

Add data to .env file

## 🚀 Setup Instructions

### 1️⃣ Install Dependencies
```bash
pip install telethon python-dotenv

source .env
```

### 2️⃣ Run the Bot Manually
```bash
python3 telegram_forwarder.py
```

### 3️⃣ Run in Background (Linux/macOS)
```bash
nohup python3 telegram_forwarder.py > output.log 2>&1 &
```

### 4️⃣ Check Logs
```bash
tail -f output.log
```

### 5️⃣ Stop the Bot
```bash
ps aux | grep telegram_forwarder.py
kill -9 <PID>
```