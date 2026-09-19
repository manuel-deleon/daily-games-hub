export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  global_streak: number;
  highest_streak: number;
  created_at: string;
}

export interface GlobalGame {
  id: string;
  name: string;
  url: string;
  logo_url: string | null;
  color: string;
  created_at: string;
}

export interface Game {
  id: string;
  user_id: string;
  global_game_id: string;
  custom_name: string | null;
  custom_logo_url: string | null;
  custom_color: string | null;
  current_streak: number;
  created_at: string;
  global_games?: GlobalGame;
}
