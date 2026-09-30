//! Tests d'intégration de l'IPC front ↔ Rust.
//!
//! Le contrat partagé avec le front (`contracts/ipc.json`) est rejoué dans le vrai
//! pipeline d'invocation de Tauri, avec un runtime simulé (pas de fenêtre) mais la
//! configuration et les capabilities réelles de l'app. Sont donc vérifiés : les noms
//! des commandes et de leurs arguments, la désérialisation, les permissions, et la
//! forme des réponses et des erreurs. Le front vérifie de son côté qu'il envoie
//! exactement ces appels (`src/platform/tauri/ipc-contract.test.ts`).
//!
//! Sous Windows, ce binaire de test reçoit le manifeste Common Controls v6 (voir `build.rs`).

use std::fs;
use std::path::PathBuf;

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, Manager, WebviewWindow, WebviewWindowBuilder};

use workspace_presets_lib::ipc_test_support::{invoke_handler, DataFiles, ProcessEvent, ProcessRegistry};

const CONTRACT: &str = include_str!("../../contracts/ipc.json");

/// Origine de la page de l'app : seules les pages locales reçoivent les permissions.
const APP_URL: &str = if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" };

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Contract {
    calls: Vec<Call>,
    process_events: Vec<Value>,
}

#[derive(Deserialize)]
struct Call {
    name: String,
    command: String,
    args: Value,
    response: Value,
    #[serde(default = "replayed_by_default")]
    replay: bool,
}

fn replayed_by_default() -> bool {
    true
}

fn contract() -> Contract {
    serde_json::from_str(CONTRACT).expect("contracts/ipc.json is valid")
}

/// Application simulée, avec les mêmes commandes que la vraie et un dossier de données temporaire.
struct TestApp {
    _app: App<MockRuntime>,
    webview: WebviewWindow<MockRuntime>,
    data: PathBuf,
}

impl TestApp {
    fn new(test_name: &str) -> Self {
        let data = std::env::temp_dir().join(format!("workspace-presets-ipc-{test_name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&data);
        let app = mock_builder()
            .manage(ProcessRegistry::default())
            .manage(DataFiles::new(&data))
            .invoke_handler(invoke_handler())
            .build(tauri::generate_context!())
            .expect("mock app");
        // La fenêtre « main » de la configuration, visée par la capability `default`.
        let webview = match app.get_webview_window("main") {
            Some(window) => window,
            None => WebviewWindowBuilder::new(&app, "main", Default::default())
                .build()
                .expect("main window"),
        };
        Self { _app: app, webview, data }
    }

    fn invoke(&self, command: &str, args: Value) -> Result<Value, Value> {
        let request = InvokeRequest {
            cmd: command.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: APP_URL.parse().expect("valid URL"),
            body: InvokeBody::Json(args),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        };
        get_ipc_response(&self.webview, request).map(|body| body.deserialize().expect("JSON response"))
    }
}

impl Drop for TestApp {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.data);
    }
}

/// `"<channel>"` du contrat → identifiant de Channel tel que le front le sérialise.
fn with_channels(value: Value) -> Value {
    match value {
        Value::String(text) if text == "<channel>" => Value::String("__CHANNEL__:1".into()),
        Value::Object(map) => Value::Object(map.into_iter().map(|(key, value)| (key, with_channels(value))).collect()),
        Value::Array(items) => Value::Array(items.into_iter().map(with_channels).collect()),
        other => other,
    }
}

/// Égalité, où `"<string>"` et `"<number>"` acceptent n'importe quelle valeur de ce type.
fn matches(actual: &Value, expected: &Value) -> bool {
    match (expected, actual) {
        (Value::String(pattern), Value::String(_)) if pattern == "<string>" => true,
        (Value::String(pattern), Value::Number(_)) if pattern == "<number>" => true,
        (Value::Object(expected), Value::Object(actual)) => {
            expected.len() == actual.len()
                && expected
                    .iter()
                    .all(|(key, value)| actual.get(key).is_some_and(|found| matches(found, value)))
        }
        _ => expected == actual,
    }
}

#[test]
fn rust_accepts_every_call_of_the_contract_and_answers_as_agreed() {
    let app = TestApp::new("contract");
    for call in contract().calls.into_iter().filter(|call| call.replay) {
        let response = app.invoke(&call.command, with_channels(call.args));
        match (&call.response["ok"], &call.response["error"], response) {
            (expected, Value::Null, Ok(actual)) if call.response.get("ok").is_some() => {
                assert!(matches(&actual, expected), "{}: got {actual}", call.name);
            }
            (_, Value::String(kind), Err(error)) => {
                // Une erreur de l'app (`AppError`), pas un refus de Tauri (argument, permission).
                assert_eq!(error["kind"], json!(kind), "{}: got {error}", call.name);
                assert!(error["message"].is_string(), "{}: got {error}", call.name);
            }
            (_, _, response) => panic!("{}: unexpected response {response:?}", call.name),
        }
    }
}

#[test]
fn process_events_have_the_shape_the_front_expects() {
    let events = [
        ProcessEvent::Stdout { line: "ready on http://localhost:3000".into() },
        ProcessEvent::Stderr { line: "warning: something".into() },
        ProcessEvent::Exited { code: Some(0), missing_program: None },
        ProcessEvent::Exited { code: Some(1), missing_program: Some("npx".into()) },
        ProcessEvent::Exited { code: None, missing_program: None },
    ];
    let serialized: Vec<Value> = events.iter().map(|event| serde_json::to_value(event).expect("JSON")).collect();
    assert_eq!(serialized, contract().process_events);
}

#[test]
fn unknown_arguments_are_refused_at_the_boundary() {
    let app = TestApp::new("unknown-fields");
    // `deny_unknown_fields` : un champ inattendu (ex. un autre shell) n'est jamais ignoré en silence.
    let error = app
        .invoke(
            "execute_command",
            json!({ "request": { "command": "echo hi", "shell": "powershell" }, "onEvent": "__CHANNEL__:1" }),
        )
        .expect_err("unknown field must be refused");
    assert!(error.as_str().is_some_and(|message| message.contains("unknown field")), "{error}");
}

#[test]
fn permissions_are_enforced_for_commands_the_app_does_not_grant() {
    let app = TestApp::new("acl");
    // Renommer la fenêtre n'est pas accordé au front : Tauri refuse avant d'exécuter.
    let error = app
        .invoke("plugin:window|set_title", json!({ "label": "main", "value": "Hacked" }))
        .expect_err("not granted");
    assert!(error.as_str().is_some_and(|message| message.contains("not allowed")), "{error}");
}
