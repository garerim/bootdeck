fn main() {
    // Chaque commande de l'app devient une permission (`allow-<commande>`) qu'une
    // capability doit accorder explicitement : sans ça, Tauri autorise toutes les
    // commandes de l'app à toutes les fenêtres.
    let manifest = tauri_build::AppManifest::new().commands(&[
        "load_presets",
        "save_presets",
        "backup_presets_file",
        "open_url",
        "open_folder",
        "launch_application",
        "execute_command",
        "stop_process",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to run tauri-build");
}
