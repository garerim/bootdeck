fn main() {
    // Chaque commande de l'app devient une permission (`allow-<commande>`) qu'une
    // capability doit accorder explicitement : sans ça, Tauri autorise toutes les
    // commandes de l'app à toutes les fenêtres.
    let manifest = tauri_build::AppManifest::new().commands(&[
        "load_data_file",
        "save_data_file",
        "backup_data_file",
        "open_url",
        "open_folder",
        "launch_application",
        "execute_command",
        "stop_process",
        "pick_folder",
        "pick_program",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to run tauri-build");

    embed_windows_manifest_in_tests();
}

/// Tests d'intégration sous Windows (`tests/ipc.rs`) : le binaire de test charge les
/// composants graphiques de Tauri, qui exigent les Common Controls v6. tauri-build
/// n'ajoute ce manifeste qu'à l'exécutable de l'app ; sans lui, le test s'arrête au
/// démarrage (`STATUS_ENTRYPOINT_NOT_FOUND`). L'exécutable de l'app n'est pas concerné.
fn embed_windows_manifest_in_tests() {
    let windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    if !windows_msvc {
        return;
    }
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("windows-test-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}", manifest.display());
}
