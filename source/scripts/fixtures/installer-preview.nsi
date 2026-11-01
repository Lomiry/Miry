; A UI-only harness, NOT a Tauri bundle or an installation/upgrade test.
; No payload, registry, shortcuts, AppData, uninstaller or application launch.
; The only optional write is a run-choice marker next to this QA executable.
Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2
RequestExecutionLevel user
!include MUI2.nsh
!include FileFunc.nsh
!include "@HOOK@"
Name "Miry QA Preview"
Caption "Miry QA Preview @VERSION@"
OutFile "@OUTPUT@"
VIProductVersion "@VERSION@.0"
VIAddVersionKey "FileVersion" "@VERSION@"
BrandingText "Miry · UI preview only"
!define MUI_ICON "@ICON@"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "@HEADER@"
!define MUI_WELCOMEFINISHPAGE_BITMAP "@SIDEBAR@"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
; Same finish declarations/order as the pinned Tauri 2.12.1 template.
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "$(createDesktop)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION PreviewShortcut
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION PreviewRunChoice
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
LangString createDesktop 2052 "创建桌面快捷方式（仅预览）"
LangString createDesktop 1033 "Create desktop shortcut (preview only)"

Function .onInit
  StrCpy $LANGUAGE 2052
  !ifdef PREVIEW_EN
    StrCpy $LANGUAGE 1033
  !endif
  ${GetOptions} $CMDLINE "/EN" $0
  ${IfNot} ${Errors}
    StrCpy $LANGUAGE 1033
  ${EndIf}
FunctionEnd

Section "Preview"
  !ifdef PREVIEW_FAIL
    Abort "QA simulated failure: finish page must not be shown."
  !endif
  ${GetOptions} $CMDLINE "/FAIL" $0
  ${IfNot} ${Errors}
    Abort "QA simulated failure: finish page must not be shown."
  ${EndIf}
  DetailPrint "UI preview only: no application has been installed."
  !insertmacro NSIS_HOOK_POSTINSTALL
SectionEnd

Function PreviewRunChoice
  FileOpen $0 "$EXEDIR\run-choice.txt" w
  FileWrite $0 "User selected Run in the UI-only preview."
  FileClose $0
FunctionEnd

Function PreviewShortcut
  ; Deliberately empty; never create a real shortcut in this preview.
FunctionEnd
