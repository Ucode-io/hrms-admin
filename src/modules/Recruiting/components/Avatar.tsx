import { avatarTint, initials } from "../types";

interface AvatarProps {
  firstName: string;
  lastName: string;
  photo?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ firstName, lastName, photo, size = 40, className = "" }: AvatarProps) {
  const seed = `${lastName} ${firstName}`.trim() || "?";
  const dimension = { width: size, height: size, fontSize: size * 0.38 };

  if (photo) {
    return (
      <img
        src={photo}
        alt={seed}
        style={dimension}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={dimension}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarTint(
        seed
      )} ${className}`}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
