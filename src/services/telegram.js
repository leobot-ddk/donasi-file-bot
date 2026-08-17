// ======================================================
// TELEGRAM API SERVICE
// ======================================================

function getBotToken(env) {

  const token =
    env.TELEGRAM_BOT_TOKEN;

  if (!token) {

    throw new Error(
      "TELEGRAM_BOT_TOKEN belum diset."
    );

  }

  return token;

}


// ======================================================
// TELEGRAM REQUEST
// ======================================================

export async function telegram(
  env,
  method,
  body = {}
) {

  const token =
    getBotToken(env);


  const url =
    `https://api.telegram.org/bot${token}/${method}`;


  const response =
    await fetch(
      url,
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(body)

      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `Telegram ${method} invalid response: ${text}`
    );

  }


  if (
    !response.ok ||
    !data.ok
  ) {

    console.error(
      `TELEGRAM ${method} ERROR:`,
      {

        status:
          response.status,

        description:
          data.description,

        body

      }
    );


    throw new Error(
      `Telegram ${method} error: ` +
      `${data.description || text}`
    );

  }


  return data.result;

}


// ======================================================
// SEND MESSAGE
// ======================================================

export async function sendMessage(
  env,
  chatId,
  text,
  extra = {}
) {

  return telegram(
    env,
    "sendMessage",
    {

      chat_id:
        chatId,

      text,

      ...extra

    }
  );

}


// ======================================================
// ANSWER CALLBACK QUERY
// ======================================================

export async function answerCallbackQuery(
  env,
  callbackQueryId,
  text = null
) {

  const body = {

    callback_query_id:
      callbackQueryId

  };


  if (text) {

    body.text =
      text;

  }


  return telegram(
    env,
    "answerCallbackQuery",
    body
  );

}


// ======================================================
// EDIT MESSAGE TEXT
// ======================================================

export async function editMessageText(
  env,
  chatId,
  messageId,
  text,
  extra = {}
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

      ...extra

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
// DELETE FILE YANG DIKIRIM BOT
// ======================================================

export async function deleteBotFile(
  env,
  chatId,
  messageId
) {

  if (
    !chatId ||
    !messageId
  ) {

    console.error(
      "DELETE BOT FILE: chatId/messageId kosong",
      {
        chatId,
        messageId
      }
    );

    return false;

  }


  try {

    const result =
      await telegram(
        env,
        "deleteMessage",
        {

          chat_id:
            chatId,

          message_id:
            messageId

        }
      );


    console.log(
      "DELETE BOT FILE BERHASIL:",
      {
        chatId,
        messageId,
        result
      }
    );


    return true;

  } catch (error) {

    console.error(
      "DELETE BOT FILE GAGAL:",
      {
        chatId,
        messageId,

        error:
          error?.message ||
          String(error)

      }
    );


    return false;

  }

}


// ======================================================
// FORWARD MESSAGE
// ======================================================

export async function forwardMessage(
  env,
  chatId,
  fromChatId,
  messageId
) {

  return telegram(
    env,
    "forwardMessage",
    {

      chat_id:
        chatId,

      from_chat_id:
        fromChatId,

      message_id:
        messageId

    }
  );

}


// ======================================================
// COPY MESSAGE
// ======================================================
//
// Menyalin pesan/file dari chat user ke grup admin.
//
// Tidak menggunakan forwardMessage sehingga hasilnya
// menjadi salinan biasa, bukan pesan "Forwarded".
//
// ======================================================

export async function copyMessage(
  env,
  chatId,
  fromChatId,
  messageId,
  extra = {}
) {

  if (!chatId) {

    throw new Error(
      "COPY MESSAGE: chat_id kosong."
    );

  }


  if (!fromChatId) {

    throw new Error(
      "COPY MESSAGE: from_chat_id kosong."
    );

  }


  if (!messageId) {

    throw new Error(
      "COPY MESSAGE: message_id kosong."
    );

  }


  const body = {

    chat_id:
      chatId,

    from_chat_id:
      fromChatId,

    message_id:
      messageId,

    ...extra

  };


  try {

    const result =
      await telegram(
        env,
        "copyMessage",
        body
      );


    console.log(
      "COPY MESSAGE BERHASIL:",
      {

        chatId,

        fromChatId,

        messageId,

        result

      }
    );


    return result;

  } catch (error) {

    console.error(
      "COPY MESSAGE GAGAL:",
      {

        chatId,

        fromChatId,

        messageId,

        body,

        error:
          error?.message ||
          String(error)

      }
    );


    throw error;

  }

}


// ======================================================
// GET FILE
// ======================================================

export async function getFile(
  env,
  fileId
) {

  return telegram(
    env,
    "getFile",
    {

      file_id:
        fileId

    }
  );

}


// ======================================================
// SET WEBHOOK
// ======================================================

export async function setWebhook(
  env,
  webhookUrl
) {

  return telegram(
    env,
    "setWebhook",
    {

      url:
        webhookUrl

    }
  );

}


// ======================================================
// DELETE WEBHOOK
// ======================================================

export async function deleteWebhook(
  env
) {

  return telegram(
    env,
    "deleteWebhook"
  );

}


// ======================================================
// GET WEBHOOK INFO
// ======================================================

export async function getWebhookInfo(
  env
) {

  return telegram(
    env,
    "getWebhookInfo"
  );

}


// ======================================================
// BOT INFO
// ======================================================

export async function getMe(
  env
) {

  return telegram(
    env,
    "getMe"
  );

}
