use crate::error::AppError;
use serde::Serialize;

const ELEVENLABS_TTS_BASE_URL: &str = "https://api.elevenlabs.io/v1/text-to-speech";
const MAX_READ_ALOUD_CHARS: usize = 10_000;

#[derive(Debug, Serialize)]
struct TextToSpeechRequest<'a> {
    text: &'a str,
    model_id: &'a str,
}

#[tauri::command]
pub async fn text_to_speech(
    text: String,
    api_key: String,
    voice_id: String,
    model_id: String,
) -> Result<Vec<u8>, AppError> {
    text_to_speech_impl(&text, &api_key, &voice_id, &model_id).await
}

pub async fn text_to_speech_impl(
    text: &str,
    api_key: &str,
    voice_id: &str,
    model_id: &str,
) -> Result<Vec<u8>, AppError> {
    let text = text.trim();
    if text.is_empty() {
        return Err(AppError::Io("No text to read".into()));
    }

    let api_key = read_value_or_env(api_key, "ELEVENLABS_API_KEY");
    if api_key.is_empty() {
        return Err(AppError::Io(
            "Add an ElevenLabs API key in Preferences before using Read For Me".into(),
        ));
    }

    let voice_id = read_value_or_env(voice_id, "ELEVENLABS_VOICE_ID");
    if voice_id.is_empty() {
        return Err(AppError::Io("ElevenLabs voice ID is empty".into()));
    }

    let model_id = read_value_or_env(model_id, "ELEVENLABS_MODEL_ID");
    if model_id.is_empty() {
        return Err(AppError::Io("ElevenLabs model ID is empty".into()));
    }

    if text.chars().count() > MAX_READ_ALOUD_CHARS {
        return Err(AppError::Io(format!(
            "Read For Me supports up to {MAX_READ_ALOUD_CHARS} characters per request"
        )));
    }

    let url = format!(
        "{}/{voice_id}?output_format=mp3_44100_128",
        ELEVENLABS_TTS_BASE_URL
    );
    let response = reqwest::Client::new()
        .post(url)
        .header("xi-api-key", api_key.as_str())
        .json(&TextToSpeechRequest {
            text,
            model_id: model_id.as_str(),
        })
        .send()
        .await
        .map_err(|err| AppError::Io(format!("ElevenLabs request failed: {err}")))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let detail = if body.trim().is_empty() {
            status.to_string()
        } else {
            format!("{status}: {}", body.trim())
        };
        return Err(AppError::Io(format!("ElevenLabs request failed: {detail}")));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| AppError::Io(format!("Failed to read ElevenLabs audio: {err}")))?;

    Ok(bytes.to_vec())
}

fn read_value_or_env(value: &str, env_key: &str) -> String {
    let value = value.trim();
    if !value.is_empty() {
        return value.to_string();
    }
    std::env::var(env_key)
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}
