// Reference: Windows low-level keyboard hook implementation
// This file documents the approach used via koffi in hotkey.ts
// Not compiled in MVP — koffi handles the FFI directly.

/*
#include <windows.h>

static HHOOK g_hook = NULL;

LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION) {
        KBDLLHOOKSTRUCT* p = (KBDLLHOOKSTRUCT*)lParam;
        if (p->vkCode == VK_RMENU) {
            if (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN) {
                // Right Alt pressed
            }
        }
    }
    return CallNextHookEx(g_hook, nCode, wParam, lParam);
}

void InstallHook() {
    g_hook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, GetModuleHandle(NULL), 0);
}

void UninstallHook() {
    if (g_hook) UnhookWindowsHookEx(g_hook);
}
*/
