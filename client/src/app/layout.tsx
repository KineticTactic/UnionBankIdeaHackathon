import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/hooks/useAuth";
import ConditionalShell from "@/components/ConditionalShell";

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "PCOP · Union Bank Intelligence",
  description: "Predictive Customer Outreach Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", poppins.variable)}>
      <body className="min-h-full flex bg-[#F9F9F7] text-[#2A161B] font-sans">
        <AuthProvider>
          <ConditionalShell>
            {children}
          </ConditionalShell>
        </AuthProvider>
      </body>
    </html>
  );
}
