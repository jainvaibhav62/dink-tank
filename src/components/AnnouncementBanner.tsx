import type { Announcement } from '../types'

export function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  return (
    <div className="bg-gradient-to-r from-lime-400 via-green-400 to-emerald-400 px-4 py-3 text-center font-bold text-white shadow-lg">
      <style>{`
        @keyframes blink {
          0%, 49%, 100% { opacity: 1; }
          50%, 99% { opacity: 0.55; }
        }
        .banner-blink { animation: blink 1.5s ease-in-out infinite; }
      `}</style>
      <div className="banner-blink">📣 {announcement.text}</div>
    </div>
  )
}
