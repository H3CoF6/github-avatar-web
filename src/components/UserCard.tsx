'use client';

import { motion } from 'framer-motion';
import { User, Hash, MapPin, Calendar } from 'lucide-react';

interface GitHubUser {
  login: string;
  id: number;
  name: string;
  bio: string;
  location: string;
  avatar_url: string;
  html_url: string;
  created_at?: string;
}

export function UserCard({ user, type }: { user: GitHubUser, type: 'default' | 'custom' }) {
  const themeColor = type === 'default' ? '06b6d4' : '8b5cf6';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative overflow-hidden rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5 backdrop-blur-md transition-all hover:shadow-2xl hover:border-black/10 dark:hover:border-white/20 h-full flex flex-col justify-between"
    >
      {/* Decorative Blur */}
      <div className={`absolute -right-12 -top-12 h-28 w-28 rounded-full blur-[60px] opacity-20 ${type === 'default' ? 'bg-cyan-500' : 'bg-violet-500'}`} />

      <div className="relative">
        <div className="flex gap-4 items-start">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={`relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-white dark:border-zinc-800 shadow-lg transition-transform duration-500 group-hover:scale-105`}>
              <img src={user.avatar_url} alt={user.login} className="h-full w-full object-cover" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white truncate tracking-tight">
                {user.name || user.login}
              </h3>
              <a
                href={user.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg transition-transform hover:scale-110 active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-white/40">
                <User size={12} className={type === 'default' ? 'text-cyan-500' : 'text-violet-500'} /> @{user.login}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-white/40">
                <Hash size={12} className={type === 'default' ? 'text-cyan-500' : 'text-violet-500'} /> {user.id}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {user.location && (
                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-white/20 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
                  <MapPin size={9} /> {user.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {user.bio && (
          <p className="mt-4 text-xs font-medium text-slate-600 dark:text-white/60 leading-relaxed italic border-l-2 border-black/5 dark:border-white/10 pl-3">
            &quot;{user.bio}&quot;
          </p>
        )}
      </div>

      {/* Stats Section - Horizontal layout with 3 cards */}
      <div className="mt-5 pt-5 border-t border-black/5 dark:border-white/5 flex gap-3">
        <div className="flex-1 h-[120px] flex items-center justify-center">
          <img
            src={`https://github-stats-h3cof6.vercel.app/api?username=${user.login}&show_icons=true&theme=transparent&title_color=${themeColor}&text_color=888&icon_color=888&bg_color=00000000&hide_border=true&border_radius=12&hide_rank=false`}
            alt="Main Stats"
            className="h-full w-full object-contain dark:invert-[0.05] dark:brightness-125"
          />
        </div>
        <div className="flex-1 h-[120px] flex items-center justify-center">
          <img
            src={`https://github-stats-h3cof6.vercel.app/api/top-langs/?username=${user.login}&layout=compact&theme=transparent&title_color=${themeColor}&text_color=888&bg_color=00000000&hide_border=true&border_radius=12`}
            alt="Top Languages"
            className="h-full w-full object-contain dark:invert-[0.05] dark:brightness-125"
          />
        </div>
        <div className="flex-1 h-[120px] flex items-center justify-center">
          <img
            src={`https://github-readme-streak-stats.herokuapp.com?user=${user.login}&theme=transparent&hide_border=true&border_radius=12&ring=${themeColor}&fire=${themeColor}&currStreakLabel=888&sideLabels=888&currStreakNum=888&sideNums=888&dates=888`}
            alt="Streak Stats"
            className="h-full w-full object-contain dark:invert-[0.05] dark:brightness-125"
          />
        </div>
      </div>
    </motion.div>
  );
}
