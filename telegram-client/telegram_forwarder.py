import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from telethon import TelegramClient, events
from telethon.tl.types import PeerChat
from telethon.errors.rpcerrorlist import PeerIdInvalidError, ChatWriteForbiddenError

# ✅ Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

API_ID = "***"
API_HASH = "***"
SESSION_NAME = "telegram_forwarder"

SOURCE_GROUP = PeerChat(00000)  # Group where signals are received
TARGET_BOT_NAME = "*****"  # Bot username (if registered as a bot)
TARGET_USER_ID = 0000  # Fallback user ID

# ✅ Email Config (Send email if bot logs out)
# SMTP_SERVER = "smtp.gmail.com"
# SMTP_PORT = 587
# EMAIL_SENDER = "your-email@gmail.com"
# EMAIL_PASSWORD = "your-email-password"
# EMAIL_RECEIVER = "your-email@gmail.com"


# async def send_email(subject, message):
#     """ Sends an email notification. """
#     try:
#         msg = MIMEText(message)
#         msg["Subject"] = subject
#         msg["From"] = EMAIL_SENDER
#         msg["To"] = EMAIL_RECEIVER

#         server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
#         server.starttls()
#         server.login(EMAIL_SENDER, EMAIL_PASSWORD)
#         server.sendmail(EMAIL_SENDER, EMAIL_RECEIVER, msg.as_string())
#         server.quit()
#         logging.info("📧 Email notification sent.")
#     except Exception as e:
#         logging.error(f"❌ Failed to send email: {e}")


async def detect_bot(client):
    """ Detects whether the target is a bot or a user and returns correct identifier. """
    try:
        entity = await client.get_entity(TARGET_BOT_NAME)
        if getattr(entity, "bot", False):
            logging.info(f"✅ {TARGET_BOT_NAME} is a bot. Using username for forwarding.")
            return TARGET_BOT_NAME  # Use bot username if it's a bot
        else:
            logging.warning(f"⚠️ {TARGET_BOT_NAME} is NOT a bot. Using fallback user ID: {TARGET_USER_ID}")
            return TARGET_USER_ID  # Use user ID if not a bot
    except Exception as e:
        logging.error(f"❌ Failed to detect bot: {e}. Using fallback user ID: {TARGET_USER_ID}")
        return TARGET_USER_ID  # Default to user ID


async def forward_message(client, message_text):
    """ Forwards a message to the bot/user. """
    try:
        recipient = await detect_bot(client)
        logging.info(f"📤 Forwarding message to {recipient}...")
        await client.send_message(recipient, message_text)
        logging.info("✅ Message forwarded successfully!")
    except Exception as e:
        logging.error(f"❌ Failed to forward message: {e}")
        # await send_email("Telegram Bot Alert", f"Failed to forward message: {e}")

async def main():
    """ Main function to monitor Telegram group and forward messages. """
    async with TelegramClient(SESSION_NAME, API_ID, API_HASH) as client:
        me = await client.get_me()
        logging.info(f"✅ Logged in as {me.username}")

        dialogs = await client.get_dialogs()
        for dialog in dialogs:
            print(f"Chat Name: {dialog.name} | ID: {dialog.id}")

        @client.on(events.NewMessage(chats=SOURCE_GROUP))
        async def handler(event):
            message_text = event.raw_text
            logging.info(f"📥 New message received: {message_text}")

            if "Open Price" in message_text:
                logging.info("🔎 Matching keyword found! Forwarding...")
                await forward_message(client, message_text)

        logging.info(f"🚀 Listening for messages in '{SOURCE_GROUP}'...")
        await client.run_until_disconnected()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logging.critical(f"🚨 Bot logged out or crashed: {e}")
        # asyncio.run(send_email("Telegram Bot Logged Out", f"Error: {e}"))
