'use client';

import { useState } from 'react';
import { youtubeIdFromUrl, spotifyEmbedFromUrl, type LessonMediaJson } from '@/lib/guitar/lesson-schema';

interface Props {
  media: LessonMediaJson;
  /** Compact mode hides the secondary preview controls — used inline in lesson player. */
  compact?: boolean;
}

type EmbedKind = 'youtube' | 'spotify' | null;

export function LessonMedia({ media, compact }: Props) {
  const youtubeId = media.youtube ? youtubeIdFromUrl(media.youtube) : null;
  const spotify = media.spotify ? spotifyEmbedFromUrl(media.spotify) : null;
  const hasYoutube = youtubeId != null;
  const hasSpotify = spotify != null;

  // Default to whichever is present; YouTube wins when both exist.
  const [active, setActive] = useState<EmbedKind>(hasYoutube ? 'youtube' : hasSpotify ? 'spotify' : null);
  const [embedLoaded, setEmbedLoaded] = useState(false);

  if (!hasYoutube && !hasSpotify && !media.tabSource) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1a1a1a]">
        {hasYoutube && (
          <button
            onClick={() => {
              setActive('youtube');
              setEmbedLoaded(true);
            }}
            className={`px-2 py-1 text-[11px] rounded font-mono uppercase tracking-wider transition-colors ${
              active === 'youtube'
                ? 'bg-[#ff0000]/15 text-[#ff5555]'
                : 'text-[#666] hover:text-[#ededed]'
            }`}
          >
            YouTube
          </button>
        )}
        {hasSpotify && (
          <button
            onClick={() => {
              setActive('spotify');
              setEmbedLoaded(true);
            }}
            className={`px-2 py-1 text-[11px] rounded font-mono uppercase tracking-wider transition-colors ${
              active === 'spotify'
                ? 'bg-[#1db954]/15 text-[#1ed760]'
                : 'text-[#666] hover:text-[#ededed]'
            }`}
          >
            Spotify
          </button>
        )}
        {media.tabSource && (
          <a
            href={media.tabSource}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto px-2 py-1 text-[11px] rounded font-mono uppercase tracking-wider text-[#888] hover:text-[#ededed]"
          >
            Tab source ↗
          </a>
        )}
      </div>

      {active === 'youtube' && hasYoutube && (
        <div className={compact ? 'aspect-video bg-black' : 'aspect-video bg-black'}>
          {embedLoaded ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              onClick={() => setEmbedLoaded(true)}
              className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-3xl">▶</span>
              <span className="text-xs text-[#888] mt-2">Load YouTube preview</span>
            </button>
          )}
        </div>
      )}

      {active === 'spotify' && hasSpotify && (
        <div className="bg-black">
          {embedLoaded ? (
            <iframe
              className="w-full"
              style={{ height: spotify!.kind === 'track' ? 152 : 380 }}
              src={`https://open.spotify.com/embed/${spotify!.kind}/${spotify!.id}`}
              title="Spotify embed"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : (
            <button
              onClick={() => setEmbedLoaded(true)}
              className="w-full h-32 flex flex-col items-center justify-center bg-[#0a0a0a] hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-3xl">♫</span>
              <span className="text-xs text-[#888] mt-2">Load Spotify player</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
