import Capacitor
import UIKit
import WebKit

// WKWebView has no built-in print UI (unlike Safari), so window.print() in
// the web app does nothing unless the host app implements this delegate
// method itself and drives UIPrintInteractionController.
class MainViewController: CAPBridgeViewController {
    private var printingUIDelegate: PrintingWebViewUIDelegate?

    override func capacitorDidLoad() {
        guard let webView = webView else { return }
        let wrapped = PrintingWebViewUIDelegate(forwardingTo: webView.uiDelegate)
        printingUIDelegate = wrapped
        webView.uiDelegate = wrapped
    }
}

// Capacitor already assigns its own uiDelegate (for JS alerts/confirms,
// window.open, etc). We can't have two delegates at once, so this wraps
// that original delegate and forwards everything to it except printing.
private class PrintingWebViewUIDelegate: NSObject, WKUIDelegate {
    private weak var base: WKUIDelegate?

    init(forwardingTo base: WKUIDelegate?) {
        self.base = base
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || (base?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        super.responds(to: aSelector) ? nil : base
    }

    @available(iOS 16.0, *)
    func webView(
        _ webView: WKWebView,
        printFrame frame: WKFrameInfo?,
        pdfConfiguration pdfConfig: WKPDFConfiguration,
        completionHandler: @escaping () -> Void
    ) {
        webView.createPDF(configuration: pdfConfig) { result in
            defer { completionHandler() }
            guard case let .success(data) = result else { return }
            let printController = UIPrintInteractionController.shared
            let printInfo = UIPrintInfo(dictionary: nil)
            printInfo.outputType = .general
            printInfo.jobName = Bundle.main.infoDictionary?["CFBundleDisplayName"] as? String ?? "StallDrift"
            printController.printInfo = printInfo
            printController.printingItem = data
            printController.present(animated: true)
        }
    }
}
