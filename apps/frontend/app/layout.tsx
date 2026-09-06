import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Oxanium } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { WorkoutProvider } from "@/lib/workout-context";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";

// The CSP (issue #125) uses a per-request nonce with strict-dynamic. Next only
// stamps that nonce onto its scripts when a route is rendered per request, so
// every route must render dynamically — a statically prerendered page would ship
// nonce-less inline scripts that an enforcing policy blocks. These pages all
// fetch the signed-in user's data on mount anyway, so nothing was truly static.
export const dynamic = "force-dynamic";

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Personal Workout Tracking Application",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce (set by middleware.ts). next-themes injects an inline
  // <script>, so it needs the nonce to survive strict-dynamic once enforced.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="de"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", oxanium.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <AuthProvider>
            <WorkoutProvider>
              <Toaster />
              <MobileNav />
              {children}
            </WorkoutProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
