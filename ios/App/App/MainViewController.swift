import AuthenticationServices
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
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }
}

// Shows Apple's own sign-in sheet and hands the identity token to the web app,
// which signs in to Supabase with it (authService.ts, signInWithApple).
@objc(AppleSignInPlugin)
class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    let identifier = "AppleSignInPlugin"
    let jsName = "AppleSignIn"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("Missing nonce")
            return
        }
        pendingCall = call
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = nonce
        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.webView?.window ?? ASPresentationAnchor()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        defer { pendingCall = nil }
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let token = String(data: tokenData, encoding: .utf8)
        else {
            pendingCall?.reject("Apple gave no identity token")
            return
        }
        pendingCall?.resolve([
            "identityToken": token,
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? "",
        ])
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        defer { pendingCall = nil }
        if (error as? ASAuthorizationError)?.code == .canceled {
            pendingCall?.reject("Cancelled", "CANCELLED")
        } else {
            pendingCall?.reject(error.localizedDescription)
        }
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
            printInfo.jobName = Bundle.main.infoDictionary?["CFBundleDisplayName"] as? String ?? "StallOrg"
            printController.printInfo = printInfo
            printController.printingItem = data
            printController.present(animated: true)
        }
    }
}
