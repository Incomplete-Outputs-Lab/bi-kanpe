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
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
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
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Get app state and clone Arc references
                let state = window.app_handle().state::<AppState>();
                let client_arc = state.client.clone();
                let server_arc = state.server.clone();
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

                    // Reset mode
                    *mode_arc.write().await = AppMode::NotSelected;
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
