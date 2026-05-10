'use client';

import { motion } from 'framer-motion';
import { ExternalLink, MapPin, User, Hash } from 'lucide-react';

interface GitHubUser {
  login: string;
  id: number;
  name: string;
  bio: string;
  location: string;
  avatar_url: string;
  html_url: string;
}

export function UserCard({ user, type }: { user: GitHubUser, type: 'default' | 'custom' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 p-6 backdrop-blur-md transition-all hover:border-black/10 dark:hover:border-white/20 hover:bg-black/[0.07] dark:hover:bg-white/10"
    >
      <div className="flex gap-5">
        <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-black/5 dark:border-white/10 flex-shrink-0">
          <img src={user.avatar_url} alt={user.login} className="h-full w-full object-cover" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-slate-900 dark:text-white">{user.name || user.login}</h3>
            <a
              href={user.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <ExternalLink size={18} />
            </a>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-white/50">
            <span className="flex items-center gap-1"><User size={14} /> {user.login}</span>
            <span className="flex items-center gap-1"><Hash size={14} /> {user.id}</span>
          </div>

          {user.location && (
            <div className="flex items-center gap-1 text-sm text-slate-400 dark:text-white/40">
              <MapPin size={14} /> {user.location}
            </div>
          )}
        </div>
      </div>

      {user.bio && (
        <p className="mt-4 text-sm text-slate-600 dark:text-white/60 line-clamp-2 italic">
          &quot;{user.bio}&quot;
        </p>
      )}

      <div className="mt-5 pt-5 border-t border-black/5 dark:border-white/5">
        <img
          src={`https://github-stats-h3cof6.vercel.app/api?username=${user.login}&show_icons=true&theme=transparent&title_color=${type === 'default' ? '0891b2' : '4f46e5'}&text_color=888&icon_color=888&bg_color=00000000&hide_border=true`}
          alt="GitHub Stats"
          className="w-full dark:invert-[0.1] dark:brightness-150"
        />
      </div>
    </motion.div>
  );
}
