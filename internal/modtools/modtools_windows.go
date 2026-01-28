//go:build windows

package modtools

import (
	"syscall"
)

// getSysProcAttr returns Windows-specific process attributes
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		// Don't hide window - match PowerShell's -NoNewWindow behavior
	}
}

// getDetachedSysProcAttr returns Windows-specific process attributes for detached processes
func getDetachedSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}
