import "./globals.css";
import { AppLocaleProvider } from "../components/AppLocale";
import AppSplash from "../components/AppSplash";
import PWAInstall from "../components/PWAInstall";

export const metadata = {
  title: "Rakh-Rakhaav - Smart Inventory & GST Billing",
  description: "Complete inventory management, GST billing, and business accounting for Indian shopkeepers.",
  keywords: "inventory management, GST billing, udhaar, vyapar, shop management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rakh-Rakhaav",
    startupImage: ["/splash-v2.png"],
  },
  icons: {
    icon: [
      { url: "/icon-v2.png", sizes: "1024x1024", type: "image/png" },
      { url: "/icon-v2-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-v2-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-v2.png", sizes: "1024x1024", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0c1222",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0c1222" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-v2.png" />
        <link rel="apple-touch-startup-image" href="/splash-v2.png" />
        <link rel="preload" as="image" href="/splash-v2.png" />
      </head>
      <body className="rr-enterprise-surface">
        <AppLocaleProvider>
          <AppSplash />
          {children}
          <PWAInstall />
        </AppLocaleProvider>
      </body>
    </html>
  );
}
