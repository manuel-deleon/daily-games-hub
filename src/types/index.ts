export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  global_streak: number;
  highest_streak: number;
  created_at: string;
}

export interface Game {
  id: string;
  user_id: string;
  name: string;
  url: string;
  logo_url: string | null;
  color: string;
  current_streak: number;
  created_at: string;
}
