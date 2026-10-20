; Tauri CLI 2.12.1 includes this file before declaring its MUI pages.
; Keep the upstream template: upgrade, uninstall, AppData and /R stay upstream.
!ifndef MIRY_INSTALLER_HOOKS
!define MIRY_INSTALLER_HOOKS

!define MUI_HEADERIMAGE_RIGHT
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_TEXT_LARGE
!define MUI_WELCOMEPAGE_TEXT "$(MiryWelcomeText)"
!define MUI_FINISHPAGE_TEXT "$(MiryFinishText)"
!define MUI_CUSTOMFUNCTION_GUIINIT MiryBrandingInit

; Read the packaged version; leave Tauri's LegalCopyright metadata untouched.
; Use MUI's existing branding control without changing its layout or visibility.
Function MiryBrandingInit
  Push $1
  Push $2
  Push $3
  GetDLLVersion "$EXEPATH" $1 $2
  IntOp $3 $1 >> 16
  IntOp $1 $1 & 0xffff
  IntOp $2 $2 >> 16
  SendMessage $mui.Branding.Text ${WM_SETTEXT} 0 "STR:$(^Name) v$3.$1.$2"
  SendMessage $mui.Branding.Background ${WM_SETTEXT} 0 "STR:$(^Name) v$3.$1.$2"
  Pop $3
  Pop $2
  Pop $1
FunctionEnd

; NSIS language IDs (language macros are inserted later by Tauri).
; ^Name follows productName, including an isolated QA identity.
LangString MiryWelcomeText 2052 "欢迎使用 $(^Name)，Windows Emby 桌面客户端。$\r$\n$\r$\n向导将帮助你选择安装位置并完成安装。$\r$\n$\r$\n安装完成后，你可以选择是否启动应用。$\r$\n$\r$\n点击“下一步”继续。"
LangString MiryWelcomeText 1033 "Welcome to $(^Name), an Emby desktop client for Windows.$\r$\n$\r$\nThis wizard will help you choose a location and install the app.$\r$\n$\r$\nYou can choose whether to launch the app when installation is complete.$\r$\n$\r$\nClick Next to continue."
LangString MiryFinishText 2052 "$(^Name) 已安装完成。$\r$\n$\r$\n如需立即使用，请勾选下方的运行选项。你也可以稍后从开始菜单打开应用。$\r$\n$\r$\n点击“完成”退出安装向导。"
LangString MiryFinishText 1033 "$(^Name) has been installed.$\r$\n$\r$\nTo open it now, select the run option below. You can also open it later from the Start menu.$\r$\n$\r$\nClick Finish to close this wizard."

!macro NSIS_HOOK_POSTINSTALL
  ; Reached only after Tauri copies files and writes shortcuts/registration.
  ; Advance from the successful progress page to Finish, never launch here.
  ; No timer, custom callback or uninstall hook is needed.
  SetAutoClose true
!macroend

!endif
