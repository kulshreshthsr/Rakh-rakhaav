import "./globals.css";
import { AppLocaleProvider } from "../components/AppLocale";
import PWAInstall from "../components/PWAInstall";

export const metadata = {
  title: "Rakhaav — Smart Inventory & GST Billing",
  description: "Complete inventory management, GST billing, and business accounting for Indian shopkeepers.",
  keywords: "inventory management, GST billing, udhaar, vyapar, shop management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rakhaav",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AppLocaleProvider>
          {children}
          <PWAInstall />
        </AppLocaleProvider>
      </body>
    </html>
  );
}
