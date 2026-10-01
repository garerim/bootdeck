//! Processus gérés : commandes lancées par l'app, dont on suit la sortie et la fin.
//!
//! Pour chaque processus, trois threads :
//! - deux lecteurs (stdout, stderr) qui transmettent la sortie ligne par ligne ;
//! - un surveillant qui attend la fin du processus et envoie `Exited`.
//!
//! Des threads plutôt que de l'asynchrone : lire un flux et attendre un processus
//! sont des opérations bloquantes simples, et quelques processus à la fois
//! représentent une poignée de threads.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use crate::errors::AppError;
use crate::models::{ProcessEvent, ProcessId};
use crate::system::{self, ProcessTree};

/// Au-delà, une ligne sans retour à la ligne est découpée (barres de progression…).
const MAX_LINE_BYTES: u64 = 8 * 1024;

/// Temps laissé aux lecteurs pour transmettre les dernières lignes après la fin
/// du processus. Borné : un petit-enfant resté en vie peut garder la sortie ouverte.
const OUTPUT_DRAIN_TIMEOUT: Duration = Duration::from_secs(1);

type EventSink = Arc<dyn Fn(ProcessEvent) + Send + Sync>;

#[derive(Default)]
pub struct ProcessRegistry {
    next_id: AtomicU64,
    /// Processus en cours : identifiant de l'app → arbre de processus de l'OS.
    running: Arc<Mutex<HashMap<ProcessId, Arc<ProcessTree>>>>,
}

