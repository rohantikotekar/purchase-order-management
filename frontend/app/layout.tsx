import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Zap } from "lucide-react"; 
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OrderPro | Enterprise OS",
  description: "Purchase Order management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[#020617] text-slate-200 selection:bg-indigo-500/30`}>
        
        {/* GLOBAL AMBIENT BACKGROUND */}
        <div className="fixed inset-0 z-[-1] pointer-events-none">
           <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,#0f172a_0,transparent_50%),radial-gradient(at_50%_0%,#1e1b4b_0,transparent_50%),radial-gradient(at_100%_0%,#312e81_0,transparent_50%)] opacity-80" />
           <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/20 blur-[100px] rounded-full" />
        </div>

        <div className="app-shell relative flex flex-col min-h-screen">
          
          {/* NAVIGATION BAR */}
          <nav className="sticky top-4 z-50 mx-auto w-[95%] max-w-7xl rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl flex items-center justify-between px-6 py-3 mt-4">
             
             {/* Left: Brand */}
             <Link href="/" className="flex items-center gap-3 group">
               <div className="relative">
                 <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-30 blur group-hover:opacity-60 transition duration-200" />
                 <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 border border-white/10">
                   <Zap className="h-5 w-5 text-indigo-400" />
                 </div>
               </div>
               <div className="flex flex-col">
                 <span className="text-base font-bold tracking-tight text-white leading-none">OrderPro</span>
                 <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Enterprise</span>
               </div>
             </Link>

             {/* Right: Navigation Links */}
             <div className="flex items-center gap-2">
                <Link 
                  href="/" 
                  className="text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg transition-all"
                >
                  Dashboard
                </Link>
                <Link 
                  href="#manifest" 
                  className="text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg transition-all"
                >
                  Live Manifest
                </Link>
             </div>

          </nav>

          {/* PAGE CONTENT - Reduced top padding from py-8 to pt-2 */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}