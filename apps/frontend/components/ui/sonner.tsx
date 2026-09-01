"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

/**
 * App-themed sonner Toaster. Follows the next-themes resolved theme (so the manual
 * light/dark toggle wins, not just the OS setting) and paints toasts from the same
 * popover / border / muted tokens and `--font-sans` (Oxanium) the rest of the UI uses --
 * `richColors` is intentionally off, it ships sonner's own green/red/blue palette which
 * does not match the application.
 */
function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      position="top-center"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          title: "group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-popover group-[.toast]:text-foreground group-[.toast]:border-border",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
