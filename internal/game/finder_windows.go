//go:build windows

package game

import (
	"syscall"
)

// getSysProcAttr returns Windows-specific process attributes to hide console window
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		HideWindow: true,
	}
}
