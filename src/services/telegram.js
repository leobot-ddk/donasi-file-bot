// ======================================================
// TELEGRAM API
// ======================================================

export async function telegram(
  env,
  method,
  data = {}
) {

  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN belum diset."
    );
  }

  const url =
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            cleanData(data)
          )
      }
    );

  const text =
    await response.text();

  let result;

  try {

    result =
      JSON.parse(text);

  } catch {

    throw new Error(
      `Telegram ${method}: ${text}`
    );

  }

  if (
    !response.ok ||
    !result.ok
  ) {

    throw new Error(
      `Telegram ${method}: ${
        result.description ||
        text
      }`
    );

  }

  return result.result;
}


// ======================================================
// CLEAN UNDEFINED
// ======================================================

function cleanData(data) {

  const output = {};

  for (
    const [key, value]
    of Object.entries(data || {})
  ) {

    if (
      value !== undefined
    ) {

      output[key] =
        value;

    }

  }

  return output;
}


// ======================================================
// SEND MESSAGE
// ======================================================

export async function sendMessage(
  env,
  chatId,
  text,
  options = {}
) {

  return telegram(
    env,
    "sendMessage",
    {
      chat_id:
        chatId,

      text,

      ...options
    }
  );

}


// ======================================================
// EDIT MESSAGE
// ======================================================

export async function editMessageText(
  env,
  chatId,
  messageId,
  text,
  options = {}
) {

  return telegram(
    env,
    "editMessageText",
    {
      chat_id:
        chatId,

      message_id:
        messageId,

      text,

      ...options
    }
  );

}


// ======================================================
// ANSWER CALLBACK
// ======================================================

export async function answerCallbackQuery(
  env,
  callbackQueryId,
  text = "",
  options = {}
) {

  return telegram(
    env,
    "answerCallbackQuery",
    {
      callback_query_id:
        callbackQueryId,

      ...(text
        ? {
            text
          }
        : {}),

      ...options
    }
  );

}


// ======================================================
// DELETE MESSAGE
// ======================================================

export async function deleteMessage(
  env,
  chatId,
  messageId
) {

  return telegram(
    env,
    "deleteMessage",
    {
      chat_id:
        chatId,

      message_id:
        messageId
    }
  );

}


// ======================================================
// SEND DOCUMENT
// ======================================================

export async function sendDocument(
  env,
  chatId,
  document,
  options = {}
) {

  return telegram(
    env,
    "sendDocument",
    {
      chat_id:
        chatId,

      document,

      ...options
    }
  );

}


// ======================================================
// SEND PHOTO
// ======================================================

export async function sendPhoto(
  env,
  chatId,
  photo,
  options = {}
) {

  return telegram(
    env,
    "sendPhoto",
    {
      chat_id:
        chatId,

      photo,

      ...options
    }
  );

}


// ======================================================
// SEND VIDEO
// ======================================================

export async function sendVideo(
  env,
  chatId,
  video,
  options = {}
) {

  return telegram(
    env,
    "sendVideo",
    {
      chat_id:
        chatId,

      video,

      ...options
    }
  );

}


// ======================================================
// SEND AUDIO
// ======================================================

export async function sendAudio(
  env,
  chatId,
  audio,
  options = {}
) {

  return telegram(
    env,
    "sendAudio",
    {
      chat_id:
        chatId,

      audio,

      ...options
    }
  );

}


// ======================================================
// SEND VOICE
// ======================================================

export async function sendVoice(
  env,
  chatId,
  voice,
  options = {}
) {

  return telegram(
    env,
    "sendVoice",
    {
      chat_id:
        chatId,

      voice,

      ...options
    }
  );

}


// ======================================================
// SEND ANIMATION
// ======================================================

export async function sendAnimation(
  env,
  chatId,
  animation,
  options = {}
) {

  return telegram(
    env,
    "sendAnimation",
    {
      chat_id:
        chatId,

      animation,

      ...options
    }
  );

}


// ======================================================
// SEND VIDEO NOTE
// ======================================================

export async function sendVideoNote(
  env,
  chatId,
  videoNote,
  options = {}
) {

  return telegram(
    env,
    "sendVideoNote",
    {
      chat_id:
        chatId,

      video_note:
        videoNote,

      ...options
    }
  );

}


// ======================================================
// SEND STICKER
// ======================================================

export async function sendSticker(
  env,
  chatId,
  sticker,
  options = {}
) {

  return telegram(
    env,
    "sendSticker",
    {
      chat_id:
        chatId,

      sticker,

      ...options
    }
  );

}


// ======================================================
// GET ME
// ======================================================

export async function getMe(
  env
) {

  return telegram(
    env,
    "getMe"
  );

}


// ======================================================
// SET WEBHOOK
// ======================================================

export async function setWebhook(
  env,
  webhookUrl,
  options = {}
) {

  return telegram(
    env,
    "setWebhook",
    {
      url:
        webhookUrl,

      ...options
    }
  );

}
