import asyncio
import logging
import smtplib
import os
from dotenv import load_dotenv
from email.mime.text import MIMEText
from telethon import TelegramClient, events
from telethon.errors.rpcerrorlist import PeerIdInvalidError, ChatWriteForbiddenError

# ✅ Load environment variables from .envrc
load_dotenv(".env")

# ✅ Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# ✅ Load credentials from .envrc
API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME", "telegram_forwarder")
BOT_NAME = os.getenv("BOT_NAME")
GROUP_NAME = os.getenv("GROUP_NAME")
EXECUTE_TRADE = os.getenv("EXECUTE_TRADE", "False").lower() == "true"

# ✅ Email Config (Used for notifications if bot crashes, but email sending is disabled by default)
SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = os.getenv("SMTP_PORT", "587")
EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
EMAIL_RECEIVER = os.getenv("EMAIL_RECEIVER")

async def send_email(subject, message):
    """ Sends an email notification (Disabled by default). """
    try:
        msg = MIMEText(message)
        msg["Subject"] = subject
        msg["From"] = EMAIL_SENDER
        msg["To"] = EMAIL_RECEIVER

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, EMAIL_RECEIVER, msg.as_string())
        server.quit()
        logging.info("📧 Email notification sent.")
    except Exception as e:
        logging.error(f"❌ Failed to send email: {e}")


async def get_ids(client):
    """ Fetches the IDs of the bot and group based on their names. """
    logging.info("🔍 Fetching bot and group IDs...")
    
    dialogs = await client.get_dialogs()
    bot_id, group_id = None, None

    for dialog in dialogs:
        logging.info(f"Chat Name: {dialog.name} | ID: {dialog.id}")
        if dialog.name.strip() == BOT_NAME.strip():
            bot_id = dialog.id
            logging.info(f"✅ Bot '{BOT_NAME}' found with ID: {bot_id}")

        if dialog.name.strip() == GROUP_NAME.strip():
            group_id = dialog.id
            logging.info(f"✅ Group '{GROUP_NAME}' found with ID: {group_id}")

    if bot_id is None or group_id is None:
        logging.error("❌ Could not find bot or group. Check the names in .envrc!")
        exit(1)

    return bot_id, group_id


async def main():
    """ Main function to monitor Telegram group and forward messages. """
    async with TelegramClient(SESSION_NAME, API_ID, API_HASH) as client:
        me = await client.get_me()
        logging.info(f"✅ Logged in as {me.username}")

        # ✅ Get bot and group IDs dynamically
        bot_id, group_id = await get_ids(client)

        @client.on(events.NewMessage(chats=group_id))
        async def group_handler(event):
            """ Handles messages received in the target group. """
            message_text = event.raw_text
            # logging.info(f"📥 New group message received: {message_text}")

            if "Open Price" in message_text:
                logging.info("🔎 Matching keyword found! Forwarding...")

                if EXECUTE_TRADE:                    
                    logging.info("⚡ Adding /tradethis ")
                    modified_message = f"{message_text} \n\n/tradethis"
                    await client.send_message(bot_id, modified_message)
                else:
                    await client.send_message(bot_id, message_text)
                

        logging.info(f"🚀 Listening for messages in '{GROUP_NAME}' and bot '{BOT_NAME}'...")
        await client.run_until_disconnected()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logging.critical(f"🚨 Bot logged out or crashed: {e}")
        # Uncomment to enable email alerts:
        # asyncio.run(send_email("Telegram Bot Logged Out", f"Error: {e}"))
