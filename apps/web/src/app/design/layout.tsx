import { Barlow_Condensed } from "next/font/google";

// The alternative display face is only needed for the side-by-side comparison here.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-barlow-condensed",
  display: "swap",
  preload: false,
});

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return <div className={barlow.variable}>{children}</div>;
}
