use std::sync::atomic::{AtomicBool, Ordering};

pub struct AppStatus {
    listening: AtomicBool,
    offline: AtomicBool,
}

impl Default for AppStatus {
    fn default() -> Self {
        Self {
            listening: AtomicBool::new(true),
            offline: AtomicBool::new(false),
        }
    }
}

impl AppStatus {
    pub fn listening(&self) -> bool {
        self.listening.load(Ordering::SeqCst)
    }

    pub fn offline(&self) -> bool {
        self.offline.load(Ordering::SeqCst)
    }

    pub fn set_listening(&self, value: bool) {
        self.listening.store(value, Ordering::SeqCst);
    }

    pub fn set_offline(&self, value: bool) {
        self.offline.store(value, Ordering::SeqCst);
    }

    pub fn toggle_listening(&self) -> bool {
        let previous = self.listening.fetch_xor(true, Ordering::SeqCst);
        !previous
    }

    pub fn toggle_offline(&self) -> bool {
        let previous = self.offline.fetch_xor(true, Ordering::SeqCst);
        !previous
    }
}
