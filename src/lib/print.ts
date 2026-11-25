import { Capacitor, registerPlugin } from '@capacitor/core'

// Android's WebView ignores window.print(); PrintPlugin.java does it there.
const AndroidPrint = registerPlugin<{
  print(options: { title?: string }): Promise<void>
}>('Print')

export function printPage(): void {
  if (Capacitor.getPlatform() === 'android') {
    void AndroidPrint.print({ title: document.title })
    return
  }
  window.print()
}
