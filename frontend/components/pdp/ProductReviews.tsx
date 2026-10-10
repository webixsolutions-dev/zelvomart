"use client";

import { useState, useId } from "react";
import Image from "next/image";

export interface MediaItem {
  type: "image" | "video";
  url: string;
  thumbnail?: string;
}

export interface ReviewItem {
  id: string;
  author: string;
  avatarText: string;
  avatarBg: string;
  location: string;
  verifiedDetails: string;
  rating: number;
  date: string;
  text: string;
  media?: MediaItem[];
  storeReply?: {
    name: string;
    text: string;
  };
}

const SAMPLE_MEDIA: MediaItem[] = [
  {
    type: "image",
    url: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589004179-Black-1200ML-insulated-tumbler-2.webp",
    thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589004179-Black-1200ML-insulated-tumbler-2.webp",
  },
  {
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589008736-Black-1200ML-insulated-tumbler-3-600x600.webp",
  },
  {
    type: "image",
    url: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589013388-Black-1200ML-insulated-tumbler-4.webp",
    thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589013388-Black-1200ML-insulated-tumbler-4.webp",
  },
  {
    type: "image",
    url: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589004179-Black-1200ML-insulated-tumbler-2.webp",
    thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589004179-Black-1200ML-insulated-tumbler-2.webp",
  },
  {
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589008736-Black-1200ML-insulated-tumbler-3-600x600.webp",
  },
  {
    type: "image",
    url: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589013388-Black-1200ML-insulated-tumbler-4.webp",
    thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589013388-Black-1200ML-insulated-tumbler-4.webp",
  },
];

const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: "r1",
    author: "Hira S.",
    avatarText: "HS",
    avatarBg: "bg-[#f43f5e]",
    location: "Multan",
    verifiedDetails: "Verified order · Pink Marble · 1 Tumbler",
    rating: 5,
    date: "2 days ago",
    text: "Exactly like the photos — the marble pattern is even prettier in real life. Keeps my water cold through university.",
    media: [
      {
        type: "image",
        url: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589004179-Black-1200ML-insulated-tumbler-2.webp",
      },
      {
        type: "video",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        thumbnail: "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/1791589008736-Black-1200ML-insulated-tumbler-3-600x600.webp",
      },
    ],
  },
  {
    id: "r2",
    author: "Zainab A.",
    avatarText: "ZA",
    avatarBg: "bg-[#0284c7]",
    location: "Lahore",
    verifiedDetails: "Verified order · Both colours · 2 Tumblers",
    rating: 5,
    date: "1 week ago",
    text: "Ordered the pair for me and my sister. Neatly packed with a thank-you card, and the confirmation call came the same day.",
  },
  {
    id: "r3",
    author: "Bilal K.",
    avatarText: "BK",
    avatarBg: "bg-slate-900",
    location: "Rawalpindi",
    verifiedDetails: "Verified order · Sky Blue · 1 Tumbler",
    rating: 4,
    date: "2 weeks ago",
    text: "Good quality, but delivery took 6 days to my area.",
    storeReply: {
      name: "Zelvomart replied",
      text: "Sorry about the wait, Bilal — some areas take a little longer. We've shared this with our delivery partner and we're watching your area closely.",
    },
  },
];

