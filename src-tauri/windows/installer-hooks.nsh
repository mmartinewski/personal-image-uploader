; Graceful uninstall: close the tray app first, then remove orphaned child processes.
; Killing piu-backend before piu-desktop triggers a false "failed to start" dialog.

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'taskkill /F /IM piu-desktop.exe /T'
  Sleep 2000
  nsExec::ExecToLog 'taskkill /F /IM piu-backend.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM piu-monitor.exe /T'
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Install dir for per-user installs is often LocalAppData\PIU (not bundle id).
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    RmDir /r /REBOOTOK "$LOCALAPPDATA\PIU"
  ${EndIf}
!macroend