impl ProcessRegistry {
    /// Démarre la commande et renvoie immédiatement son identifiant.
    /// La sortie et la fin arrivent ensuite via `on_event`.
    pub fn spawn(
        &self,
        mut command: Command,
        on_event: impl Fn(ProcessEvent) + Send + Sync + 'static,
    ) -> Result<ProcessId, AppError> {
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        system::configure_managed_process(&mut command);

        let mut child = command
            .spawn()
            .map_err(|error| AppError::start(command.get_program(), error))?;
        let tree = Arc::new(system::track_process_tree(&child));

        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        lock(&self.running).insert(id, tree);

        let on_event: EventSink = Arc::new(on_event);
        let (finished_tx, finished_rx) = mpsc::channel();
        if let Some(stdout) = child.stdout.take() {
            let emit = Arc::clone(&on_event);
            let finished = finished_tx.clone();
            thread::spawn(move || {
                forward_lines(stdout, |line| emit(ProcessEvent::Stdout { line }));
                let _ = finished.send(());
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let emit = Arc::clone(&on_event);
            let finished = finished_tx.clone();
            thread::spawn(move || {
                forward_lines(stderr, |line| emit(ProcessEvent::Stderr { line }));
                let _ = finished.send(());
            });
        }
        drop(finished_tx);

        let running = Arc::clone(&self.running);
        thread::spawn(move || {
            let code = child.wait().ok().and_then(|status| status.code());
            // Retiré du registre dès sa fin : son PID pourra être réattribué par
            // l'OS, un `stop` tardif ne doit surtout pas viser un autre programme.
            if let Some(tree) = lock(&running).remove(&id) {
                tree.release();
            }

            let deadline = Instant::now() + OUTPUT_DRAIN_TIMEOUT;
            for _ in 0..2 {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if finished_rx.recv_timeout(remaining).is_err() {
                    break;
                }
            }
            on_event(ProcessEvent::Exited { code, missing_program: None });
        });

        Ok(id)
    }

    /// Arrête le processus et ses descendants. Sans effet s'il est déjà terminé
    /// (idempotent : « s'assurer qu'il est arrêté »).
    pub fn stop(&self, id: ProcessId) -> Result<(), AppError> {
        // Copié hors du verrou : l'arrêt peut prendre du temps (repli sur `taskkill`).
        let tree = lock(&self.running).get(&id).cloned();
        match tree {
            None => Ok(()),
            Some(tree) => tree.kill().map_err(|source| AppError::Stop { pid: tree.pid(), source }),
        }
    }

    /// Arrête tous les processus en cours (fermeture de l'application).
    pub fn stop_all(&self) {
        let trees: Vec<Arc<ProcessTree>> = lock(&self.running).values().cloned().collect();
        for tree in trees {
            let _ = tree.kill();
        }
    }

    #[cfg(test)]
    pub fn is_running(&self, id: ProcessId) -> bool {
        lock(&self.running).contains_key(&id)
    }
}

/// Un thread qui a paniqué en tenant le verrou n'empêche pas les autres d'avancer.
fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Lit le flux jusqu'à sa fermeture et transmet chaque ligne, sans le retour à la ligne.
/// Les octets invalides en UTF-8 sont remplacés (sortie de programmes Windows en code page OEM).
fn forward_lines(stream: impl Read, emit: impl Fn(String)) {
    let mut reader = BufReader::new(stream);
    let mut buffer = Vec::new();
    loop {
        buffer.clear();
        match reader.by_ref().take(MAX_LINE_BYTES).read_until(b'\n', &mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buffer);
                emit(line.trim_end_matches(['\r', '\n']).to_owned());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Registre + événements reçus, pour observer un processus depuis un test.
    struct Harness {
        registry: ProcessRegistry,
        events: Arc<Mutex<Vec<ProcessEvent>>>,
    }

    impl Harness {
        fn new() -> Self {
            Self {
                registry: ProcessRegistry::default(),
                events: Arc::default(),
            }
        }

        fn run(&self, command_line: &str) -> ProcessId {
            let events = Arc::clone(&self.events);
            let command = system::shell_command(command_line);
            self.registry
                .spawn(command, move |event| lock(&events).push(event))
                .unwrap()
        }

        fn events(&self) -> Vec<ProcessEvent> {
            lock(&self.events).clone()
        }

        fn wait_until(&self, condition: impl Fn(&[ProcessEvent]) -> bool) -> Vec<ProcessEvent> {
            let deadline = Instant::now() + Duration::from_secs(15);
            while Instant::now() < deadline {
                let events = self.events();
                if condition(&events) {
                    return events;
                }
                thread::sleep(Duration::from_millis(20));
            }
            panic!("timed out, events so far: {:?}", self.events());
        }

        fn wait_for_exit(&self) -> Vec<ProcessEvent> {
            self.wait_until(|events| events.iter().any(|event| matches!(event, ProcessEvent::Exited { .. })))
        }
    }

    fn stdout(line: &str) -> ProcessEvent {
        ProcessEvent::Stdout { line: line.into() }
    }

    fn exited(code: i32) -> ProcessEvent {
        ProcessEvent::Exited { code: Some(code), missing_program: None }
    }

    #[test]
    fn streams_output_then_reports_the_exit_code() {
        let harness = Harness::new();
        harness.run("echo hello");
        assert_eq!(
            harness.wait_for_exit(),
            vec![stdout("hello"), exited(0)]
        );
    }

    #[test]
    fn reports_a_failing_exit_code() {
        let harness = Harness::new();
        harness.run("exit 3");
        assert_eq!(harness.wait_for_exit(), vec![exited(3)]);
    }

    #[test]
    fn a_silent_command_succeeds_only_its_exit_code_matters() {
        let harness = Harness::new();
        // Aucune sortie (redirigée vers nul) : ce n'est pas une erreur.
        harness.run(if cfg!(windows) { "ping -n 2 127.0.0.1 >nul" } else { "sleep 1" });
        assert_eq!(harness.wait_for_exit(), vec![exited(0)]);

        // Même silence, mais un code de sortie non nul : c'est lui qui fait l'échec.
        let failing = Harness::new();
        failing.run(if cfg!(windows) { "ping -n 2 127.0.0.1 >nul && exit 1" } else { "sleep 1 && exit 1" });
        assert_eq!(failing.wait_for_exit(), vec![exited(1)]);
    }

    #[test]
    fn separates_stderr_from_stdout() {
        let harness = Harness::new();
        // Redirection en tête : avec `echo oops 1>&2`, cmd afficherait aussi l'espace avant `1>&2`.
        harness.run(">&2 echo oops");
        let events = harness.wait_for_exit();
        assert!(events.contains(&ProcessEvent::Stderr { line: "oops".into() }), "{events:?}");
    }

    #[test]
    #[cfg(windows)]
    fn passes_the_command_line_to_the_shell_unchanged() {
        let harness = Harness::new();
        // Guillemets, `&` littéral et enchaînement `&&` : interprétés par le shell, pas par Rust.
        harness.run("echo \"a & b\"&& echo done");
        let events = harness.wait_for_exit();
        assert_eq!(&events[..2], &[stdout("\"a & b\""), stdout("done")], "{events:?}");
    }

    #[test]
    fn stop_kills_the_whole_process_tree() {
        let harness = Harness::new();
        // Un enfant du shell qui écrit une ligne par seconde (`ping` sous Windows ; sous
        // Unix un sous-shell, `ping` étant souvent absent ou restreint, ex. en conteneur).
        let id = harness.run(if cfg!(windows) {
            "ping -n 30 127.0.0.1"
        } else {
            "sh -c 'while true; do echo tick; sleep 1; done'"
        });
        harness.wait_until(|events| events.len() >= 2);
        assert!(harness.registry.is_running(id));

        harness.registry.stop(id).unwrap();
        harness.wait_for_exit();
        assert!(!harness.registry.is_running(id));

        // Si l'enfant avait survécu à son parent, il continuerait d'écrire.
        let count = harness.events().len();
        thread::sleep(Duration::from_millis(2500));
        assert_eq!(harness.events().len(), count, "output continued after stop");
    }

    #[test]
    #[cfg(unix)]
    fn stop_forces_a_command_that_ignores_the_polite_request() {
        let harness = Harness::new();
        // Le shell ignore SIGTERM : seul le SIGKILL envoyé après le délai de grâce l'arrête.
        let id = harness.run("trap '' TERM; while true; do echo tick; sleep 1; done");
        harness.wait_until(|events| !events.is_empty());

        harness.registry.stop(id).unwrap();
        let events = harness.wait_for_exit();
        assert!(!harness.registry.is_running(id));
        assert!(events.contains(&ProcessEvent::Exited { code: None, missing_program: None }), "{events:?}");
    }

    #[test]
    fn stopping_an_unknown_or_finished_process_is_not_an_error() {
        let harness = Harness::new();
        let id = harness.run("echo done");
        harness.wait_for_exit();
        assert!(harness.registry.stop(id).is_ok());
        assert!(harness.registry.stop(9999).is_ok());
    }

    #[test]
    fn forward_lines_splits_lines_and_cuts_very_long_ones() {
        let input = format!("one\r\ntwo\n{}", "x".repeat(MAX_LINE_BYTES as usize + 10));
        let lines = Mutex::new(Vec::new());
        forward_lines(input.as_bytes(), |line| lock(&lines).push(line));
        let lines = lines.into_inner().unwrap();
        assert_eq!(lines[..2], ["one".to_owned(), "two".to_owned()]);
        assert_eq!(lines[2].len(), MAX_LINE_BYTES as usize);
        assert_eq!(lines[3], "x".repeat(10));
    }
}
