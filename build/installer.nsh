; 自定义 NSIS 安装脚本
; 确保卸载程序正常工作

!macro customInstall
  ; 写入卸载信息到注册表
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "Publisher" "${COMPANY_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString" "$INSTDIR\Uninstall ${PRODUCT_FILENAME}.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "QuietUninstallString" "$INSTDIR\Uninstall ${PRODUCT_FILENAME}.exe /S"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "NoRepair" 1
!macroend

!macro customUnInstall
  ; 删除注册表项
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  
  ; 关闭所有正在运行的应用实例
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到 ${PRODUCT_NAME} 可能正在运行。$\n是否强制关闭后继续卸载？" IDYES +2
    Abort
  ${EndIf}
  
  ; 尝试关闭应用
  Call un.CloseRunningApp
!macroend

Function un.CloseRunningApp
  ; 结束进程
  nsExec::Exec 'taskkill /F /IM "${PRODUCT_FILENAME}.exe"'
  Sleep 1000
FunctionEnd
