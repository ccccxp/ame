//go:build windows

package modtools

import (
	"syscall"
)

// getSysProcAttr returns Windows-specific process attributes to hide console window
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		HideWindow: true,
	}
}

// getDetachedSysProcAttr returns Windows-specific process attributes for detached processes
func getDetachedSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}
