import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Reimbursor — Expenses, in good order",
  description: "A clearer way to submit, review, and manage company expenses. Bring expense requests, receipts, and approvals into one workspace.",
}

export const viewport: Viewport = {
  themeColor: "#f0f0f0",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
