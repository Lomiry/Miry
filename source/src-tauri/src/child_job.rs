//! The mpv child dies with Miry even when Windows terminates Miry without Rust Drop.
use windows_sys::Win32::{
    Foundation::CloseHandle,
    System::{
        JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        },
        Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE},
    },
};
pub struct Job(usize);
impl Drop for Job {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0 as _);
        }
    }
}
pub fn attach(child: &tokio::process::Child) -> Result<Job, String> {
    let pid = child.id().ok_or("mpv 进程不可用")?;
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return Err("无法创建播放器进程保护".into());
        }
        let owner = Job(job as usize);
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as _,
            std::mem::size_of_val(&info) as u32,
        ) == 0
        {
            return Err("无法设置播放器进程保护".into());
        }
        let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
        if process.is_null() {
            return Err("无法绑定播放器进程保护".into());
        }
        let success = AssignProcessToJobObject(job, process);
        CloseHandle(process);
        if success == 0 {
            return Err("无法绑定播放器进程保护".into());
        }
        Ok(owner)
    }
}
