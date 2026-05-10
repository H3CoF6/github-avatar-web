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
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10"
    >
      <div className="flex gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/10">
          <img src={user.avatar_url} alt={user.login} className="h-full w-full object-cover" />
        </div>
        
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{user.name || user.login}</h3>
            <a 
              href={user.html_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
            >
              <ExternalLink size={16} />
            </a>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1"><User size={12} /> {user.login}</span>
            <span className="flex items-center gap-1"><Hash size={12} /> {user.id}</span>
          </div>

          {user.location && (
            <div className="flex items-center gap-1 text-xs text-white/40">
              <MapPin size={12} /> {user.location}
            </div>
          )}
        </div>
      </div>

      {user.bio && (
        <p className="mt-3 text-xs text-white/60 line-clamp-2 italic">
          &quot;{user.bio}&quot;
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-white/5">
        <img 
          src={`https://github-readme-stats.vercel.app/api?username=${user.login}&show_icons=true&theme=transparent&title_color=fff&text_color=ccc&icon_color=fff&bg_color=00000000&hide_border=true`}
          alt="GitHub Stats"
          className="w-full"
        />
      </div>
    </motion.div>
  );
}
