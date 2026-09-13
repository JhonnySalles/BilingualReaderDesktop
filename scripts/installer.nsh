; =============================================================================
; Bilingual Reader Desktop — NSIS Custom Script
; Preserves 'data' and 'cache' directories during install, update and uninstall
; =============================================================================

!macro customRemoveFiles
  DetailPrint "Limpando arquivos do programa (preservando data e cache)..."
  
  FindFirst $0 $1 "$INSTDIR\*.*"
  _br_clean_loop:
    StrCmp $1 "" _br_clean_done
    StrCmp $1 "." _br_clean_next
    StrCmp $1 ".." _br_clean_next
    StrCmp $1 "data" _br_clean_next
    StrCmp $1 "cache" _br_clean_next
    StrCmp $1 "Data" _br_clean_next
    StrCmp $1 "Cache" _br_clean_next
    StrCmp $1 "DATA" _br_clean_next
    StrCmp $1 "CACHE" _br_clean_next

    IfFileExists "$INSTDIR\$1\*.*" _br_is_dir _br_is_file

    _br_is_dir:
      RMDir /r "$INSTDIR\$1"
      Goto _br_clean_next

    _br_is_file:
      Delete "$INSTDIR\$1"
      Goto _br_clean_next

    _br_clean_next:
      FindNext $0 $1
      Goto _br_clean_loop

  _br_clean_done:
    FindClose $0
!macroend

!macro customUnInstall
  DetailPrint "Removendo instalacao do Bilingual Reader (preservando data e cache)..."
  
  FindFirst $0 $1 "$INSTDIR\*.*"
  _br_uninst_loop:
    StrCmp $1 "" _br_uninst_done
    StrCmp $1 "." _br_uninst_next
    StrCmp $1 ".." _br_uninst_next
    StrCmp $1 "data" _br_uninst_next
    StrCmp $1 "cache" _br_uninst_next
    StrCmp $1 "Data" _br_uninst_next
    StrCmp $1 "Cache" _br_uninst_next
    StrCmp $1 "DATA" _br_uninst_next
    StrCmp $1 "CACHE" _br_uninst_next

    IfFileExists "$INSTDIR\$1\*.*" _br_uninst_dir _br_uninst_file

    _br_uninst_dir:
      RMDir /r "$INSTDIR\$1"
      Goto _br_uninst_next

    _br_uninst_file:
      Delete "$INSTDIR\$1"
      Goto _br_uninst_next

    _br_uninst_next:
      FindNext $0 $1
      Goto _br_uninst_loop

  _br_uninst_done:
    FindClose $0
!macroend

