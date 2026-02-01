fn main() {
    // Get Git commit hash from environment or git command
    let git_commit = std::env::var("GIT_COMMIT_HASH").unwrap_or_else(|_| {
        std::process::Command::new("git")
            .args(["rev-parse", "--short", "HEAD"])
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    });
    println!("cargo:rustc-env=GIT_COMMIT_HASH={}", git_commit);

    // Get build timestamp from environment or generate current time
    let build_timestamp = std::env::var("BUILD_TIMESTAMP").unwrap_or_else(|_| {
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
    });
    println!("cargo:rustc-env=BUILD_TIMESTAMP={}", build_timestamp);

    tauri_build::build()
}
