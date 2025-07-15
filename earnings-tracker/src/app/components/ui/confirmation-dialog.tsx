'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { AlertTriangle, Info, Trash2 } from "lucide-react"

export interface ConfirmationOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
  icon?: 'info' | 'warning' | 'delete'
}

interface ConfirmationDialogState extends ConfirmationOptions {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

let setDialogState: React.Dispatch<React.SetStateAction<ConfirmationDialogState | null>> | null = null

export function useConfirmation() {
  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      if (setDialogState) {
        setDialogState({
          ...options,
          isOpen: true,
          onConfirm: () => {
            setDialogState?.(null)
            resolve(true)
          },
          onCancel: () => {
            setDialogState?.(null)
            resolve(false)
          },
        })
      } else {
        resolve(false)
      }
    })
  }, [])

  return { confirm }
}

export function ConfirmationDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmationDialogState | null>(null)
  
  setDialogState = setState

  const iconMap = {
    info: <Info className="h-5 w-5 text-blue-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    delete: <Trash2 className="h-5 w-5 text-destructive" />,
  }

  return (
    <>
      {children}
      {state && (
        <Dialog open={state.isOpen} onOpenChange={(open) => !open && state.onCancel()}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {state.icon && iconMap[state.icon]}
                {state.title}
              </DialogTitle>
              <DialogDescription className="whitespace-pre-wrap">
                {state.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={state.onCancel}
              >
                {state.cancelText || 'Cancel'}
              </Button>
              <Button
                variant={state.variant === 'destructive' ? 'destructive' : 'default'}
                onClick={state.onConfirm}
              >
                {state.confirmText || 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}