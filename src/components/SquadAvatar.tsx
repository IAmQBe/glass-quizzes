import { type ImgHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from "react";
import { getSquadAvatarCandidates } from "@/lib/squadAvatar";

interface SquadAvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  avatarUrl?: string | null;
  username?: string | null;
  fallback?: ReactNode;
}

export const SquadAvatar = ({
  avatarUrl,
  username,
  fallback = null,
  onError,
  ...imgProps
}: SquadAvatarProps) => {
  const candidates = useMemo(() => getSquadAvatarCandidates(avatarUrl, username), [avatarUrl, username]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [allCandidatesFailed, setAllCandidatesFailed] = useState(false);

  useEffect(() => {
    setActiveCandidateIndex(0);
    setAllCandidatesFailed(false);
  }, [avatarUrl, username]);

  if (candidates.length === 0 || allCandidatesFailed) {
    return <>{fallback}</>;
  }

  const currentSrc = candidates[Math.min(activeCandidateIndex, candidates.length - 1)];
  const hasFallbackCandidate = activeCandidateIndex < candidates.length - 1;

  return (
    <img
      {...imgProps}
      src={currentSrc}
      onError={(event) => {
        if (hasFallbackCandidate) {
          setActiveCandidateIndex((prev) => Math.min(prev + 1, candidates.length - 1));
        } else {
          setAllCandidatesFailed(true);
        }
        onError?.(event);
      }}
    />
  );
};
