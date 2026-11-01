//! A close-only receipt for the existing renderer-owned history store.
use serde::Serialize;
use std::{sync::Mutex, time::Duration};
use tauri::{Emitter, Manager};
use tokio::sync::oneshot;

#[derive(Default)]
pub struct FinalSave(Mutex<Option<(String, oneshot::Sender<bool>)>>);

impl FinalSave {
    fn begin(&self) -> (String, oneshot::Receiver<bool>) {
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        *self.0.lock().unwrap() = Some((id.clone(), tx));
        (id, rx)
    }
    fn confirm(&self, id: &str, persisted: bool) -> bool {
        let mut pending = self.0.lock().unwrap();
        if pending.as_ref().is_some_and(|(current, _)| current == id) {
            let (_, tx) = pending.take().unwrap();
            return tx.send(persisted).is_ok();
        }
        false
    }
    fn clear(&self, id: &str) {
        let mut pending = self.0.lock().unwrap();
        if pending.as_ref().is_some_and(|(current, _)| current == id) {
            pending.take();
        }
    }
}

#[tauri::command]
pub fn player_final_saved(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, FinalSave>,
    persistence_id: String,
    persisted: bool,
) -> Result<(), &'static str> {
    if window.label() != "main" {
        return Err("Final save receipt requires the main window");
    }
    if !state.confirm(&persistence_id, persisted) {
        return Err("Final save receipt is no longer pending");
    }
    Ok(())
}

async fn receipt(rx: oneshot::Receiver<bool>, budget: Duration) -> Result<(), &'static str> {
    match tokio::time::timeout(budget, rx).await {
        Ok(Ok(true)) => Ok(()),
        Ok(Ok(false)) => Err("Final playback history write failed"),
        Ok(Err(_)) => Err("Final playback history receipt lost"),
        Err(_) => Err("Final playback history receipt timed out"),
    }
}

pub async fn persist(
    window: &tauri::Window,
    snapshot: &crate::player::Snapshot,
) -> Result<(), &'static str> {
    if snapshot.play_session_id.is_empty() {
        return Ok(());
    }
    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Request<'a> {
        #[serde(flatten)]
        snapshot: &'a crate::player::Snapshot,
        persistence_id: String,
    }
    let state = window.state::<FinalSave>();
    let (id, rx) = state.begin();
    let sent = window.emit(
        "player-final-snapshot",
        Request {
            snapshot,
            persistence_id: id.clone(),
        },
    );
    let result = if sent.is_ok() {
        // A missing or blocked renderer must not prevent application exit.
        receipt(rx, Duration::from_secs(1)).await
    } else {
        Err("Final playback history event could not be sent")
    };
    state.clear(&id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn only_the_pending_receipt_can_complete_a_save() {
        let state = FinalSave::default();
        let (old, old_rx) = state.begin();
        let (id, rx) = state.begin();
        assert!(!state.confirm(&old, true));
        assert!(receipt(old_rx, Duration::from_secs(1)).await.is_err());
        assert!(state.confirm(&id, true));
        assert!(!state.confirm(&id, false));
        assert_eq!(receipt(rx, Duration::from_secs(1)).await, Ok(()));
    }
    #[tokio::test]
    async fn completion_waits_for_the_renderer_instead_of_a_fixed_grace_period() {
        let state = FinalSave::default();
        let (id, rx) = state.begin();
        let mut waiting = Box::pin(receipt(rx, Duration::from_secs(1)));
        assert!(tokio::time::timeout(Duration::ZERO, waiting.as_mut())
            .await
            .is_err());
        assert!(state.confirm(&id, true));
        assert_eq!(waiting.await, Ok(()));
    }
    #[tokio::test]
    async fn write_failure_and_missing_renderer_are_distinct_and_bounded() {
        let state = FinalSave::default();
        let (id, rx) = state.begin();
        assert!(state.confirm(&id, false));
        assert_eq!(
            receipt(rx, Duration::from_secs(1)).await,
            Err("Final playback history write failed")
        );
        let (id, rx) = state.begin();
        assert_eq!(
            receipt(rx, Duration::ZERO).await,
            Err("Final playback history receipt timed out")
        );
        state.clear(&id);
        assert!(!state.confirm(&id, true));
        assert!(state.0.lock().unwrap().is_none());
    }
}
