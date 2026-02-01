mod commands;
mod config;
mod state;
mod templates;

use state::{AppMode, AppState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                // Initialize updater plugin
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                
                // Spawn auto-update check task
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = check_for_updates(handle).await {
                        eprintln!("Failed to check for updates: {}", e);
                    }
                });
            }
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // App commands
            commands::get_app_version,
            // Server commands
            commands::start_server,
            commands::stop_server,
            commands::send_kanpe_message,
            commands::get_connected_clients,
            commands::get_server_addresses,
            commands::add_virtual_monitor,
            commands::remove_virtual_monitor,
            commands::update_virtual_monitor,
            commands::get_virtual_monitors,
            commands::send_flash_command,
            commands::send_clear_command,
            // Client commands
            commands::connect_to_server,
            commands::disconnect_from_server,
            commands::send_feedback,
            commands::create_popout_window,
            commands::close_popout_window,
            commands::get_client_connection_status,
            // Template commands
            commands::get_templates,
            commands::add_server_template,
            commands::update_server_template,
            commands::delete_server_template,
            commands::add_client_template,
            commands::update_client_template,
            commands::delete_client_template,
            // StreamDeck commands
            commands::start_streamdeck_server,
            commands::stop_streamdeck_server,
            commands::get_streamdeck_status,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Get app state and clone Arc references
                let state = window.app_handle().state::<AppState>();
                let client_arc = state.client.clone();
                let server_arc = state.server.clone();
                let streamdeck_arc = state.streamdeck_server.clone();
                let mode_arc = state.mode.clone();

                // Cleanup client or server on window close
                tauri::async_runtime::spawn(async move {
                    // Check and cleanup client
                    let mut client = client_arc.write().await;
                    if let Some(mut c) = client.take() {
                        let _ = c.disconnect().await;
                    }
                    drop(client);

                    // Check and cleanup server
                    let mut server = server_arc.write().await;
                    if let Some(mut s) = server.take() {
                        let _ = s.stop().await;
                    }
                    drop(server);

                    // Check and cleanup StreamDeck server
                    let mut streamdeck = streamdeck_arc.write().await;
                    if let Some(s) = streamdeck.take() {
                        let _ = s.shutdown().await;
                    }
                    drop(streamdeck);

                    // Reset mode
                    *mode_arc.write().await = AppMode::NotSelected;
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
async fn check_for_updates(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_updater::UpdaterExt;

    println!("Checking for updates...");
    
    if let Some(update) = app.updater()?.check().await? {
        println!(
            "Update available: {} (current: {})",
            update.version, update.current_version
        );
        println!("Update date: {:?}", update.date);
        
        let mut downloaded = 0u64;
        
        // Download and install the update
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length as u64;
                    if let Some(total) = content_length {
                        let progress = (downloaded as f64 / total as f64) * 100.0;
                        println!("Download progress: {:.1}%", progress);
                    }
                },
                || {
                    println!("Download finished, installing update...");
                },
            )
            .await?;
        
        println!("Update installed successfully, restarting...");
        app.restart();
    } else {
        println!("No updates available");
    }
    
    Ok(())
}
