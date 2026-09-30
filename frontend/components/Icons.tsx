import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export function SearchIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.7-3.7"/></svg>; }
export function CartIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6.2"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>; }
export function MenuIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>; }
export function XIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>; }
export function ChevronDown({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m6 9 6 6 6-6"/></svg>; }
export function ArrowRight({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M5 12h14M14 7l5 5-5 5"/></svg>; }
export function ArrowLeft({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M19 12H5M10 7l-5 5 5 5"/></svg>; }
export function ChevronLeft({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m15 18-6-6 6-6"/></svg>; }
export function ChevronRight({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m9 18 6-6-6-6"/></svg>; }
export function TruckIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/></svg>; }
export function ShieldIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M12 3 5 6v5c0 4.4 2.6 8.3 7 10 4.4-1.7 7-5.6 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
export function WalletIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18v16H6a2 2 0 0 1-2-2z"/><path d="M15 10h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></svg>; }
export function HeadphonesIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1z"/></svg>; }
export function StarIcon({ size, ...props }: IconProps) { return <svg width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill="currentColor" {...props}><path d="m12 2.7 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9z"/></svg>; }
export function PlusIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function MinusIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M5 12h14"/></svg>; }
export function FilterIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M4 6h16M7 12h10M10 18h4"/></svg>; }
export function TrashIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>; }
export function WhatsAppIcon({ size, ...props }: IconProps) { return <svg width={size ?? 22} height={size ?? 22} viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2a9.7 9.7 0 0 0-8.35 14.65L2.3 21.7l5.18-1.31A9.72 9.72 0 1 0 12 2Zm0 17.68a7.6 7.6 0 0 1-3.88-1.06l-.28-.16-3.07.78.82-2.98-.18-.3A7.62 7.62 0 1 1 12 19.68Zm4.18-5.69c-.23-.12-1.35-.67-1.56-.75-.21-.08-.36-.12-.52.12-.15.23-.6.75-.73.9-.14.15-.27.17-.5.06-.23-.12-.98-.36-1.86-1.15-.69-.61-1.15-1.37-1.29-1.6-.13-.23-.01-.35.1-.47.1-.1.23-.27.34-.4.12-.14.15-.23.23-.39.08-.15.04-.29-.02-.4-.06-.12-.52-1.25-.71-1.72-.19-.45-.38-.39-.52-.4h-.44c-.15 0-.4.06-.61.29-.21.23-.81.79-.81 1.93 0 1.13.83 2.23.94 2.38.12.15 1.63 2.49 3.94 3.49.55.24.98.38 1.32.49.55.17 1.05.15 1.45.09.44-.07 1.35-.55 1.54-1.08.19-.54.19-1 .13-1.09-.05-.1-.21-.16-.44-.27Z"/></svg>; }
export function HeartIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M20.8 4.6a5.3 5.3 0 0 0-7.5 0L12 5.9l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.9a5.3 5.3 0 0 0 0-7.5Z"/></svg>; }
