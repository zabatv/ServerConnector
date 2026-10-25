import asyncio
import logging
import re
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.types import Message

BOT_TOKEN = "ВСТАВЬ_СВОЙ_ТОКЕН"
BAD_WORDS_FILE = Path(__file__).with_name("bad_words.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("moderator")


def load_bad_words(path: Path) -> set[str]:
    if not path.exists():
        log.warning("нет файла %s — список пуст", path)
        return set()
    words = {
        line.strip().lower()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    log.info("загружено слов для фильтра: %d", len(words))
    return words


bad_words = load_bad_words(BAD_WORDS_FILE)

# убираем пунктуацию и сравниваем отдельные слова
word_re = re.compile(r"[\wа-яё]+", re.IGNORECASE | re.UNICODE)


def contains_bad_word(text: str) -> bool:
    words = {w.lower() for w in word_re.findall(text)}
    return bool(words & bad_words)


dp = Dispatcher()


@dp.message(F.text)
async def moderate(message: Message):
    if not contains_bad_word(message.text):
        return
    try:
        await message.delete()
    except Exception as e:
        log.warning(
            "не смог удалить сообщение %s в чате %s: %s",
            message.message_id,
            message.chat.id,
            e,
        )
        return
    log.info(
        "удалено сообщение %s от %s в чате %s",
        message.message_id,
        message.from_user.id if message.from_user else "?",
        message.chat.id,
    )


async def main():
    bot = Bot(BOT_TOKEN)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