export default function ProductReviews({ product }: { product?: any }) {
  const [reviews, setReviews] = useState<ReviewItem[]>(INITIAL_REVIEWS);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);

  // Modal Form States
  const [modalRating, setModalRating] = useState(5);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([]);
  const fileUploadId = useId();

  // Local Media File Selector
  const handleMediaFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    const newItems: MediaItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith("video/");
      const blobUrl = URL.createObjectURL(file);
      newItems.push({
        type: isVideo ? "video" : "image",
        url: blobUrl,
        thumbnail: blobUrl,
      });
    }

    setUploadedMedia((prev) => [...prev, ...newItems].slice(0, 6));
    e.target.value = "";
  };

  const handlePostReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !reviewBody.trim()) return;

    const initials = `${firstName[0] || "U"}${lastName[0] || ""}`.toUpperCase();
    const newEntry: ReviewItem = {
      id: `rev-${Date.now()}`,
      author: `${firstName.trim()} ${lastName.trim() ? lastName[0] + "." : ""}`.trim(),
      avatarText: initials || "U",
      avatarBg: "bg-[#0284c7]",
      location: city.trim() || "Pakistan",
      verifiedDetails: "Verified order · Just now",
      rating: modalRating,
      date: "Just now",
      text: reviewBody.trim(),
      media: uploadedMedia.length ? [...uploadedMedia] : undefined,
    };

    setReviews([newEntry, ...reviews]);
    setIsModalOpen(false);

    // Reset Form Fields
    setModalRating(5);
    setFirstName("");
    setLastName("");
    setCity("");
    setReviewBody("");
    setUploadedMedia([]);
  };

  // Filter Reviews
  const filteredReviews = reviews.filter((r) => {
    if (activeFilter === "photos") return r.media && r.media.length > 0;
    if (activeFilter === "pink") return r.verifiedDetails.toLowerCase().includes("pink");
    if (activeFilter === "blue") return r.verifiedDetails.toLowerCase().includes("blue");
    return true;
  });

  return (
    <section id="reviews" className="w-full mt-14 pt-8 border-t border-slate-100 max-w-[1240px] mx-auto px-4 md:px-6">
      {/* 1. TOP SECTION HEADER */}
      <div className="mb-8">
        <span className="text-[12px] font-bold text-sky-500 uppercase tracking-wider block mb-1">
          REVIEWS
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            What customers say.
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fef9c3] text-[#854d0e] border border-[#fef08a]/80 shadow-2xs">
            Live: verified orders only
          </span>
        </div>
      </div>

      {/* 2. TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* LEFT COLUMN: GOOGLE SCORECARD (4 COLS) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-start gap-3.5 mb-5">
            <span className="text-5xl font-black text-slate-900 leading-none tracking-tight">
              4.9
            </span>
            <div>
              <div className="flex text-[#f59e0b] text-base gap-0.5">{"★★★★★"}</div>
              <p className="text-[11.5px] text-slate-500 font-medium mt-1">
                Based on 64 verified orders
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs font-medium text-slate-600 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-10">5 star</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#f59e0b] rounded-full w-[88%]" />
              </div>
              <span className="w-5 text-right font-semibold">57</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10">4 star</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#f59e0b] rounded-full w-[12%]" />
              </div>
              <span className="w-5 text-right font-semibold">6</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10">3 star</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#f59e0b] rounded-full w-[2%]" />
              </div>
              <span className="w-5 text-right font-semibold">1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10">2 star</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-slate-200 rounded-full w-0" />
              </div>
              <span className="w-5 text-right text-slate-400 font-semibold">0</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10">1 star</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-slate-200 rounded-full w-0" />
              </div>
              <span className="w-5 text-right text-slate-400 font-semibold">0</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition shadow-2xs text-center cursor-pointer"
          >
            Write a review
          </button>
        </div>

        {/* RIGHT COLUMN: MEDIA STRIP, FILTERS & REVIEWS FEED (8 COLS) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Photos & Videos Strip (Clean Swipe with No Grey Scrollbars) */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1 sm:px-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  Customer photos &amp; videos
                </span>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  28
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilter("photos")}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 active:text-sky-800 transition cursor-pointer"
              >
                See all 28 →
              </button>
            </div>

            {/* Edge-to-Edge Bleed on Mobile with Touch-Snap */}
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-2.5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 pt-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {SAMPLE_MEDIA.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveMedia(item)}
                    className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100 shrink-0 cursor-pointer snap-start group shadow-2xs hover:opacity-95 active:scale-95 transition-all"
                  >
                    <Image
                      src={item.thumbnail || item.url}
                      alt={`Customer submission ${idx + 1}`}
                      fill
                      sizes="(max-width: 640px) 80px, 88px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Centered Play Pill for Video Items */}
                    {item.type === "video" && (
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <span className="w-7 h-7 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-md">
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 20 20">
                            <path d="M4 4l12 6-12 6z" />
                          </svg>
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* "+22 View All" Tile */}
                <button
                  type="button"
                  onClick={() => setActiveFilter("photos")}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50 shrink-0 flex flex-col items-center justify-center text-slate-500 hover:text-slate-700 transition cursor-pointer snap-start p-2 text-center"
                >
                  <span className="text-xs font-extrabold text-slate-800">+22</span>
                  <span className="text-[10px] font-medium text-slate-500 leading-tight">View all</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills (Clean Chips with No Scrollbars) */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 overflow-x-auto scroll-smooth py-1 items-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 select-none ${
                  activeFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs scale-102"
                    : "bg-white text-slate-700 border border-slate-200/90 hover:border-slate-300 active:bg-slate-50"
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("photos")}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 select-none ${
                  activeFilter === "photos"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-102"
                    : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 active:bg-slate-50"
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 ${activeFilter === "photos" ? "text-white" : "text-slate-500"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>With photos &amp; videos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("pink")}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0 select-none ${
                  activeFilter === "pink"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-102"
                    : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 active:bg-slate-50"
                }`}
              >
                Pink Marble
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("blue")}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0 select-none ${
                  activeFilter === "blue"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-102"
                    : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 active:bg-slate-50"
                }`}
              >
                Sky Blue Marble
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("recent")}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0 select-none ${
                  activeFilter === "recent"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-102"
                    : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 active:bg-slate-50"
                }`}
              >
                Most recent
              </button>
            </div>
          </div>

          {/* 3. REVIEWS FEED LIST */}
          <div className="divide-y divide-slate-100">
            {filteredReviews.map((rev) => (
              <article key={rev.id} className="py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${rev.avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0`}
                    >
                      {rev.avatarText}
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-slate-900 leading-tight">
                        {rev.author} · {rev.location}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-0.5">
                        <svg className="w-3 h-3 fill-emerald-600" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{rev.verifiedDetails}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-normal">{rev.date}</span>
                </div>

                <div className="flex text-[#f59e0b] text-xs gap-0.5 my-2">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < rev.rating ? "text-[#f59e0b]" : "text-slate-200"}>
                      ★
                    </span>
                  ))}
                </div>

                <p className="text-[13.5px] text-slate-700 leading-relaxed font-normal">
                  {rev.text}
                </p>

                {/* Attached Customer Photos & Videos */}
                {rev.media && rev.media.length > 0 && (
                  <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {rev.media.map((med, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveMedia(med)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 shrink-0 cursor-pointer group hover:opacity-95"
                      >
                        <Image
                          src={med.thumbnail || med.url}
                          alt="Review media"
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {med.type === "video" && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <span className="w-6 h-6 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-xs">
                              <svg className="w-3 h-3 fill-current ml-0.5" viewBox="0 0 20 20">
                                <path d="M4 4l12 6-12 6z" />
                              </svg>
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Official Store Reply Box */}
                {rev.storeReply && (
                  <div className="mt-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-[#0284c7] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                      Z
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold text-slate-900">
                        {rev.storeReply.name}
                      </h4>
                      <p className="text-[12px] text-slate-600 mt-0.5 leading-relaxed">
                        {rev.storeReply.text}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* 4. MODAL: WRITE A REVIEW WITH MEDIA UPLOAD */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Write a review</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePostReview} className="mt-4 space-y-4">
              {/* Star Rating Select */}
              <div>
                <label className="text-xs font-bold text-slate-700">Rating *</label>
                <div className="flex gap-1.5 text-2xl text-[#f59e0b] mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setModalRating(s)}
                      className="cursor-pointer focus:outline-none hover:scale-110 transition-transform"
                    >
                      {s <= modalRating ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name and City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Ayesha"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Lahore"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">Your Review *</label>
                <textarea
                  rows={3}
                  required
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="Share details of your experience with this item (e.g. build quality, insulation, finish)..."
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Photos & Videos Uploader */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">Add Photos or Videos</label>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <label
                    htmlFor={fileUploadId}
                    className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Upload media</span>
                  </label>
                  <input
                    id={fileUploadId}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    hidden
                    onChange={handleMediaFiles}
                  />

                  {/* Thumbnail Preview Chips */}
                  {uploadedMedia.map((m, idx) => (
                    <div
                      key={idx}
                      className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-300 bg-slate-900 shrink-0"
                    >
                      {m.type === "video" ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white text-[10px] font-bold">
                          VIDEO
                        </div>
                      ) : (
                        <Image src={m.url} alt="Upload preview" fill className="object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedMedia((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold transition shadow-xs"
                >
                  Submit review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. FULLSCREEN MEDIA LIGHTBOX (PHOTOS & VIDEOS) */}
      {activeMedia && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setActiveMedia(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] h-[550px] bg-black rounded-2xl overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {activeMedia.type === "video" ? (
              <video
                src={activeMedia.url}
                controls
                autoPlay
                className="w-full h-full max-h-[85vh] object-contain rounded-2xl"
              />
            ) : (
              <Image
                src={activeMedia.url}
                alt="Full customer media"
                fill
                className="object-contain"
              />
            )}
            <button
              type="button"
              onClick={() => setActiveMedia(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-sm font-bold backdrop-blur-xs transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}