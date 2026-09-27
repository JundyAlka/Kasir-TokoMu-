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
        if (name === 'bis_skin_checked' || name === 'bis_register' || name === 'bis_size') {
          return;
        }
        return origSetAttr.apply(this, arguments);
      };
      var cleanup = function() {
        var elements = document.querySelectorAll('[bis_skin_checked], [bis_register], [bis_size]');
        for (var i = 0; i < elements.length; i++) {
          elements[i].removeAttribute('bis_skin_checked');
          elements[i].removeAttribute('bis_register');
          elements[i].removeAttribute('bis_size');
        }
      };
      cleanup();
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
