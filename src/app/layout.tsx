import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Warung OS",
  description: "Aplikasi kasir tablet-first untuk operasional warung modern.",
};

const extensionFixScript = `
  (function() {
    try {
      var origSetAttr = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (typeof name === 'string' && name.indexOf('bis_') === 0) {
          return;
        }
        return origSetAttr.apply(this, arguments);
      };

      // Suppress Next.js hydration error popup specifically caused by browser extensions
      var isExtensionError = function(msg) {
        return typeof msg === 'string' && (
          msg.indexOf('bis_skin_checked') !== -1 || 
          msg.indexOf('bis_') !== -1 ||
          msg.indexOf('chrome-extension://') !== -1
        );
      };

      var origConsoleError = console.error;
      console.error = function() {
        var msg = arguments[0] || '';
        if (isExtensionError(msg)) {
          return;
        }
        return origConsoleError.apply(console, arguments);
      };

      window.addEventListener('error', function(event) {
        if (isExtensionError(event.message) || isExtensionError(event.filename)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return true;
        }
      }, true);

      window.addEventListener('unhandledrejection', function(event) {
        var reason = event.reason;
        var msg = (reason && (reason.message || reason.stack)) || String(reason || '');
        if (isExtensionError(msg)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return true;
        }
      }, true);

      var cleanup = function() {
        var elements = document.querySelectorAll('[bis_skin_checked], [bis_register], [bis_size], [bis_depth]');
        for (var i = 0; i < elements.length; i++) {
          elements[i].removeAttribute('bis_skin_checked');
          elements[i].removeAttribute('bis_register');
          elements[i].removeAttribute('bis_size');
          elements[i].removeAttribute('bis_depth');
        }
        // Auto-dismiss nextjs error overlay if caused by extension
        try {
          var portals = document.querySelectorAll('nextjs-portal');
          for (var p = 0; p < portals.length; p++) {
            var shadow = portals[p].shadowRoot;
            if (shadow && shadow.innerHTML && (shadow.innerHTML.indexOf('bis_skin_checked') !== -1 || shadow.innerHTML.indexOf('chrome-extension') !== -1)) {
              portals[p].style.display = 'none';
            }
          }
        } catch(e) {}
      };
      cleanup();
      setInterval(cleanup, 1000);
      if (document.readyState !== 'complete') {
        window.addEventListener('DOMContentLoaded', cleanup, { once: true });
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${bricolageGrotesque.variable} ${ibmPlexMono.variable} h-full w-full overflow-hidden antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: extensionFixScript }} />
      </head>
      <body suppressHydrationWarning className="h-full w-full flex flex-col overflow-hidden bg-background">
        <ThemeProvider defaultTheme="dark">
          <AppStateProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
