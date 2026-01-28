//! Template management Tauri commands

use crate::templates::{load_templates, save_templates, ServerTemplate, ClientTemplate, TemplateConfig};
use tauri::AppHandle;

/// Get all templates (both server and client)
#[tauri::command]
pub async fn get_templates(app_handle: AppHandle) -> Result<TemplateConfig, String> {
    load_templates(&app_handle)
}

/// Add a new server template
#[tauri::command]
pub async fn add_server_template(
    content: String,
    priority: String,
    app_handle: AppHandle,
) -> Result<ServerTemplate, String> {
    let mut config = load_templates(&app_handle)?;

    let template = ServerTemplate {
        id: uuid::Uuid::new_v4().to_string(),
        content,
        priority,
    };

    config.server_templates.push(template.clone());
    save_templates(&app_handle, &config)?;

    Ok(template)
}

/// Update an existing server template
#[tauri::command]
pub async fn update_server_template(
    id: String,
    content: String,
    priority: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut config = load_templates(&app_handle)?;

    let template = config
        .server_templates
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| "Template not found".to_string())?;

    template.content = content;
    template.priority = priority;

    save_templates(&app_handle, &config)?;

    Ok(())
}

/// Delete a server template
#[tauri::command]
pub async fn delete_server_template(id: String, app_handle: AppHandle) -> Result<(), String> {
    let mut config = load_templates(&app_handle)?;

    config.server_templates.retain(|t| t.id != id);
    save_templates(&app_handle, &config)?;

    Ok(())
}

/// Add a new client template
#[tauri::command]
pub async fn add_client_template(
    content: String,
    feedback_type: String,
    app_handle: AppHandle,
) -> Result<ClientTemplate, String> {
    let mut config = load_templates(&app_handle)?;

    let template = ClientTemplate {
        id: uuid::Uuid::new_v4().to_string(),
        content,
        feedback_type,
    };

    config.client_templates.push(template.clone());
    save_templates(&app_handle, &config)?;

    Ok(template)
}

/// Update an existing client template
#[tauri::command]
pub async fn update_client_template(
    id: String,
    content: String,
    feedback_type: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut config = load_templates(&app_handle)?;

    let template = config
        .client_templates
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| "Template not found".to_string())?;

    template.content = content;
    template.feedback_type = feedback_type;

    save_templates(&app_handle, &config)?;

    Ok(())
}

/// Delete a client template
#[tauri::command]
pub async fn delete_client_template(id: String, app_handle: AppHandle) -> Result<(), String> {
    let mut config = load_templates(&app_handle)?;

    config.client_templates.retain(|t| t.id != id);
    save_templates(&app_handle, &config)?;

    Ok(())
}
