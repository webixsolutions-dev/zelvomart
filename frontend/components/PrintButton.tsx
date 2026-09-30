"use client";
export default function PrintButton({ label = "Print" }: { label?: string }) { return <button className="btn-outline" onClick={() => window.print()}>{label}</button>; }
