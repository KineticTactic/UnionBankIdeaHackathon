import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans, Merriweather } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

const merriweatherHeading = Merriweather({ subsets: ['latin'], variable: '--font-heading' });

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PCOP Bank Admin",
  description: "Predictive Customer Outreach Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", geist.variable, merriweatherHeading.variable)}
    >
      <body className="min-h-full flex bg-slate-50 text-slate-900">
        <Sidebar />
        <div className="flex-1 ml-60 flex flex-col min-h-screen">
          <Topbar />
          <main className="p-8 flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
