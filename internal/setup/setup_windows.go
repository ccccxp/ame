//go:build windows

package setup

import (
	"syscall"
)

// getSysProcAttr returns Windows-specific process attributes to hide console window
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		HideWindow: true,
	}
}
