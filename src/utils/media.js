// ======================================================
// TELEGRAM MEDIA PARSER
// ======================================================

export function getMedia(message) {

  if (!message) {
    return null;
  }


  // ====================================================
  // DOCUMENT
  // ====================================================

  if (message.document) {

    const file =
      message.document;

    return {

      type: "document",

      fileId:
        file.file_id,

      fileName:
        file.file_name || "document",

      mimeType:
        file.mime_type || null,

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // PHOTO
  // ====================================================

  if (
    Array.isArray(message.photo) &&
    message.photo.length > 0
  ) {

    const file =
      message.photo[
        message.photo.length - 1
      ];

    return {

      type: "photo",

      fileId:
        file.file_id,

      fileName:
        "photo.jpg",

      mimeType:
        "image/jpeg",

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // VIDEO
  // ====================================================

  if (message.video) {

    const file =
      message.video;

    return {

      type: "video",

      fileId:
        file.file_id,

      fileName:
        file.file_name ||
        "video.mp4",

      mimeType:
        file.mime_type ||
        "video/mp4",

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // AUDIO
  // ====================================================

  if (message.audio) {

    const file =
      message.audio;

    return {

      type: "audio",

      fileId:
        file.file_id,

      fileName:
        file.file_name ||
        "audio.mp3",

      mimeType:
        file.mime_type ||
        "audio/mpeg",

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // VOICE
  // ====================================================

  if (message.voice) {

    const file =
      message.voice;

    return {

      type: "voice",

      fileId:
        file.file_id,

      fileName:
        "voice.ogg",

      mimeType:
        file.mime_type ||
        "audio/ogg",

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // ANIMATION / GIF
  // ====================================================

  if (message.animation) {

    const file =
      message.animation;

    return {

      type: "animation",

      fileId:
        file.file_id,

      fileName:
        file.file_name ||
        "animation.mp4",

      mimeType:
        file.mime_type ||
        "video/mp4",

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // VIDEO NOTE
  // ====================================================

  if (message.video_note) {

    const file =
      message.video_note;

    return {

      type: "video_note",

      fileId:
        file.file_id,

      fileName:
        "video-note.mp4",

      mimeType:
        "video/mp4",

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // STICKER
  // ====================================================

  if (message.sticker) {

    const file =
      message.sticker;

    let mimeType =
      "application/octet-stream";


    if (
      file.is_animated
    ) {

      mimeType =
        "application/x-tgsticker";

    }

    else if (
      file.is_video
    ) {

      mimeType =
        "video/webm";

    }


    return {

      type: "sticker",

      fileId:
        file.file_id,

      fileName:
        "sticker",

      mimeType,

      fileSize:
        file.file_size || null

    };

  }


  // ====================================================
  // TIDAK ADA MEDIA
  // ====================================================

  return null;

}
